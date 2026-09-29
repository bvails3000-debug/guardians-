// Dashboard: countdown, readiness, today's (adapted) session, what's next, score snapshot.

import { getJob } from '../data/jobs.js';
import { evaluateTest } from '../engine/scoring.js';
import { analyze, dayScore } from '../engine/adapt.js';
import { buildContext, planSession, planSummary } from '../engine/planner.js';
import { addDays, daysBetween, isoDate, prettyDate } from '../util.js';
import { h, sessionCard, intensityBadge, ring, messages } from './components.js';
import { emblemSvg, resolveTheme } from '../themes.js';

function greeting(name) {
  const hr = new Date().getHours();
  const part = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

export function renderToday(root, app) {
  const state = app.state;
  const today = isoDate();
  const ctx = buildContext(state);
  const summary = planSummary(ctx, today);
  const job = getJob(state.goal.jobId);
  const adaptation = analyze(state.diary, today);
  const session = planSession(ctx, today < ctx.startDate ? ctx.startDate : today, adaptation);
  const todayEntry = state.diary.find((e) => e.date === today);
  const daysLeft = daysBetween(today, ctx.testDate);
  const unknown = ctx.events.filter((e) => !e.known);
  const theme = resolveTheme(state);

  const upcoming = [];
  for (let i = 1; i <= 3; i++) {
    const d = addDays(today, i);
    const s = planSession(ctx, d);
    if (s) upcoming.push(s);
  }

  const snapshot = ctx.tests
    .map(({ test, requirement, choices, targets, events }) => {
      const values = Object.fromEntries(events.filter((e) => e.known).map((e) => [e.event.id, e.value]));
      const ev = evaluateTest(test, values, state.profile, { choices, requirement });
      const pct = ev.complete ? Math.round((ev.total / targets.total) * 100) : 0;
      return `
        <a class="snap" href="#/progress">
          <span class="snap-name">${h(test.short)}</span>
          <span class="snap-score">${ev.complete ? ev.total : '—'}<span class="muted"> / ${targets.total} goal</span></span>
          <span class="snap-bar"><span style="width:${Math.min(100, pct)}%"></span></span>
          <span class="muted small">${ev.complete ? h(ev.category) : 'Log a baseline to score'}</span>
        </a>`;
    })
    .join('');

  root.innerHTML = `
    <header class="page-head">
      <div>
        <h1>${h(greeting(state.profile.name))}</h1>
        <p class="muted">${job ? `${h(job.code)} · ${h(job.title)}` : h(ctx.tests.map((t) => t.test.short).join(' + '))}</p>
      </div>
      <a class="brand-badge" href="#/settings" aria-label="${h(theme.name)} theme — change in Settings">${emblemSvg(theme, 30)}</a>
    </header>

    <div class="grid-2">
      <div class="card countdown">
        <div class="big">${daysLeft >= 0 ? daysLeft : 0}</div>
        <div class="muted">${daysLeft === 0 ? 'Test day!' : daysLeft === 1 ? 'day to test' : 'days to test'}</div>
        <div class="small">${h(prettyDate(ctx.testDate, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }))}</div>
        <div class="phase"><span class="badge badge-phase">${h(summary.phaseInfo.label)} phase</span> <span class="muted small">Week ${Math.min(summary.week + 1, summary.totalWeeks)} of ${summary.totalWeeks}</span></div>
      </div>
      <div class="card readiness">
        ${ring(adaptation.readiness, 100, 'readiness')}
        <div>
          <div class="small">${readinessText(adaptation.readiness)}</div>
          ${todayEntry ? `<div class="small muted">Today logged · day score ${dayScore(todayEntry)}</div>` : ''}
        </div>
      </div>
    </div>

    ${
      unknown.length
        ? `<div class="msg msg-info">Missing baseline for ${unknown.map((e) => h(e.event.short)).join(', ')}. <a href="#/progress">Enter results</a> so your plan uses real numbers.</div>`
        : ''
    }
    <p class="muted small phase-blurb">${h(summary.phaseInfo.blurb)}</p>

    ${session ? sessionCard(session, { open: true, today: true }) : ''}

    <div class="actions">
      <a class="btn btn-primary" href="#/log">${todayEntry ? 'Edit today’s diary' : 'Log today in your diary'}</a>
      <a class="btn btn-ghost" href="#/plan">Full plan</a>
    </div>

    <h2 class="section">Coming up</h2>
    <div class="upcoming">
      ${upcoming
        .map(
          (s) => `<a class="up" href="#/plan">
          <span class="muted small">${h(prettyDate(s.date))}</span>
          <span>${h(s.title)}</span>
          ${intensityBadge(s.intensity)}
        </a>`,
        )
        .join('')}
    </div>
    ${messages(upcoming.flatMap((s) => s.notes || []).filter((m, i, arr) => m.level === 'warn' && arr.findIndex((x) => x.text === m.text) === i).slice(0, 1))}

    <h2 class="section">Score snapshot</h2>
    <div class="snaps">${snapshot}</div>
  `;
}

function readinessText(r) {
  if (r >= 80) return 'Fresh and ready. Push the quality today.';
  if (r >= 65) return 'Good to train as planned.';
  if (r >= 50) return 'A little worn down — the plan has been eased.';
  return 'Recovery comes first today.';
}
