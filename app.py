"""
AquaIQ — Campus Water Intelligence System
Flask backend with multi-page routing + API endpoints
"""
import os, json, math, random
from datetime import datetime, timedelta
from flask import Flask, render_template, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ──────────────────────────────────────────────
#  PAGE ROUTES
# ──────────────────────────────────────────────

@app.route("/")
def dashboard():
    return render_template("dashboard.html", active="dashboard")

@app.route("/forecast")
def forecast():
    return render_template("forecast.html", active="forecast")

@app.route("/pumps")
def pumps():
    return render_template("pumps.html", active="pumps")

@app.route("/tanks")
def tanks():
    return render_template("tanks.html", active="tanks")

@app.route("/zones")
def zones():
    return render_template("zones.html", active="zones")


# ──────────────────────────────────────────────
#  API ENDPOINTS  (unchanged from original)
# ──────────────────────────────────────────────

@app.route("/api/forecast")
def api_forecast():
    """ML demand prediction — daily + hourly."""
    today = datetime.now()
    daily = []
    for i in range(7):
        d = today + timedelta(days=i)
        is_weekend = d.weekday() >= 5
        temp = round(32 + random.uniform(-4, 6), 1)
        rain = round(random.uniform(0, 25) if random.random() < 0.3 else 0, 1)
        base = 1750 if is_weekend else 1900
        predicted = round(base + (temp - 32) * 8 - rain * 12 + random.uniform(-40, 40), 1)
        daily.append({
            "date": d.strftime("%Y-%m-%d"),
            "day":  d.strftime("%a").upper(),
            "predicted_kl": predicted,
            "lower_kl":  round(predicted * 0.95, 1),
            "upper_kl":  round(predicted * 1.05, 1),
            "is_weekend": is_weekend,
            "temp": temp,
            "rain": rain,
        })

    hourly = []
    profile = [0,0,0,0,8,18,38,52,44,30,22,24,26,24,21,22,31,40,28,20,14,9,5,1]
    for h, v in enumerate(profile):
        hourly.append({
            "hour": h,
            "predicted_kl": round(v + random.uniform(-1, 2), 2),
        })

    return jsonify({
        "daily": daily,
        "hourly": hourly,
        "model": {"daily_acc": 99.1, "daily_mape": 0.9, "daily_rmse": 5.9,
                  "hourly_acc": 96.7, "hourly_mape": 3.25, "hourly_rmse": 0.89},
    })


@app.route("/api/weather")
def api_weather():
    """7-day weather forecast (synthetic fallback)."""
    icons = ["☀️","⛅","🌧️","🌤️","☀️","⛅","🌧️"]
    today = datetime.now()
    days  = []
    for i in range(7):
        d    = today + timedelta(days=i)
        rain = round(random.uniform(0, 30) if random.random() < 0.35 else 0, 1)
        temp = round(30 + random.uniform(-5, 7), 1)
        days.append({
            "date":  d.strftime("%Y-%m-%d"),
            "day":   d.strftime("%a").upper(),
            "icon":  icons[i % len(icons)],
            "temp":  temp,
            "rain":  rain,
            "today": i == 0,
            "demand_impact": round((temp - 30) * 0.8 - rain * 0.25, 1),
        })
    return jsonify(days)


@app.route("/api/tanks")
def api_tanks():
    """Current tank fill levels."""
    tanks = [
        {"id": 0, "name": "OHT Hostel A", "location": "Block A Roof",  "capacity_kl": 150, "current_pct": 72, "color": "#4d9fff"},
        {"id": 1, "name": "OHT Hostel B", "location": "Block B Roof",  "capacity_kl": 150, "current_pct": 55, "color": "#34d399"},
        {"id": 2, "name": "UGT Academic", "location": "Main Block",    "capacity_kl": 200, "current_pct": 81, "color": "#a78bfa"},
        {"id": 3, "name": "OHT Canteen",  "location": "Dining Zone",   "capacity_kl": 80,  "current_pct": 48, "color": "#fbbf24"},
    ]
    return jsonify(tanks)


@app.route("/api/pumps")
def api_pumps():
    """AI-optimised pump schedule."""
    pumps = [
        {"id": 0, "name": "Main Booster",   "schedule": "05:00–07:30", "kw": 11, "tariff": "offpeak",  "ai_on": False},
        {"id": 1, "name": "Hostel Block A", "schedule": "06:00–08:00", "kw": 7,  "tariff": "offpeak",  "ai_on": True},
        {"id": 2, "name": "Academic Zone",  "schedule": "07:30–09:30", "kw": 5,  "tariff": "standard", "ai_on": True},
        {"id": 3, "name": "Canteen Supply", "schedule": "10:00–11:30", "kw": 3,  "tariff": "peak",     "ai_on": False},
        {"id": 4, "name": "Garden/Grounds", "schedule": "18:00–19:30", "kw": 4,  "tariff": "standard", "ai_on": False},
        {"id": 5, "name": "Hostel Block B", "schedule": "21:00–22:30", "kw": 7,  "tariff": "offpeak",  "ai_on": False},
    ]
    return jsonify(pumps)


@app.route("/api/zones")
def api_zones():
    """Zone-wise demand breakdown."""
    zones = [
        {"zone": "Hostel Block A", "demand_kl": 520, "prev_kl": 490, "color": "#4d9fff"},
        {"zone": "Hostel Block B", "demand_kl": 480, "prev_kl": 510, "color": "#34d399"},
        {"zone": "Academic Block", "demand_kl": 320, "prev_kl": 300, "color": "#a78bfa"},
        {"zone": "Canteen & Mess", "demand_kl": 180, "prev_kl": 185, "color": "#fbbf24"},
        {"zone": "Gardens & Lawn", "demand_kl": 220, "prev_kl": 310, "color": "#22d3ee"},
        {"zone": "Admin & Labs",   "demand_kl": 127, "prev_kl": 130, "color": "#f87171"},
    ]
    return jsonify(zones)


@app.route("/api/alerts")
def api_alerts():
    """Smart alerts & AI recommendations."""
    alerts = [
        {"type": "ai",      "icon": "🤖", "title": "AI: Run Pump 5 at 21:00",         "body": "Hostel B peaks at 06:00. Pre-fill off-peak saves ₹226."},
        {"type": "warn",    "icon": "⚠️", "title": "Canteen OHT at 48% — Low",        "body": "Schedule fill before 09:00 peak. Off-peak window: 21:00–05:00."},
        {"type": "info",    "icon": "🌧", "title": "Rain Monday → Irrigation paused", "body": "Garden pump auto-paused Mon–Tue. Saving: ~8 kWh, ₹58."},
        {"type": "success", "icon": "✅", "title": "Off-peak window: 21:00–05:00",    "body": "All non-urgent fills redirected. Projected saving: ₹380."},
    ]
    return jsonify(alerts)


@app.route("/api/metrics")
def api_metrics():
    """Model accuracy + impact stats."""
    return jsonify({
        "model": {"daily_acc": 99.1, "daily_mape": 0.9,  "daily_rmse": 5.9,
                  "hourly_acc": 96.7,"hourly_mape": 3.25, "hourly_rmse": 0.89},
        "impact": {"kwh_saved": 1284, "kl_optimised": 8420, "inr_saved": 9640,
                   "overpump_reduction_pct": 24},
    })


# ──────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)
