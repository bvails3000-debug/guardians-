// First-run wizard: profile → goal job → required scores → current stats → schedule → review.
// Also reused from Settings ("Change goal") with the current state pre-filled.

import { BRANCHES, TESTS, getTest, testsForBranch, howTo } from '../data/tests.js';
import { getJob, searchJobs, jobsForBranch, requirementFor } from '../data/jobs.js';
import { activeEvents, evaluateTest, eventTargets, scoreEvent } from '../engine/scoring.js';
import { buildContext, weekTemplate, defaultRequirement, latestResult, DEFAULT_TRAINING_DAYS, PHASES } from '../engine/planner.js';
import { addDays, isoDate, parseValue, prettyDate, WEEKDAY_NAMES, daysBetween } from '../util.js';
import { h, fmt, inputPlaceholder, inputMode, formatForInput } from './components.js';
import { addResult } from '../store.js';
import { THEMES, applyTheme, emblemSvg, resolveTheme } from '../themes.js';

const STEPS = ['welcome', 'about', 'job', 'targets', 'stats', 'schedule', 'review'];
const STEP_LABELS = { about: 'You', job: 'Job', targets: 'Scores', stats: 'Stats', schedule: 'Schedule', review: 'Plan' };

let draft = null;

function newDraft(state, editing) {
  const baseline = {};
  for (const testId of state.goal.testIds || []) {
    for (const e of getTest(testId).events) {
      const r = latestResult(state.results, testId, e.id);
      if (r) baseline[`${testId}:${e.id}`] = formatForInput(e, r.value);
    }
  }
  return {
    editing,
    step: editing ? 'about' : 'welcome',
    profile: { ...state.profile },
    jobId: state.goal.jobId,
    testIds: [...(state.goal.testIds || [])],
    level: state.goal.level || 'target',
    customTotals: { ...(state.goal.customTotals || {}) },
    choices: JSON.parse(JSON.stringify(state.goal.choices || {})),
    baseline,
    unknown: {},
    schedule: {
      testDate: state.schedule.testDate || addDays(isoDate(), 70),
      trainingDays: [...(state.schedule.trainingDays || DEFAULT_TRAINING_DAYS[4])],
      pool: state.schedule.pool !== false,
    },
    jobQuery: '',
    specialOnly: false,
    error: '',
  };
}

export function startOnboarding(app, editing = false) {
  draft = newDraft(app.state, editing);
}

/** A throwaway state object built from the draft so we can reuse the planner/scoring. */
function draftState() {
  const results = [];
  for (const [key, raw] of Object.entries(draft.baseline)) {
    const [testId, eventId] = key.split(':');
    const test = getTest(testId);
    const ev = test?.events.find((e) => e.id === eventId);
    if (!ev || !draft.testIds.includes(testId)) continue;
    const value = parseValue(ev, raw);
    if (!isNaN(value)) results.push({ date: isoDate(), testId, eventId, value, source: 'baseline' });
  }
  return {
    profile: draft.profile,
    goal: { jobId: draft.jobId, testIds: draft.testIds, level: draft.level, customTotals: draft.customTotals, choices: draft.choices },
    schedule: { startDate: isoDate(), ...draft.schedule },
    results,
    diary: [],
  };
}

function progressBar() {
  const visible = STEPS.slice(1);
  const idx = visible.indexOf(draft.step);
  return `<ol class="steps">${visible
    .map((s, i) => `<li class="${i < idx ? 'done' : i === idx ? 'current' : ''}">${STEP_LABELS[s]}</li>`)
    .join('')}</ol>`;
}

function nav({ next = 'Next', back = true, nextDisabled = false } = {}) {
  return `
    ${draft.error ? `<div class="msg msg-warn">${h(draft.error)}</div>` : ''}
    <div class="wizard-nav">
      ${back ? '<button class="btn btn-ghost" data-act="back">Back</button>' : '<span></span>'}
      <button class="btn btn-primary" data-act="next" ${nextDisabled ? 'disabled' : ''}>${next}</button>
    </div>`;
}

