/* ════════════════════════════════════════════════════
   pumps.js — Pump control page logic
════════════════════════════════════════════════════ */

let PUMPS = [];

/* ── TARIFF INFO BAR ── */
function updateTariffBar() {
  const t = getTariff();
  const titleEl = document.getElementById('ib-tariff-title');
  const subEl   = document.getElementById('ib-tariff-sub');
  if (titleEl) titleEl.textContent = `${t.label} — ₹${t.rate}/kWh`;
  if (subEl)   subEl.textContent   = t.tier === 'peak'
    ? '⚠ Avoid running non-essential pumps now — highest rate window'
    : t.tier === 'offpeak'
    ? '✓ Best window for bulk fills — lowest tariff rate now'
    : 'Standard rate window — monitor demand vs. need';
}

/* ── LOAD PUMPS ── */
async function loadPumps() {
  const data = await fetch('/api/pumps').then(r => r.json());
  PUMPS = data.map(p => ({ ...p, isOn: p.ai_on }));
  renderPumps();
  renderTimeline();
}

/* ── RENDER PUMP LIST ── */
function renderPumps() {
  const now = (new Date().getHours() + new Date().getMinutes() / 60) / 24;
  const el  = document.getElementById('pump-list');
  const t   = getTariff();

  el.innerHTML = PUMPS.map(p => {
    const [startStr, endStr] = p.schedule.split('–');
    const toFrac = s => { const [h, m] = s.split(':').map(Number); return (h + m / 60) / 24; };
    const s = toFrac(startStr), e = toFrac(endStr);
    const done   = now > e;
    const dotCls = p.isOn ? 'run' : (done ? 'done' : 'sched');
    const tariffCls = p.tariff === 'peak' ? 'peak' : p.tariff === 'offpeak' ? 'off' : 'std';
    const tariffLabel = p.tariff === 'peak' ? 'Peak' : p.tariff === 'offpeak' ? 'Off-Peak' : 'Standard';

    return `<div class="pump-row ${p.isOn ? 'on' : ''} ${p.isOn && p.tariff === 'peak' ? 'pk-warn' : ''}" id="pr-${p.id}">
      <div class="pdot ${dotCls}"></div>
      <div>
        <div class="pname">${p.name}</div>
        <div class="ptime">${p.schedule}</div>
      </div>
      <span class="ptag ${tariffCls}">${tariffLabel}</span>
      <span class="pkw ${p.isOn ? 'run' : ''}" id="pkw-${p.id}">${p.isOn ? p.kw + ' kW' : '— kW'}</span>
      <label class="toggle" title="Toggle ${p.name}">
        <input type="checkbox" ${p.isOn ? 'checked' : ''} onchange="togglePump(${p.id}, this.checked)">
        <div class="ttrack"></div>
      </label>
    </div>`;
  }).join('');

  updatePowerSummary();
  updatePumpCountBadge();
  updateAiRec();
}

/* ── TOGGLE ── */
window.togglePump = function(id, on) {
  const p = PUMPS.find(x => x.id === id);
  if (!p) return;
  p.isOn = on;
  const t = getTariff();

  if (on && t.tier === 'peak') {
    toast('warn', `${p.name} — Peak Tariff Warning`, `Running at ₹${t.rate}/kWh · costs ₹${(p.kw * t.rate).toFixed(2)}/hr`);
  } else if (on) {
    toast('success', `${p.name} activated`, `${p.kw} kW · ${t.label}`);
  } else {
    toast('info', `${p.name} OFF`, `Est. saving: ${(p.kw * 0.5).toFixed(1)} kWh`);
  }
  renderPumps();
};

/* ── RESET ── */
window.resetPumps = function() {
  PUMPS.forEach(p => { p.isOn = p.ai_on; });
  renderPumps();
  toast('info', 'AI Schedule Restored', 'All manual overrides cleared');
};

