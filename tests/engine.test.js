import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TESTS, TEST_LIST } from '../js/data/tests.js';
import { JOBS, searchJobs, getJob } from '../js/data/jobs.js';
import { scoreEvent, valueForPoints, evaluateTest, eventTargets, activeEvents } from '../js/engine/scoring.js';
import { analyze, dayScore, parseNotes } from '../js/engine/adapt.js';
import { buildContext, planSession, weekTemplate, weekSessions } from '../js/engine/planner.js';
import { parseTime, formatTime, addDays } from '../js/util.js';

const male21 = { sex: 'male', age: 21 };
const female30 = { sex: 'female', age: 30 };

test('time parsing and formatting round-trip', () => {
  assert.equal(parseTime('13:22'), 802);
  assert.equal(parseTime('1:02:03'), 3723);
  assert.equal(formatTime(802), '13:22');
  assert.equal(formatTime(3723), '1:02:03');
  assert.ok(isNaN(parseTime('abc')));
});

test('every test has well-formed events', () => {
  for (const t of TEST_LIST) {
    assert.ok(t.events.length >= 3, t.id);
    for (const e of t.events) {
      assert.ok(e.std.all || (e.std.male && e.std.female), `${t.id}.${e.id} std`);
      const [min, max] = e.std.all || e.std.male;
      if (e.better === 'higher') assert.ok(max > min, `${t.id}.${e.id} higher`);
      else assert.ok(max < min, `${t.id}.${e.id} lower`);
    }
  }
});

test('covers every branch and special warfare', () => {
  const branches = new Set(TEST_LIST.map((t) => t.branch));
  for (const b of ['army', 'marines', 'navy', 'airforce', 'spaceforce', 'coastguard']) assert.ok(branches.has(b), b);
  assert.ok(TEST_LIST.filter((t) => t.special).length >= 8);
});

test('ACFT scoring anchors', () => {
  const t = TESTS.acft;
  const run = t.events.find((e) => e.id === '2mr');
  assert.equal(scoreEvent(t, run, 802, male21), 100);
  assert.equal(scoreEvent(t, run, 1320, male21), 60);
  assert.ok(scoreEvent(t, run, 1500, male21) < 60);
  assert.equal(scoreEvent(t, run, 700, male21), 100);
});

test('valueForPoints inverts scoreEvent', () => {
  for (const t of TEST_LIST) {
    for (const e of t.events) {
      for (const pts of [65, 80, 95]) {
        const range = t.scoring === 'readiness' ? 100 : e.maxPts ?? t.maxPts ?? 100;
        const p = Math.min(pts, range);
        const v = valueForPoints(t, e, p * (range / 100), female30);
        const back = scoreEvent(t, e, v, female30);
        assert.ok(back >= p * (range / 100) - 1, `${t.id}.${e.id} pts ${p}: value ${v} scored ${back}`);
      }
    }
  }
});

test('evaluateTest pass/fail and category', () => {
  const t = TESTS.pft;
  const good = evaluateTest(t, { pull: 23, plk: 225, '3mr': 1080 }, male21);
  assert.equal(good.total, 300);
  assert.equal(good.category, '1st Class');
  assert.ok(good.passed);
  const bad = evaluateTest(t, { pull: 1, plk: 60, '3mr': 1900 }, male21);
  assert.equal(bad.passed, false);
  const partial = evaluateTest(t, { pull: 10 }, male21);
  assert.equal(partial.complete, false);
});

test('group alternatives pick the chosen event', () => {
  const ids = activeEvents(TESTS.pft, { upper: 'pu' }).map((e) => e.id);
  assert.deepEqual(ids, ['pu', 'plk', '3mr']);
  assert.equal(activeEvents(TESTS.af_pfa).length, 4);
});

test('combat MOS targets use sex-neutral standard', () => {
  const req = getJob('army-11b').tests[0];
  const f = eventTargets(TESTS.acft, { sex: 'female', age: 21 }, req, 'min');
  const m = eventTargets(TESTS.acft, { sex: 'male', age: 21 }, req, 'min');
  assert.deepEqual(f.events, m.events);
  assert.equal(f.total, 350);
});

test('every job references valid tests', () => {
  for (const j of JOBS) {
    assert.ok(j.tests.length, j.id);
    for (const r of j.tests) assert.ok(TESTS[r.testId], `${j.id} -> ${r.testId}`);
  }
  const ids = JOBS.map((j) => j.id);
  assert.equal(new Set(ids).size, ids.length, 'job ids unique');
});

test('job search', () => {
  assert.equal(searchJobs('11B')[0].code, '11B');
  assert.equal(searchJobs('seal')[0].id, 'navy-so');
  assert.ok(searchJobs('rescue swimmer').some((j) => j.id === 'coastguard-ast'));
  assert.ok(searchJobs('pararescue', 'airforce').length >= 1);
});

