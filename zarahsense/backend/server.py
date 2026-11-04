import json
import logging
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

from engine import (DATA, FEATS, WIN, HOUR, load_clean, train_mask, climatology, forecast,
                    pm25_to_aqi, nowcast)
from openaq import OpenAQError, current_reading, live_status, live_station

load_dotenv(Path(__file__).parent / ".env")
logger = logging.getLogger("zarahsense")
logging.basicConfig(level=logging.INFO)

STATION_IDS = {"FMHS_Serdang": "fmhs", "KLCC": "klcc", "Sejati_Residences": "sejati",
               "Setia_Eco_Park": "setia-eco", "Taman_Tun_Dr_Ismail": "ttdi"}
DRIVER_LABELS = {"PM2.5": "Recent PM2.5 readings", "PM1": "Recent PM1 readings", "RH": "Humidity",
                 "Temp": "Temperature", "Particles_0.3um": "PM0.3 particle count"}
OVERRIDE_KEYS = {"pm1": "PM1", "pm25": "PM2.5", "rh": "RH", "temp": "Temp", "particles": "Particles_0.3um"}
FILES = {"clean_dataset.csv": "Cleaned hourly dataset (5 stations)",
         "meta.json": "Model settings and notebook test scores",
         "accuracy.json": "Backtest accuracy report per station and horizon"}

META = json.load(open(DATA / "meta.json"))
SCALER = joblib.load(DATA / "scaler.pkl")
DF = load_clean()
TM = train_mask(DF)
ACC = json.load(open(DATA / "accuracy.json")) if (DATA / "accuracy.json").exists() else {"stations": {}}
KAGGLE_MODEL_PATH = DATA / "aqi_model.pkl"
MODEL_PATH = KAGGLE_MODEL_PATH if KAGGLE_MODEL_PATH.exists() else DATA / "rf_model.joblib"
_model = {"m": None}
_lock = threading.Lock()


def model():
    with _lock:
        if _model["m"] is None:
            if META.get("feature_cols") != FEATS:
                raise RuntimeError("Model feature columns do not match the live OpenAQ inputs")
            model_cols = FEATS + ["hour_sin", "hour_cos", "month_sin", "month_cos"]
            if META.get("model_cols") != model_cols:
                raise RuntimeError("Model time-feature schema is incompatible with live forecasting")
            if getattr(SCALER, "n_features_in_", len(FEATS)) != len(FEATS):
                raise RuntimeError("Model scaler does not match the live OpenAQ feature schema")
            loaded = joblib.load(MODEL_PATH)
            expected_features = WIN * len(model_cols)
            if getattr(loaded, "n_features_in_", expected_features) != expected_features:
                raise RuntimeError(
                    f"Model expects {getattr(loaded, 'n_features_in_', 'unknown')} inputs; "
                    f"live forecasting provides {expected_features}"
                )
            _model["m"] = loaded
        return _model["m"]


def iso(t):
    return pd.Timestamp(t).strftime("%Y-%m-%dT%H:%M:%S") + "+08:00"


def build_station(name):
    g = DF[DF["station"] == name]
    tr = g[TM[g.index]]
    times = g["datetime"].values.astype("datetime64[h]")
    breaks = np.where(np.diff(times) != HOUR)[0]
    tail = len(times) - (breaks[-1] + 1) if len(breaks) else len(times)
    info = next((s for s in META["stations"] if s["station"] == name), {})
    return {
        "id": STATION_IDS.get(name, name.lower().replace("_", "-")), "key": name,
        "name": name.replace("_", " "), "lat": info.get("latitude"), "lon": info.get("longitude"),
        "g": g, "times": times, "clim": climatology(tr if len(tr) >= 24 else g),
        "median": tr[FEATS].median().values if len(tr) else g[FEATS].median().values,
        "status": "ok" if tail >= WIN else "limited",
    }


STATIONS = {s["id"]: s for s in (build_station(n) for n in DF["station"].unique())}


