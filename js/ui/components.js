// Shared HTML-building helpers for the views.

import { escapeHtml as h, formatValue, formatTime, prettyDate } from '../util.js';

export { h };

const INTENSITY_LABEL = {
  rest: 'Rest',
  recovery: 'Recovery',
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  test: 'Test',
};

export function intensityBadge(intensity) {
  return `<span class="badge badge-${intensity}">${INTENSITY_LABEL[intensity] || intensity}</span>`;
}

export function messages(list = []) {
  if (!list.length) return '';
  return `<div class="msgs">${list.map((m) => `<div class="msg msg-${m.level}">${h(m.text)}</div>`).join('')}</div>`;
}

export function sessionBody(s) {
  const list = (title, items) =>
    items?.length ? `<div class="block"><div class="block-title">${h(title)}</div><ul>${items.map((i) => `<li>${h(i)}</li>`).join('')}</ul></div>` : '';
  return `
    ${messages(s.notes)}
    ${s.warmup ? list('Warm-up', s.warmup) : ''}
    ${s.blocks.map((b) => list(b.title, b.items)).join('')}
    ${s.cooldown ? list('Cool-down', s.cooldown) : ''}
  `;
}

export function sessionCard(s, { open = false, today = false } = {}) {
  const meta = [intensityBadge(s.intensity), s.minutes ? `<span class="muted">~${s.minutes} min</span>` : '', s.adapted ? '<span class="badge badge-adapted">Adapted</span>' : '']
    .filter(Boolean)
    .join(' ');
  return `
    <details class="card session ${today ? 'session-today' : ''}" ${open ? 'open' : ''}>
      <summary>
        <div class="session-head">
          <div>
            <div class="session-date">${today ? 'Today · ' : ''}${h(prettyDate(s.date))}</div>
            <div class="session-title">${h(s.title)}</div>
          </div>
          <div class="session-meta">${meta}</div>
        </div>
      </summary>
      ${sessionBody(s)}
    </details>`;
}

export function inputPlaceholder(event) {
  if (event.unit === 'time') return (event.distanceMi || 0) >= 4 ? 'h:mm:ss' : 'm:ss';
  if (event.unit === 'lb') return 'lb';
  if (event.unit === 'ratio') return '0.48';
  return 'reps';
}

export function inputMode(event) {
  if (event.unit === 'time') return 'text';
  if (event.unit === 'ratio') return 'decimal';
  return 'numeric';
}

export function formatForInput(event, value) {
  if (value == null || isNaN(value)) return '';
  if (event.unit === 'time') return formatTime(value);
  if (event.unit === 'ratio') return Number(value).toFixed(2);
  return String(Math.round(value));
}

export function fmt(event, value) {
  return formatValue(event, value);
}

/** Horizontal bar: current points vs minimum and target markers. */
export function scoreBar({ pts, minPts, targetPts, maxPts }) {
  const pct = (x) => Math.max(0, Math.min(100, (x / maxPts) * 100));
  const cls = pts == null ? 'none' : pts >= targetPts ? 'good' : pts >= minPts ? 'ok' : 'low';
  return `
    <div class="bar" role="img" aria-label="${pts ?? 0} of ${maxPts} points">
      <div class="bar-fill bar-${cls}" style="width:${pct(pts ?? 0)}%"></div>
      <div class="bar-mark bar-min" style="left:${pct(minPts)}%" title="Minimum"></div>
      <div class="bar-mark bar-target" style="left:${pct(targetPts)}%" title="Target"></div>
    </div>`;
}

/** Tiny SVG sparkline. `better` flips the y-axis so "up" always means improving. */
export function sparkline(values, better = 'higher') {
  if (values.length < 2) return '';
  const w = 120;
  const hgt = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 4) + 2;
    let y = ((v - min) / span) * (hgt - 6) + 3;
    if (better === 'higher') y = hgt - y;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `<svg class="spark" viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}" aria-hidden="true"><polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function ring(value, max, label) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, value / max));
  const cls = frac >= 0.75 ? 'good' : frac >= 0.5 ? 'ok' : 'low';
  return `
    <div class="ring ring-${cls}">
      <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
        <circle cx="40" cy="40" r="${r}" class="ring-bg"/>
        <circle cx="40" cy="40" r="${r}" class="ring-fg" stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 40 40)"/>
      </svg>
      <div class="ring-text"><strong>${Math.round(value)}</strong><span>${h(label)}</span></div>
    </div>`;
}

export function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2600);
}
