// Training planner: builds a periodized day-by-day plan from the user's current stats, their
// job/test targets, their test date and training days — then adapts each day using the diary.
//
// Nothing is stored: sessions are computed on demand from state, so logging a new result or a
// bad day immediately changes every future session.

import { getTest } from '../data/tests.js';
import { requirementFor } from '../data/jobs.js';
import { activeEvents, eventTargets, gapRatio, valueForPoints, eventPtsRange, scoreEvent } from './scoring.js';
import { analyze, minIntensity } from './adapt.js';
import { addDays, clamp, daysBetween, formatTime, roundTo, weekday, isoDate } from '../util.js';

export const KIND_FAMILY = {
  deadlift: 'strength',
  hrp: 'upper',
  pushup: 'upper',
  pullup: 'upper',
  acl: 'upper',
  situp: 'core',
  plank: 'core',
  run: 'run',
  hamr: 'run',
  swim: 'swim',
  tread: 'swim',
  ruck: 'ruck',
  sdc: 'anaerobic',
  mtc: 'anaerobic',
  manuf: 'anaerobic',
  row: 'row',
  whtr: 'bodycomp',
};

const CARDIO = new Set(['run', 'swim', 'row', 'ruck']);
const SLOT_FAMILIES = ['run', 'swim', 'row', 'ruck', 'strength', 'upper', 'anaerobic'];

export const PHASES = {
  base: { label: 'Base', I: 0.6, blurb: 'Build the engine and clean technique. Moderate volume, controlled intensity.' },
  build: { label: 'Build', I: 0.7, blurb: 'More volume at goal pace. This is where most of your gains happen.' },
  peak: { label: 'Peak', I: 0.8, blurb: 'Test-specific, high-intensity work. Practice pacing and event order.' },
  taper: { label: 'Taper', I: 0.7, blurb: 'Volume drops so you arrive fresh. Stay sharp, sleep a lot.' },
};