def get_station(sid):
    s = STATIONS.get(sid)
    if not s:
        raise HTTPException(404, "Unknown station")
    return s


def horizon_rmse(s):
    h = ACC["stations"].get(s["key"], {}).get("horizons")
    if not h:
        pooled = [v["horizons"] for v in ACC["stations"].values() if v.get("horizons")]
        if not pooled:
            return np.linspace(META["test_metrics"]["RMSE"], META["test_metrics"]["RMSE"] * 3, 24)
        h = {k: {"rmsePm25": float(np.mean([p[k]["rmsePm25"] for p in pooled]))} for k in pooled[0]}
    ks = sorted(int(k) for k in h)
    return np.interp(np.arange(1, 25), ks, [h[str(k)]["rmsePm25"] for k in ks])


def run_forecast(s, overrides=None, live=None):
    if live is None:
        g = s["g"]
        raw = g[FEATS].values[-WIN:].astype(float).copy()
        times = s["times"][-WIN:]
        station_clim = s["clim"]
    else:
        g = live["forecastData"]
        raw = g[FEATS].values.astype(float).copy()
        times = g["datetime"].values.astype("datetime64[h]")
        station_clim = climatology(g[["datetime", "RH", "Temp"]])
    if overrides:
        for k, col in OVERRIDE_KEYS.items():
            if overrides.get(k) is not None:
                raw[-1, FEATS.index(col)] = overrides[k]
    batch = [raw]
    for j in range(len(FEATS)):
        p = raw.copy(); p[:, j] = s["median"][j]; batch.append(p)
    fc = forecast(model(), SCALER, np.stack(batch), np.repeat(times[None], len(batch), 0), station_clim)
    base = fc[0]
    rm = horizon_rmse(s)
    points = []
    for i in range(24):
        t = times[-1] + HOUR * (i + 1)
        pm = round(float(base[i]), 1)
        aqi_rmse = float(pm25_to_aqi(pm + rm[i])) - float(pm25_to_aqi(pm))
        points.append({
            "time": iso(t), "hourAhead": i + 1, "pm25": pm, "aqi": int(pm25_to_aqi(pm)),
            "lo": int(pm25_to_aqi(max(0, pm - rm[i]))), "hi": int(pm25_to_aqi(pm + rm[i])),
            "confidence": "High" if aqi_rmse < 10 else "Medium" if aqi_rmse < 20 else "Low",
        })
    effects = [(FEATS[j], float(base[:6].mean() - fc[j + 1][:6].mean())) for j in range(len(FEATS))]
    effects.sort(key=lambda e: -abs(e[1]))
    drivers = [{"feature": DRIVER_LABELS[f], "effect": "rising" if e > 0 else "falling",
                "impact": round(e, 2)} for f, e in effects[:3]]
    return {"issuedAt": iso(times[-1]), "status": "ok", "source": "OpenAQ" if live else "Dataset",
            "forecastMethod": "model", "points": points, "drivers": drivers}


def run_persistence_forecast(live):
    readings = live["data"].tail(12)
    latest = current_reading(live)
    pm25 = float(latest["PM2.5"])
    changes = readings["PM2.5"].astype(float).diff().dropna().values
    step_variability = float(np.std(changes, ddof=1)) if len(changes) > 1 else max(1.0, pm25 * 0.1)
    step_variability = max(step_variability, 0.3)
    points = []
    for hour in range(1, 25):
        margin = 1.96 * step_variability * np.sqrt(hour)
        points.append({
            "time": iso(latest["datetime"] + HOUR * hour),
            "hourAhead": hour,
            "pm25": round(pm25, 1),
            "aqi": int(pm25_to_aqi(pm25)),
            "lo": int(pm25_to_aqi(max(0, pm25 - margin))),
            "hi": int(pm25_to_aqi(pm25 + margin)),
            "confidence": "Low",
        })
    return {
        "issuedAt": iso(latest["datetime"]),
        "status": "ok",
        "source": "OpenAQ",
        "forecastMethod": "persistence",
        "methodMessage": (
            "Limited fallback: holds the latest PM2.5 reading constant. "
            "The range widens using recent reading variability; this is not the five-input ML forecast."
        ),
        "points": points,
        "drivers": [],
    }


