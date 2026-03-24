"""
AquaIQ – Campus Water Dataset Generator
Generates 2 years of realistic 15-minute interval water consumption data
for a medium campus (~1200 students) across 6 zones.

Run once:  python generate_dataset.py
Output:    data/campus_water_usage.csv
"""

import pandas as pd
import numpy as np
import os

SEED = 42
np.random.seed(SEED)

# ── Parameters ──────────────────────────────────────────────────────────────
START = "2024-01-01"
END   = "2025-12-31 23:45:00"
FREQ  = "15min"

ZONES = {
    "hostel_a":  {"base": 35, "capacity": 150},
    "hostel_b":  {"base": 30, "capacity": 150},
    "academic":  {"base": 20, "capacity": 200},
    "canteen":   {"base": 12, "capacity":  80},
    "gardens":   {"base": 15, "capacity": 100},
    "admin_lab": {"base":  8, "capacity":  60},
}

def hostel_pattern(hour: int, is_weekend: bool) -> float:
    """kL per 15-min slot — hostel usage peaks morning & evening."""
    if is_weekend:
        if   6 <= hour < 9:  return 3.5 + np.random.normal(0, 0.3)
        elif 9 <= hour < 12: return 2.0 + np.random.normal(0, 0.2)
        elif 18 <= hour < 22: return 3.0 + np.random.normal(0, 0.3)
        else:                return 0.4 + np.random.normal(0, 0.05)
    else:
        if   5 <= hour < 8:  return 4.5 + np.random.normal(0, 0.4)
        elif 8 <= hour < 11: return 2.2 + np.random.normal(0, 0.2)
        elif 17 <= hour < 21: return 3.8 + np.random.normal(0, 0.35)
        else:                return 0.5 + np.random.normal(0, 0.05)

def academic_pattern(hour: int, is_weekend: bool, is_holiday: bool) -> float:
    if is_holiday or is_weekend: return 0.2 + np.random.normal(0, 0.02)
    if   8 <= hour < 13: return 2.8 + np.random.normal(0, 0.25)
    elif 13 <= hour < 17: return 2.2 + np.random.normal(0, 0.2)
    elif 17 <= hour < 19: return 1.0 + np.random.normal(0, 0.1)
    else:                return 0.1 + np.random.normal(0, 0.01)

def canteen_pattern(hour: int, is_weekend: bool) -> float:
    if   7 <= hour < 9:  return 2.8 + np.random.normal(0, 0.3)
    elif 12 <= hour < 14: return 3.5 + np.random.normal(0, 0.4)
    elif 19 <= hour < 21: return 2.5 + np.random.normal(0, 0.3)
    elif 9 <= hour < 12:  return 0.8 + np.random.normal(0, 0.1)
    else:                return 0.2 + np.random.normal(0, 0.02)

def garden_pattern(hour: int, month: int, rainfall_mm: float) -> float:
    if rainfall_mm > 5: return 0.1  # rain → no irrigation
    if month in [11, 12, 1, 2]:  # winter — less watering
        if 6 <= hour < 8:  return 1.5 + np.random.normal(0, 0.15)
        if 17 <= hour < 19: return 1.0 + np.random.normal(0, 0.1)
        return 0.1
    else:                         # summer — more watering
        if 6 <= hour < 8:  return 3.0 + np.random.normal(0, 0.3)
        if 17 <= hour < 20: return 2.5 + np.random.normal(0, 0.25)
        return 0.15

# ── Date range ───────────────────────────────────────────────────────────────
idx = pd.date_range(start=START, end=END, freq=FREQ)

# ── Synthetic weather (Chennai-like climate) ─────────────────────────────────
def gen_temp(dt):
    base = 28 + 6 * np.sin((dt.month - 4) * np.pi / 6)
    return round(base + np.random.normal(0, 1.5), 1)

def gen_rain(dt):
    # Northeast monsoon Oct-Dec, light SW Jun-Sep
    monsoon = dt.month in [10, 11, 12]
    sw_rain  = dt.month in [6, 7, 8, 9]
    p = 0.35 if monsoon else (0.15 if sw_rain else 0.03)
    return round(abs(np.random.exponential(8)) if np.random.random() < p else 0, 1)

