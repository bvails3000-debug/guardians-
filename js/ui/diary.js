// Training diary: log how the day went. Saving shows exactly how tomorrow's plan changed.

import { PAIN_AREAS, dayScore, diaryStats } from '../engine/adapt.js';
import { buildContext, planSession } from '../engine/planner.js';
import { addDays, isoDate, parseValue, prettyDate } from '../util.js';
import { h, messages, sessionCard, inputPlaceholder, inputMode, toast } from './components.js';
import { upsertDiary, addResult } from '../store.js';

const SCALES = {
  energy: { label: 'Energy', lo: 'Drained', hi: 'Charged' },
  sleep: { label: 'Sleep quality', lo: 'Awful', hi: 'Great' },
  soreness: { label: 'Soreness', lo: 'None', hi: 'Very sore' },
  mood: { label: 'Mood / stress', lo: 'Rough', hi: 'Great' },
};

let form = null;
let lastChange = null;

function blankForm(date, existing) {
  return {
    date,
    completion: existing?.completion ?? 'full',
    rpe: existing?.rpe ?? 6,
    energy: existing?.energy ?? 3,
    sleep: existing?.sleep ?? 3,
    soreness: existing?.soreness ?? 2,
    mood: existing?.mood ?? 3,
    pain: [...(existing?.pain || [])],
    sick: !!existing?.sick,
    notes: existing?.notes || '',
    results: [],
  };
}