/* ── POWER SUMMARY ── */
function updatePowerSummary() {
  const t    = getTariff();
  const kw   = PUMPS.filter(p => p.isOn).reduce((s, p) => s + p.kw, 0);
  const cost = (kw * t.rate).toFixed(2);

  const kwEl = document.getElementById('total-kw');
  if (kwEl) { kwEl.textContent = kw + ' kW'; kwEl.className = `pd-value${kw > 25 ? ' high' : ''}`; }
  const ceEl = document.getElementById('cost-hr');   if (ceEl) ceEl.textContent = '₹' + cost;
  const reEl = document.getElementById('rate-now');  if (reEl) reEl.textContent = `₹${t.rate}/kWh`;
  const ruEl = document.getElementById('pumps-running'); if (ruEl) ruEl.textContent = PUMPS.filter(p => p.isOn).length;
}

function updatePumpCountBadge() {
  const on  = PUMPS.filter(p => p.isOn).length;
  const el  = document.getElementById('pump-count-badge');
  if (el) el.textContent = `${on}/${PUMPS.length} running`;
}

function updateAiRec() {
  const t = getTariff();
  const el = document.getElementById('ai-rec-text');
  if (!el) return;
  const recs = {
    peak:     'Peak tariff active (₹9.5/kWh). Defer filling non-critical tanks until 22:00. Turn off Main Booster and Canteen Supply to save ₹47/hr.',
    offpeak:  'Off-peak window active (₹4.8/kWh). Ideal for bulk fills. AI recommends running Hostel B pump now to pre-fill before morning demand.',
    standard: 'Standard tariff (₹7.2/kWh). Maintain current AI schedule. Monitor Canteen OHT — at 48%, consider scheduling a fill before peak hours.',
  };
  el.textContent = recs[t.tier];
}

/* ── TIMELINE ── */
function renderTimeline() {
  const el = document.getElementById('pump-timeline');
  if (!el) return;
  el.innerHTML = PUMPS.map(p => {
    const tariffCls = p.tariff === 'peak' ? 'peak' : p.tariff === 'offpeak' ? 'off' : 'std';
    const [s, e]    = p.schedule.split('–');
    const toH = str => { const [h, m] = str.split(':').map(Number); return h + m / 60; };
    const pct = ((toH(e) - toH(s)) / 24 * 100).toFixed(1);
    return `<div class="tl-item">
      <span class="tl-name">${p.name}</span>
      <div class="tl-bar-bg"><div class="tl-bar ${tariffCls}" style="width:${pct}%"></div></div>
      <span class="tl-time">${p.schedule}</span>
    </div>`;
  }).join('');
}

/* ── ENERGY CHART ── */
function renderEnergyChart() {
  const hours  = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}:00`);
  const active = [0,0,0,0,0,11,11,7,7,7,0,3,0,0,0,0,0,0,4,4,0,0,7,7];
  const colors = hours.map((_, h) => {
    if ((h >= 9 && h < 12) || (h >= 18 && h < 22)) return 'rgba(248,113,113,0.7)';
    if (h >= 22 || h < 6) return 'rgba(52,211,153,0.7)';
    return 'rgba(251,191,36,0.6)';
  });
  new Chart(document.getElementById('energyChart'), {
    type: 'bar',
    data: {
      labels: hours,
      datasets: [{
        label: 'kW Load',
        data: active,
        backgroundColor: colors,
        borderRadius: 3,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
      scales: {
        ...CHART_DEFAULTS.scales,
        x: { ...CHART_DEFAULTS.scales.x, ticks: { ...CHART_DEFAULTS.scales.x.ticks, maxTicksLimit: 8 } },
      },
    },
  });
}

/* ── INIT ── */
(async function() {
  updateTariffBar();
  await loadPumps();
  renderEnergyChart();
  setInterval(updatePowerSummary, 30000);
  setInterval(updateTariffBar, 30000);
  toast('info', 'Pump Control Panel', 'Toggle switches to override AI schedule');
})();
