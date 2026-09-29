// Progress: current estimated scores per test, per-event gaps to target, trends, result logging.

import { howTo } from '../data/tests.js';
import { evaluateTest, eventPtsRange } from '../engine/scoring.js';
import { buildContext } from '../engine/planner.js';
import { isoDate, parseValue, prettyDate } from '../util.js';
import { h, fmt, scoreBar, sparkline, inputPlaceholder, inputMode, toast } from './components.js';
import { addResult } from '../store.js';

let mockFor = null; // testId when the full-test form is open

export function renderProgress(root, app) {
  const state = app.state;
  const ctx = buildContext(state);
  const today = isoDate();

  const testCards = ctx.tests
    .map(({ test, requirement, choices, targets, mins, events }) => {
      const values = Object.fromEntries(events.filter((e) => e.known).map((e) => [e.event.id, e.value]));
      const ev = evaluateTest(test, values, state.profile, { choices, requirement });
      const unit = test.scoring === 'readiness' ? '/100' : `/${ev.maxTotal}`;
      const rows = events
        .map((e) => {
          const hist = state.results.filter((r) => r.testId === test.id && r.eventId === e.event.id).map((r) => r.value);
          const { maxPts } = eventPtsRange(test, e.event);
          const minPts = Math.max(eventPtsRange(test, e.event).minPts, requirement.minPerEvent ?? 0);
          const met = e.known && e.pts >= e.targetPts;
          return `
          <div class="ev-row">
            <div class="ev-head">
              <strong>${h(e.event.short)}</strong>
              <span class="${met ? 'good' : ''}">${e.known ? h(fmt(e.event, e.value)) : '<em class="muted">not tested</em>'}${e.known ? ` · ${e.pts} pts` : ''}</span>
            </div>
            ${scoreBar({ pts: e.known ? e.pts : null, minPts, targetPts: e.targetPts, maxPts })}
            <div class="ev-foot muted small">
              <span>Min ${h(fmt(e.event, mins.events[e.event.id].value))} · Goal <strong>${h(fmt(e.event, e.target))}</strong></span>
              <span class="trend">${sparkline(hist, e.event.better)}</span>
            </div>
            ${e.known && !met ? `<div class="small">${gapText(e)}</div>` : ''}
            ${met ? '<div class="small good">Goal reached — keep it there.</div>' : ''}
          </div>`;
        })
        .join('');
      return `
      <div class="card">
        <div class="test-head">
          <div><h3>${h(test.name)}</h3><span class="muted small">${h(ev.category)}</span></div>
          <div class="test-score"><strong>${ev.complete ? ev.total : '—'}</strong><span class="muted small">${unit}<br>goal ${targets.total}</span></div>
        </div>
        ${rows}
        <div class="legend muted small"><span class="lg lg-min"></span>minimum <span class="lg lg-target"></span>your goal</div>
        <button class="btn btn-ghost btn-sm" data-mock="${test.id}">${mockFor === test.id ? 'Close' : 'Enter a full test / mock test'}</button>
        ${mockFor === test.id ? mockForm(test, events) : ''}
      </div>`;
    })
    .join('');

  const allEvents = ctx.events;
  root.innerHTML = `
    <header class="page-head"><h1>Progress</h1></header>
    ${testCards}

    <form class="card form" id="result-form">
      <h3>Log a single result</h3>
      <div class="row">
        <label>Event
          <select name="key">${allEvents.map((e) => `<option value="${e.key}">${h(e.test.short)} · ${h(e.event.short)}</option>`).join('')}</select>
        </label>
        <label>Result <input type="text" name="value" placeholder="${allEvents[0] ? inputPlaceholder(allEvents[0].event) : ''}" autocomplete="off"></label>
      </div>
      <label>Date <input type="date" name="date" value="${today}" max="${today}"></label>
      <details class="howto"><summary>How to test this</summary><p id="howto-text">${allEvents[0] ? h(howTo(allEvents[0].event)) : ''}</p></details>
      <button class="btn btn-primary" type="submit">Save result</button>
    </form>

    <h2 class="section">Result history</h2>
    <div class="history">
      ${
        state.results.length
          ? state.results
              .slice()
              .reverse()
              .map((r, i) => {
                const ce = allEvents.find((e) => e.key === `${r.testId}:${r.eventId}`);
                if (!ce) return '';
                return `<div class="hist"><span class="hist-main"><strong>${h(ce.event.short)}</strong> ${h(fmt(ce.event, r.value))}
                  <span class="muted small">${h(ce.test.short)} · ${h(prettyDate(r.date))} · ${h(r.source || '')}</span></span>
                  <button class="btn btn-link btn-sm" data-del="${state.results.length - 1 - i}" aria-label="Delete result">Delete</button></div>`;
              })
              .join('')
          : '<p class="muted">No results yet.</p>'
      }
    </div>
  `;
  bind(root, app, ctx);
}

