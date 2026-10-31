const CACHE = 'momentum-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon.svg',
  './css/base.css',
  './css/components.css',
  './css/views.css',
  './css/animations.css',
  './js/access-keys.js',
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
  const url = new URL(e.request.url);

  // access-keys.json : TOUJOURS network-first pour que les revoquages soient immediats
  if (url.pathname.endsWith('/access-keys.json')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Reste : cache-first
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
