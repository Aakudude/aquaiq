/* ════════════════════════════════════════════════════
   tanks.js — Tank monitoring page logic
════════════════════════════════════════════════════ */

let TANKS = [];
let TANK_DEFAULTS = [];
let tankBarChart = null;

/* ── COLOR HELPER ── */
function tankColor(pct, base) {
  return pct < 30 ? '#f87171' : pct < 50 ? '#fbbf24' : base;
}

/* ── LOAD ── */
async function loadTanks() {
  const data = await fetch('/api/tanks').then(r => r.json());
  TANKS = data.map(t => ({ ...t, pct: t.current_pct }));
  TANK_DEFAULTS = TANKS.map(t => t.pct);
  renderAllTanks();
  renderBarChart();
  renderDepletion();
}

/* ── SUMMARY BAR ── */
function updateSummary() {
  const avg  = Math.round(TANKS.reduce((s, t) => s + t.pct, 0) / TANKS.length);
  const tot  = TANKS.reduce((s, t) => s + Math.round(t.capacity_kl * t.pct / 100), 0);
  const low  = TANKS.filter(t => t.pct < 50 && t.pct >= 30).length;
  const crit = TANKS.filter(t => t.pct < 30).length;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('avg-fill',    avg + '%');
  set('total-stored', tot);
  set('tanks-low',   low);
  set('tanks-crit',  crit);

  const kv = document.getElementById('kv-tank');
  if (kv) kv.textContent = avg + '%';
}

/* ── RENDER ALL TANK CARDS ── */
function renderAllTanks() {
  const el = document.getElementById('tank-cards-grid');
  el.innerHTML = TANKS.map(t => renderTankCard(t)).join('');
  updateSummary();
  renderTankAlerts();
}

function renderTankCard(t) {
  const pct  = t.pct;
  const col  = tankColor(pct, t.color);
  const vol  = Math.round(t.capacity_kl * pct / 100);
  const sc   = pct < 30 ? 'crit' : pct < 50 ? 'warn' : 'ok';
  const cc   = pct < 30 ? 'crit' : pct < 50 ? 'warn' : '';
  const msg  = pct < 30 ? '🚨 CRITICAL — Activate pump immediately' : pct < 50 ? '⚠ LOW — Schedule fill during off-peak (21:00–05:00)' : '';

  return `<div class="tank-card ${cc}" id="tc-${t.id}">
    <div class="tank-card-head">
      <div>
        <div class="tc-name">${t.name}</div>
        <div class="tc-loc">${t.location} · ${t.capacity_kl}kL cap</div>
      </div>
      <div class="tc-pct" id="tp-${t.id}" style="color:${col}">${pct}%</div>
    </div>
    <div class="tank-tube">
      <div class="tank-fill" id="tf-${t.id}" style="height:${pct}%;background:${col}30">
        <div class="tank-wave" style="background:${col}50"></div>
      </div>
    </div>
    <div class="tc-vol" id="tv-${t.id}">${vol} / ${t.capacity_kl} kL stored</div>
    <input type="range" min="0" max="100" value="${pct}" step="1"
      class="tslider ${sc}" id="ts-${t.id}"
      oninput="updateTank(${t.id}, +this.value)">
    <div class="tank-msg ${cc} ${msg ? 'show' : ''}" id="ta-${t.id}">${msg}</div>
  </div>`;
}

/* ── LIVE SLIDER UPDATE ── */
window.updateTank = function(id, pct) {
  const t    = TANKS.find(x => x.id === id);
  if (!t) return;
  const prev = t.pct;
  t.pct = pct;

  const col = tankColor(pct, t.color);
  const vol = Math.round(t.capacity_kl * pct / 100);

  // Update fill visuals
  const tf = document.getElementById(`tf-${id}`);
  if (tf) tf.style.cssText = `height:${pct}%;background:${col}30`;
  const tp = document.getElementById(`tp-${id}`);
  if (tp) { tp.style.color = col; tp.textContent = pct + '%'; }
  const tv = document.getElementById(`tv-${id}`);
  if (tv) tv.textContent = `${vol} / ${t.capacity_kl} kL stored`;

  // Update slider class
  const sc = pct < 30 ? 'crit' : pct < 50 ? 'warn' : 'ok';
  const ts = document.getElementById(`ts-${id}`);
  if (ts) ts.className = `tslider ${sc}`;

  // Update card border
  const card = document.getElementById(`tc-${id}`);
  if (card) card.className = `tank-card ${pct < 30 ? 'crit' : pct < 50 ? 'warn' : ''}`;

  // Update alert msg
  const ta = document.getElementById(`ta-${id}`);
  if (ta) {
    if (pct < 30) {
      ta.className = 'tank-msg crit show';
      ta.textContent = '🚨 CRITICAL — Activate pump immediately';
      if (prev >= 30) toast('danger', `${t.name} CRITICAL`, `${pct}% — only ${vol}kL left!`);
    } else if (pct < 50) {
      ta.className = 'tank-msg warn show';
      ta.textContent = '⚠ LOW — Schedule fill during off-peak (21:00–05:00)';
      if (prev >= 50) toast('warn', `${t.name} running low`, `${pct}% — schedule a fill soon`);
    } else {
      ta.className = 'tank-msg';
      ta.textContent = '';
    }
  }

  if (pct >= 95 && prev < 95) toast('success', `${t.name} nearly full`, `${pct}% — consider stopping fill pump`);

  updateSummary();
  updateBarChart();
  renderDepletion();
  renderTankAlerts();
};

