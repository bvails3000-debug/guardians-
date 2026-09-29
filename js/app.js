// App shell: state holder, hash router, bottom navigation, service worker registration.

import * as store from './store.js';
import { isNative, platform } from './native.js';
import { syncReminders } from './reminders.js';
import { escapeHtml } from './util.js';
import { applyTheme, resolveTheme } from './themes.js';
import { renderOnboarding } from './ui/onboarding.js';
import { renderToday } from './ui/today.js';
import { renderPlan } from './ui/plan.js';
import { renderDiary } from './ui/diary.js';
import { renderProgress } from './ui/progress.js';
import { renderSettings } from './ui/settings.js';

const ROUTES = {
  today: renderToday,
  plan: renderPlan,
  log: renderDiary,
  progress: renderProgress,
  settings: renderSettings,
  setup: renderOnboarding,
};

const view = document.getElementById('view');
const nav = document.getElementById('nav');

const app = {
  state: null, // set in init() after native storage is restored
  installPrompt: null,
  /** Mutate state, persist, and (by default) re-render the current route. */
  commit(fn, rerender = true) {
    fn(this.state);
    store.save(this.state);
    syncReminders(this.state);
    if (rerender) render();
  },
  /** Replace the whole state (import / reset). */
  replace(newState) {
    this.state = newState || store.emptyState();
    store.save(this.state);
    syncReminders(this.state);
    this.go(this.state.onboarded ? '#/today' : '#/setup');
    render();
  },
  go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  },
};

function parseRoute() {
  const [, name = '', param] = (location.hash || '').split('/');
  return { name, param };
}

function render() {
  if (!app.state) return; // not initialized yet
  applyTheme(resolveTheme(app.state));
  let { name, param } = parseRoute();
  if (!app.state.onboarded) name = 'setup';
  else if (!ROUTES[name]) name = 'today';
  const onboarding = name === 'setup';
  nav.hidden = onboarding;
  document.body.classList.toggle('onboarding', onboarding);
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.route === name));
  try {
    ROUTES[name](view, app, param);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="card"><h2>Something went wrong</h2><p class="muted">${escapeHtml(err.message || err)}</p><a class="btn btn-ghost" href="#/settings">Settings</a></div>`;
  }
}

let lastRoute = null;
window.addEventListener('hashchange', () => {
  const r = parseRoute().name;
  render();
  if (r !== lastRoute) window.scrollTo(0, 0);
  lastRoute = r;
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  app.installPrompt = e;
});

// The native apps ship their files inside the app bundle, so offline caching is only for the web.
if (!isNative() && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

async function init() {
  document.documentElement.dataset.platform = platform();
  await store.hydrate();
  app.state = store.load();
  render();
  // Reminders name each day's session, so refresh them whenever the app opens.
  syncReminders(app.state);
}

init();
