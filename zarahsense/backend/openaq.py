import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd

from engine import FEATS, WIN

API_BASE = "https://api.openaq.org/v3"
CACHE_SECONDS = 600
MAX_READING_AGE_HOURS = 4
SEARCH_RADIUS_METERS = 10000
PARAMETER_FEATURES = {
    "pm1": "PM1",
    "pm25": "PM2.5",
    "relativehumidity": "RH",
    "temperature": "Temp",
    "um003": "Particles_0.3um",
}
_cache = {}
_cache_locks = {}
_cache_lock = threading.Lock()


class OpenAQError(RuntimeError):
    pass


def _request_json(path, params=None):
    api_key = os.environ.get("OPENAQ_API_KEY", "").strip()
    if not api_key or api_key == "replace-with-your-new-OpenAQ-key":
        raise OpenAQError("OpenAQ API key is not configured in backend/.env")

    url = f"{API_BASE}{path}"
    if params:
        url = f"{url}?{urlencode(params)}"
    request = Request(url, headers={"X-API-Key": api_key, "Accept": "application/json"})
    try:
        with urlopen(request, timeout=20) as response:
            return json.load(response)
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise OpenAQError("OpenAQ rejected the API key; verify backend/.env") from exc
        raise OpenAQError(f"OpenAQ returned HTTP {exc.code}") from exc
    except URLError as exc:
        raise OpenAQError(f"Could not reach OpenAQ: {exc.reason}") from exc
    except (TimeoutError, json.JSONDecodeError) as exc:
        raise OpenAQError(f"OpenAQ request failed: {exc}") from exc


def _distance_meters(lat1, lon1, lat2, lon2):
    radius = 6371000
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * radius * asin(sqrt(a))


def _find_location(latitude, longitude, location_id=None):
    required = set(PARAMETER_FEATURES)
    if location_id is not None:
        payload = _request_json(f"/locations/{location_id}")
        location = next(
            (item for item in payload.get("results", []) if str(item.get("id")) == str(location_id)),
            None,
        )
        if location is None:
            return None
        sensors = {}
        for sensor in location.get("sensors", []):
            parameter = sensor.get("parameter", {}).get("name")
            if parameter in required and parameter not in sensors:
                sensors[parameter] = sensor.get("id")
        if set(sensors) != required:
            return None
        coordinates = location.get("coordinates") or {}
        distance = None
        if coordinates.get("latitude") is not None and coordinates.get("longitude") is not None:
            distance = _distance_meters(
                latitude, longitude, coordinates["latitude"], coordinates["longitude"]
            )
        return {
            "id": location["id"],
            "name": location.get("name", "OpenAQ station"),
            "distanceMeters": round(distance, 1) if distance is not None else None,
            "coordinates": coordinates,
            "sensors": sensors,
        }

    payload = _request_json(
        "/locations",
        {
            "coordinates": f"{latitude},{longitude}",
            "radius": SEARCH_RADIUS_METERS,
            "limit": 100,
        },
    )
    candidates = []
    for location in payload.get("results", []):
        sensors = {}
        for sensor in location.get("sensors", []):
            parameter = sensor.get("parameter", {}).get("name")
            if parameter in required and parameter not in sensors:
                sensors[parameter] = sensor.get("id")
        if set(sensors) != required:
            continue
        coordinates = location.get("coordinates") or {}
        distance = location.get("distance")
        if distance is None and coordinates.get("latitude") is not None and coordinates.get("longitude") is not None:
            distance = _distance_meters(
                latitude, longitude, coordinates["latitude"], coordinates["longitude"]
            )
        candidates.append((float(distance or 0), location, sensors))

    if not candidates:
        return None
    distance, location, sensors = min(candidates, key=lambda candidate: candidate[0])
    return {
        "id": location["id"],
        "name": location.get("name", "OpenAQ station"),
        "distanceMeters": round(distance, 1),
        "coordinates": location.get("coordinates") or {},
        "sensors": sensors,
    }