export const DEFAULT_TRAINING_DAYS = {
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

// ---------------------------------------------------------------- context

export function defaultRequirement(test) {
  if (test.scoring === 'readiness') return { minTotal: 60, minPerEvent: 60, targetTotal: 85 };
  const mt = test.maxTotal ?? 300;
  return { minTotal: test.pass?.minTotal ?? 0, targetTotal: Math.round(mt * 0.8) };
}

/** Requirement for a test, taking the job and the user's chosen target level into account. */
export function effectiveRequirement(state, testId) {
  const test = getTest(testId);
  const base = requirementFor(state.goal?.jobId, testId) || defaultRequirement(test);
  const req = { ...base };
  const custom = state.goal?.customTotals?.[testId];
  if (state.goal?.level === 'custom' && custom) req.targetTotal = custom;
  if (state.goal?.level === 'min') req.targetTotal = req.minTotal;
  return req;
}

export function latestResult(results = [], testId, eventId) {
  let best = null;
  for (const r of results) {
    if (r.testId === testId && r.eventId === eventId && (!best || r.date >= best.date)) best = r;
  }
  return best;
}

/** Everything the planner needs, derived from app state. */
export function buildContext(state) {
  const profile = state.profile || {};
  const schedule = state.schedule || {};
  const events = [];
  const tests = (state.goal?.testIds || []).map((testId) => {
    const test = getTest(testId);
    const requirement = effectiveRequirement(state, testId);
    const choices = state.goal?.choices?.[testId] || {};
    const opts = { sexNeutral: requirement.standard === 'combat' };
    const targets = eventTargets(test, profile, requirement, 'target', choices);
    const mins = eventTargets(test, profile, requirement, 'min', choices);
    const testEvents = activeEvents(test, choices).map((event) => {
      const res = latestResult(state.results, testId, event.id);
      const known = res != null;
      // Unknown events: assume a bit under the minimum so the plan starts conservatively.
      const { minPts } = eventPtsRange(test, event);
      const value = known ? res.value : valueForPoints(test, event, minPts * 0.85, profile, opts);
      const target = targets.events[event.id].value;
      const entry = {
        key: `${testId}:${event.id}`,
        test,
        event,
        known,
        value,
        target,
        min: mins.events[event.id].value,
        targetPts: targets.events[event.id].pts,
        pts: scoreEvent(test, event, value, profile, opts),
        gap: gapRatio(test, event, value, target, profile, opts),
        opts,
      };
      events.push(entry);
      return entry;
    });
    return { test, requirement, choices, targets, mins, events: testEvents };
  });
  const startDate = schedule.startDate || isoDate();
  const testDate = schedule.testDate || addDays(startDate, 56);
  const trainingDays = (schedule.trainingDays?.length ? schedule.trainingDays : DEFAULT_TRAINING_DAYS[4]).slice().sort();
  return {
    profile,
    tests,
    events,
    startDate,
    testDate,
    trainingDays,
    pool: schedule.pool !== false,
    totalWeeks: Math.max(1, Math.ceil((daysBetween(startDate, testDate) + 1) / 7)),
    diary: state.diary || [],
  };
}

export function phaseFor(ctx, date) {
  const daysToTest = daysBetween(date, ctx.testDate);
  const week = Math.floor(daysBetween(ctx.startDate, date) / 7);
  let phase;
  if (daysToTest <= 7) phase = 'taper';
  else {
    const ratio = week / Math.max(1, ctx.totalWeeks - 2);
    phase = ratio < 0.45 ? 'base' : ratio < 0.8 ? 'build' : 'peak';
  }
  return { week, daysToTest, phase, progress: clamp(week / Math.max(1, ctx.totalWeeks - 1), 0, 1) };
}

// ------------------------------------------------------------ allocation

export function familyWeights(ctx) {
  const w = {};
  for (const e of ctx.events) {
    const f = KIND_FAMILY[e.event.kind];
    w[f] = (w[f] || 0) + 0.35 + (e.known ? e.gap : 0.5);
  }
  return w;
}

/**
 * Session families for each training day of a week.
 * Returns [{ family, extras: [family...] }] in training-day order.
 */
export function weekTemplate(ctx) {
  const n = ctx.trainingDays.length;
  const w = familyWeights(ctx);
  const fams = SLOT_FAMILIES.filter((f) => w[f]).sort((a, b) => w[b] - w[a]);
  if (!fams.length) fams.push('run', 'upper');
  const chosen = fams.slice(0, n);
  const leftovers = fams.slice(n);
  const counts = Object.fromEntries(chosen.map((f) => [f, 1]));
  let remaining = n - chosen.length;
  // Distribute remaining slots by weight (largest share first), max 1 ruck and 3 of anything.
  while (remaining > 0) {
    const cands = chosen.filter((f) => (f === 'ruck' ? counts[f] < 1 : counts[f] < 3));
    if (!cands.length) break;
    cands.sort((a, b) => w[b] / (counts[b] + 1) - w[a] / (counts[a] + 1));
    counts[cands[0]]++;
    remaining--;
  }
  const cardio = [];
  const other = [];
  for (const f of chosen) {
    for (let i = 0; i < counts[f]; i++) (CARDIO.has(f) ? cardio : other).push(f);
  }
  // Put heavier-weighted families first within each list, ruck last.
  const order = (a, b) => (a === 'ruck') - (b === 'ruck') || w[b] - w[a];
  cardio.sort(order);
  other.sort(order);
  // Interleave cardio / non-cardio, starting with the longer list.
  const slots = [];
  const [first, second] = cardio.length >= other.length ? [cardio, other] : [other, cardio];
  while (first.length || second.length) {
    if (first.length) slots.push(first.shift());
    if (second.length) slots.push(second.shift());
  }
  // Ruck lives on the last day of the week (usually the weekend).
  const ri = slots.indexOf('ruck');
  if (ri !== -1 && ri !== slots.length - 1) {
    slots.splice(ri, 1);
    slots.push('ruck');
  }
  // Attach leftover families as secondary work on complementary days.
  const plan = slots.map((family) => ({ family, extras: [] }));
  leftovers.forEach((f, i) => {
    const target = plan.filter((p) => CARDIO.has(p.family) !== CARDIO.has(f) && p.family !== 'ruck');
    const pool = target.length ? target : plan;
    pool[i % pool.length].extras.push(f);
  });
  return plan;
}

function subtypeFor(family, occurrence, countInWeek, week) {
  if (family === 'run') {
    const rot = ['intervals', 'tempo', 'long'];
    if (countInWeek === 1) return rot[week % 3];
    if (countInWeek === 2) return occurrence === 0 ? 'intervals' : week % 2 ? 'tempo' : 'long';
    return rot[occurrence] || 'easy';
  }
  if (family === 'swim') {
    const rot = ['intervals', 'technique', 'endurance'];
    if (countInWeek === 1) return week % 2 ? 'technique' : 'intervals';
    return rot[occurrence] || 'technique';
  }
  if (family === 'row') return occurrence === 0 ? 'intervals' : 'steady';
  return null;
}

// ---------------------------------------------------------- prescriptions

function pick(ctx, kinds) {
  const list = ctx.events.filter((e) => kinds.includes(e.event.kind));
  if (!list.length) return null;
  return list.slice().sort((a, b) => b.gap - a.gap)[0];
}

function all(ctx, kinds) {
  const seen = new Set();
  return ctx.events.filter((e) => {
    if (!kinds.includes(e.event.kind) || seen.has(e.event.kind)) return false;
    seen.add(e.event.kind);
    return true;
  });
}

const n = (x, min = 1) => Math.max(min, Math.round(x));
const pace = (s) => formatTime(s);

function targetLine(e) {
  const fmt = e.event.unit === 'time' ? formatTime(e.target) : e.event.unit === 'lb' ? `${e.target} lb` : e.event.unit === 'ratio' ? e.target.toFixed(2) : `${e.target}`;
  return `Goal for test day: ${fmt}`;
}

const BUILDERS = {
  pushup(e, { I, v, phase }) {
    const M = e.value;
    const label = e.event.kind === 'hrp' ? 'hand-release push-ups' : 'push-ups';
    const items = [`${n(5 * v, 2)} × ${n(M * I, 3)} ${label} — rest 60–90 s`];
    if (phase === 'peak' || phase === 'taper') items.push(`1 × timed test-style set (${e.event.timeLimit || '2 min'}) — pace it, don’t sprint the first 30 s`);
    else items.push(`${n(3 * v, 1)} × ${n(M * 0.4, 3)} diamond or wide-grip push-ups`);
    items.push(targetLine(e));
    return { title: e.event.short, items };
  },
  pullup(e, { I, v }) {
    const M = e.value;
    if (M < 4) {
      return {
        title: 'Pull-ups (building strength)',
        items: [
          `${n(5 * v, 2)} × 3 slow negatives (5-second lower)`,
          `${n(4 * v, 2)} × 6 band-assisted pull-ups`,
          `${n(3 * v, 1)} × 20–30 s flexed-arm hang`,
          `${n(3 * v, 1)} × 10 inverted rows`,
          targetLine(e),
        ],
      };
    }
    return {
      title: 'Pull-ups',
      items: [`${n(6 * v, 2)} × ${n(M * I, 1)} strict pull-ups — rest 90 s`, `${n(3 * v, 1)} × 10 inverted rows or lat pulldowns`, targetLine(e)],
    };
  },
  situp(e, { I, v, phase }) {
    const M = e.value;
    const items = [`${n(4 * v, 2)} × ${n(M * I, 5)} sit-ups — rest 45 s`];
    if (phase !== 'base') items.push(`${n(4 * v, 2)} × 30 s on / 30 s off at test pace (~${n(e.target / (e.event.timeLimit === '1 min' ? 2 : 4))} reps per 30 s)`);
    items.push(targetLine(e));
    return { title: e.event.short, items };
  },
  plank(e, { I, v }) {
    return {
      title: 'Plank',
      items: [`${n(4 * v, 2)} × ${formatTime(n(e.value * I, 20))} forearm plank — rest 45 s`, `${n(2 * v, 1)} × 30 s side plank each side`, `${n(3 * v, 1)} × 20 s hollow-body hold`, targetLine(e)],
    };
  },
  deadlift(e, { v, phase }) {
    const e1 = e.value / 0.93;
    const lb = (pct) => roundTo(e1 * pct, 5);
    const main = {
      base: `${n(5 * v, 2)} × 5 @ ${lb(0.7)} lb`,
      build: `${n(5 * v, 2)} × 3 @ ${lb(0.8)} lb`,
      peak: `Work up to a heavy triple (~${lb(0.9)} lb), then ${n(2 * v, 1)} × 3 @ ${lb(0.8)} lb`,
      taper: `${n(3 * v, 2)} × 3 @ ${lb(0.7)} lb — crisp, not grinding`,
    }[phase];
    return {
      title: 'Hex-bar deadlift',
      items: [main, `${n(3 * v, 2)} × 8 Romanian deadlifts`, `${n(3 * v, 2)} × 8 split squats each leg`, targetLine(e)],
    };
  },
  sdc(e, { v, phase }) {
    const items =
      phase === 'base'
        ? [`${n(8 * v, 3)} × 25 m sprints`, `${n(4 * v, 2)} × 25 m backward sled/heavy-bag drag`, `${n(6 * v, 2)} × 25 m lateral shuffles`, `${n(4 * v, 2)} × 50 m farmer carry (2 × 40 lb)`]
        : [`${n(3 * v, 1)} × full Sprint-Drag-Carry simulation (5 × 50 m) — rest 3 min`, `${n(6 * v, 2)} × 25 m acceleration sprints`];
    items.push(targetLine(e));
    return { title: 'Sprint-Drag-Carry', items };
  },
  mtc(e, { v }) {
    return { title: 'Movement to Contact', items: [`${n(4 * v, 2)} × 440 yd @ ${pace(e.target / 2)} — walk back to recover`, `${n(2 * v, 1)} × 880 yd @ ${pace(e.target * 1.05)}`, targetLine(e)] };
  },
  acl(e, { I, v }) {
    return { title: 'Ammo Can Lift', items: [`${n(5 * v, 2)} × ${n(e.value * I, 5)} overhead presses with 30 lb (ammo can, dumbbell or sandbag)`, `${n(3 * v, 1)} × 10 push press`, targetLine(e)] };
  },
  manuf(e, { v }) {
    return {
      title: 'Maneuver Under Fire circuit',
      items: [
        `${n(4 * v, 2)} rounds: 25 yd sprint → 10 yd high crawl → 10 yd low crawl → 25 yd buddy drag → 25 yd fireman carry → 75 yd 2 × 30 lb carry → 3 push-ups`,
        'Rest 2 min between rounds',
        targetLine(e),
      ],
    };
  },
  hamr(e, { v }) {
    return { title: 'HAMR shuttles', items: [`${n(8 * v, 3)} × 1 min of 20 m shuttles at your goal level pace — rest 1 min`, targetLine(e)] };
  },
  whtr(e) {
    if (e.value <= e.target) return null;
    return {
      title: 'Body composition',
      items: ['Aim for 0.5–1 lb/week loss: protein ~0.8 g per lb bodyweight, mostly whole foods, limit liquid calories', '8,000–10,000 steps every day', 'Measure your waist weekly (same day, same time) and log it as a result', targetLine(e)],
    };
  },
  tread(e, { v }) {
    return { title: 'Treading water', items: [`${n(3 * v, 1)} × ${formatTime(n(e.target * 0.5, 60))} tread — hands out of the water for the last 30 s`, targetLine(e)] };
  },
};

function runPaces(e) {
  const d = e.event.distanceMi || 1.5;
  return { d, cur: e.value / d, goal: e.target / d };
}

function runBlock(e, sub, { v, phase }) {
  if (e.event.kind === 'hamr') return BUILDERS.hamr(e, { v });
  const { d, cur, goal } = runPaces(e);
  const items = [];
  if (sub === 'intervals') {
    if (d <= 3) {
      items.push(
        {
          base: `${n(6 * v, 3)} × 400 m @ ${pace(goal / 4)} — rest 90 s`,
          build: `${n(5 * v, 2)} × 800 m @ ${pace(goal / 2)} — rest 2 min`,
          peak: `${n(3 * v, 2)} × 1 mile @ ${pace(goal)} — rest 3 min`,
          taper: `${n(4 * v, 2)} × 400 m @ ${pace(goal / 4)} — full recovery`,
        }[phase],
      );
    } else {
      items.push(
        {
          base: `${n(5 * v, 2)} × 800 m @ ${pace(goal / 2)} — rest 2 min`,
          build: `${n(4 * v, 2)} × 1 mile @ ${pace(goal)} — rest 2 min`,
          peak: `${n(3 * v, 2)} × 2 miles @ ${pace(goal)} — rest 3 min`,
          taper: `${n(3 * v, 2)} × 800 m @ ${pace(goal / 2)}`,
        }[phase],
      );
    }
  } else if (sub === 'tempo') {
    const mins = n({ base: 20, build: 25, peak: 30, taper: 15 }[phase] * v, 10);
    items.push(`${mins} min continuous tempo @ ${pace(Math.min(cur, goal + 20))}/mi (comfortably hard)`);
  } else if (sub === 'long') {
    const miles = Math.min(10, Math.max(2, roundTo(d * { base: 1.5, build: 2, peak: 2.2, taper: 1 }[phase] * v, 0.5)));
    items.push(`${miles} miles easy @ ~${pace(cur + 75)}/mi — conversational`);
  } else {
    items.push(`${n(25 * v, 15)} min easy run @ ~${pace(cur + 90)}/mi (or run/walk)`);
  }
  items.push(`Current: ${formatTime(e.value)} (${pace(cur)}/mi) → goal ${formatTime(e.target)} (${pace(goal)}/mi)`);
  const titles = { intervals: 'Run intervals', tempo: 'Tempo run', long: 'Long run', easy: 'Easy run' };
  return { title: `${titles[sub]} — ${e.event.short}`, items };
}

function swimBlock(e, sub, { v, phase, pool }) {
  if (!pool) {
    return {
      title: 'Swim dryland (no pool access)',
      items: [
        'Find a pool — your test has a swim and nothing replaces time in the water.',
        `${n(3 * v, 2)} × 20 band pull-aparts`,
        `${n(4 * v, 2)} × 12 lat pulldowns or band pulldowns`,
        `${n(4 * v, 2)} × 30 s flutter kicks`,
        `${n(3 * v, 2)} × 10 streamline squats`,
      ],
    };
  }
  const u = e.event.distanceYd ? 'yd' : 'm';
  const D = e.event.distanceYd || e.event.distanceM || 500;
  const cur100 = e.value / (D / 100);
  const goal100 = e.target / (D / 100);
  const items = [];
  if (sub === 'intervals') {
    items.push(
      {
        base: `${n(10 * v, 4)} × 50 ${u} @ ${pace(goal100 / 2 + 3)} — rest 20 s`,
        build: `${n(8 * v, 3)} × 100 ${u} @ ${pace(goal100)} — rest 20 s`,
        peak: `${n(3 * v, 2)} × 200 ${u} @ ${pace(goal100 * 2)} — rest 45 s, then 1 × ${D} ${u} at test effort`,
        taper: `${n(6 * v, 3)} × 50 ${u} @ ${pace(goal100 / 2)} — easy between`,
      }[phase],
    );
  } else if (sub === 'technique') {
    items.push(`${n(6 * v, 3)} × 50 ${u} combat sidestroke — long glide, count strokes per length and try to lower it`, `${n(4 * v, 2)} × 25 ${u} scissor-kick only (kickboard)`, `${n(4 * v, 2)} × 50 ${u} breaststroke with long pull-outs`, `${roundTo(400 * v, 50)} ${u} easy continuous`);
  } else {
    items.push(`${roundTo(Math.max(400, D * 2) * v, 50)} ${u} continuous, steady effort`, `${n(4 * v, 2)} × 50 ${u} fast finish`);
  }
  if (e.event.kind === 'swim') items.push(`Current: ${formatTime(e.value)} (${pace(cur100)}/100 ${u}) → goal ${formatTime(e.target)} (${pace(goal100)}/100 ${u})`);
  const titles = { intervals: 'Swim intervals', technique: 'Swim technique', endurance: 'Swim endurance' };
  return { title: titles[sub] || 'Swim', items };
}

function ruckBlock(e, { v, progress, phase }) {
  const d = e.event.distanceMi || 6;
  const L = e.event.ruckLb || 35;
  const p = phase === 'taper' ? 0.3 : progress;
  const miles = Math.min(d, Math.max(3, roundTo(d * (0.35 + 0.6 * p) * v, 0.5)));
  const lb = roundTo(L * (0.6 + 0.4 * p), 5);
  return {
    title: 'Ruck march',
    items: [
      `${miles} miles with ${lb} lb @ ${pace(e.target / d)}/mi`,
      'Check feet for hot spots every 3 miles; wear the boots you will test in',
      targetLine(e),
    ],
  };
}

function rowBlock(e, sub, { v, phase }) {
  const split = e.target / 4;
  const items =
    sub === 'intervals'
      ? [
          {
            base: `${n(6 * v, 3)} × 500 m @ ${pace(split + 3)}/500 m — rest 2 min`,
            build: `${n(4 * v, 2)} × 750 m @ ${pace(split)}/500 m — rest 2 min`,
            peak: `${n(3 * v, 2)} × 1000 m @ ${pace(split)}/500 m — rest 3 min`,
            taper: `${n(4 * v, 2)} × 250 m @ ${pace(split - 3)}/500 m`,
          }[phase],
        ]
      : [`${n(30 * v, 15)} min steady row @ ${pace(split + 15)}/500 m`];
  items.push(targetLine(e));
  return { title: sub === 'intervals' ? 'Row intervals' : 'Steady row', items };
}

function coreBlocks(ctx, p) {
  return all(ctx, ['situp', 'plank']).map((e) => BUILDERS[e.event.kind](e, p));
}

function upperBlocks(ctx, p) {
  return all(ctx, ['hrp', 'pushup', 'pullup', 'acl']).map((e) => BUILDERS[e.event.kind === 'hrp' ? 'pushup' : e.event.kind](e, p));
}

function familyBlocks(ctx, family, sub, p) {
  switch (family) {
    case 'run': {
      const e = pick(ctx, ['run', 'hamr']);
      return e ? [runBlock(e, sub || 'intervals', p)] : [];
    }
    case 'swim': {
      const e = pick(ctx, ['swim']) || pick(ctx, ['tread']);
      const blocks = e?.event.kind === 'swim' ? [swimBlock(e, sub || 'technique', p)] : [];
      const t = pick(ctx, ['tread']);
      if (t && p.pool) blocks.push(BUILDERS.tread(t, p));
      if (!blocks.length && e) blocks.push(swimBlock(e, sub, p));
      return blocks;
    }
    case 'ruck': {
      const e = pick(ctx, ['ruck']);
      return e ? [ruckBlock(e, p)] : [];
    }
    case 'row': {
      const e = pick(ctx, ['row']);
      return e ? [rowBlock(e, sub || 'intervals', p)] : [];
    }
    case 'strength': {
      const e = pick(ctx, ['deadlift']);
      return e ? [BUILDERS.deadlift(e, p)] : [];
    }
    case 'upper':
      return upperBlocks(ctx, p);
    case 'anaerobic':
      return all(ctx, ['sdc', 'mtc', 'manuf']).map((e) => BUILDERS[e.event.kind](e, p));
    case 'core':
      return coreBlocks(ctx, p);
    default:
      return [];
  }
}

function shortExtra(ctx, family, p) {
  // A lighter version of a family's work to tack onto another day.
  const light = { ...p, v: p.v * 0.6 };
  if (family === 'run') {
    const e = pick(ctx, ['run', 'hamr']);
    return e ? [runBlock(e, 'easy', light)] : [];
  }
  if (family === 'ruck') {
    const e = pick(ctx, ['ruck']);
    return e ? [{ title: 'Short ruck', items: [`${Math.max(2, roundTo((e.event.distanceMi || 6) * 0.3, 0.5))} miles with ${roundTo((e.event.ruckLb || 35) * 0.7, 5)} lb, brisk pace`] }] : [];
  }
  return familyBlocks(ctx, family, family === 'swim' ? 'technique' : null, light);
}

// ---------------------------------------------------------------- sessions

const FAMILY_TITLES = {
  run: 'Run',
  swim: 'Swim',
  ruck: 'Ruck',
  row: 'Row',
  strength: 'Strength',
  upper: 'Upper-body endurance',
  anaerobic: 'Combat conditioning',
  core: 'Core',
};

const WARMUP = ['5 min easy jog, bike or row', 'Dynamic mobility: leg swings, arm circles, hip openers, inchworms (5 min)', '2–3 build-up efforts of the first exercise'];
const COOLDOWN = ['5 min easy walk', 'Stretch hips, hamstrings, chest and lats (5–10 min)'];

function restSession(ctx, date, reason, extra = []) {
  const items = ['Walk 20–30 min', '10–15 min mobility / foam rolling', 'Sleep 8+ hours — this is when you adapt'];
  const upper = ctx.events.filter((e) => ['pushup', 'hrp', 'pullup'].includes(e.event.kind) && e.gap > 0.3);
  if (upper.length && !reason) {
    items.push(`Optional grease-the-groove: 4–5 easy sets of ~40% of your max ${upper.map((e) => e.event.short.toLowerCase()).join(' / ')} spread through the day`);
  }
  const whtr = pick(ctx, ['whtr']);
  const blocks = [{ title: 'Active rest', items }];
  const bc = whtr && BUILDERS.whtr(whtr);
  if (bc) blocks.push(bc);
  return { date, type: 'rest', title: reason ? 'Rest & recover' : 'Rest day', intensity: 'rest', minutes: 0, blocks, notes: extra, family: null };
}

function recoverySession(ctx, date, notes) {
  return {
    date,
    type: 'recovery',
    title: 'Active recovery',
    intensity: 'recovery',
    minutes: 30,
    blocks: [{ title: 'Recovery', items: ['20–30 min easy walk, bike or swim — nose-breathing pace', '15 min mobility flow: hips, T-spine, ankles, shoulders', 'Hydrate and eat protein at every meal'] }],
    notes,
    family: null,
  };
}

function testSession(ctx, date, kind) {
  const blocks = ctx.tests.map(({ test, events }) => ({
    title: test.name,
    items: [
      ...events.map((e) => `${e.event.name}${kind === 'baseline' ? (e.known ? ` (last: ${fmtVal(e)})` : ' — not tested yet') : ` — goal ${fmtTarget(e)}`}`),
      'Rest 3–5 min between events and run them in official order.',
    ],
  }));
  const title = { baseline: 'Baseline test', mock: 'Mock test', test: 'TEST DAY' }[kind];
  const notes =
    kind === 'test'
      ? [{ level: 'good', text: 'You put in the work. Eat a familiar breakfast, warm up well, trust your pacing. Log your official scores in the Progress tab afterward.' }]
      : [{ level: 'info', text: 'Log each result in the Progress tab — your whole plan re-calibrates from the new numbers.' }];
  return { date, type: kind === 'test' ? 'test_day' : `${kind}_test`, title, intensity: 'test', minutes: 90, warmup: WARMUP, blocks, cooldown: COOLDOWN, notes, family: 'test' };
}

function fmtVal(e) {
  return e.event.unit === 'time' ? formatTime(e.value) : e.event.unit === 'ratio' ? e.value.toFixed(2) : `${e.value}${e.event.unit === 'lb' ? ' lb' : ''}`;
}
function fmtTarget(e) {
  return e.event.unit === 'time' ? formatTime(e.target) : e.event.unit === 'ratio' ? e.target.toFixed(2) : `${e.target}${e.event.unit === 'lb' ? ' lb' : ''}`;
}

/** Swap a family for a safe alternative when the diary says to avoid something. */
function swapForAvoid(ctx, family, avoid) {
  const has = (f) => ctx.events.some((e) => KIND_FAMILY[e.event.kind] === f);
  if (avoid.includes('impact') && ['run', 'ruck', 'anaerobic'].includes(family)) return has('swim') && ctx.pool ? 'swim' : 'lowimpact';
  if (avoid.includes('spine') && ['strength', 'ruck'].includes(family)) return has('upper') && !avoid.includes('upper') ? 'upper' : 'lowimpact';
  if (avoid.includes('upper') && family === 'upper') return 'lowerbody';
  if (avoid.includes('upper') && family === 'swim') return 'lowimpact';
  return family;
}

function downgradeSub(family, sub, cap) {
  if (cap === 'hard') return sub;
  if (family === 'run') return cap === 'easy' ? 'easy' : sub === 'intervals' ? 'tempo' : sub === 'long' ? 'easy' : sub;
  if (family === 'swim') return cap === 'easy' ? 'technique' : sub === 'intervals' ? 'endurance' : sub;
  if (family === 'row') return 'steady';
  return sub;
}

function intensityOf(family, sub, phase) {
  if (['recovery', 'lowimpact', 'lowerbody'].includes(family)) return 'moderate';
  if (sub === 'easy' || sub === 'technique' || sub === 'steady') return 'easy';
  if (sub === 'intervals' || family === 'anaerobic' || phase === 'peak') return 'hard';
  return 'moderate';
}

/**
 * The (adapted) session for a date. `adaptation` defaults to analyzing the diary in ctx.
 */
export function planSession(ctx, date, adaptation) {
  if (date < ctx.startDate) return null;
  if (date === ctx.testDate) return testSession(ctx, date, 'test');
  if (date > ctx.testDate) {
    return { date, type: 'post', title: 'Test complete', intensity: 'rest', minutes: 0, blocks: [{ title: 'What next?', items: ['Log your official results in the Progress tab.', 'Set a new test date in Settings to start your next cycle.'] }], notes: [], family: null };
  }
  const a = adaptation || analyze(ctx.diary, date);
  const ph = phaseFor(ctx, date);
  const notes = [...a.messages];
  const idx = ctx.trainingDays.indexOf(weekday(date));

  if (ph.daysToTest === 1) return restSession(ctx, date, 'pre-test', [{ level: 'info', text: 'Tomorrow is test day: light walk only, lay out your gear, hydrate, sleep early.' }, ...notes]);
  if (idx === -1) return restSession(ctx, date, null, notes.filter((m) => m.level === 'warn'));
  if (a.intensityCap === 'rest') return restSession(ctx, date, 'adapt', notes);
  if (a.intensityCap === 'recovery') return recoverySession(ctx, date, notes);

  // Baseline test on the first training day when stats are missing.
  const unknown = ctx.events.some((e) => !e.known);
  if (unknown && date === firstTrainingDay(ctx) && !a.avoid.length) {
    return testSession(ctx, date, 'baseline');
  }

  // Mock test on the last training day of every 4th week.
  const isMockDay = ph.week % 4 === 3 && idx === ctx.trainingDays.length - 1 && ph.daysToTest > 10;
  if (isMockDay) {
    if (a.intensityCap === 'hard' && !a.avoid.length) {
      const mock = testSession(ctx, date, 'mock');
      mock.notes = [...notes, ...mock.notes];
      return mock;
    }
    notes.push({ level: 'info', text: 'Mock test postponed — you are not fully recovered. Regular session today instead.' });
  }

  const template = weekTemplate(ctx);
  const slot = template[idx] || template[0];
  const occurrence = template.slice(0, idx).filter((s) => s.family === slot.family).length;
  const count = template.filter((s) => s.family === slot.family).length;
  let family = slot.family;
  let sub = subtypeFor(family, occurrence, count, ph.week);

  const swapped = swapForAvoid(ctx, family, a.avoid);
  if (swapped !== family) {
    family = swapped;
    sub = subtypeFor(family, 0, 1, ph.week) || null;
  }
  const cap = a.intensityCap;
  sub = downgradeSub(family, sub, cap);

  let I = PHASES[ph.phase].I;
  if (cap === 'moderate') I = Math.min(I, 0.65);
  if (cap === 'easy') I = Math.min(I, 0.5);
  let v = a.volume;
  if (ph.phase === 'taper') v *= 0.6;
  const p = { I, v, phase: ph.phase, progress: ph.progress, pool: ctx.pool };

  let blocks;
  if (family === 'lowimpact') {
    blocks = [{ title: 'Low-impact cardio', items: [ctx.pool ? `${n(30 * v, 15)} min easy swim or pool running` : `${n(30 * v, 15)} min bike, elliptical or rower`, `${n(6 * v, 3)} × 1 min moderate-hard / 1 min easy`, 'Stop if pain increases'] }];
  } else if (family === 'lowerbody') {
    blocks = [{ title: 'Lower body & legs', items: [`${n(4 * v, 2)} × 8 goblet or bodyweight squats`, `${n(3 * v, 2)} × 10 walking lunges each leg`, `${n(3 * v, 2)} × 12 step-ups`, `${n(3 * v, 2)} × 15 glute bridges`] }];
  } else {
    blocks = familyBlocks(ctx, family, sub, p);
  }
  // Secondary work (families that didn't get their own day this week).
  for (const x of slot.extras) {
    const xf = swapForAvoid(ctx, x, a.avoid);
    if (xf !== x || cap === 'easy') continue;
    blocks.push(...shortExtra(ctx, x, p));
  }
  // Core finisher on non-core days.
  if (!['core'].includes(family) && cap !== 'easy' && !(a.avoid.includes('spine'))) {
    const core = coreBlocks(ctx, { ...p, v: v * 0.5 });
    if (core.length && !blocks.some((b) => core.some((c) => c.title === b.title))) {
      blocks.push({ title: 'Core finisher', items: core.flatMap((c) => c.items.filter((i) => !i.startsWith('Goal')).slice(0, 1)) });
    }
  }
  blocks = blocks.filter(Boolean);
  if (!blocks.length) blocks = [{ title: 'General conditioning', items: ['30 min moderate cardio', '3 rounds: 15 push-ups, 20 squats, 30 s plank'] }];

  const subTitle = { intervals: 'Intervals', tempo: 'Tempo', long: 'Long', easy: 'Easy', technique: 'Technique', endurance: 'Endurance', steady: 'Steady' }[sub];
  const baseTitle = { lowimpact: 'Low-impact cardio', lowerbody: 'Lower body' }[family] || FAMILY_TITLES[family];
  const intensity = minIntensity(intensityOf(family, sub, ph.phase), cap);
  const minutes = Math.round((15 + blocks.reduce((s, b) => s + b.items.length * 6, 0)) * Math.min(1.1, Math.max(0.6, v)));
  return {
    date,
    type: family,
    sub,
    family,
    title: subTitle ? `${baseTitle} — ${subTitle}` : baseTitle,
    intensity,
    minutes,
    warmup: WARMUP,
    blocks,
    cooldown: COOLDOWN,
    notes,
    phase: ph.phase,
    week: ph.week,
    adapted: a.volume !== 1 || a.intensityCap !== 'hard' || a.avoid.length > 0 || swapped !== slot.family,
  };
}

export function firstTrainingDay(ctx) {
  let d = ctx.startDate;
  for (let i = 0; i < 7; i++) {
    if (ctx.trainingDays.includes(weekday(d))) return d;
    d = addDays(d, 1);
  }
  return ctx.startDate;
}

/** Sessions for 7 days starting at `fromDate`. */
export function weekSessions(ctx, fromDate) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(fromDate, i);
    out.push(planSession(ctx, d) || { date: d, type: 'none', title: 'Before plan start', intensity: 'rest', blocks: [], notes: [] });
  }
  return out;
}

/** Overall plan summary for the dashboard. */
export function planSummary(ctx, today) {
  const ph = phaseFor(ctx, today < ctx.startDate ? ctx.startDate : today);
  return {
    ...ph,
    phaseInfo: PHASES[ph.phase],
    totalWeeks: ctx.totalWeeks,
    template: weekTemplate(ctx),
  };
}
