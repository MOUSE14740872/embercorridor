/* 余烬回廊（SPA 版）· service worker
 * 预缓存应用外壳与静态数据；导航请求网络优先、离线回落 index.html。
 * MapLibre CDN 等跨域资源不接管。 */

const CACHE = 'ember-spa-v1';

const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'assets/app.css',
  'assets/js/store.js',
  'assets/js/tree.js',
  'assets/js/map.js',
  'assets/js/codex.js',
  'assets/js/quests.js',
  'assets/js/guide.js',
  'assets/js/memes.js',
  'assets/js/mods.js',
  'assets/js/save.js',
  'assets/js/main.js',
  'data/pois.json',
  'data/quests.json',
  'data/codex.json',
  'data/memes.json',
  'data/mods.json',
  'data/guide.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
    )
  );
});