def _fetch_sensor_hours(sensor_id, datetime_from):
    payload = _request_json(
        f"/sensors/{sensor_id}/hours",
        {"datetime_from": datetime_from, "limit": 100},
    )
    readings = {}
    for item in payload.get("results", []):
        timestamp = item.get("period", {}).get("datetimeFrom", {}).get("utc")
        if not timestamp:
            continue
        value = item.get("summary", {}).get("avg")
        if value is None:
            value = item.get("value")
        if value is None:
            continue
        hour = pd.Timestamp(timestamp).tz_convert("Asia/Kuala_Lumpur").tz_localize(None).floor("h")
        readings[hour] = float(value)
    return readings


def _load_station(latitude, longitude, location_id=None):
    location = _find_location(latitude, longitude, location_id)
    if location is None:
        return {
            "location": None,
            "data": pd.DataFrame(columns=["datetime", *FEATS]),
            "forecastData": None,
        }

    since = (datetime.now(timezone.utc) - timedelta(hours=72)).replace(
        minute=0, second=0, microsecond=0
    ).isoformat().replace("+00:00", "Z")
    feature_sensors = {
        PARAMETER_FEATURES[parameter]: sensor_id
        for parameter, sensor_id in location["sensors"].items()
    }

    with ThreadPoolExecutor(max_workers=len(feature_sensors)) as executor:
        results = list(executor.map(
            lambda item: (item[0], _fetch_sensor_hours(item[1], since)),
            feature_sensors.items(),
        ))

    series = {feature: pd.Series(readings, dtype=float) for feature, readings in results}
    if not series:
        data = pd.DataFrame(columns=["datetime", *FEATS])
    else:
        data = pd.concat(series, axis=1).reindex(columns=FEATS).dropna().sort_index()
        data.index.name = "datetime"
        data = data.reset_index()

    forecast_data = None
    if len(data) >= WIN:
        times = pd.DatetimeIndex(data["datetime"])
        gaps = np.where(np.diff(times.values.astype("datetime64[h]")) != np.timedelta64(1, "h"))[0]
        start = int(gaps[-1] + 1) if len(gaps) else 0
        contiguous = data.iloc[start:].reset_index(drop=True)
        age = pd.Timestamp.now(tz="Asia/Kuala_Lumpur").tz_localize(None) - contiguous["datetime"].iloc[-1]
        if len(contiguous) >= WIN and age <= pd.Timedelta(hours=MAX_READING_AGE_HOURS):
            forecast_data = contiguous.iloc[-WIN:].copy()

    return {"location": location, "data": data, "forecastData": forecast_data}


def live_station(station_id, latitude, longitude):
    now = time.monotonic()
    with _cache_lock:
        cached = _cache.get(station_id)
        lock = _cache_locks.setdefault(station_id, threading.Lock())
        if cached and now - cached[0] < CACHE_SECONDS:
            return cached[1]

    with lock:
        now = time.monotonic()
        with _cache_lock:
            cached = _cache.get(station_id)
            if cached and now - cached[0] < CACHE_SECONDS:
                return cached[1]
        result = _load_station(latitude, longitude)
        with _cache_lock:
            _cache[station_id] = (time.monotonic(), result)
        return result


def current_reading(live):
    data = live["data"]
    if data.empty:
        return None
    row = data.iloc[-1]
    age = pd.Timestamp.now(tz="Asia/Kuala_Lumpur").tz_localize(None) - row["datetime"]
    if age > pd.Timedelta(hours=MAX_READING_AGE_HOURS):
        return None
    return row


def live_status(live):
    data = live["data"]
    latest = current_reading(live)
    location = live["location"]
    forecast_data = live["forecastData"]
    method = "model" if forecast_data is not None else "persistence" if latest is not None else None
    return {
        "source": "OpenAQ",
        "sourceStatus": "live" if latest is not None else "unavailable",
        "openAqLocation": location["name"] if location else None,
        "distanceMeters": location["distanceMeters"] if location else None,
        "liveHours": int(len(data)),
        "lastReadingAt": latest["datetime"].isoformat() + "+08:00" if latest is not None else None,
        "forecastAvailable": method is not None,
        "forecastMethod": method,
    }