function gapText(e) {
  const diff = e.target - e.value;
  const ev = e.event;
  if (ev.unit === 'time') {
    const s = Math.abs(Math.round(diff));
    return `${ev.better === 'lower' ? 'Cut' : 'Add'} ${Math.floor(s / 60) ? `${Math.floor(s / 60)} min ` : ''}${s % 60} s to reach your goal.`;
  }
  if (ev.unit === 'ratio') return `Lower by ${Math.abs(diff).toFixed(2)} to reach your goal.`;
  if (ev.unit === 'lb') return `Add ${Math.round(diff)} lb to reach your goal.`;
  return `${Math.round(diff)} more rep${Math.round(diff) === 1 ? '' : 's'} to reach your goal.`;
}

function mockForm(test, events) {
  return `
    <form class="form mock-form" data-mockform="${test.id}">
      <p class="muted small">Enter everything from one test session. Leave blank any event you skipped.</p>
      ${events
        .map(
          (e) => `<label>${h(e.event.name)}
        <input type="text" name="${e.event.id}" placeholder="${inputPlaceholder(e.event)}" inputmode="${inputMode(e.event)}" autocomplete="off"></label>`,
        )
        .join('')}
      <label>Date <input type="date" name="date" value="${isoDate()}" max="${isoDate()}"></label>
      <button class="btn btn-primary" type="submit">Save test</button>
    </form>`;
}

function bind(root, app, ctx) {
  const form = root.querySelector('#result-form');
  const sel = form.querySelector('[name=key]');
  sel?.addEventListener('change', () => {
    const ce = ctx.events.find((e) => e.key === sel.value);
    form.querySelector('[name=value]').placeholder = inputPlaceholder(ce.event);
    form.querySelector('[name=value]').inputMode = inputMode(ce.event);
    root.querySelector('#howto-text').textContent = howTo(ce.event);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ce = ctx.events.find((x) => x.key === sel.value);
    const v = parseValue(ce.event, form.querySelector('[name=value]').value);
    if (isNaN(v)) return toast(`Enter ${ce.event.short} as ${inputPlaceholder(ce.event)}`);
    app.commit((s) => addResult(s, { testId: ce.test.id, eventId: ce.event.id, value: v, date: form.querySelector('[name=date]').value || isoDate(), source: 'log' }));
    toast('Result saved — plan updated');
  });
  root.querySelectorAll('[data-mock]').forEach((b) =>
    b.addEventListener('click', () => {
      mockFor = mockFor === b.dataset.mock ? null : b.dataset.mock;
      renderProgress(root, app);
    }),
  );
  root.querySelectorAll('[data-mockform]').forEach((f) =>
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const testId = f.dataset.mockform;
      const date = f.querySelector('[name=date]').value || isoDate();
      const entries = [];
      for (const ce of ctx.events.filter((x) => x.test.id === testId)) {
        const raw = f.querySelector(`[name="${ce.event.id}"]`).value;
        if (!raw.trim()) continue;
        const v = parseValue(ce.event, raw);
        if (isNaN(v)) return toast(`Check ${ce.event.short} (${inputPlaceholder(ce.event)})`);
        entries.push({ testId, eventId: ce.event.id, value: v, date, source: 'test' });
      }
      if (!entries.length) return toast('Enter at least one result');
      mockFor = null;
      app.commit((s) => entries.forEach((r) => addResult(s, r)));
      toast('Test saved — plan recalibrated');
    }),
  );
  root.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!confirm('Delete this result?')) return;
      app.commit((s) => s.results.splice(Number(b.dataset.del), 1));
    }),
  );
}
