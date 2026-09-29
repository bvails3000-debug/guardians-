// Offline support: cache the app shell, serve cache-first, refresh in the background.
const CACHE = 'guardians-v2';
const SHELL = [
  './',
  './index.html',
  './privacy.html',
  './manifest.webmanifest',
  './css/styles.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/util.js',
  './js/store.js',
  './js/native.js',
  './js/reminders.js',
  './js/data/tests.js',
  './js/data/jobs.js',
  './js/engine/scoring.js',
  './js/engine/adapt.js',
  './js/engine/planner.js',
  './js/ui/components.js',
  './js/ui/onboarding.js',
  './js/ui/today.js',
  './js/ui/plan.js',
  './js/ui/diary.js',
  './js/ui/progress.js',
  './js/ui/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
