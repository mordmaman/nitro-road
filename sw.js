// Lets the game install as an app and work offline.
// Network first, so new versions show up straight away when online;
// falls back to the saved copy when there's no internet.
const CACHE = 'nitro-road-v2';
const ASSETS = [
  './', './index.html', './manifest.json', './css/style.css',
  './js/config.js', './js/util.js', './js/audio.js', './js/art.js', './js/tracks.js', './js/render.js', './js/game.js', './js/ui.js',
  './fonts/russo-one.woff2', './fonts/fredoka-500.woff2', './fonts/fredoka-600.woff2', './fonts/fredoka-700.woff2',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true })
          .then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined))
      )
  );
});
