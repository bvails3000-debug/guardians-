// Local persistence. All data stays on the device: localStorage in the browser, plus Capacitor
// Preferences (UserDefaults / SharedPreferences) in the native apps, because iOS may clear WebView
// storage when the device is low on space.

import { isoDate } from './util.js';
import { plugin } from './native.js';
import { TESTS, BRANCHES } from './data/tests.js';
import { getJob } from './data/jobs.js';
import { PAIN_AREAS } from './engine/adapt.js';
import { THEMES } from './themes.js';

const KEY = 'guardians.state.v1';

export function emptyState() {
  return {
    version: 1,
    onboarded: false,
    profile: { name: '', age: null, sex: null, branch: null },
    goal: { jobId: null, testIds: [], level: 'target', customTotals: {}, choices: {} },
    schedule: { startDate: isoDate(), testDate: null, trainingDays: [1, 2, 4, 5], pool: true },
    results: [],
    diary: [],
    settings: { reminder: { enabled: false, time: '07:00' }, theme: 'auto' },
  };
}

let memoryFallback = null;

/**
 * Native apps: restore state from native storage before the first render.
 * Native storage wins because it survives WebView storage eviction.
 */
export async function hydrate() {
  const prefs = plugin('Preferences');
  if (!prefs) return;
  try {
    const { value } = await prefs.get({ key: KEY });
    if (value) {
      localStorage.setItem(KEY, value);
    } else {
      // First launch after an update that added native storage: copy existing data across.
      const local = localStorage.getItem(KEY);
      if (local) await prefs.set({ key: KEY, value: local });
    }
  } catch {
    /* fall back to localStorage */
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return memoryFallback || emptyState();
    const base = emptyState();
    const data = JSON.parse(raw);
    return { ...base, ...data, settings: { ...base.settings, ...data.settings } };
  } catch {
    return memoryFallback || emptyState();
  }
}

export function save(state) {
  memoryFallback = state;
  const json = JSON.stringify(state);
  try {
    localStorage.setItem(KEY, json);
  } catch {
    /* storage unavailable (private mode) — keep in memory */
  }
  plugin('Preferences')?.set({ key: KEY, value: json }).catch(() => {});
}

export function reset() {
  memoryFallback = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  plugin('Preferences')?.remove({ key: KEY }).catch(() => {});
}

/** Add a result; replaces an existing one for the same test/event/date. */
export function addResult(state, r) {
  state.results = state.results.filter((x) => !(x.testId === r.testId && x.eventId === r.eventId && x.date === r.date));
  state.results.push({ source: 'log', ...r });
  state.results.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function upsertDiary(state, entry) {
  state.diary = state.diary.filter((e) => e.date !== entry.date);
  state.diary.push(entry);
  state.diary.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function exportJson(state) {
  return JSON.stringify(state, null, 2);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
const str = (v, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '');
const iso = (v) => (typeof v === 'string' && ISO.test(v) ? v : null);

/** Parse a backup file, keeping only well-formed fields (the file may have been hand-edited). */
export function importJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!data || typeof data !== 'object' || !data.profile || !Array.isArray(data.results)) {
    throw new Error('That file does not look like a Guardians backup.');
  }
  const base = emptyState();
  const p = data.profile || {};
  const g = data.goal || {};
  const sc = data.schedule || {};
  const testIds = (Array.isArray(g.testIds) ? g.testIds : []).filter((id) => TESTS[id]);
  const eventOk = (testId, eventId) => TESTS[testId]?.events.some((e) => e.id === eventId);
  const choices = {};
  for (const id of testIds) {
    const c = g.choices?.[id];
    if (!c || typeof c !== 'object') continue;
    choices[id] = Object.fromEntries(Object.entries(c).filter(([grp, ev]) => TESTS[id].groups?.[grp] && eventOk(id, ev)));
  }
  const customTotals = Object.fromEntries(
    Object.entries(g.customTotals || {}).filter(([id, v]) => TESTS[id] && num(v) != null && v > 0),
  );
  const level = ['target', 'min', 'custom'].includes(g.level) ? g.level : 'target';
  const days = (Array.isArray(sc.trainingDays) ? sc.trainingDays : []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const scale = (v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);
  const state = {
    ...base,
    onboarded: !!data.onboarded && testIds.length > 0,
    profile: {
      name: str(p.name, 60),
      age: num(p.age) != null && p.age >= 17 && p.age <= 65 ? p.age : null,
      sex: p.sex === 'female' ? 'female' : p.sex === 'male' ? 'male' : null,
      branch: BRANCHES[p.branch] ? p.branch : null,
    },
    goal: { jobId: getJob(g.jobId) ? g.jobId : null, testIds, level, customTotals, choices },
    schedule: {
      startDate: iso(sc.startDate) || base.schedule.startDate,
      testDate: iso(sc.testDate),
      trainingDays: days.length >= 2 ? [...new Set(days)].sort() : base.schedule.trainingDays,
      pool: sc.pool !== false,
    },
    results: data.results
      .filter((r) => r && iso(r.date) && eventOk(r.testId, r.eventId) && num(r.value) != null)
      .map((r) => ({ date: r.date, testId: r.testId, eventId: r.eventId, value: r.value, source: str(r.source, 20) })),
    diary: (Array.isArray(data.diary) ? data.diary : [])
      .filter((e) => e && iso(e.date))
      .map((e) => ({
        date: e.date,
        completion: ['full', 'partial', 'skipped', 'rest'].includes(e.completion) ? e.completion : 'full',
        rpe: Number.isInteger(e.rpe) && e.rpe >= 1 && e.rpe <= 10 ? e.rpe : null,
        energy: scale(e.energy),
        sleep: scale(e.sleep),
        soreness: scale(e.soreness),
        mood: scale(e.mood),
        pain: (Array.isArray(e.pain) ? e.pain : []).filter((a) => PAIN_AREAS[a]),
        sick: !!e.sick,
        notes: str(e.notes, 2000),
      })),
  };
  const rem = data.settings?.reminder || {};
  const theme = data.settings?.theme;
  state.settings = {
    theme: theme === 'auto' || THEMES[theme] ? theme : 'auto',
    reminder: {
      enabled: rem.enabled === true,
      time: typeof rem.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(rem.time) ? rem.time : base.settings.reminder.time,
    },
  };
  if (state.onboarded && (!state.profile.age || !state.profile.sex || !state.schedule.testDate)) state.onboarded = false;
  return state;
}
