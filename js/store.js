// Local persistence. All data stays on the device (localStorage).

import { isoDate } from './util.js';

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
  };
}

let memoryFallback = null;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return memoryFallback || emptyState();
    return { ...emptyState(), ...JSON.parse(raw) };
  } catch {
    return memoryFallback || emptyState();
  }
}

export function save(state) {
  memoryFallback = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — keep in memory */
  }
}

export function reset() {
  memoryFallback = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
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

export function importJson(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !data.profile || !Array.isArray(data.results)) {
    throw new Error('That file does not look like a Guardians backup.');
  }
  return { ...emptyState(), ...data };
}
