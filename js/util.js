// Small shared helpers: time/value formatting, date math, misc.

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse "m:ss", "h:mm:ss" or plain seconds into seconds. Returns NaN on bad input. */
export function parseTime(str) {
  if (typeof str === 'number') return str;
  if (str == null) return NaN;
  const s = String(str).trim();
  if (!s) return NaN;
  if (!s.includes(':')) return Number(s);
  const parts = s.split(':').map((p) => p.trim());
  if (parts.some((p) => p === '' || isNaN(Number(p)))) return NaN;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

/** Format seconds as m:ss (or h:mm:ss when >= 1 hour). */
export function formatTime(totalSeconds) {
  if (totalSeconds == null || isNaN(totalSeconds)) return '—';
  const sec = Math.round(totalSeconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/** Format an event value according to its unit. */
export function formatValue(event, value) {
  if (value == null || isNaN(value)) return '—';
  switch (event.unit) {
    case 'time':
      return formatTime(value);
    case 'lb':
      return `${Math.round(value)} lb`;
    case 'reps':
      return `${Math.round(value)} reps`;
    case 'ratio':
      return Number(value).toFixed(2);
    default:
      return String(value);
  }
}

/** Parse user input for an event into a numeric value. */
export function parseValue(event, input) {
  if (event.unit === 'time') return parseTime(input);
  const n = Number(String(input).trim());
  return isNaN(n) || String(input).trim() === '' ? NaN : n;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** ISO date string (YYYY-MM-DD) in local time. */
export function isoDate(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local-time Date at midnight. */
export function fromIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function daysBetween(isoA, isoB) {
  return Math.round((fromIso(isoB) - fromIso(isoA)) / DAY_MS);
}

export function weekday(iso) {
  return fromIso(iso).getDay(); // 0 = Sunday
}

export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function prettyDate(iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return fromIso(iso).toLocaleDateString(undefined, opts);
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function roundTo(v, step) {
  return Math.round(v / step) * step;
}
