/* ════════════════════════════════════════════════════
   forecast.js — Forecast page logic
════════════════════════════════════════════════════ */

const BASE_DEMAND = 1847;
const SIM_BASE    = { temp: 34, rain: 0, occ: 85, day: 0 };
const DAY_TYPES   = ['Weekday', 'Weekend', 'Holiday'];

let fcChart   = null;
let fcData    = null;   // raw API response

/* ── METRIC STRIP ── */
function updateMetricStrip(daily) {
  const vals = daily.map(d => d.predicted_kl);
  const set  = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('fc-today', vals[0].toLocaleString('en-IN'));
  set('fc-week',  vals.reduce((s, v) => s + v, 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  set('fc-peak',  Math.max(...vals).toLocaleString('en-IN'));
  set('fc-low',   Math.min(...vals).toLocaleString('en-IN'));
}

/* ── MAIN FORECAST CHART ── */
async function loadForecastChart() {
  fcData = await fetch('/api/forecast').then(r => r.json());
  updateMetricStrip(fcData.daily);
  buildChart('daily');
}

function buildChart(mode) {
  const canvas = document.getElementById('forecastChart');
  if (!canvas) return;
  if (fcChart) fcChart.destroy();

  let labels, datasets;

  if (mode === 'daily') {
    labels = fcData.daily.map(d => d.day);
    const fc   = fcData.daily.map(d => d.predicted_kl);
    const up   = fcData.daily.map(d => d.upper_kl);
    const lo   = fcData.daily.map(d => d.lower_kl);
    const base = fc.map(() => 1900);
    const hist = [1780,1760,1800,1750,1820,1880,1950];
    datasets = [
      { label: 'Upper CI', data: up,   borderColor: 'transparent', backgroundColor: 'rgba(77,159,255,0.1)', fill: '+1', tension: 0.4, pointRadius: 0 },
      { label: 'Lower CI', data: lo,   borderColor: 'transparent', fill: false, tension: 0.4, pointRadius: 0 },
      { label: 'AI Forecast', data: fc, borderColor: '#4d9fff', backgroundColor: 'rgba(77,159,255,0.05)', fill: false, tension: 0.4, borderWidth: 2.5, pointBackgroundColor: '#4d9fff', pointRadius: 5, pointHoverRadius: 8 },
      { label: 'Baseline (no AI)', data: base, borderColor: 'rgba(248,113,113,0.4)', borderDash: [6,4], fill: false, borderWidth: 1.5, pointRadius: 0 },
      { label: 'Hist. Avg', data: hist, borderColor: 'rgba(255,255,255,0.1)', borderDash: [3,3], fill: false, tension: 0.3, borderWidth: 1, pointRadius: 0 },
    ];

  } else if (mode === 'hourly') {
    labels = fcData.hourly.map(h => `${String(h.hour).padStart(2,'0')}:00`);
    const hf   = fcData.hourly.map(h => h.predicted_kl);
    const hup  = hf.map(v => +(v * 1.08).toFixed(2));
    const hlo  = hf.map(v => +(v * 0.92).toFixed(2));
    const base = hf.map(() => 21);
    datasets = [
      { label: 'Upper CI', data: hup, borderColor: 'transparent', backgroundColor: 'rgba(77,159,255,0.1)', fill: '+1', tension: 0.4, pointRadius: 0 },
      { label: 'Lower CI', data: hlo, borderColor: 'transparent', fill: false, tension: 0.4, pointRadius: 0 },
      { label: 'Hourly Forecast', data: hf, borderColor: '#4d9fff', fill: false, tension: 0.4, borderWidth: 2, pointBackgroundColor: '#4d9fff', pointRadius: 3, pointHoverRadius: 6 },
      { label: 'Avg Baseline', data: base, borderColor: 'rgba(248,113,113,0.35)', borderDash: [5,4], fill: false, borderWidth: 1.5, pointRadius: 0 },
      { label: 'Prev Day', data: hf.map(v => +(v * 0.94).toFixed(2)), borderColor: 'rgba(255,255,255,0.1)', borderDash: [3,3], fill: false, tension: 0.3, borderWidth: 1, pointRadius: 0 },
    ];

  } else { // realvspred
    labels = fcData.daily.map(d => d.day);
    const pred = fcData.daily.map(d => d.predicted_kl);
    const act  = pred.map(v => +(v * (0.94 + Math.random() * 0.12)).toFixed(1));
    const up   = pred.map(v => +(v * 1.05).toFixed(1));
    const lo   = pred.map(v => +(v * 0.95).toFixed(1));
    datasets = [
      { label: 'Upper CI', data: up,  borderColor: 'transparent', backgroundColor: 'rgba(77,159,255,0.08)', fill: '+1', tension: 0.4, pointRadius: 0 },
      { label: 'Lower CI', data: lo,  borderColor: 'transparent', fill: false, tension: 0.4, pointRadius: 0 },
      { label: 'ML Predicted', data: pred, borderColor: '#4d9fff', fill: false, tension: 0.4, borderWidth: 2.5, pointBackgroundColor: '#4d9fff', pointRadius: 4, pointHoverRadius: 7 },
      { label: 'Actual',       data: act,  borderColor: '#34d399', borderDash: [4,3], fill: false, tension: 0.4, borderWidth: 2, pointBackgroundColor: '#34d399', pointRadius: 4 },
    ];
  }

  const filterLabels = item => !['Upper CI','Lower CI'].includes(item.text);

  fcChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { ...CHART_DEFAULTS.plugins.legend, labels: { ...CHART_DEFAULTS.plugins.legend.labels, filter: filterLabels } },
      },
    },
  });
}