test('notes parsing', () => {
  const n = parseNotes('Knee hurts after the run, felt exhausted');
  assert.deepEqual(n.painAreas, ['knee']);
  assert.ok(n.tired);
  assert.ok(parseNotes('came down with the flu').sick);
  assert.ok(parseNotes('Crushed it, new PR!').good);
});

test('bad day trims next session, two bad days deload', () => {
  const bad = { date: '2026-10-05', completion: 'partial', energy: 1, sleep: 2, soreness: 5, mood: 2, rpe: 9 };
  assert.ok(dayScore(bad) < 50);
  const a1 = analyze([bad], '2026-10-06');
  assert.equal(a1.intensityCap, 'moderate');
  assert.ok(a1.volume <= 0.75);
  const a2 = analyze([{ ...bad, date: '2026-10-04' }, bad], '2026-10-06');
  assert.equal(a2.intensityCap, 'easy');
  assert.ok(a2.volume <= 0.6);
  // Effect only looks backward.
  assert.equal(analyze([bad], '2026-10-05').intensityCap, 'hard');
});

test('sickness forces rest, pain avoids affected area', () => {
  assert.equal(analyze([{ date: '2026-10-05', sick: true }], '2026-10-06').intensityCap, 'rest');
  assert.equal(analyze([{ date: '2026-10-05', sick: true }], '2026-10-07').intensityCap, 'recovery');
  const a = analyze([{ date: '2026-10-05', notes: 'shin pain on the run' }], '2026-10-06');
  assert.deepEqual(a.avoid, ['impact']);
});

test('good streak progresses volume', () => {
  const good = (d) => ({ date: d, completion: 'full', energy: 5, sleep: 5, soreness: 1, mood: 5, rpe: 6 });
  const a = analyze([good('2026-10-03'), good('2026-10-04'), good('2026-10-05')], '2026-10-06');
  assert.ok(a.volume > 1);
});

function stateFor(jobId, extra = {}) {
  const job = getJob(jobId);
  return {
    profile: { name: 'T', age: 22, sex: 'male', branch: job.branch },
    goal: { jobId, testIds: job.tests.map((t) => t.testId), level: 'target', choices: {} },
    schedule: { startDate: '2026-10-05', testDate: '2026-12-14', trainingDays: [1, 2, 4, 5, 6], pool: true },
    results: [],
    diary: [],
    ...extra,
  };
}

test('every job generates a full plan without errors', () => {
  for (const j of JOBS) {
    const ctx = buildContext(stateFor(j.id));
    let d = ctx.startDate;
    while (d <= ctx.testDate) {
      const s = planSession(ctx, d);
      assert.ok(s, `${j.id} ${d}`);
      assert.ok(s.blocks.length, `${j.id} ${d} ${s.type} has blocks`);
      for (const b of s.blocks) for (const i of b.items) assert.ok(!/NaN|undefined/.test(i), `${j.id} ${d}: ${i}`);
      d = addDays(d, 1);
    }
  }
});

test('plan starts with a baseline test when stats are unknown and ends with test day', () => {
  const ctx = buildContext(stateFor('navy-so'));
  assert.equal(planSession(ctx, '2026-10-05').type, 'baseline_test');
  assert.equal(planSession(ctx, '2026-12-14').type, 'test_day');
  assert.equal(planSession(ctx, '2026-12-13').type, 'rest');
});

test('known stats skip the baseline and drive prescriptions', () => {
  const results = [
    { date: '2026-10-01', testId: 'seal_pst', eventId: 'swim', value: 700 },
    { date: '2026-10-01', testId: 'seal_pst', eventId: 'pu', value: 60 },
    { date: '2026-10-01', testId: 'seal_pst', eventId: 'su', value: 60 },
    { date: '2026-10-01', testId: 'seal_pst', eventId: 'pull', value: 12 },
    { date: '2026-10-01', testId: 'seal_pst', eventId: 'run', value: 620 },
  ];
  const ctx = buildContext(stateFor('navy-so', { results }));
  assert.notEqual(planSession(ctx, '2026-10-05').type, 'baseline_test');
  const fams = weekTemplate(ctx).map((s) => s.family);
  assert.ok(fams.includes('swim') && fams.includes('run') && fams.includes('upper'));
});

