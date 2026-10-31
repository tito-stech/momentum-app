const CACHE = 'momentum-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon.svg',
  './css/base.css',
  './css/components.css',
  './css/views.css',
  './css/animations.css',
  './js/utils.js',
  './js/db.js',
  './js/charts.js',
  './js/components.js',
  './js/router.js',
  './js/app.js',
  './js/views/dashboard.js',
  './js/views/habits.js',
  './js/views/goals.js',
  './js/views/journal.js',
  './js/views/finance.js',
  './js/views/fitness.js',
  './js/views/sleep.js',
  './js/views/learning.js',
  './js/views/tasks.js',
  './js/views/stats.js',
  './js/views/settings.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