/* ── TAB SWITCH ── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#fc-tabs .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#fc-tabs .tab').forEach(t => t.classList.remove('on'));
      btn.classList.add('on');
      if (fcData) buildChart(btn.dataset.mode);
    });
  });

  // Zone tabs
  document.querySelectorAll('#zone-tabs .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#zone-tabs .tab').forEach(t => t.classList.remove('on'));
      btn.classList.add('on');
    });
  });
});

/* ── HISTORICAL CHART ── */
function loadHistChart() {
  const canvas = document.getElementById('histChart');
  if (!canvas) return;
  const m30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(2026, 2, 20);
    d.setDate(d.getDate() - 29 + i);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: m30,
      datasets: [
        { label: 'Hostels',  data: m30.map(() => +(500 + Math.random()*200).toFixed(0)), backgroundColor: 'rgba(77,159,255,0.65)',  stack: 's' },
        { label: 'Academic', data: m30.map(() => +(250 + Math.random()*100).toFixed(0)), backgroundColor: 'rgba(167,139,250,0.65)', stack: 's' },
        { label: 'Canteen',  data: m30.map(() => +(150 + Math.random()*60).toFixed(0)),  backgroundColor: 'rgba(251,191,36,0.65)',  stack: 's' },
        { label: 'Gardens',  data: m30.map(() => +(180 + Math.random()*120).toFixed(0)), backgroundColor: 'rgba(52,211,153,0.55)',  stack: 's' },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, stacked: true, ticks: { ...CHART_DEFAULTS.scales.x.ticks, maxTicksLimit: 8, maxRotation: 0 } },
        y: { ...CHART_DEFAULTS.scales.y, stacked: true },
      },
    },
  });
}

/* ── ACCURACY CHART ── */
function loadAccChart() {
  const canvas = document.getElementById('accChart');
  if (!canvas) return;
  const days = Array.from({ length: 14 }, (_, i) => `D-${13-i}`);
  const pred = days.map(() => +(1600 + Math.random()*400).toFixed(0));
  const act  = pred.map(v => +(v * (0.94 + Math.random()*0.12)).toFixed(0));
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        { label: 'Predicted', data: pred, borderColor: '#4d9fff', fill: false, tension: 0.4, borderWidth: 2, pointRadius: 2 },
        { label: 'Actual',    data: act,  borderColor: '#34d399', fill: false, tension: 0.4, borderWidth: 2, pointRadius: 2, borderDash: [4,3] },
      ],
    },
    options: CHART_DEFAULTS,
  });
}

/* ════════════════════════════════════════════════════
   SCENARIO SIMULATOR
════════════════════════════════════════════════════ */
function bindSimInputs() {
  const inputs = {
    temp: document.getElementById('ss-temp'),
    rain: document.getElementById('ss-rain'),
    occ:  document.getElementById('ss-occ'),
    day:  document.getElementById('ss-day'),
  };
  if (!inputs.temp) return;
  Object.values(inputs).forEach(el => el.addEventListener('input', updateSim));
  updateSim();
}