// ------------------------------------------------------------------ steps

function viewWelcome() {
  return `
    <section class="hero">
      <div class="hero-logo" aria-hidden="true">${logoSvg()}</div>
      <h1>Guardians</h1>
      <p class="lead">Your adaptive coach for military fitness tests.</p>
      <ul class="feature-list">
        <li><strong>Every branch, every test</strong> — Army AFT, Marine PFT/CFT, Navy PRT, Air & Space Force PFA, Coast Guard, and special-warfare screeners (SEAL/SWCC PST, PAST, Ranger/SF, MARSOC, Recon, Rescue Swimmer).</li>
        <li><strong>Pick your job</strong> — see exactly what score you need to qualify and what makes you competitive.</li>
        <li><strong>A plan built from your numbers</strong> — enter your current stats and get a periodized schedule up to test day.</li>
        <li><strong>A diary that adapts</strong> — log how each day went. Bad day, sore, sick or hurt? Tomorrow’s training adjusts automatically.</li>
      </ul>
      <p class="muted small">Takes about 3 minutes. Everything stays on your device.</p>
      <button class="btn btn-primary btn-lg" data-act="next">Get started</button>
    </section>`;
}

function viewAbout() {
  const p = draft.profile;
  return `
    ${progressBar()}
    <h2>About you</h2>
    <p class="muted">Test standards are scored by age and sex, so we need both to calculate your scores.</p>
    <div class="card form">
      <label>First name <span class="muted">(optional)</span>
        <input type="text" data-field="name" value="${h(p.name || '')}" autocomplete="given-name" placeholder="e.g. Alex">
      </label>
      <div class="row">
        <label>Age
          <input type="number" inputmode="numeric" data-field="age" min="17" max="65" value="${p.age ?? ''}" placeholder="18">
        </label>
        <div class="field">
          <span class="label">Scored as</span>
          <div class="seg">
            ${['male', 'female'].map((s) => `<button type="button" class="seg-btn ${p.sex === s ? 'on' : ''}" data-sex="${s}">${s === 'male' ? 'Male' : 'Female'}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>
    <h3>Branch</h3>
    <p class="muted small">The app switches to your branch’s colors. You can pick a different theme anytime in Settings.</p>
    <div class="grid-branches">
      ${Object.values(BRANCHES)
        .map((b) => `<button type="button" class="branch ${p.branch === b.id ? 'on' : ''}" data-branch="${b.id}" style="--bc:${b.color}"><span class="branch-mark">${emblemSvg(THEMES[b.id], 22)}</span>${b.name}</button>`)
        .join('')}
    </div>
    ${nav()}`;
}

function jobCard(j) {
  const on = draft.jobId === j.id;
  const tests = j.tests.map((t) => TESTS[t.testId].short).join(' + ');
  return `
    <button type="button" class="job ${on ? 'on' : ''}" data-job="${j.id}">
      <span class="job-code">${h(j.code)}</span>
      <span class="job-main"><span class="job-title">${h(j.title)}</span><span class="job-tests muted small">${h(BRANCHES[j.branch].name)} · ${h(tests)}</span></span>
      ${j.special ? '<span class="badge badge-special">Special warfare</span>' : ''}
    </button>`;
}

function jobListHtml() {
  const branch = draft.profile.branch;
  let list = draft.jobQuery ? searchJobs(draft.jobQuery, branch) : jobsForBranch(branch);
  if (draft.specialOnly) list = list.filter((j) => j.special);
  let others = [];
  if (draft.jobQuery) {
    others = searchJobs(draft.jobQuery).filter((j) => j.branch !== branch && (!draft.specialOnly || j.special)).slice(0, 6);
  }
  const branchName = BRANCHES[branch]?.name || '';
  return `
    ${list.length ? list.map(jobCard).join('') : `<p class="muted">No ${h(branchName)} jobs match “${h(draft.jobQuery)}”. Try a code (e.g. 11B, 0311), a keyword, or choose “Other”.</p>`}
    ${others.length ? `<div class="subhead">Matches in other branches</div>${others.map(jobCard).join('')}` : ''}`;
}

function viewJob() {
  const branch = draft.profile.branch;
  const tests = testsForBranch(branch);
  return `
    ${progressBar()}
    <h2>What job do you want?</h2>
    <p class="muted">Search by job code or name. We’ll show the score you need and build your plan around it.</p>
    <div class="search">
      <input type="search" data-field="jobQuery" value="${h(draft.jobQuery)}" placeholder="e.g. 11B, infantry, SEAL, pararescue, rescue swimmer" aria-label="Search jobs">
    </div>
    <label class="check"><input type="checkbox" data-field="specialOnly" ${draft.specialOnly ? 'checked' : ''}> Special warfare / special operations only</label>
    <div class="job-list" id="job-list">${jobListHtml()}</div>
    <details class="card">
      <summary><strong>No specific job?</strong> Just train for a test</summary>
      <div class="test-pick">
        ${tests
          .map((t) => {
            const on = !draft.jobId && draft.testIds.length === 1 && draft.testIds[0] === t.id;
            return `<button type="button" class="job ${on ? 'on' : ''}" data-test="${t.id}"><span class="job-main"><span class="job-title">${h(t.name)}</span></span>${t.special ? '<span class="badge badge-special">Special</span>' : ''}</button>`;
          })
          .join('')}
      </div>
    </details>
    ${nav({ nextDisabled: !draft.testIds.length })}`;
}

function viewTargets() {
  const st = draftState();
  const job = getJob(draft.jobId);
  const cards = draft.testIds
    .map((testId) => {
      const test = getTest(testId);
      const req = requirementOrDefault(testId);
      const choices = draft.choices[testId] || {};
      const minT = eventTargets(test, st.profile, req, 'min', choices);
      const tgtT = eventTargets(test, st.profile, req, 'target', choices);
      const groups = Object.entries(test.groups || {});
      const unit = test.scoring === 'readiness' ? ' / 100 readiness' : ` / ${test.maxTotal ?? ''}`;
      return `
      <div class="card">
        <h3>${h(test.name)}</h3>
        <p class="muted small">${h(test.description)}</p>
        ${req.standard === 'combat' ? '<p class="msg msg-info">This job uses the sex-neutral <strong>combat standard</strong>.</p>' : ''}
        ${groups
          .map(
            ([gid, g]) => `
          <div class="field"><span class="label">${h(g.label)} event</span>
            <div class="seg">${test.events
              .filter((e) => e.group === gid)
              .map((e) => `<button type="button" class="seg-btn ${(choices[gid] || g.default) === e.id ? 'on' : ''}" data-choice="${testId}|${gid}|${e.id}">${h(e.short)}</button>`)
              .join('')}</div>
          </div>`,
          )
          .join('')}
        <table class="req">
          <thead><tr><th>Event</th><th>Minimum</th><th>Recommended</th></tr></thead>
          <tbody>
            ${activeEvents(test, choices)
              .map((e) => `<tr><td>${h(e.short)}</td><td>${h(fmt(e, minT.events[e.id].value))}</td><td><strong>${h(fmt(e, tgtT.events[e.id].value))}</strong></td></tr>`)
              .join('')}
            <tr class="total"><td>Total score</td><td>${minT.total}${unit}</td><td><strong>${tgtT.total}</strong>${unit}</td></tr>
          </tbody>
        </table>
        ${
          draft.level === 'custom'
            ? `<label>Custom target total<input type="number" inputmode="numeric" data-custom="${testId}" value="${draft.customTotals[testId] ?? tgtT.total}"></label>`
            : ''
        }
      </div>`;
    })
    .join('');
  return `
    ${progressBar()}
    <h2>${job ? `${h(job.code)} · ${h(job.title)}` : 'Your test'}</h2>
    ${job?.notes ? `<p class="msg msg-info">${h(job.notes)}</p>` : ''}
    <p class="muted">Here’s what it takes. <strong>Minimum</strong> gets you through the door; <strong>Recommended</strong> is what we suggest training for so you’re competitive and have margin on test day.</p>
    <div class="field"><span class="label">Train for</span>
      <div class="seg">
        ${[
          ['target', 'Recommended'],
          ['min', 'Minimum'],
          ['custom', 'Custom'],
        ]
          .map(([id, l]) => `<button type="button" class="seg-btn ${draft.level === id ? 'on' : ''}" data-level="${id}">${l}</button>`)
          .join('')}
      </div>
    </div>
    ${cards}
    <p class="muted small">Scores are estimates from published standards. Official charts vary by age bracket and are updated periodically — confirm with your recruiter.</p>
    ${nav()}`;
}

// Job requirement for the table: always shows the job's recommended target (custom overrides it).
function requirementOrDefault(testId) {
  const req = { ...(requirementFor(draft.jobId, testId) || defaultRequirement(getTest(testId))) };
  if (draft.level === 'custom' && draft.customTotals[testId]) req.targetTotal = draft.customTotals[testId];
  return req;
}

function statRow(test, e) {
  const key = `${test.id}:${e.id}`;
  const raw = draft.baseline[key] ?? '';
  return `
    <div class="stat-row">
      <div class="stat-head">
        <label for="in-${key}">${h(e.name)}</label>
        <span class="pts muted small" data-pts="${key}">${ptsText(test, e, raw)}</span>
      </div>
      <input id="in-${key}" type="text" inputmode="${inputMode(e)}" data-stat="${key}" value="${h(raw)}" placeholder="${inputPlaceholder(e)}" autocomplete="off">
      <details class="howto"><summary>How to test this</summary><p>${h(howTo(e))}</p></details>
    </div>`;
}

function ptsText(test, e, raw) {
  if (raw === '' || raw == null) return 'Not tested yet';
  const v = parseValue(e, raw);
  if (isNaN(v)) return `<span class="bad">Use ${inputPlaceholder(e)}</span>`;
  const req = requirementOrDefault(test.id);
  const pts = scoreEvent(test, e, v, draft.profile, { sexNeutral: req.standard === 'combat' });
  return test.scoring === 'readiness' ? `≈ ${pts}/100 readiness` : `≈ ${pts} pts`;
}

function viewStats() {
  return `
    ${progressBar()}
    <h2>Your current stats</h2>
    <div class="msg msg-info">
      Enter your most recent <strong>honest</strong> numbers for each event — this is the starting point for your whole plan.
      Haven’t tested yourself? Leave it blank and <strong>day 1 of your plan will be a baseline test</strong> with instructions.
      Tap “How to test this” for the correct form and standards.
    </div>
    ${draft.testIds
      .map((testId) => {
        const test = getTest(testId);
        return `<div class="card"><h3>${h(test.name)}</h3>${activeEvents(test, draft.choices[testId]).map((e) => statRow(test, e)).join('')}</div>`;
      })
      .join('')}
    ${nav()}`;
}

function viewSchedule() {
  const s = draft.schedule;
  const hasSwim = draft.testIds.some((id) => getTest(id).events.some((e) => e.kind === 'swim' || e.kind === 'tread'));
  const weeks = Math.round(daysBetween(isoDate(), s.testDate) / 7);
  return `
    ${progressBar()}
    <h2>Your schedule</h2>
    <div class="card form">
      <label>Test date
        <input type="date" data-field="testDate" value="${s.testDate}" min="${addDays(isoDate(), 7)}">
      </label>
      <div class="chips">
        ${[6, 8, 12, 16, 24].map((w) => `<button type="button" class="chip" data-weeks="${w}">${w} weeks</button>`).join('')}
      </div>
      <p class="muted small">${weeks > 0 ? `${weeks} weeks to train.` : ''} ${weeks < 6 ? 'Short timeline — we’ll prioritize your weakest events.' : ''}</p>
    </div>
    <div class="card form">
      <span class="label">Training days (${s.trainingDays.length} per week)</span>
      <div class="days">
        ${WEEKDAY_NAMES.map((n, i) => `<button type="button" class="day ${s.trainingDays.includes(i) ? 'on' : ''}" data-day="${i}">${n}</button>`).join('')}
      </div>
      <p class="muted small">3–6 days recommended. Non-training days are active rest.</p>
    </div>
    ${
      hasSwim
        ? `<div class="card form"><label class="check"><input type="checkbox" data-field="pool" ${s.pool ? 'checked' : ''}> I have access to a pool</label>
        <p class="muted small">Your test includes a swim. Without a pool we’ll give you dryland substitutes, but you really need water time.</p></div>`
        : ''
    }
    ${nav()}`;
}

function viewReview() {
  const st = draftState();
  const ctx = buildContext(st);
  const template = weekTemplate(ctx);
  const famNames = { run: 'Run', swim: 'Swim', ruck: 'Ruck', row: 'Row', strength: 'Strength', upper: 'Upper-body endurance', anaerobic: 'Combat conditioning' };
  const scoreCards = ctx.tests
    .map(({ test, requirement, choices, targets, events }) => {
      const values = Object.fromEntries(events.filter((e) => e.known).map((e) => [e.event.id, e.value]));
      const ev = evaluateTest(test, values, st.profile, { choices, requirement });
      const unit = test.scoring === 'readiness' ? '/100' : `/${ev.maxTotal}`;
      return `<div class="card">
        <h3>${h(test.short)}</h3>
        <div class="kpis">
          <div class="kpi"><span class="kpi-v">${ev.complete ? ev.total : '—'}</span><span class="kpi-l">Now${ev.complete ? ` · ${h(ev.category)}` : ' (needs baseline)'}</span></div>
          <div class="kpi"><span class="kpi-v">${targets.total}</span><span class="kpi-l">Target ${unit}</span></div>
        </div>
        <ul class="gaps">${events
          .map((e) => `<li><span>${h(e.event.short)}</span><span>${e.known ? h(fmt(e.event, e.value)) : '<em>baseline</em>'} → <strong>${h(fmt(e.event, e.target))}</strong></span></li>`)
          .join('')}</ul>
      </div>`;
    })
    .join('');
  const weeks = ctx.totalWeeks;
  return `
    ${progressBar()}
    <h2>Your plan is ready</h2>
    <p class="muted">${weeks} weeks · ${ctx.trainingDays.length} days/week · Test day ${h(prettyDate(ctx.testDate, { weekday: 'long', month: 'long', day: 'numeric' }))}</p>
    ${scoreCards}
    <div class="card">
      <h3>Your typical week</h3>
      <ul class="week-template">${template
        .map((s, i) => `<li><span class="muted">${WEEKDAY_NAMES[ctx.trainingDays[i]]}</span> ${h(famNames[s.family] || s.family)}${s.extras.length ? ` <span class="muted small">+ ${s.extras.map((x) => famNames[x] || x).join(', ')}</span>` : ''}</li>`)
        .join('')}</ul>
      <p class="muted small">Weighted toward your biggest gaps. Phases: ${Object.values(PHASES).map((p) => p.label).join(' → ')}. Mock tests every 4th week.</p>
    </div>
    <div class="msg msg-info">Log every day in the <strong>Diary</strong> — how you felt, what you finished, anything that hurts. The plan adapts from it.</div>
    ${nav({ next: draft.editing ? 'Save changes' : 'Start training' })}`;
}

// ------------------------------------------------------------ validation

function validate() {
  const p = draft.profile;
  switch (draft.step) {
    case 'about':
      if (!(Number(p.age) >= 17 && Number(p.age) <= 65)) return 'Enter an age between 17 and 65.';
      if (!p.sex) return 'Choose which standard you’re scored on.';
      if (!p.branch) return 'Pick a branch.';
      return '';
    case 'job':
      return draft.testIds.length ? '' : 'Choose a job or a test.';
    case 'stats':
      for (const [key, raw] of Object.entries(draft.baseline)) {
        if (raw === '' || raw == null) continue;
        const [testId, eventId] = key.split(':');
        if (!draft.testIds.includes(testId)) continue;
        const ev = getTest(testId).events.find((e) => e.id === eventId);
        if (ev && isNaN(parseValue(ev, raw))) return `Check your ${ev.short} entry — use ${inputPlaceholder(ev)}.`;
      }
      return '';
    case 'schedule':
      if (!draft.schedule.testDate || daysBetween(isoDate(), draft.schedule.testDate) < 7) return 'Pick a test date at least a week away.';
      if (draft.schedule.trainingDays.length < 2) return 'Pick at least 2 training days.';
      return '';
    default:
      return '';
  }
}

function finish(app) {
  const st = draftState();
  app.commit((state) => {
    state.profile = { ...draft.profile, age: Number(draft.profile.age) };
    state.goal = st.goal;
    const startDate = draft.editing && state.schedule.startDate ? state.schedule.startDate : isoDate();
    state.schedule = { ...state.schedule, ...draft.schedule, startDate: startDate > draft.schedule.testDate ? isoDate() : startDate };
    for (const r of st.results) {
      const prev = latestResult(state.results, r.testId, r.eventId);
      if (!prev || prev.value !== r.value) addResult(state, r);
    }
    state.onboarded = true;
  });
  draft = null;
  app.go(app.state.onboarded ? '#/today' : '#/');
}

// ----------------------------------------------------------------- render

const VIEWS = { welcome: viewWelcome, about: viewAbout, job: viewJob, targets: viewTargets, stats: viewStats, schedule: viewSchedule, review: viewReview };

export function renderOnboarding(root, app) {
  if (!draft) startOnboarding(app, app.state.onboarded);
  // Preview the branch theme live while choosing.
  applyTheme(resolveTheme({ profile: draft.profile, settings: app.state.settings }));
  root.innerHTML = `<div class="wizard">${VIEWS[draft.step]()}</div>`;
  bind(root, app);
}

function rerender(root, app) {
  renderOnboarding(root, app);
  window.scrollTo(0, 0);
}

function bind(root, app) {
  root.querySelectorAll('[data-act]').forEach((b) =>
    b.addEventListener('click', () => {
      const i = STEPS.indexOf(draft.step);
      if (b.dataset.act === 'back') {
        draft.error = '';
        if (draft.editing && draft.step === 'about') {
          draft = null;
          app.go('#/settings');
          return;
        }
        draft.step = STEPS[Math.max(0, i - 1)];
      } else {
        draft.error = validate();
        if (draft.error) return rerender(root, app);
        if (draft.step === 'review') return finish(app);
        draft.step = STEPS[i + 1];
      }
      rerender(root, app);
    }),
  );

  // Generic fields.
  root.querySelectorAll('[data-field]').forEach((el) => {
    const f = el.dataset.field;
    const handler = () => {
      if (f === 'name' || f === 'age') draft.profile[f] = el.value;
      else if (f === 'jobQuery') {
        draft.jobQuery = el.value;
        const list = root.querySelector('#job-list');
        list.innerHTML = jobListHtml();
        bindJobs(root, app);
      } else if (f === 'specialOnly') {
        draft.specialOnly = el.checked;
        root.querySelector('#job-list').innerHTML = jobListHtml();
        bindJobs(root, app);
      } else if (f === 'testDate') {
        draft.schedule.testDate = el.value;
        rerender(root, app);
      } else if (f === 'pool') draft.schedule.pool = el.checked;
    };
    el.addEventListener(el.type === 'checkbox' || el.type === 'date' ? 'change' : 'input', handler);
  });

  root.querySelectorAll('[data-sex]').forEach((b) =>
    b.addEventListener('click', () => {
      draft.profile.sex = b.dataset.sex;
      rerender(root, app);
    }),
  );
  root.querySelectorAll('[data-branch]').forEach((b) =>
    b.addEventListener('click', () => {
      if (draft.profile.branch !== b.dataset.branch) {
        draft.profile.branch = b.dataset.branch;
        const j = getJob(draft.jobId);
        if (j && j.branch !== b.dataset.branch) {
          draft.jobId = null;
          draft.testIds = [];
        }
      }
      rerender(root, app);
    }),
  );
  bindJobs(root, app);
  root.querySelectorAll('[data-test]').forEach((b) =>
    b.addEventListener('click', () => {
      draft.jobId = null;
      draft.testIds = [b.dataset.test];
      rerender(root, app);
    }),
  );
  root.querySelectorAll('[data-level]').forEach((b) =>
    b.addEventListener('click', () => {
      draft.level = b.dataset.level;
      rerender(root, app);
    }),
  );
  root.querySelectorAll('[data-choice]').forEach((b) =>
    b.addEventListener('click', () => {
      const [testId, gid, eid] = b.dataset.choice.split('|');
      draft.choices[testId] = { ...(draft.choices[testId] || {}), [gid]: eid };
      rerender(root, app);
    }),
  );
  root.querySelectorAll('[data-custom]').forEach((el) =>
    el.addEventListener('change', () => {
      const v = Number(el.value);
      if (v > 0) draft.customTotals[el.dataset.custom] = v;
      rerender(root, app);
    }),
  );
  root.querySelectorAll('[data-stat]').forEach((el) =>
    el.addEventListener('input', () => {
      const key = el.dataset.stat;
      draft.baseline[key] = el.value;
      const [testId, eventId] = key.split(':');
      const test = getTest(testId);
      const ev = test.events.find((e) => e.id === eventId);
      const span = root.querySelector(`[data-pts="${CSS.escape(key)}"]`);
      if (span) span.innerHTML = ptsText(test, ev, el.value);
    }),
  );
  root.querySelectorAll('[data-weeks]').forEach((b) =>
    b.addEventListener('click', () => {
      draft.schedule.testDate = addDays(isoDate(), Number(b.dataset.weeks) * 7);
      rerender(root, app);
    }),
  );
  root.querySelectorAll('[data-day]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.day);
      const days = draft.schedule.trainingDays;
      draft.schedule.trainingDays = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
      rerender(root, app);
    }),
  );
}

function bindJobs(root, app) {
  root.querySelectorAll('[data-job]').forEach((b) =>
    b.addEventListener('click', () => {
      const j = getJob(b.dataset.job);
      draft.jobId = j.id;
      draft.testIds = j.tests.map((t) => t.testId);
      draft.profile.branch = j.branch;
      draft.error = '';
      root.querySelector('#job-list').innerHTML = jobListHtml();
      bindJobs(root, app);
      root.querySelectorAll('[data-test]').forEach((x) => x.classList.remove('on'));
      const next = root.querySelector('[data-act="next"]');
      if (next) next.disabled = false;
    }),
  );
}

export function logoSvg() {
  return `<svg viewBox="0 0 64 64" width="72" height="72"><path d="M32 4 8 12v18c0 15 10 26 24 30 14-4 24-15 24-30V12L32 4z" fill="currentColor" opacity=".15"/><path d="M32 4 8 12v18c0 15 10 26 24 30 14-4 24-15 24-30V12L32 4z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="m20 34 8 8 16-18" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

