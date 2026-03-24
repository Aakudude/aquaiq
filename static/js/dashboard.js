/* ════════════════════════════════════════════════════
   dashboard.js — Dashboard page logic
════════════════════════════════════════════════════ */

const BASE_DEMAND = 1847;

const REASONS = [
  { label: 'Temperature (34°C)',   dir: 'pos', impact: '+6.8%', bar: 68, desc: 'High heat drives evaporative cooling & personal use. Each +1°C adds ~0.8% demand.' },
  { label: 'Friday pattern',       dir: 'pos', impact: '+3.1%', bar: 31, desc: 'Fridays show elevated canteen & hostel usage before weekend departure.' },
  { label: 'Prev Day Usage',       dir: 'pos', impact: '+2.4%', bar: 24, desc: 'Yesterday: 1,812 kL. Positive lag correlation — model weights this heavily.' },
  { label: 'Rolling 7-Day Avg',   dir: 'pos', impact: '+1.9%', bar: 19, desc: '7-day rolling avg: 1,781 kL. Trending upward, boosting today\'s forecast.' },
  { label: 'No Rainfall (0mm)',    dir: 'neu', impact: '0.0%',  bar: 2,  desc: 'No rain expected. Garden irrigation proceeds at normal schedule.' },
  { label: 'Occupancy (85%)',      dir: 'neg', impact: '−1.2%', bar: 12, desc: 'Standard academic day. Surge occupancy (>95%) would add ~180 kL more.' },
];

/* ── WEATHER ── */
async function loadWeather() {
  try {
    const data = await fetch('/api/weather').then(r => r.json());
    const el = document.getElementById('weather-strip');
    el.innerHTML = data.map(w => {
      const sign  = w.demand_impact > 0 ? '+' : '';
      const icls  = w.demand_impact >  2 ? 'pos' : w.demand_impact < -2 ? 'neg' : '';
      return `<div class="wx-card ${w.today ? 'today' : ''}">
        <div class="wx-day">${w.today ? 'TODAY' : w.day}</div>
        <div class="wx-icon">${w.icon}</div>
        <div class="wx-temp">${w.temp}°C</div>
        <div class="wx-rain">${w.rain > 0 ? w.rain + 'mm' : 'Dry'}</div>
        <div class="wx-impact ${icls}">${sign}${w.demand_impact}% demand</div>
      </div>`;
    }).join('');
  } catch (e) {
    document.getElementById('weather-strip').innerHTML = '<div class="loading-state">Weather unavailable</div>';
  }
}

/* ── KPI ── */
async function loadKpis() {
  try {
    const [fc, tanks] = await Promise.all([
      fetch('/api/forecast').then(r => r.json()),
      fetch('/api/tanks').then(r => r.json()),
    ]);

    const today = fc.daily[0];
    document.getElementById('kv-today').textContent = today.predicted_kl.toLocaleString('en-IN');
    document.getElementById('ks-today').textContent = `↑ kL · ${fc.model.daily_acc}% confidence`;

    const avg = Math.round(tanks.reduce((s, t) => s + t.current_pct, 0) / tanks.length);
    const low = tanks.filter(t => t.current_pct < 50).length;
    document.getElementById('kv-tank').textContent = avg + '%';
    const ks = document.getElementById('ks-tank');
    ks.textContent = low > 0 ? `↓ ${low} tank${low > 1 ? 's' : ''} need attention` : '↑ All tanks healthy';
    ks.className = `kpi-sub ${low > 0 ? 'dn' : 'up'}`;
  } catch (e) {
    console.error('KPI load error', e);
  }
}