test('diary pain swaps running for low-impact work', () => {
  const results = [{ date: '2026-10-01', testId: 'acft', eventId: '2mr', value: 1100 }];
  const s = stateFor('army-11b', { results });
  s.schedule.pool = false;
  const ctx = buildContext(s);
  // Find a run day in week 2.
  let d = '2026-10-12';
  let run;
  for (let i = 0; i < 7; i++, d = addDays(d, 1)) {
    const sess = planSession(ctx, d);
    if (sess.family === 'run') { run = d; break; }
  }
  assert.ok(run, 'has a run day');
  const hurt = buildContext({ ...s, diary: [{ date: addDays(run, -1), completion: 'full', pain: ['knee'] }] });
  const adapted = planSession(hurt, run);
  assert.equal(adapted.family, 'lowimpact');
  assert.ok(adapted.adapted);
});

test('weekSessions returns 7 days', () => {
  const ctx = buildContext(stateFor('marines-0311'));
  assert.equal(weekSessions(ctx, '2026-10-05').length, 7);
});

test('backup import keeps valid data and drops malformed or unsafe fields', async () => {
  // store.js touches localStorage only inside functions, so importing it under Node is safe.
  const { importJson, exportJson, emptyState } = await import('../js/store.js');
  const good = {
    ...emptyState(),
    onboarded: true,
    profile: { name: 'A', age: 20, sex: 'male', branch: 'navy' },
    goal: { jobId: 'navy-so', testIds: ['seal_pst'], level: 'target', customTotals: {}, choices: {} },
    schedule: { startDate: '2026-10-05', testDate: '2026-12-14', trainingDays: [1, 3, 5], pool: true },
    results: [{ date: '2026-10-01', testId: 'seal_pst', eventId: 'pu', value: 60, source: 'baseline' }],
    diary: [{ date: '2026-10-02', completion: 'full', rpe: 6, energy: 4, sleep: 4, soreness: 2, mood: 4, pain: ['knee'], sick: false, notes: 'ok' }],
  };
  const round = importJson(exportJson(good));
  assert.equal(round.onboarded, true);
  assert.deepEqual(round.results, good.results);
  assert.deepEqual(round.diary, good.diary);

  const evil = JSON.parse(JSON.stringify(good));
  evil.profile.age = '"><img src=x onerror=alert(1)>';
  evil.schedule.testDate = '"><script>alert(1)</script>';
  evil.goal.testIds = ['seal_pst', 'nope'];
  evil.goal.customTotals = { seal_pst: '<b>' };
  evil.results.push({ date: 'bad', testId: 'seal_pst', eventId: 'pu', value: 1 }, { date: '2026-10-01', testId: 'seal_pst', eventId: 'zzz', value: 1 });
  evil.diary[0].pain = ['knee', '<x>'];
  const clean = importJson(JSON.stringify(evil));
  assert.equal(clean.profile.age, null);
  assert.equal(clean.schedule.testDate, null);
  assert.equal(clean.onboarded, false, 'incomplete profile forces setup again');
  assert.deepEqual(clean.goal.testIds, ['seal_pst']);
  assert.deepEqual(clean.goal.customTotals, {});
  assert.equal(clean.results.length, 1);
  assert.deepEqual(clean.diary[0].pain, ['knee']);

  assert.throws(() => importJson('not json'), /valid JSON/);
  assert.throws(() => importJson('{}'), /Guardians backup/);
});

test('reminders name each training day session and skip rest days', async () => {
  const { buildReminders } = await import('../js/reminders.js');
  const state = {
    ...stateFor('army-11b'),
    onboarded: true,
    settings: { reminder: { enabled: true, time: '07:30' } },
  };
  const now = new Date(2026, 9, 5, 6, 0); // Mon Oct 5 2026, 06:00 local — before today's reminder
  const list = buildReminders(state, now);
  assert.ok(list.length > 0);
  assert.ok(list.length <= 14);
  const ctx = buildContext(state);
  for (const n of list) {
    assert.ok(n.schedule.at > now);
    assert.equal(n.schedule.at.getHours(), 7);
    assert.equal(n.schedule.at.getMinutes(), 30);
    const iso = `${n.schedule.at.getFullYear()}-${String(n.schedule.at.getMonth() + 1).padStart(2, '0')}-${String(n.schedule.at.getDate()).padStart(2, '0')}`;
    const s = planSession(ctx, iso);
    assert.notEqual(s.intensity, 'rest');
    assert.ok(n.title.includes(s.title));
  }
  assert.equal(new Set(list.map((n) => n.id)).size, list.length, 'unique ids');
  // Today's reminder is skipped once its time has passed.
  const later = buildReminders(state, new Date(2026, 9, 5, 8, 0));
  assert.ok(later.every((n) => n.schedule.at > new Date(2026, 9, 5, 8, 0)));
  // Disabled → nothing.
  assert.deepEqual(buildReminders({ ...state, settings: { reminder: { enabled: false, time: '07:30' } } }, now), []);
});
