// Weekly plan view with week-by-week navigation.

import { buildContext, weekSessions, planSummary, PHASES, phaseFor } from '../engine/planner.js';
import { addDays, isoDate, prettyDate, weekday } from '../util.js';
import { h, sessionCard } from './components.js';

let weekOffset = 0;

function mondayOf(iso) {
  const wd = weekday(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

export function renderPlan(root, app) {
  const state = app.state;
  const today = isoDate();
  const ctx = buildContext(state);
  const start = addDays(mondayOf(today), weekOffset * 7);
  const sessions = weekSessions(ctx, start);
  const diaryByDate = new Map(state.diary.map((e) => [e.date, e]));
  const summary = planSummary(ctx, today);
  const refDate = sessions.find((s) => s.date >= ctx.startDate && s.date <= ctx.testDate)?.date;
  const ph = refDate ? phaseFor(ctx, refDate) : null;
  const firstWeek = mondayOf(ctx.startDate);
  const lastWeek = mondayOf(ctx.testDate);

  const done = { full: '✓ Done', partial: '◐ Partial', skipped: '✗ Skipped', rest: '• Rested' };
  root.innerHTML = `
    <header class="page-head"><h1>Training plan</h1></header>
    <div class="phase-strip">${Object.entries(PHASES)
      .map(([id, p]) => `<span class="phase-chip ${ph?.phase === id ? 'on' : ''}">${p.label}</span>`)
      .join('<span class="muted">›</span>')}</div>
    <div class="week-nav">
      <button class="btn btn-ghost" data-week="-1" ${start <= firstWeek ? 'disabled' : ''} aria-label="Previous week">‹</button>
      <div class="week-label">
        <strong>${h(prettyDate(start, { month: 'short', day: 'numeric' }))} – ${h(prettyDate(addDays(start, 6), { month: 'short', day: 'numeric' }))}</strong>
        <span class="muted small">${ph ? `Week ${ph.week + 1} of ${summary.totalWeeks} · ${PHASES[ph.phase].label}` : 'Outside plan'}</span>
      </div>
      <button class="btn btn-ghost" data-week="1" ${start >= lastWeek ? 'disabled' : ''} aria-label="Next week">›</button>
    </div>
    ${weekOffset !== 0 ? '<button class="btn btn-link" data-week="0">Back to this week</button>' : ''}
    ${ph ? `<p class="muted small">${h(PHASES[ph.phase].blurb)}</p>` : ''}
    <div class="sessions">
      ${sessions
        .map((s) => {
          const entry = diaryByDate.get(s.date);
          const card = sessionCard(s, { open: s.date === today, today: s.date === today });
          const status = entry ? `<div class="logged logged-${entry.completion}">${done[entry.completion] || 'Logged'}${entry.notes ? ` — “${h(entry.notes.slice(0, 80))}”` : ''}</div>` : '';
          return `<div class="plan-day ${s.date < today ? 'past' : ''}">${card}${status}</div>`;
        })
        .join('')}
    </div>
    <p class="muted small">Future days update automatically when you log your diary or new results.</p>
  `;
  root.querySelectorAll('[data-week]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.week);
      weekOffset = d === 0 ? 0 : weekOffset + d;
      renderPlan(root, app);
    }),
  );
}