/* ── MINI FORECAST CHART ── */
async function loadMiniforecast() {
  const data = await fetch('/api/forecast').then(r => r.json());
  const labels  = data.daily.map(d => d.day);
  const forecast = data.daily.map(d => d.predicted_kl);
  const upper    = data.daily.map(d => d.upper_kl);
  const lower    = data.daily.map(d => d.lower_kl);
  const baseline = forecast.map(() => 1900);

  new Chart(document.getElementById('miniforecastChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Upper CI', data: upper, borderColor: 'transparent', backgroundColor: 'rgba(77,159,255,0.1)', fill: '+1', tension: 0.4, pointRadius: 0 },
        { label: 'Lower CI', data: lower, borderColor: 'transparent', fill: false, tension: 0.4, pointRadius: 0 },
        { label: 'Forecast', data: forecast, borderColor: '#4d9fff', backgroundColor: 'rgba(77,159,255,0.05)', fill: false, tension: 0.4, borderWidth: 2.5, pointBackgroundColor: '#4d9fff', pointRadius: 4, pointHoverRadius: 6 },
        { label: 'Baseline', data: baseline, borderColor: 'rgba(248,113,113,0.35)', borderDash: [5,4], fill: false, tension: 0, borderWidth: 1.5, pointRadius: 0 },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { ...CHART_DEFAULTS.plugins.legend, labels: { ...CHART_DEFAULTS.plugins.legend.labels, filter: i => !['Upper CI','Lower CI'].includes(i.text) } },
      },
    },
  });
}

/* ── ZONE DONUT ── */
async function loadZoneDonut() {
  const data = await fetch('/api/zones').then(r => r.json());
  new Chart(document.getElementById('zoneDonutChart'), {
    type: 'doughnut',
    data: {
      labels: data.map(z => z.zone),
      datasets: [{
        data:            data.map(z => z.demand_kl),
        backgroundColor: data.map(z => z.color + 'cc'),
        borderColor:     data.map(z => z.color),
        borderWidth: 1,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#3a5268', font: { family: 'JetBrains Mono', size: 10 }, boxWidth: 10, padding: 10 } },
        tooltip: CHART_DEFAULTS.plugins.tooltip,
      },
      cutout: '65%',
      animation: { duration: 700 },
    },
  });
}

/* ── ALERTS ── */
async function loadAlerts() {
  const data = await fetch('/api/alerts').then(r => r.json());
  let alerts = [...data];
  document.getElementById('alert-count').textContent = alerts.length;

  function render() {
    document.getElementById('alert-list').innerHTML = alerts.length
      ? alerts.map((a, i) => `
          <div class="alert-item ${a.type}">
            <span class="alert-icon">${a.icon}</span>
            <div><div class="alert-title">${a.title}</div><div class="alert-body">${a.body}</div></div>
            <button class="alert-dismiss" onclick="this.closest('.alert-item').remove();this">×</button>
          </div>`).join('')
      : '<div class="empty-state">No active alerts</div>';
    document.getElementById('alert-count').textContent = document.querySelectorAll('#alert-list .alert-item').length;
  }
  render();
}

/* ── AI REASONING ── */
function renderReasons() {
  document.getElementById('reason-grid').innerHTML = REASONS.map(r => {
    const barColor = r.dir === 'pos' ? 'var(--red)' : r.dir === 'neg' ? 'var(--green)' : 'var(--text3)';
    return `<div class="reason-item ${r.dir}">
      <div class="reason-head">
        <div class="reason-feat">${r.label}</div>
        <div class="reason-impact ${r.dir === 'pos' ? 'up' : r.dir === 'neg' ? 'dn' : ''}">${r.impact}</div>
      </div>
      <div class="reason-desc">${r.desc}</div>
      <div class="reason-bar-bg"><div class="reason-bar" style="width:${r.bar}%;background:${barColor}"></div></div>
    </div>`;
  }).join('');
}

/* ── INIT ── */
(async function() {
  await Promise.all([loadWeather(), loadKpis(), loadAlerts()]);
  await Promise.all([loadMiniforecast(), loadZoneDonut()]);
  renderReasons();
  toast('info', 'AquaIQ Dashboard', 'Data loaded · XGBoost model active');
})();
