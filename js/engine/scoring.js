// Scoring engine: converts raw event results into points, and points back into raw values
// (so we can tell the user exactly what they need to hit for a target score).

import { clamp } from '../util.js';

// Multiplier applied to standards for older age groups (1.0 = youngest bracket).
const AGE_BRACKETS = [
  [21, 1.0],
  [26, 1.0],
  [31, 0.98],
  [36, 0.96],
  [41, 0.93],
  [46, 0.9],
  [51, 0.87],
  [56, 0.84],
  [61, 0.8],
  [Infinity, 0.77],
];

export function ageFactor(age) {
  const a = Number(age) || 21;
  for (const [maxAge, f] of AGE_BRACKETS) if (a <= maxAge) return f;
  return 1;
}

export function eventPtsRange(test, event) {
  if (test.scoring === 'readiness') return { minPts: 60, maxPts: 100 };
  return {
    minPts: event.minPts ?? test.minPts ?? 60,
    maxPts: event.maxPts ?? test.maxPts ?? 100,
  };
}

/**
 * The (age/sex adjusted) raw-value anchors for an event.
 * opts.sexNeutral forces the male column (used for the Army combat standard).
 */
export function eventStandard(test, event, profile = {}, opts = {}) {
  const sex = opts.sexNeutral ? 'male' : profile.sex === 'female' ? 'female' : 'male';
  const pair = event.std.all || event.std[sex] || event.std.male;
  let [min, max] = pair;
  if (test.ageAdjust && !event.noAge) {
    const f = ageFactor(profile.age);
    if (event.better === 'higher') {
      min *= f;
      max *= f;
    } else {
      min /= f;
      max /= f;
    }
  }
  return { min, max, ...eventPtsRange(test, event) };
}

function roundPts(test, event, pts) {
  const { maxPts } = eventPtsRange(test, event);
  return maxPts < 50 ? Math.round(pts * 10) / 10 : Math.round(pts);
}

/** Points for a raw value. Values below the minimum fall off linearly to 0. */
export function scoreEvent(test, event, value, profile, opts) {
  if (value == null || isNaN(value)) return null;
  const { min, max, minPts, maxPts } = eventStandard(test, event, profile, opts);
  const t = (value - min) / (max - min); // works for both directions
  let pts;
  if (t >= 1) pts = maxPts;
  else if (t >= 0) pts = minPts + t * (maxPts - minPts);
  else pts = Math.max(0, minPts * (1 + t));
  return roundPts(test, event, pts);
}

/** Raw value needed to reach `pts` on an event (rounded to something the user can aim for). */
export function valueForPoints(test, event, pts, profile, opts) {
  const { min, max, minPts, maxPts } = eventStandard(test, event, profile, opts);
  const p = clamp(pts, 0, maxPts);
  let v;
  if (p >= minPts) v = min + ((p - minPts) / (maxPts - minPts)) * (max - min);
  else v = min + (p / minPts - 1) * (max - min);
  return roundForEvent(event, v);
}

export function roundForEvent(event, v) {
  switch (event.unit) {
    case 'lb':
      return Math.ceil(v / 10) * 10;
    case 'reps':
      return Math.ceil(v - 1e-9);
    case 'ratio':
      return Math.floor(v * 100 + 1e-9) / 100;
    case 'time':
      return event.better === 'higher' ? Math.ceil(v - 1e-9) : Math.floor(v + 1e-9);
    default:
      return v;
  }
}

/** Events actually taken, given "pick one" group choices (e.g. pull-ups vs push-ups). */
export function activeEvents(test, choices = {}) {
  return test.events.filter((e) => {
    if (!e.group) return true;
    const chosen = choices[e.group] || test.groups?.[e.group]?.default;
    return chosen === e.id;
  });
}

export function maxTotal(test, choices) {
  if (test.scoring === 'readiness') return 100;
  return test.maxTotal ?? activeEvents(test, choices).reduce((s, e) => s + eventPtsRange(test, e).maxPts, 0);
}

/**
 * Evaluate a full test attempt.
 * values: { eventId: rawValue }. Missing values leave the attempt incomplete.
 * requirement (optional): job requirement for the minimum total / per-event floor.
 */
export function evaluateTest(test, values, profile, { choices, requirement } = {}) {
  const opts = { sexNeutral: requirement?.standard === 'combat' };
  const events = activeEvents(test, choices).map((event) => {
    const value = values?.[event.id];
    const pts = scoreEvent(test, event, value, profile, opts);
    const { minPts } = eventPtsRange(test, event);
    const floor = Math.max(minPts, requirement?.minPerEvent ?? 0);
    return { event, value, pts, meetsMin: pts != null && pts >= floor };
  });
  const complete = events.every((e) => e.pts != null);
  const sum = events.reduce((s, e) => s + (e.pts ?? 0), 0);
  const total = test.scoring === 'readiness' ? Math.round(sum / events.length) : Math.round(sum * 10) / 10;
  const allPassed = events.every((e) => e.meetsMin);
  const minTotal = requirement?.minTotal ?? test.pass?.minTotal ?? 0;
  const passed = complete && allPassed && total >= minTotal;
  let category;
  if (!complete) category = 'Incomplete';
  else if (test.categories) category = test.categories(total, test, allPassed);
  else if (test.scoring === 'readiness') {
    if (!allPassed) category = 'Below minimum';
    else if (total >= 90) category = 'Competitive';
    else if (total >= 75) category = 'Strong';
    else category = 'Meets minimum';
  } else category = passed ? 'Pass' : 'Fail';
  if (complete && requirement && !passed && category !== 'Fail') category += ' (below job requirement)';
  return { events, total, maxTotal: maxTotal(test, choices), passed, complete, category };
}

/**
 * Per-event points and raw values needed to hit a requirement level.
 * level: 'min' | 'target'. Totals are spread across events in proportion to each event's max.
 */
export function eventTargets(test, profile, requirement = {}, level = 'target', choices) {
  const events = activeEvents(test, choices);
  const mt = maxTotal(test, choices);
  const opts = { sexNeutral: requirement.standard === 'combat' };
  const total =
    level === 'min'
      ? requirement.minTotal ?? test.pass?.minTotal ?? 0
      : requirement.targetTotal ?? (test.scoring === 'readiness' ? 85 : Math.round(mt * 0.8));
  const perEventFloor = level === 'min' ? requirement.minPerEvent ?? 0 : requirement.targetPerEvent ?? 0;
  const out = {};
  for (const e of events) {
    const { minPts, maxPts } = eventPtsRange(test, e);
    const share = test.scoring === 'readiness' ? total : (maxPts * total) / mt;
    let pts = Math.max(minPts, perEventFloor, share);
    pts = Math.min(maxPts, pts);
    pts = maxPts < 50 ? Math.round(pts * 10) / 10 : Math.ceil(pts);
    out[e.id] = { pts, value: valueForPoints(test, e, pts, profile, opts) };
  }
  return { total, events: out };
}

/** How far (0 = at current, 1 = reached) a value is toward a target, in points space. */
export function gapRatio(test, event, current, target, profile, opts) {
  const cur = scoreEvent(test, event, current, profile, opts);
  const tgt = scoreEvent(test, event, target, profile, opts);
  if (cur == null) return 1;
  if (tgt == null || tgt <= 0) return 0;
  return clamp((tgt - cur) / tgt, 0, 1);
}
