// Adaptation engine: reads the training diary and decides how upcoming sessions should change.
//
// Each diary entry looks like:
//   { date: 'YYYY-MM-DD', completion: 'full'|'partial'|'skipped'|'rest', rpe: 1-10,
//     energy: 1-5, sleep: 1-5, soreness: 1-5, mood: 1-5, pain: ['knee', ...], sick: bool,
//     notes: 'free text', results: { 'testId:eventId': value } }
//
// analyze(diary, date) looks only at entries BEFORE `date`, so a bad day today changes
// tomorrow's plan, and the effect fades as good days are logged.

import { addDays, clamp, daysBetween } from '../util.js';

export const PAIN_AREAS = {
  knee: 'impact',
  shin: 'impact',
  ankle: 'impact',
  foot: 'impact',
  hip: 'impact',
  calf: 'impact',
  hamstring: 'impact',
  shoulder: 'upper',
  elbow: 'upper',
  wrist: 'upper',
  chest: 'upper',
  back: 'spine',
  neck: 'spine',
};

const INTENSITY_ORDER = ['rest', 'recovery', 'easy', 'moderate', 'hard'];

export function minIntensity(a, b) {
  return INTENSITY_ORDER[Math.min(INTENSITY_ORDER.indexOf(a), INTENSITY_ORDER.indexOf(b))];
}

