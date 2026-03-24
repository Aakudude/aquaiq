"""
AquaIQ – ML Model Training Script
===================================
Trains two complementary models:
  1. XGBoost  — daily demand forecasting (next 7 days)
  2. XGBoost  — hourly demand forecasting (next 24 hours)
  Optional: LSTM (uncomment block at bottom if keras is installed)

Run:
    python train_model.py

Outputs:
    models/xgb_daily.pkl
    models/xgb_hourly.pkl
    models/feature_scaler.pkl
    models/training_report.json
"""

import os, json, warnings
import pandas as pd
import numpy as np
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_percentage_error, mean_squared_error
from sklearn.model_selection import TimeSeriesSplit

warnings.filterwarnings("ignore")

try:
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    print("⚠  xgboost not found — falling back to GradientBoostingRegressor")
    from sklearn.ensemble import GradientBoostingRegressor
    XGB_AVAILABLE = False

os.makedirs("models", exist_ok=True)

# ═══════════════════════════════════════════════════════════════════════════════
# 1. LOAD DATA
# ═══════════════════════════════════════════════════════════════════════════════

print("Loading datasets…")
daily  = pd.read_csv("data/campus_water_daily.csv",   parse_dates=["date"])
hourly = pd.read_csv("data/campus_water_15min.csv",   parse_dates=["timestamp"])

# Resample 15-min → hourly for the hourly model
hourly_agg = (
    hourly.set_index("timestamp")
          .resample("1h")
          .agg({
              "total_kl":       "sum",
              "temperature_c":  "mean",
              "rainfall_mm":    "sum",
              "occupancy_pct":  "mean",
              "is_weekend":     "first",
              "is_holiday":     "first",
          })
          .reset_index()
)
hourly_agg["hour"]        = hourly_agg["timestamp"].dt.hour
hourly_agg["day_of_week"] = hourly_agg["timestamp"].dt.dayofweek
hourly_agg["month"]       = hourly_agg["timestamp"].dt.month
hourly_agg["prev_hr_kl"]  = hourly_agg["total_kl"].shift(1).fillna(hourly_agg["total_kl"].mean())
hourly_agg["prev24_kl"]   = hourly_agg["total_kl"].shift(24).fillna(hourly_agg["total_kl"].mean())
hourly_agg = hourly_agg.dropna()

print(f"  Daily  rows : {len(daily):,}")
print(f"  Hourly rows : {len(hourly_agg):,}")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. FEATURE ENGINEERING
# ═══════════════════════════════════════════════════════════════════════════════

DAILY_FEATURES = [
    "day_of_week", "month", "is_weekend", "is_holiday",
    "temp_mean", "temp_max", "rainfall_mm",
    "occupancy_mean", "prev_day_kl", "rolling7_kl",
]

HOURLY_FEATURES = [
    "hour", "day_of_week", "month", "is_weekend", "is_holiday",
    "temperature_c", "rainfall_mm", "occupancy_pct",
    "prev_hr_kl", "prev24_kl",
]

def add_cyclical(df, col, max_val):
    """Encode cyclic features (hour, day, month) as sin/cos."""
    df[f"{col}_sin"] = np.sin(2 * np.pi * df[col] / max_val)
    df[f"{col}_cos"] = np.cos(2 * np.pi * df[col] / max_val)
    return df

daily  = add_cyclical(daily,       "day_of_week", 7)
daily  = add_cyclical(daily,       "month",       12)
hourly_agg = add_cyclical(hourly_agg, "hour",         24)
hourly_agg = add_cyclical(hourly_agg, "day_of_week",  7)
hourly_agg = add_cyclical(hourly_agg, "month",        12)

DAILY_FEATURES  += ["day_of_week_sin","day_of_week_cos","month_sin","month_cos"]
HOURLY_FEATURES += ["hour_sin","hour_cos","day_of_week_sin","day_of_week_cos","month_sin","month_cos"]

# ═══════════════════════════════════════════════════════════════════════════════
# 3. DAILY MODEL (XGBoost)
# ═══════════════════════════════════════════════════════════════════════════════

print("\n─── Training Daily Demand Model ───")

X_d = daily[DAILY_FEATURES].values
y_d = daily["total_kl"].values

# Time-series split — last 60 days as test
split = len(X_d) - 60
X_train_d, X_test_d = X_d[:split], X_d[split:]
y_train_d, y_test_d = y_d[:split], y_d[split:]

if XGB_AVAILABLE:
    model_daily = xgb.XGBRegressor(
        n_estimators     = 400,
        max_depth        = 6,
        learning_rate    = 0.05,
        subsample        = 0.85,
        colsample_bytree = 0.85,
        reg_alpha        = 0.1,
        reg_lambda       = 1.0,
        objective        = "reg:squarederror",
        random_state     = 42,
        n_jobs           = -1,
        verbosity        = 0,
    )
else:
    from sklearn.ensemble import GradientBoostingRegressor
    model_daily = GradientBoostingRegressor(
        n_estimators=300, max_depth=5, learning_rate=0.05,
        subsample=0.85, random_state=42
    )