app = FastAPI()
api = APIRouter(prefix="/api")


@api.get("/")
def root():
    return {"app": "ZarahSense", "model": META["model"]}


@api.get("/stations")
def stations():
    def station_status(s):
        result = {"id": s["id"], "name": s["name"], "lat": s["lat"], "lon": s["lon"]}
        try:
            live = live_station(s["id"], s["lat"], s["lon"])
            status = live_status(live)
            result.update(status)
            result["status"] = "ok" if status["forecastMethod"] == "model" else "limited"
            result["hoursOfData"] = status["liveHours"]
            result["lastReadingAt"] = status["lastReadingAt"] or iso(s["times"][-1])
        except OpenAQError as exc:
            logger.warning("OpenAQ station lookup failed for %s: %s", s["id"], exc)
            result.update({"source": "OpenAQ", "sourceStatus": "error", "sourceError": str(exc),
                           "openAqLocation": None, "distanceMeters": None, "forecastAvailable": False})
            result["status"] = "limited"
            result["hoursOfData"] = 0
            result["lastReadingAt"] = iso(s["times"][-1])
        return result

    with ThreadPoolExecutor(max_workers=len(STATIONS)) as executor:
        return list(executor.map(station_status, STATIONS.values()))


@api.get("/current/{sid}")
def current(sid: str):
    s = get_station(sid)
    live_error = None
    try:
        live = live_station(sid, s["lat"], s["lon"])
    except OpenAQError as exc:
        logger.warning("OpenAQ current readings failed for %s: %s", sid, exc)
        live = None
        live_error = str(exc)

    if live is not None:
        last = current_reading(live)
        if last is not None:
            recent = live["data"].tail(12)["PM2.5"].values
            nc = round(nowcast(recent), 1)
            return {
                "time": iso(last["datetime"]), "pm25": round(float(last["PM2.5"]), 1),
                "nowcastPm25": nc, "aqi": int(pm25_to_aqi(nc)),
                "pm1": round(float(last["PM1"]), 1), "rh": round(float(last["RH"])),
                "temp": round(float(last["Temp"]), 1),
                "particles": round(float(last["Particles_0.3um"])),
                "status": "ok" if live["forecastData"] is not None else "limited",
                "source": "OpenAQ", "openAqLocation": live["location"]["name"],
            }

    g = s["g"]
    last = g.iloc[-1]
    recent = g[g["datetime"] > last["datetime"] - pd.Timedelta(hours=12)]["PM2.5"].values
    nc = round(nowcast(recent), 1)
    aqi = int(pm25_to_aqi(nc))
    return {"time": iso(last["datetime"]), "pm25": round(float(last["PM2.5"]), 1), "nowcastPm25": nc,
            "aqi": aqi, "pm1": round(float(last["PM1"]), 1), "rh": round(float(last["RH"])),
            "temp": round(float(last["Temp"]), 1), "particles": round(float(last["Particles_0.3um"])),
            "status": s["status"], "source": "Dataset",
            "sourceMessage": (
                f"OpenAQ unavailable ({live_error}); showing the saved dataset."
                if live_error else "No current complete OpenAQ reading; showing the saved dataset."
            )}