/* ── RESET ── */
window.resetTanks = function() {
  TANKS.forEach((t, i) => { t.pct = TANK_DEFAULTS[i]; });
  renderAllTanks();
  renderBarChart();
  renderDepletion();
  toast('info', 'Tank levels reset', 'Restored to last sensor readings');
};

/* ── BAR CHART ── */
function renderBarChart() {
  const canvas = document.getElementById('tankBarChart');
  if (!canvas) return;
  if (tankBarChart) tankBarChart.destroy();

  tankBarChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: TANKS.map(t => t.name),
      datasets: [
        {
          label: 'Current Fill %',
          data: TANKS.map(t => t.pct),
          backgroundColor: TANKS.map(t => tankColor(t.pct, t.color) + 'bb'),
          borderColor:     TANKS.map(t => tankColor(t.pct, t.color)),
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Remaining capacity',
          data: TANKS.map(t => 100 - t.pct),
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 0,
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: 'y',
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, max: 100, stacked: true, ticks: { ...CHART_DEFAULTS.scales.x.ticks, callback: v => v + '%' } },
        y: { ...CHART_DEFAULTS.scales.y, stacked: true },
      },
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
    },
  });
}

function updateBarChart() {
  if (!tankBarChart) return;
  tankBarChart.data.datasets[0].data            = TANKS.map(t => t.pct);
  tankBarChart.data.datasets[0].backgroundColor = TANKS.map(t => tankColor(t.pct, t.color) + 'bb');
  tankBarChart.data.datasets[0].borderColor     = TANKS.map(t => tankColor(t.pct, t.color));
  tankBarChart.data.datasets[1].data            = TANKS.map(t => 100 - t.pct);
  tankBarChart.update();
}

/* ── DEPLETION FORECAST ── */
// Estimate hours until <30% at avg campus demand (580 kL/day total / 4 tanks ≈ 6 kL/hr per tank)
function renderDepletion() {
  const el = document.getElementById('depletion-list');
  if (!el) return;

  const HOURLY_DEMAND_KL = [0, 0, 0, 0, 0.5, 1.5, 3.5, 4.5, 3.8, 2.5, 2, 2, 2.2, 2, 1.8, 1.8, 2.5, 3.5, 2.5, 1.8, 1.2, 0.8, 0.4, 0.1];
  const avgHourly = HOURLY_DEMAND_KL.reduce((s, v) => s + v, 0) / 24;

  el.innerHTML = TANKS.map(t => {
    const stored = Math.round(t.capacity_kl * t.pct / 100);
    const safe   = Math.round(t.capacity_kl * 0.30);
    const usable = Math.max(0, stored - safe);
    // each tank handles proportional share based on capacity
    const share  = t.capacity_kl / TANKS.reduce((s, x) => s + x.capacity_kl, 0);
    const hrRate = avgHourly * share;
    const hrs    = hrRate > 0 ? Math.round(usable / hrRate) : 999;

    const col  = hrs < 8 ? 'var(--red)' : hrs < 24 ? 'var(--amber)' : 'var(--green)';
    const note = hrs < 8 ? '🚨 Urgent' : hrs < 24 ? '⚠ Fill today' : '✓ OK';

    return `<div class="dep-item">
      <div>
        <div class="dep-name">${t.name}</div>
        <div class="dep-lbl">${t.pct}% full · ${Math.round(t.capacity_kl * t.pct / 100)}kL stored</div>
      </div>
      <div style="text-align:right">
        <div class="dep-hrs" style="color:${col}">${hrs < 999 ? hrs + 'h' : '∞'}</div>
        <div class="dep-lbl">${note}</div>
      </div>
    </div>`;
  }).join('');
}

/* ── TANK-SPECIFIC ALERTS ── */
function renderTankAlerts() {
  const alerts = [];
  TANKS.forEach(t => {
    if (t.pct < 30) {
      alerts.push({ type: 'danger', icon: '🚨', title: `${t.name} CRITICAL — ${t.pct}%`, body: `Only ${Math.round(t.capacity_kl * t.pct / 100)}kL remaining. Activate pump immediately.` });
    } else if (t.pct < 50) {
      alerts.push({ type: 'warn', icon: '⚠️', title: `${t.name} LOW — ${t.pct}%`, body: `Schedule fill in tonight's off-peak window (21:00–05:00) to avoid disruption.` });
    }
  });

  const el    = document.getElementById('tank-alert-list');
  const badge = document.getElementById('tank-alert-count');
  if (badge) badge.textContent = alerts.length;
  if (!el) return;

  el.innerHTML = alerts.length
    ? alerts.map(a => `<div class="alert-item ${a.type}">
        <span class="alert-icon">${a.icon}</span>
        <div><div class="alert-title">${a.title}</div><div class="alert-body">${a.body}</div></div>
      </div>`).join('')
    : '<div class="empty-state">✓ No alerts — all tanks nominal</div>';
}

/* ── INIT ── */
(async function() {
  await loadTanks();
  toast('info', 'Tank Monitor', 'Drag sliders to simulate fill levels');
})();
