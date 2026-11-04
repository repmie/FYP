from pathlib import Path
import numpy as np
import pandas as pd

DATA = Path(__file__).parent / "data"
FEATS = ["PM1", "PM2.5", "RH", "Temp", "Particles_0.3um"]
WIN = 24
TRAIN_SPLIT = 0.8
HOUR = np.timedelta64(1, "h")
BP = [(0.0, 9.0, 0, 50), (9.1, 35.4, 51, 100), (35.5, 55.4, 101, 150),
      (55.5, 125.4, 151, 200), (125.5, 225.4, 201, 300), (225.5, 325.4, 301, 500)]
CATS = ["Good", "Moderate", "Unhealthy for Sensitive Groups", "Unhealthy", "Very Unhealthy", "Hazardous"]


def pm25_to_aqi(c):
    c = np.floor(np.maximum(0, np.asarray(c, dtype=float)) * 10) / 10
    out = np.full(c.shape, 500.0)
    for lo, hi, ilo, ihi in reversed(BP):
        m = c <= hi
        out[m] = (ihi - ilo) / (hi - lo) * (np.maximum(c[m], lo) - lo) + ilo
    return np.minimum(500, np.round(out)).astype(int)


def aqi_cat_idx(aqi):
    return np.digitize(np.asarray(aqi), [50, 100, 150, 200, 300], right=True)


def nowcast(pm_last12):
    """US EPA NowCast for PM2.5 from up to 12 hourly values, newest last."""
    v = np.asarray(pm_last12, dtype=float)[::-1]
    w = max(0.5, 1 - (v.max() - v.min()) / v.max()) if v.max() > 0 else 1
    wt = w ** np.arange(len(v))
    return float((v * wt).sum() / wt.sum())


def time_feats(times):
    t = pd.DatetimeIndex(np.asarray(times).ravel())
    h, m = t.hour.values, t.month.values - 1
    return np.c_[np.sin(2 * np.pi * h / 24), np.cos(2 * np.pi * h / 24),
                 np.sin(2 * np.pi * m / 12), np.cos(2 * np.pi * m / 12)]


def load_clean():
    df = pd.read_csv(DATA / "clean_dataset.csv", parse_dates=["datetime"])
    return df.sort_values(["station", "datetime"]).reset_index(drop=True)


def train_mask(df):
    mask = np.zeros(len(df), dtype=bool)
    st = df["station"].values
    for s in df["station"].unique():
        pos = np.where(st == s)[0]
        mask[pos[: int(len(pos) * TRAIN_SPLIT)]] = True
    return mask


def climatology(g):
    """Mean RH and Temp by hour of day for one station's rows."""
    c = g.groupby(g["datetime"].dt.hour)[["RH", "Temp"]].mean().reindex(range(24))
    return c.interpolate(limit_direction="both").values


def scale(scaler, raw):
    return raw * scaler.scale_ + scaler.min_


def model_input(scaler, raw, times):
    n = len(raw)
    tf = time_feats(times).reshape(n, WIN, 4)
    return np.concatenate([scale(scaler, raw), tf], axis=2).reshape(n, -1)


def forecast(model, scaler, raw, times, clim, steps=24):
    """Recursive hourly forecast. raw (N,24,5) readings, times (N,24) datetime64, clim (24,2)."""
    raw = np.array(raw, dtype=float)
    times = np.array(times, dtype="datetime64[h]")
    n = len(raw)
    last = raw[:, -1, :]
    hist = raw[:, :-1, :]
    base = np.maximum(hist[:, :, 1], 0.5)
    r_pm1 = np.clip(np.median(hist[:, :, 0] / base, axis=1), 0, 1.5)
    r_part = np.clip(np.median(hist[:, :, 4] / base, axis=1), 0, 3000)
    out = np.zeros((n, steps))
    for k in range(steps):
        p = np.clip(model.predict(model_input(scaler, raw, times)), 0, None)
        out[:, k] = p
        nt = times[:, -1] + HOUR
        hr = pd.DatetimeIndex(nt).hour.values
        new = np.stack([p * r_pm1, p, clim[hr, 0], clim[hr, 1], p * r_part], axis=1)
        raw = np.concatenate([raw[:, 1:], new[:, None, :]], axis=1)
        times = np.concatenate([times[:, 1:], nt[:, None]], axis=1)
    return out