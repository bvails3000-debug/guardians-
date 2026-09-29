// Settings: goal/profile editing, schedule, backup/restore, reset.

import { BRANCHES, getTest } from '../data/tests.js';
import { getJob } from '../data/jobs.js';
import { addDays, isoDate, WEEKDAY_NAMES, daysBetween } from '../util.js';
import { h, toast } from './components.js';
import { exportJson, importJson, reset } from '../store.js';
import { startOnboarding } from './onboarding.js';

export function renderSettings(root, app) {
  const s = app.state;
  const job = getJob(s.goal.jobId);
  const hasSwim = s.goal.testIds.some((id) => getTest(id).events.some((e) => e.kind === 'swim' || e.kind === 'tread'));
  const levels = { target: 'Recommended', min: 'Minimum', custom: 'Custom' };
  root.innerHTML = `
    <header class="page-head"><h1>Settings</h1></header>

    <div class="card">
      <h3>Your goal</h3>
      <dl class="dl">
        <dt>Name</dt><dd>${h(s.profile.name || '—')}</dd>
        <dt>Age / standard</dt><dd>${h(s.profile.age)} · ${s.profile.sex === 'female' ? 'Female' : 'Male'}</dd>
        <dt>Branch</dt><dd>${h(BRANCHES[s.profile.branch]?.name || '—')}</dd>
        <dt>Job</dt><dd>${job ? `${h(job.code)} · ${h(job.title)}` : 'No specific job'}</dd>
        <dt>Tests</dt><dd>${s.goal.testIds.map((id) => h(getTest(id).short)).join(', ')}</dd>
        <dt>Training for</dt><dd>${levels[s.goal.level] || 'Recommended'} score</dd>
      </dl>
      <button class="btn btn-primary" data-edit>Change job, targets or stats</button>
    </div>

    <div class="card form">
      <h3>Schedule</h3>
      <label>Test date <input type="date" name="testDate" value="${s.schedule.testDate}" min="${addDays(isoDate(), 1)}"></label>
      <p class="muted small">${Math.max(0, daysBetween(isoDate(), s.schedule.testDate))} days away. Changing it re-periodizes the plan.</p>
      <span class="label">Training days</span>
      <div class="days">${WEEKDAY_NAMES.map((n, i) => `<button type="button" class="day ${s.schedule.trainingDays.includes(i) ? 'on' : ''}" data-day="${i}">${n}</button>`).join('')}</div>
      ${hasSwim ? `<label class="check"><input type="checkbox" name="pool" ${s.schedule.pool !== false ? 'checked' : ''}> I have pool access</label>` : ''}
      <button class="btn btn-ghost btn-sm" data-restart>Restart plan from today</button>
    </div>

    <div class="card">
      <h3>Backup</h3>
      <p class="muted small">Your data lives only on this device. Export a backup to move it to a new phone.</p>
      <div class="actions">
        <button class="btn btn-ghost" data-export>Export backup</button>
        <label class="btn btn-ghost">Import backup<input type="file" accept="application/json,.json" data-import hidden></label>
      </div>
    </div>

    <div class="card">
      <h3>Install on your phone</h3>
      <p class="small">iPhone: open in Safari → Share → <strong>Add to Home Screen</strong>. Android: Chrome menu → <strong>Install app</strong>. It then works offline like a regular app.</p>
      <button class="btn btn-ghost btn-sm" data-install hidden>Install now</button>
    </div>

    <div class="card danger">
      <h3>Reset</h3>
      <p class="muted small">Deletes your profile, results and diary from this device.</p>
      <button class="btn btn-danger" data-reset>Erase all data</button>
    </div>

    <div class="card">
      <h3>About the scores</h3>
      <p class="small muted">Standards are condensed from publicly available charts and pipeline guidance, modeled with minimum and max/competitive anchors per event with age adjustment. They are estimates for training — official charts, pipeline requirements and job standards change. Always confirm with your recruiter or unit. Consult a medical professional before starting a new training program and for any persistent pain.</p>
    </div>
  `;

  root.querySelector('[data-edit]').addEventListener('click', () => {
    startOnboarding(app, true);
    app.go('#/setup');
  });
  root.querySelector('[name=testDate]').addEventListener('change', (e) => {
    if (!e.target.value) return;
    app.commit((st) => {
      st.schedule.testDate = e.target.value;
      if (st.schedule.startDate > e.target.value) st.schedule.startDate = isoDate();
    });
    toast('Test date updated');
  });
  root.querySelectorAll('[data-day]').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.day);
      const days = s.schedule.trainingDays;
      const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
      if (next.length < 2) return toast('Keep at least 2 training days');
      app.commit((st) => (st.schedule.trainingDays = next));
    }),
  );
  root.querySelector('[name=pool]')?.addEventListener('change', (e) => app.commit((st) => (st.schedule.pool = e.target.checked)));
  root.querySelector('[data-restart]').addEventListener('click', () => {
    if (!confirm('Restart the plan from today? Your results and diary are kept.')) return;
    app.commit((st) => (st.schedule.startDate = isoDate()));
    toast('Plan restarted from today');
  });
  root.querySelector('[data-export]').addEventListener('click', () => {
    const blob = new Blob([exportJson(app.state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `guardians-backup-${isoDate()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  root.querySelector('[data-import]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = importJson(await file.text());
      app.replace(data);
      toast('Backup restored');
    } catch (err) {
      toast(err.message || 'Could not read that file');
    }
  });
  root.querySelector('[data-reset]').addEventListener('click', () => {
    if (!confirm('Erase all your data? This cannot be undone.')) return;
    reset();
    app.replace(null);
  });
  const installBtn = root.querySelector('[data-install]');
  if (app.installPrompt) {
    installBtn.hidden = false;
    installBtn.addEventListener('click', async () => {
      app.installPrompt.prompt();
      await app.installPrompt.userChoice;
      app.installPrompt = null;
      installBtn.hidden = true;
    });
  }
}