export function renderDiary(root, app, param) {
  const state = app.state;
  const today = isoDate();
  const date = param && /^\d{4}-\d{2}-\d{2}$/.test(param) && param <= today ? param : today;
  const existing = state.diary.find((e) => e.date === date);
  if (!form || form.date !== date) form = blankForm(date, existing);

  const ctx = buildContext(state);
  const planned = planSession(ctx, date);
  const stats = diaryStats(state.diary, today);

  root.innerHTML = `
    <header class="page-head"><h1>Diary</h1></header>
    <div class="kpis card">
      <div class="kpi"><span class="kpi-v">${stats.streak}</span><span class="kpi-l">day streak</span></div>
      <div class="kpi"><span class="kpi-v">${stats.compliance ?? '—'}${stats.compliance != null ? '%' : ''}</span><span class="kpi-l">sessions done (14 d)</span></div>
      <div class="kpi"><span class="kpi-v">${stats.avgScore ?? '—'}</span><span class="kpi-l">avg day score</span></div>
    </div>

    ${lastChange ? changePanel(lastChange) : ''}

    <form class="card form diary-form" id="diary-form">
      <div class="row">
        <label>Date <input type="date" name="date" value="${date}" max="${today}"></label>
      </div>
      ${planned ? `<p class="muted small">Planned: <strong>${h(planned.title)}</strong>${existing ? ' · <em>editing saved entry</em>' : ''}</p>` : ''}

      <div class="field"><span class="label">How much did you get done?</span>
        <div class="seg seg-full seg-4">${[
          ['full', 'All of it'],
          ['partial', 'Some'],
          ['skipped', 'Skipped'],
          ['rest', 'Rest day'],
        ]
          .map(([v, l]) => `<button type="button" class="seg-btn ${form.completion === v ? 'on' : ''}" data-set="completion" data-val="${v}">${l}</button>`)
          .join('')}</div>
      </div>

      ${
        form.completion === 'full' || form.completion === 'partial'
          ? `<label><span>How hard did it feel? <strong id="rpe-v">${form.rpe}</strong>/10 · <span class="muted" id="rpe-l">${rpeLabel(form.rpe)}</span></span>
        <input type="range" min="1" max="10" name="rpe" value="${form.rpe}"></label>`
          : ''
      }

      ${Object.entries(SCALES)
        .map(
          ([k, s]) => `
        <div class="field scale"><span class="label">${s.label}</span>
          <div class="seg seg-full">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="seg-btn sq ${form[k] === n ? 'on' : ''}" data-set="${k}" data-val="${n}" aria-label="${s.label} ${n}">${n}</button>`).join('')}</div>
          <div class="scale-ends muted small"><span>1 · ${s.lo}</span><span>${s.hi} · 5</span></div>
        </div>`,
        )
        .join('')}

      <div class="field"><span class="label">Anything hurting?</span>
        <div class="chips">${Object.keys(PAIN_AREAS)
          .map((a) => `<button type="button" class="chip ${form.pain.includes(a) ? 'on' : ''}" data-pain="${a}">${a}</button>`)
          .join('')}</div>
      </div>
      <label class="check"><input type="checkbox" name="sick" ${form.sick ? 'checked' : ''}> I’m sick / feeling ill</label>

      <label>Notes
        <textarea name="notes" rows="3" placeholder="How did it go? e.g. “Legs felt heavy, cut the run short. Left knee a bit sore.”">${h(form.notes)}</textarea>
      </label>
      <p class="muted small">The app reads your notes too — words like tired, sick, knee pain or new PR all shape the plan.</p>

      <details class="card-inner" ${form.results.length ? 'open' : ''}>
        <summary>Record a test result from today</summary>
        ${resultRows(ctx)}
        <button type="button" class="btn btn-ghost btn-sm" data-add-result>+ Add result</button>
      </details>

      <button type="submit" class="btn btn-primary btn-block">Save entry</button>
    </form>

    <h2 class="section">History</h2>
    <div class="history">
      ${
        state.diary.length
          ? state.diary
              .slice()
              .reverse()
              .slice(0, 30)
              .map((e) => {
                const s = dayScore(e);
                return `<a class="hist" href="#/log/${e.date}">
                  <span class="score score-${s >= 75 ? 'good' : s >= 50 ? 'ok' : 'low'}">${s}</span>
                  <span class="hist-main"><strong>${h(prettyDate(e.date))}</strong> <span class="muted small">${h(e.completion)}${e.sick ? ' · sick' : ''}${e.pain?.length ? ` · ${h(e.pain.join(', '))}` : ''}</span>
                  ${e.notes ? `<span class="muted small hist-notes">${h(e.notes)}</span>` : ''}</span>
                </a>`;
              })
              .join('')
          : '<p class="muted">No entries yet. Log your first day above.</p>'
      }
    </div>
  `;
  bind(root, app, ctx);
}

function resultRows(ctx) {
  return form.results
    .map((r, i) => {
      const opts = ctx.events.map((e) => `<option value="${e.key}" ${r.key === e.key ? 'selected' : ''}>${h(e.test.short)} · ${h(e.event.short)}</option>`).join('');
      const ev = ctx.events.find((e) => e.key === r.key)?.event;
      return `<div class="row result-row">
        <select data-rkey="${i}">${opts}</select>
        <input type="text" data-rval="${i}" value="${h(r.value)}" placeholder="${ev ? inputPlaceholder(ev) : ''}" inputmode="${ev ? inputMode(ev) : 'text'}">
      </div>`;
    })
    .join('');
}

function rpeLabel(r) {
  if (r <= 3) return 'easy';
  if (r <= 6) return 'moderate';
  if (r <= 8) return 'hard';
  return 'max effort';
}

function changePanel(c) {
  const changed = c.before.title !== c.after.title || c.before.intensity !== c.after.intensity || c.before.minutes !== c.after.minutes;
  return `
    <div class="card change">
      <h3>${changed ? 'Your plan adapted' : 'Plan on track'}</h3>
      <p class="muted small">Next session (${h(prettyDate(c.after.date))}):
        ${changed ? `<s>${h(c.before.title)}</s> → <strong>${h(c.after.title)}</strong>` : `<strong>${h(c.after.title)}</strong> — no changes needed.`}</p>
      ${messages(c.after.notes)}
      ${sessionCard(c.after)}
      <button class="btn btn-link" data-dismiss>Dismiss</button>
    </div>`;
}

function readForm(root) {
  const f = root.querySelector('#diary-form');
  const rpe = f.querySelector('[name=rpe]');
  if (rpe) form.rpe = Number(rpe.value);
  form.notes = f.querySelector('[name=notes]').value;
  form.sick = f.querySelector('[name=sick]').checked;
  root.querySelectorAll('[data-rkey]').forEach((s) => (form.results[Number(s.dataset.rkey)].key = s.value));
  root.querySelectorAll('[data-rval]').forEach((s) => (form.results[Number(s.dataset.rval)].value = s.value));
}

function bind(root, app, ctx) {
  const rerender = () => renderDiary(root, app, form.date);
  root.querySelector('[name=date]').addEventListener('change', (e) => {
    form = null;
    lastChange = null;
    app.go(`#/log/${e.target.value}`);
  });
  root.querySelectorAll('[data-set]').forEach((b) =>
    b.addEventListener('click', () => {
      readForm(root);
      const k = b.dataset.set;
      form[k] = k === 'completion' ? b.dataset.val : Number(b.dataset.val);
      rerender();
    }),
  );
  root.querySelectorAll('[data-pain]').forEach((b) =>
    b.addEventListener('click', () => {
      readForm(root);
      const a = b.dataset.pain;
      form.pain = form.pain.includes(a) ? form.pain.filter((x) => x !== a) : [...form.pain, a];
      rerender();
    }),
  );
  const rpe = root.querySelector('[name=rpe]');
  rpe?.addEventListener('input', () => {
    root.querySelector('#rpe-v').textContent = rpe.value;
    root.querySelector('#rpe-l').textContent = rpeLabel(Number(rpe.value));
  });
  root.querySelector('[data-add-result]')?.addEventListener('click', () => {
    readForm(root);
    form.results.push({ key: ctx.events[0]?.key, value: '' });
    rerender();
  });
  root.querySelector('[data-dismiss]')?.addEventListener('click', () => {
    lastChange = null;
    rerender();
  });

  root.querySelector('#diary-form').addEventListener('submit', (e) => {
    e.preventDefault();
    readForm(root);
    // Validate results first.
    const results = [];
    for (const r of form.results) {
      if (!r.value) continue;
      const ce = ctx.events.find((x) => x.key === r.key);
      const v = parseValue(ce.event, r.value);
      if (isNaN(v)) {
        toast(`Check your ${ce.event.short} result (${inputPlaceholder(ce.event)})`);
        return;
      }
      results.push({ testId: ce.test.id, eventId: ce.event.id, value: v });
    }
    const beforeCtx = buildContext(app.state);
    let tomorrow = addDays(form.date, 1);
    for (let i = 1; i <= 4; i++) {
      const d = addDays(form.date, i);
      const s = planSession(beforeCtx, d);
      if (s && s.intensity !== 'rest') {
        tomorrow = d;
        break;
      }
    }
    const before = planSession(beforeCtx, tomorrow);
    const entry = {
      date: form.date,
      completion: form.completion,
      rpe: form.completion === 'full' || form.completion === 'partial' ? form.rpe : null,
      energy: form.energy,
      sleep: form.sleep,
      soreness: form.soreness,
      mood: form.mood,
      pain: form.pain,
      sick: form.sick,
      notes: form.notes.trim(),
    };
    app.commit((state) => {
      upsertDiary(state, entry);
      for (const r of results) addResult(state, { ...r, date: form.date, source: 'diary' });
    }, false);
    const after = planSession(buildContext(app.state), tomorrow);
    lastChange = before && after ? { before, after } : null;
    form = blankForm(form.date, entry);
    toast('Diary saved');
    rerender();
    window.scrollTo(0, 0);
  });
}