window.updateSim = function() {
  const temp = +(document.getElementById('ss-temp')?.value || 34);
  const rain = +(document.getElementById('ss-rain')?.value || 0);
  const occ  = +(document.getElementById('ss-occ')?.value  || 85);
  const day  = +(document.getElementById('ss-day')?.value  || 0);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('sv-temp', temp + '°C');
  set('sv-rain', rain + ' mm');
  set('sv-occ',  occ + '%');
  set('sv-day',  DAY_TYPES[day]);

  const tempFx = (temp - SIM_BASE.temp) * 0.008 * BASE_DEMAND;
  const rainFx = rain > 5 ? -(rain * 2.8) : 0;
  const occFx  = (occ - SIM_BASE.occ) / 100 * BASE_DEMAND * 0.85;
  const dayFx  = day === 1 ? -BASE_DEMAND * 0.12 : day === 2 ? -BASE_DEMAND * 0.28 : 0;
  const delta  = tempFx + rainFx + occFx + dayFx;

  const newDemand  = Math.max(800, Math.round(BASE_DEMAND + delta));
  const pctChange  = ((delta / BASE_DEMAND) * 100).toFixed(1);
  const changed    = Math.abs(delta) > 20;

  set('sim-demand', newDemand.toLocaleString('en-IN'));

  const dEl = document.getElementById('sim-delta');
  if (dEl) {
    dEl.textContent = changed
      ? `${delta > 0 ? '↑ Higher' : '↓ Lower'} than baseline (${delta > 0 ? '+' : ''}${pctChange}% · ${delta > 0 ? '+' : ''}${Math.round(delta)} kL)`
      : 'Baseline scenario — minimal deviation';
    dEl.style.color = changed ? (delta > 0 ? 'var(--red)' : 'var(--green)') : 'var(--text3)';
  }

  const resEl = document.getElementById('sim-result');
  if (resEl) resEl.className = `sim-result${changed ? ' changed' : ''}`;

  const badges = [];
  if (tempFx >  50) badges.push({ t: '↑ Heat surge',      c: 'sb-up' });
  if (tempFx < -50) badges.push({ t: '↓ Cool weather',    c: 'sb-dn' });
  if (rainFx < -20) badges.push({ t: '↓ Rain discount',   c: 'sb-dn' });
  if (occFx  >  80) badges.push({ t: '↑ High occupancy',  c: 'sb-up' });
  if (occFx  < -80) badges.push({ t: '↓ Low occupancy',   c: 'sb-dn' });
  if (dayFx  < -100) badges.push({ t: DAY_TYPES[day] + ' mode', c: 'sb-n' });
  const bEl = document.getElementById('sim-badges');
  if (bEl) bEl.innerHTML = badges.map(b => `<span class="sim-badge ${b.c}">${b.t}</span>`).join('');

  const reasons = [];
  if (Math.abs(tempFx) > 10) reasons.push(`<strong>Temp ${temp}°C</strong>: ${tempFx > 0 ? '+' : ''}<strong>${Math.round(tempFx)} kL</strong> (${temp > 34 ? 'above avg → more cooling demand' : 'below avg → reduced demand'})`);
  if (rainFx < -10) reasons.push(`<strong>Rainfall ${rain}mm</strong>: <strong>${Math.round(rainFx)} kL</strong> (garden irrigation auto-reduced by model)`);
  if (Math.abs(occFx) > 20) reasons.push(`<strong>Occupancy ${occ}%</strong>: ${occFx > 0 ? '+' : ''}<strong>${Math.round(occFx)} kL</strong> (${occ > 85 ? 'above' : 'below'} baseline occupancy)`);
  if (dayFx !== 0) reasons.push(`<strong>${DAY_TYPES[day]}</strong>: <strong>${Math.round(dayFx)} kL</strong> (reduced academic + canteen load)`);

  const rEl = document.getElementById('sim-reasoning');
  if (rEl) rEl.innerHTML = reasons.length
    ? `<strong>ML Reasoning:</strong><br>${reasons.join(' · ')}.`
    : `<strong>ML Reasoning:</strong><br>Current conditions match baseline. No significant demand drivers detected.`;
};

window.resetSim = function() {
  ['ss-temp','ss-rain','ss-occ','ss-day'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.value = [34, 0, 85, 0][i];
  });
  updateSim();
  toast('info', 'Simulator reset', 'Restored to current conditions');
};

/* ── INIT ── */
(async function() {
  await loadForecastChart();
  loadHistChart();
  loadAccChart();
  bindSimInputs();
})();