const NOTE_PATTERNS = {
  sick: /\b(sick|ill|flu|fever|covid|cold|nause\w*|vomit\w*|food poisoning)\b/i,
  tired: /\b(tired|exhausted|drained|fatigued?|no sleep|didn'?t sleep|slept (bad|poorly)|burn(ed|t)? out|wiped)\b/i,
  pain: /\b(pain|hurt\w*|injur\w*|tweak\w*|strain\w*|sprain\w*|pulled|sharp|swollen)\b/i,
  good: /\b(great|strong|crushed|pr\b|personal (best|record)|felt good|easy|awesome|killed it|new max)\b/i,
  stressed: /\b(stress\w*|anxious|overwhelmed|rough day|bad day)\b/i,
};

/** Extract signals from free-text notes. */
export function parseNotes(notes = '') {
  const text = String(notes);
  const areas = Object.keys(PAIN_AREAS).filter((a) => new RegExp(`\\b${a}s?\\b`, 'i').test(text));
  const hasPain = NOTE_PATTERNS.pain.test(text);
  return {
    sick: NOTE_PATTERNS.sick.test(text),
    tired: NOTE_PATTERNS.tired.test(text),
    good: NOTE_PATTERNS.good.test(text),
    stressed: NOTE_PATTERNS.stressed.test(text),
    painAreas: hasPain ? areas : [],
    painUnspecified: hasPain && areas.length === 0,
  };
}

/** 0–100 score describing how a single day went. < 50 is a "bad day", >= 75 a "good day". */
export function dayScore(entry) {
  const n = parseNotes(entry.notes);
  let s = 70;
  const v = (k) => (entry[k] == null ? 3 : Number(entry[k]));
  s += (v('energy') - 3) * 8;
  s += (v('sleep') - 3) * 6;
  s += (v('mood') - 3) * 4;
  s -= (v('soreness') - 3) * 7;
  if (entry.rpe != null) {
    if (entry.rpe >= 9) s -= 10;
    else if (entry.rpe <= 5 && entry.completion === 'full') s += 5;
  }
  if (entry.completion === 'skipped') s -= 12;
  if (entry.completion === 'partial') s -= 6;
  if (entry.sick || n.sick) s -= 40;
  if ((entry.pain && entry.pain.length) || n.painAreas.length || n.painUnspecified) s -= 15;
  if (n.tired) s -= 8;
  if (n.stressed) s -= 5;
  if (n.good) s += 8;
  return clamp(Math.round(s), 0, 100);
}

function entryPain(entry) {
  const n = parseNotes(entry.notes);
  return [...new Set([...(entry.pain || []), ...n.painAreas])];
}

function isSick(entry) {
  return !!entry.sick || parseNotes(entry.notes).sick;
}

/**
 * Decide adjustments for sessions on `date`.
 * Returns { readiness, volume, intensityCap, avoid: string[], messages: [{level, text}], badStreak, goodStreak }
 */
export function analyze(diary = [], date) {
  const past = diary
    .filter((e) => e.date < date && daysBetween(e.date, date) <= 14)
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  const result = {
    readiness: 75,
    volume: 1,
    intensityCap: 'hard',
    avoid: [],
    messages: [],
    badStreak: 0,
    goodStreak: 0,
  };
  if (!past.length) return result;

  // Readiness: weighted average of the last three days that have entries.
  const recent = past.filter((e) => daysBetween(e.date, date) <= 3);
  if (recent.length) {
    const weights = { 1: 0.6, 2: 0.25, 3: 0.15 };
    let tw = 0;
    let ts = 0;
    for (const e of recent) {
      const w = weights[daysBetween(e.date, date)] || 0.1;
      tw += w;
      ts += w * dayScore(e);
    }
    result.readiness = Math.round(ts / tw);
  }

  // Consecutive bad / good days ending yesterday (consecutive entries, allowing one-day gaps).
  let prev = date;
  for (const e of past) {
    if (daysBetween(e.date, prev) > 2) break;
    if (dayScore(e) < 50) result.badStreak++;
    else break;
    prev = e.date;
  }
  prev = date;
  for (const e of past) {
    if (daysBetween(e.date, prev) > 2) break;
    if (dayScore(e) >= 75 && (e.completion === 'full' || e.completion === 'rest')) result.goodStreak++;
    else break;
    prev = e.date;
  }

  const latest = past[0];
  const latestAge = daysBetween(latest.date, date);

  // Illness: rest the next day, easy recovery the day after.
  if (isSick(latest) && latestAge <= 2) {
    if (latestAge === 1) {
      result.intensityCap = 'rest';
      result.volume = 0;
      result.messages.push({ level: 'warn', text: 'You logged feeling sick — today is a full rest day. Hydrate, sleep, and log how you feel tomorrow.' });
    } else {
      result.intensityCap = 'recovery';
      result.volume = 0.5;
      result.messages.push({ level: 'warn', text: 'Coming back from being sick — easy recovery work only today.' });
    }
  }

  // Pain: avoid loading the affected area for 3 days.
  const painAreas = new Set();
  let unspecifiedPain = false;
  for (const e of past.filter((x) => daysBetween(x.date, date) <= 3)) {
    entryPain(e).forEach((a) => painAreas.add(a));
    if (parseNotes(e.notes).painUnspecified && !(e.pain || []).length) unspecifiedPain = true;
  }
  const avoid = new Set();
  for (const a of painAreas) if (PAIN_AREAS[a]) avoid.add(PAIN_AREAS[a]);
  if (avoid.size) {
    result.avoid = [...avoid];
    const labels = { impact: 'running, rucking and sprinting', upper: 'push-ups, pull-ups and pressing', spine: 'deadlifts, rucking and loaded carries' };
    result.messages.push({
      level: 'warn',
      text: `Pain logged (${[...painAreas].join(', ')}). Swapping out ${[...avoid].map((x) => labels[x]).join(' and ')} for low-impact alternatives for a few days.`,
    });
    result.intensityCap = minIntensity(result.intensityCap, 'moderate');
  } else if (unspecifiedPain) {
    result.intensityCap = minIntensity(result.intensityCap, 'moderate');
    result.volume = Math.min(result.volume, 0.8);
    result.messages.push({ level: 'warn', text: 'Your notes mention pain. Intensity is capped today — log where it hurts so the plan can work around it.' });
  }
  const painDays = past.filter((e) => daysBetween(e.date, date) <= 7 && entryPain(e).length).length;
  if (painDays >= 3) {
    result.messages.push({ level: 'warn', text: 'Pain has shown up 3+ times this week. Get it checked by a medical professional before pushing through it.' });
  }

  // Bad-day handling.
  if (result.intensityCap !== 'rest') {
    if (result.badStreak >= 2) {
      result.volume = Math.min(result.volume, 0.6);
      result.intensityCap = minIntensity(result.intensityCap, 'easy');
      result.messages.push({
        level: 'warn',
        text: `${result.badStreak} tough days in a row — this is a mini deload: 40% less volume and easy intensity so you can bounce back.`,
      });
    } else if (result.badStreak === 1) {
      result.volume = Math.min(result.volume, 0.75);
      result.intensityCap = minIntensity(result.intensityCap, 'moderate');
      result.messages.push({
        level: 'info',
        text: 'Yesterday was a rough one. Today’s session is trimmed ~25% and capped at moderate effort. One bad day doesn’t derail the plan.',
      });
    }
  }

  // Skipped sessions: remind and keep the focus; many skips → simplify.
  const skipped14 = past.filter((e) => e.completion === 'skipped').length;
  if (latest.completion === 'skipped' && latestAge <= 2 && result.intensityCap !== 'rest') {
    result.messages.push({ level: 'info', text: 'You missed your last session — today picks up the most important work. Don’t try to double up.' });
  }
  if (skipped14 >= 3) {
    result.volume = Math.min(result.volume, 0.9);
    result.messages.push({
      level: 'info',
      text: `${skipped14} sessions skipped in the last two weeks. Sessions are shortened a bit — consistency beats intensity. Consider fewer training days in Settings.`,
    });
  }

  // Good streak → progress.
  if (result.goodStreak >= 3 && result.messages.every((m) => m.level !== 'warn') && result.badStreak === 0) {
    result.volume = Math.max(result.volume, 1.1);
    result.messages.push({ level: 'good', text: `${result.goodStreak} strong days in a row — volume bumped up 10%. Keep it rolling.` });
  }

  // Low readiness without an explicit bad streak (e.g. poor sleep trend).
  if (result.readiness < 55 && result.badStreak === 0 && result.intensityCap === 'hard') {
    result.intensityCap = 'moderate';
    result.volume = Math.min(result.volume, 0.85);
    result.messages.push({ level: 'info', text: 'Recent sleep/energy has been low — today is capped at moderate.' });
  }

  return result;
}

/** Summary statistics for the diary screen. */
export function diaryStats(diary = [], today) {
  const last14 = diary.filter((e) => daysBetween(e.date, today) >= 0 && daysBetween(e.date, today) < 14);
  const trained = last14.filter((e) => e.completion === 'full' || e.completion === 'partial').length;
  const planned = last14.filter((e) => e.completion !== 'rest').length;
  let streak = 0;
  let d = today;
  const byDate = new Map(diary.map((e) => [e.date, e]));
  if (!byDate.has(d)) d = addDays(d, -1);
  while (byDate.has(d) && byDate.get(d).completion !== 'skipped') {
    streak++;
    d = addDays(d, -1);
  }
  const avgScore = last14.length ? Math.round(last14.reduce((s, e) => s + dayScore(e), 0) / last14.length) : null;
  return { trained, planned, compliance: planned ? Math.round((trained / planned) * 100) : null, streak, avgScore };
}
