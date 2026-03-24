/* ════════════════════════════════════════════════════
   shared.js — AquaIQ utilities used on every page
════════════════════════════════════════════════════ */

/* ── CHART DEFAULTS ── */
window.CHART_DEFAULTS = {
  plugins: {
    legend: {
      labels: {
        color: '#3a5268',
        font: { family: 'JetBrains Mono', size: 10 },
        boxWidth: 10,
        padding: 14,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(11,16,22,0.95)',
      titleFont: { family: 'Syne', size: 12, weight: '700' },
      bodyFont:  { family: 'JetBrains Mono', size: 11 },
      titleColor: '#dde8f5',
      bodyColor:  '#6e8faa',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid:  { color: 'rgba(255,255,255,0.03)' },
      ticks: { color: '#3a5268', font: { family: 'JetBrains Mono', size: 10 } },
    },
    y: {
      grid:  { color: 'rgba(255,255,255,0.03)' },
      ticks: { color: '#3a5268', font: { family: 'JetBrains Mono', size: 10 } },
    },
  },
  animation: { duration: 700, easing: 'easeInOutQuart' },
  responsive: true,
  maintainAspectRatio: false,
};

/* ── TOAST ── */
window.toast = function(type, title, msg) {
  const icons = { success: '✅', warn: '⚠️', danger: '🚨', info: '💡', ai: '🤖' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-ico">${icons[type] || '💬'}</span>
    <div><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4300);
};

/* ── TARIFF ── */
window.getTariff = function() {
  const h = new Date().getHours();
  if ((h >= 9 && h < 12) || (h >= 18 && h < 22))
    return { tier: 'peak',    rate: 9.5, label: 'Peak Tariff',  cls: 'peak' };
  if (h >= 22 || h < 6)
    return { tier: 'offpeak', rate: 4.8, label: 'Off-Peak',     cls: 'off' };
  return   { tier: 'standard',rate: 7.2, label: 'Standard Rate', cls: 'std' };
};

/* ── SIDEBAR TARIFF WIDGET ── */
function updateSidebarTariff() {
  const t = getTariff();
  const vEl = document.getElementById('tw-value');
  const rEl = document.getElementById('tw-rate');
  if (vEl) vEl.textContent = t.label;
  if (rEl) rEl.textContent = `₹${t.rate}/kWh`;
}

/* ── CLOCK ── */
function updateClock() {
  const n = new Date();
  const D = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const M = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const p = v => String(v).padStart(2, '0');
  const el = document.getElementById('clock');
  if (el) el.textContent = `${D[n.getDay()]} ${p(n.getDate())} ${M[n.getMonth()]} · ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
}

/* ── SIDEBAR TOGGLE (mobile) ── */
window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
};

/* ── INIT ── */
updateClock();
setInterval(updateClock, 1000);
updateSidebarTariff();
setInterval(updateSidebarTariff, 30000);