# ── Holiday list (simple) ─────────────────────────────────────────────────────
# Mark semester breaks as holidays
holiday_ranges = [
    ("2024-01-01", "2024-01-07"),   # New Year break
    ("2024-04-10", "2024-05-31"),   # Summer semester break
    ("2024-10-02", "2024-10-05"),   # Dussehra
    ("2024-12-20", "2024-12-31"),   # Winter break
    ("2025-01-01", "2025-01-05"),
    ("2025-04-12", "2025-05-30"),
    ("2025-10-01", "2025-10-04"),
    ("2025-12-20", "2025-12-31"),
]

holiday_dates = set()
for s, e in holiday_ranges:
    for d in pd.date_range(s, e):
        holiday_dates.add(d.date())

# ── Build DataFrame ───────────────────────────────────────────────────────────
print("Generating dataset…")
rows = []
prev_total = 1800.0

for ts in idx:
    hour       = ts.hour
    dow        = ts.dayofweek          # 0=Mon … 6=Sun
    is_weekend = dow >= 5
    is_holiday = ts.date() in holiday_dates
    month      = ts.month
    temp       = gen_temp(ts)
    rain       = gen_rain(ts)

    ha = max(0, hostel_pattern(hour, is_weekend))
    hb = max(0, hostel_pattern(hour, is_weekend) * 0.88)  # slightly smaller
    ac = max(0, academic_pattern(hour, is_weekend, is_holiday))
    ca = max(0, canteen_pattern(hour, is_weekend))
    ga = max(0, garden_pattern(hour, month, rain))
    al = max(0, ac * 0.32)

    total = (ha + hb + ac + ca + ga + al) * (1 + (temp - 28) * 0.005)
    total = round(max(0, total), 3)

    rows.append({
        "timestamp":      ts,
        "hour":           hour,
        "day_of_week":    dow,
        "month":          month,
        "is_weekend":     int(is_weekend),
        "is_holiday":     int(is_holiday),
        "temperature_c":  temp,
        "rainfall_mm":    rain,
        "occupancy_pct":  round(0 if (is_holiday or is_weekend) else
                                (0.95 if 8 <= hour < 17 else 0.55) + np.random.normal(0, 0.05), 2),
        "hostel_a_kl":    round(ha, 3),
        "hostel_b_kl":    round(hb, 3),
        "academic_kl":    round(ac, 3),
        "canteen_kl":     round(ca, 3),
        "gardens_kl":     round(ga, 3),
        "admin_lab_kl":   round(al, 3),
        "total_kl":       total,
        "prev_day_total": round(prev_total, 2),
    })
    # rolling 24h previous total (very rough — just daily average × 96 slots)
    if ts.minute == 45 and ts.hour == 23:
        prev_total = total * 96 * 0.9 + np.random.normal(0, 50)

df = pd.DataFrame(rows)

# ── Daily aggregates (for XGBoost daily model) ────────────────────────────────
daily = (
    df.groupby(df["timestamp"].dt.date)
      .agg(
          total_kl       = ("total_kl", "sum"),
          temp_mean      = ("temperature_c", "mean"),
          temp_max       = ("temperature_c", "max"),
          rainfall_mm    = ("rainfall_mm", "sum"),
          is_weekend     = ("is_weekend", "first"),
          is_holiday     = ("is_holiday", "first"),
          occupancy_mean = ("occupancy_pct", "mean"),
      )
      .reset_index()
      .rename(columns={"timestamp": "date"})
)

daily["day_of_week"] = pd.to_datetime(daily["date"]).dt.dayofweek
daily["month"]       = pd.to_datetime(daily["date"]).dt.month
daily["prev_day_kl"] = daily["total_kl"].shift(1).fillna(daily["total_kl"].mean())
daily["rolling7_kl"] = daily["total_kl"].rolling(7, min_periods=1).mean().shift(1).fillna(daily["total_kl"].mean())

os.makedirs("data", exist_ok=True)
df.to_csv("data/campus_water_15min.csv", index=False)
daily.to_csv("data/campus_water_daily.csv", index=False)

print(f"✅  15-min dataset : data/campus_water_15min.csv  ({len(df):,} rows)")
print(f"✅  Daily dataset  : data/campus_water_daily.csv  ({len(daily):,} rows)")
print(f"\nDaily stats:\n{daily['total_kl'].describe().round(1)}")