@api.get("/forecast/{sid}")
def get_forecast(sid: str):
    s = get_station(sid)
    try:
        live = live_station(sid, s["lat"], s["lon"])
    except OpenAQError as exc:
        logger.warning("OpenAQ forecast data failed for %s: %s", sid, exc)
        raise HTTPException(503, f"Could not load live OpenAQ data: {exc}") from exc
    status = live_status(live)
    if status["forecastMethod"] == "persistence":
        return run_persistence_forecast(live)
    if live["forecastData"] is None:
        reason = "No recent complete OpenAQ PM2.5 readings are available for this station."
        if status["sourceStatus"] == "live":
            reason = "OpenAQ needs 24 consecutive hourly readings for all five model inputs; no usable PM2.5 fallback is available."
        return {"issuedAt": status["lastReadingAt"], "status": "limited", "source": "OpenAQ",
                "reason": reason, "points": [], "drivers": []}
    return run_forecast(s, live=live)


class WhatIf(BaseModel):
    pm25: Optional[float] = None
    pm1: Optional[float] = None
    rh: Optional[float] = None
    temp: Optional[float] = None
    particles: Optional[float] = None


@api.post("/whatif/{sid}")
def whatif(sid: str, body: WhatIf):
    s = get_station(sid)
    try:
        live = live_station(sid, s["lat"], s["lon"])
    except OpenAQError as exc:
        logger.warning("OpenAQ what-if data failed for %s: %s", sid, exc)
        raise HTTPException(503, f"Could not load live OpenAQ data: {exc}") from exc
    if live["forecastData"] is None:
        raise HTTPException(400, "OpenAQ needs 24 consecutive hourly readings for all five model inputs")
    return run_forecast(s, body.model_dump(), live=live)


@api.get("/accuracy/{sid}")
def accuracy(sid: str, horizon: int = 1):
    s = get_station(sid)
    st = ACC["stations"].get(s["key"])
    if not st or st.get("status") != "ok" or str(horizon) not in st["horizons"]:
        return {"status": "limited"}
    h = st["horizons"][str(horizon)]
    return {"status": "ok", "r2": h["r2"], "rmse": h["rmse"], "mae": h["mae"], "classHit": h["classHit"],
            "n": h["n"], "baselines": {"persistence": h["persistence"], "yesterday": h["yesterday"]},
            "beatsPersistence": h["rmse"] < h["persistence"],
            "beatsYesterday": h["yesterday"] is not None and h["rmse"] < h["yesterday"],
            "series": [{**p, "lo": round(max(0, p["forecast"] - h["rmse"])), "hi": round(p["forecast"] + h["rmse"])}
                       for p in h["series"]]}


@api.get("/model")
def model_info():
    return {"model": META["model"], "params": META["best_params"], "windowSize": META["window_size"],
            "inputs": META["model_cols"], "notebookTest": META["test_metrics"],
            "retrainedTest": ACC.get("overall1h"), "artifact": MODEL_PATH.name}


CORR_MAP = {"PM2.5": "PM2.5", "PM1": "PM1", "RH": "Humidity", "Temp": "Temperature",
            "Particles_0.3um": "Particle count"}


def corr_data():
    d = DF[list(CORR_MAP)].rename(columns=CORR_MAP)
    cols = list(CORR_MAP.values())
    matrix = d.corr().round(2).values.tolist()
    sample = d.sample(n=min(2500, len(d)), random_state=7)
    pts = [{**{c: round(float(r[c]), 1) for c in cols}, "aqi": int(pm25_to_aqi(r["PM2.5"]))}
           for _, r in sample.iterrows()]
    return {"cols": cols, "matrix": matrix, "points": pts}


@api.get("/correlation")
def correlation():
    return corr_data()


@api.get("/files")
def files():
    return [{"name": n, "description": d, "sizeKb": round((DATA / n).stat().st_size / 1024),
             "url": f"/api/files/{n}"} for n, d in FILES.items() if (DATA / n).exists()]


@api.get("/files/{name}")
def file_download(name: str):
    if name not in FILES or not (DATA / name).exists():
        raise HTTPException(404, "File not found")
    return FileResponse(DATA / name, filename=name)


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True,
                   allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def warm():
    logger.info("ZarahSense will fetch live station readings from OpenAQ on demand.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)