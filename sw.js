/* Chronos service worker — offline app shell. Bump CACHE on every release. */
const CACHE = 'chronos-v7.0';
const SHELL = ['./', 'index.html', 'manifest.json', 'assets/icon.png',
  'css/variables.css', 'css/styles.css', 'css/components.css', 'css/animations.css',
  ...['cryptoEngine', 'storage', 'notificationModule', 'auth', 'calendarModule', 'timetableModule', 'habitTracker',
    'budgetTracker', 'pomodoroKanban', 'notesModule', 'analyticsModule', 'commandPalette', 'app'].map((n) => `js/${n}.js`)];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') { // network first so updates arrive; cache as offline fallback
    e.respondWith(fetch(req).then((r) => { caches.open(CACHE).then((c) => c.put('index.html', r.clone())); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) caches.open(CACHE).then((c) => c.put(req, r.clone()));
    return r;
  })));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow('./'))));
});
