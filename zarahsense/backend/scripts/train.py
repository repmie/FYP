"""Retrain the user's RandomForest (params from meta.json) and build the accuracy report."""
import json, sys, time
from pathlib import Path
import numpy as np, joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from engine import (DATA, FEATS, WIN, HOUR, load_clean, train_mask, climatology, model_input,
                    forecast, pm25_to_aqi, aqi_cat_idx, TRAIN_SPLIT)

HORIZONS = [1, 3, 6, 12, 24]
meta = json.load(open(DATA / "meta.json"))
scaler = joblib.load(DATA / "scaler.pkl")
df = load_clean()
tm = train_mask(df)
st = df["station"].values
raw_all = df[FEATS].values.astype(float)
times_all = df["datetime"].values.astype("datetime64[h]")
pm = df["PM2.5"].values
real = ~df["PM2.5_imputed"].values


def win_ok(pos, t):
    return times_all[pos[t]] - times_all[pos[t - WIN]] == np.timedelta64(WIN, "h")


Xtr, ytr, ttr, te = [], [], [], []
for s in df["station"].unique():
    pos = np.where(st == s)[0]
    cut = int(len(pos) * TRAIN_SPLIT)
    for t in range(WIN, len(pos)):
        if not win_ok(pos, t):
            continue
        if t < cut:
            Xtr.append(pos[t - WIN:t]); ytr.append(pm[pos[t]]); ttr.append(times_all[pos[t]])
        else:
            te.append(pos[t - WIN:t + 1])
order = np.argsort(np.array(ttr), kind="stable")
idx_tr = np.array(Xtr)[order]
X_train = model_input(scaler, raw_all[idx_tr], times_all[idx_tr])
y_train = np.array(ytr)[order]
print("train", X_train.shape, flush=True)

bp = meta["best_params"]
model = RandomForestRegressor(random_state=42, n_jobs=-1, **bp)
t0 = time.time(); model.fit(X_train, y_train); print(f"fit {time.time()-t0:.0f}s", flush=True)

te = np.array(te)
X_test = model_input(scaler, raw_all[te[:, :WIN]], times_all[te[:, :WIN]])
y_test = pm[te[:, WIN]]; r_mask = real[te[:, WIN]]
yp = model.predict(X_test)
overall = {"R2": r2_score(y_test[r_mask], yp[r_mask]),
           "RMSE": float(np.sqrt(mean_squared_error(y_test[r_mask], yp[r_mask]))),
           "MAE": mean_absolute_error(y_test[r_mask], yp[r_mask]),
           "persistenceRMSE": float(np.sqrt(mean_squared_error(y_test[r_mask], pm[te[:, WIN - 1]][r_mask])))}
print("1h test (PM2.5):", overall, "notebook:", meta["test_metrics"], flush=True)
joblib.dump(model, DATA / "rf_model.joblib", compress=3)
print("saved model", flush=True)

report = {"overall1h": {k: round(v, 4) for k, v in overall.items()}, "notebook": meta["test_metrics"], "stations": {}}
for s in df["station"].unique():
    pos = np.where(st == s)[0]
    cut = int(len(pos) * TRAIN_SPLIT)
    clim = climatology(df.iloc[pos[:cut]])
    origins = [t for t in range(max(WIN, cut), len(pos)) if win_ok(pos, t)]
    if len(origins) < 48:
        report["stations"][s] = {"status": "limited", "nOrigins": len(origins)}
        continue
    origins = np.array(origins)
    w = np.stack([pos[o - WIN:o] for o in origins])
    fc = forecast(model, scaler, raw_all[w], times_all[w], clim)
    res = {"status": "ok", "nOrigins": int(len(origins)), "horizons": {}}
    for h in HORIZONS:
        tgt = origins + h - 1
        ok = tgt < len(pos)
        tgt_c = np.minimum(tgt, len(pos) - 1)
        ok &= (times_all[pos[tgt_c]] - times_all[pos[origins - 1]]) == np.timedelta64(h, "h")
        ok &= real[pos[tgt_c]]
        y_idx = tgt_c - 24
        y_ok = ok & (y_idx >= 0)
        y_ok &= (times_all[pos[tgt_c]] - times_all[pos[np.maximum(y_idx, 0)]]) == np.timedelta64(24, "h")
        act = pm[pos[tgt_c]][ok]; pred = fc[ok, h - 1]; pers = pm[pos[origins - 1]][ok]
        a_act, a_pred, a_pers = pm25_to_aqi(act), pm25_to_aqi(pred), pm25_to_aqi(pers)
        a_y = pm25_to_aqi(pm[pos[np.maximum(y_idx, 0)]][y_ok]); a_y_act = pm25_to_aqi(pm[pos[tgt_c]][y_ok])
        rmse = lambda a, b: float(np.sqrt(np.mean((a - b) ** 2)))
        ser_t = times_all[pos[tgt_c]][ok]
        last7 = ser_t >= ser_t.max() - np.timedelta64(7 * 24, "h")
        series = [{"time": str(np.datetime_as_string(t_)) + ":00:00+08:00", "actual": int(a), "forecast": int(f)}
                  for t_, a, f in zip(ser_t[last7][::2], a_act[last7][::2], a_pred[last7][::2])]
        res["horizons"][str(h)] = {
            "n": int(ok.sum()),
            "r2": round(float(r2_score(a_act, a_pred)), 3),
            "rmse": round(rmse(a_act, a_pred), 2), "mae": round(float(np.mean(np.abs(a_act - a_pred))), 2),
            "rmsePm25": round(rmse(act, pred), 3),
            "classHit": round(float(np.mean(aqi_cat_idx(a_act) == aqi_cat_idx(a_pred)) * 100), 1),
            "persistence": round(rmse(a_act, a_pers), 2),
            "yesterday": round(rmse(a_y_act, a_y), 2) if y_ok.sum() else None,
            "series": series,
        }
    report["stations"][s] = res
    print(s, {h: (v["rmse"], v["persistence"], v["r2"]) for h, v in res["horizons"].items()}, flush=True)

json.dump(report, open(DATA / "accuracy.json", "w"), indent=1)
print("done", flush=True)