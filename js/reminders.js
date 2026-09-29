// Daily training reminders (native apps only). Each reminder names that day's planned session,
// so they are rescheduled whenever the plan changes (new diary entry, result or schedule edit).

import { buildContext, planSession } from './engine/planner.js';
import { addDays, daysBetween, fromIso, isoDate } from './util.js';
import { plugin } from './native.js';

const FIRST_ID = 100;
const DAYS_AHEAD = 14;

/** Pure: the notifications to schedule for the next two weeks. */
export function buildReminders(state, now = new Date()) {
  const r = state.settings?.reminder;
  if (!r?.enabled || !state.onboarded || !state.schedule?.testDate) return [];
  const [hh, mm] = r.time.split(':').map(Number);
  const ctx = buildContext(state);
  const today = isoDate(now);
  const out = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date = addDays(today, i);
    if (date > ctx.testDate) break;
    const at = fromIso(date);
    at.setHours(hh, mm, 0, 0);
    if (at <= now) continue;
    const s = planSession(ctx, date);
    if (!s || s.intensity === 'rest') continue;
    const left = daysBetween(date, ctx.testDate);
    const title = s.type === 'test_day' ? 'Test day — you’re ready' : `Today: ${s.title}`;
    const body =
      s.type === 'test_day'
        ? 'Warm up well, trust your pacing, and log your scores afterward.'
        : `${s.minutes ? `About ${s.minutes} min. ` : ''}${left} day${left === 1 ? '' : 's'} to test. Log how it went in your diary.`;
    out.push({ id: FIRST_ID + i, title, body, schedule: { at, allowWhileIdle: true } });
  }
  return out;
}

let pending = null;

/** Cancel and reschedule reminders. Safe to call often; runs at most once per tick. */
export function syncReminders(state) {
  const ln = plugin('LocalNotifications');
  if (!ln) return Promise.resolve();
  if (pending) return pending;
  pending = Promise.resolve()
    .then(async () => {
      const ids = Array.from({ length: DAYS_AHEAD }, (_, i) => ({ id: FIRST_ID + i }));
      await ln.cancel({ notifications: ids }).catch(() => {});
      const notifications = buildReminders(state);
      if (notifications.length) await ln.schedule({ notifications });
    })
    .catch(() => {})
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Ask for notification permission. Resolves true when granted. */
export async function requestReminderPermission() {
  const ln = plugin('LocalNotifications');
  if (!ln) return false;
  try {
    let { display } = await ln.checkPermissions();
    if (display !== 'granted') ({ display } = await ln.requestPermissions());
    return display === 'granted';
  } catch {
    return false;
  }
}