model_daily.fit(X_train_d, y_train_d)

preds_d  = model_daily.predict(X_test_d)
mape_d   = mean_absolute_percentage_error(y_test_d, preds_d) * 100
rmse_d   = np.sqrt(mean_squared_error(y_test_d, preds_d))
acc_d    = 100 - mape_d

print(f"  MAPE : {mape_d:.2f}%   RMSE : {rmse_d:.1f} kL   Accuracy : {acc_d:.1f}%")
joblib.dump(model_daily, "models/xgb_daily.pkl")
print("  Saved → models/xgb_daily.pkl")

# ═══════════════════════════════════════════════════════════════════════════════
# 4. HOURLY MODEL (XGBoost)
# ═══════════════════════════════════════════════════════════════════════════════

print("\n─── Training Hourly Demand Model ───")

X_h = hourly_agg[HOURLY_FEATURES].values
y_h = hourly_agg["total_kl"].values

split_h = len(X_h) - (24 * 30)   # last 30 days as test
X_train_h, X_test_h = X_h[:split_h], X_h[split_h:]
y_train_h, y_test_h = y_h[:split_h], y_h[split_h:]

if XGB_AVAILABLE:
    model_hourly = xgb.XGBRegressor(
        n_estimators     = 500,
        max_depth        = 6,
        learning_rate    = 0.04,
        subsample        = 0.8,
        colsample_bytree = 0.8,
        reg_alpha        = 0.15,
        reg_lambda       = 1.2,
        objective        = "reg:squarederror",
        random_state     = 42,
        n_jobs           = -1,
        verbosity        = 0,
    )
else:
    from sklearn.ensemble import GradientBoostingRegressor
    model_hourly = GradientBoostingRegressor(
        n_estimators=300, max_depth=5, learning_rate=0.05,
        subsample=0.8, random_state=42
    )

model_hourly.fit(X_train_h, y_train_h)

preds_h  = model_hourly.predict(X_test_h)
mape_h   = mean_absolute_percentage_error(y_test_h, preds_h) * 100
rmse_h   = np.sqrt(mean_squared_error(y_test_h, preds_h))

print(f"  MAPE : {mape_h:.2f}%   RMSE : {rmse_h:.2f} kL/hr")
joblib.dump(model_hourly, "models/xgb_hourly.pkl")
print("  Saved → models/xgb_hourly.pkl")

# ═══════════════════════════════════════════════════════════════════════════════
# 5. FEATURE METADATA (needed by the Flask API for inference)
# ═══════════════════════════════════════════════════════════════════════════════

meta = {
    "daily_features":  DAILY_FEATURES,
    "hourly_features": HOURLY_FEATURES,
    "daily_stats": {
        "mean": float(daily["total_kl"].mean()),
        "std":  float(daily["total_kl"].std()),
        "min":  float(daily["total_kl"].min()),
        "max":  float(daily["total_kl"].max()),
    },
    "report": {
        "daily_mape":  round(mape_d,  2),
        "daily_rmse":  round(rmse_d,  1),
        "daily_acc":   round(acc_d,   1),
        "hourly_mape": round(mape_h,  2),
        "hourly_rmse": round(rmse_h,  2),
        "hourly_acc":  round(100 - mape_h, 1),
    }
}

with open("models/model_meta.json", "w") as f:
    json.dump(meta, f, indent=2)

print("\n─── Training Complete ───")
print(json.dumps(meta["report"], indent=2))
print("\nAll artefacts saved to models/")

# ═══════════════════════════════════════════════════════════════════════════════
# OPTIONAL: LSTM (uncomment if tensorflow/keras is available)
# ═══════════════════════════════════════════════════════════════════════════════
"""
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from sklearn.preprocessing import MinMaxScaler

SEQ_LEN = 48  # 48 hours look-back

scaler = MinMaxScaler()
data_scaled = scaler.fit_transform(y_h.reshape(-1,1))

def make_sequences(data, seq_len):
    X, y = [], []
    for i in range(len(data) - seq_len):
        X.append(data[i:i+seq_len])
        y.append(data[i+seq_len])
    return np.array(X), np.array(y)

X_lstm, y_lstm = make_sequences(data_scaled, SEQ_LEN)
X_lstm = X_lstm.reshape(X_lstm.shape[0], SEQ_LEN, 1)

split = int(len(X_lstm) * 0.85)
X_tr, X_te = X_lstm[:split], X_lstm[split:]
y_tr, y_te = y_lstm[:split], y_lstm[split:]

model_lstm = Sequential([
    LSTM(64, return_sequences=True, input_shape=(SEQ_LEN, 1)),
    Dropout(0.2),
    LSTM(32),
    Dropout(0.2),
    Dense(1)
])

model_lstm.compile(optimizer="adam", loss="mse")
model_lstm.fit(X_tr, y_tr, epochs=30, batch_size=64,
               validation_data=(X_te, y_te), verbose=1)

model_lstm.save("models/lstm_hourly.h5")
joblib.dump(scaler, "models/lstm_scaler.pkl")
print("LSTM saved → models/lstm_hourly.h5")
"""
