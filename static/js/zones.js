/* ════════════════════════════════════════════════════
   zones.js — Zone insights page logic
════════════════════════════════════════════════════ */

let ZONES = [];
let zoneChart = null;

/* ── LOAD ── */
async function loadZones() {
  ZONES = await fetch('/api/zones').then(r => r.json());
  renderZoneCards();
  renderZoneTable();
  buildZoneChart('bar');
  renderZoneHistChart();
}

/* ── ZONE SUMMARY CARDS ── */
function renderZoneCards() {
  const el  = document.getElementById('zone-card-strip');
  const tot = ZONES.reduce((s, z) => s + z.demand_kl, 0);
  el.innerHTML = ZONES.map(z => {
    const d    = z.demand_kl - z.prev_kl;
    const dStr = d > 0
      ? `<span style="color:var(--red)">+${d} kL</span>`
      : `<span style="color:var(--green)">${d} kL</span>`;
    const share = ((z.demand_kl / tot) * 100).toFixed(0);
    return `<div class="zone-kpi" style="--accent:${z.color}">
      <div class="zk-name">${z.zone}</div>
      <div class="zk-val" style="color:${z.color}">${z.demand_kl}</div>
      <div class="zk-unit">kL forecast</div>
      <div class="zk-delta">${dStr} vs yesterday · ${share}% share</div>
    </div>`;
  }).join('');
}

/* ── ZONE TABLE ── */
function renderZoneTable() {
  const maxD = Math.max(...ZONES.map(z => z.demand_kl));
  const tbody = document.querySelector('#zone-table tbody');
  if (!tbody) return;
  tbody.innerHTML = ZONES.map(z => {
    const d   = z.demand_kl - z.prev_kl;
    const pct = Math.round((z.demand_kl / maxD) * 100);
    const dStr = d > 0
      ? `<span style="color:var(--red)">+${d}</span>`
      : `<span style="color:var(--green)">${d}</span>`;
    return `<tr>
      <td><span class="zdot" style="background:${z.color}"></span>${z.zone}</td>
      <td style="font-family:var(--fm);font-weight:600">${z.demand_kl}</td>
      <td style="font-family:var(--fm)">${dStr}</td>
      <td><div class="bbar-wrap">
        <div class="bbar-bg"><div class="bbar-fill" style="width:${pct}%;background:${z.color}"></div></div>
        <div class="bbar-val">${pct}%</div>
      </div></td>
    </tr>`;
  }).join('');
}

/* ── ZONE MAIN CHART ── */
function buildZoneChart(mode) {
  const canvas = document.getElementById('zoneChart');
  if (!canvas) return;
  if (zoneChart) zoneChart.destroy();

  if (mode === 'pie') {
    zoneChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ZONES.map(z => z.zone),
        datasets: [{
          data:            ZONES.map(z => z.demand_kl),
          backgroundColor: ZONES.map(z => z.color + 'bb'),
          borderColor:     ZONES.map(z => z.color),
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
        cutout: '60%',
        animation: { duration: 600 },
      },
    });
    return;
  }

  // 7-day trend data
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const datasets = mode === 'line'
    ? ZONES.map(z => ({
        label: z.zone,
        data:  days.map(() => Math.round(z.demand_kl * (0.8 + Math.random() * 0.4))),
        borderColor: z.color,
        backgroundColor: z.color + '22',
        fill: false,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
      }))
    : ZONES.map(z => ({
        label: z.zone,
        data:  days.map(() => Math.round(z.demand_kl * (0.85 + Math.random() * 0.3))),
        backgroundColor: z.color + 'aa',
        borderColor: z.color,
        borderWidth: 1,
        borderRadius: 3,
      }));

  zoneChart = new Chart(canvas, {
    type: mode === 'line' ? 'line' : 'bar',
    data: { labels: days, datasets },
    options: CHART_DEFAULTS,
  });
}

/* ── ZONE HISTORICAL STACKED ── */
function renderZoneHistChart() {
  const canvas = document.getElementById('zoneHistChart');
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
      datasets: ZONES.map(z => ({
        label: z.zone,
        data:  m30.map(() => Math.round(z.demand_kl * (0.8 + Math.random() * 0.4))),
        backgroundColor: z.color + 'aa',
        stack: 's',
      })),
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

/* ── TAB SWITCH ── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#zone-tabs .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#zone-tabs .tab').forEach(t => t.classList.remove('on'));
      btn.classList.add('on');
      buildZoneChart(btn.dataset.mode);
    });
  });
});

/* ── INIT ── */
(async function() {
  await loadZones();
})();
