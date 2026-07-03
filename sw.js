/* Service Worker: офлайн-режим */
const CACHE = 'mytracker-v1';
const SHELL = ['app.html','index.html','app.css','app.js','manifest.json','icon-192.png','icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(()=>{}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API к базе — только сеть, не кэшируем
  if (url.pathname.startsWith('/sb/')) return;

  // CDN (Chart.js): cache-first — не меняется
  if (url.host === 'cdnjs.cloudflare.com') {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }))
    );
    return;
  }

  // свои файлы: network-first (свежие версии), офлайн — из кэша
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() =>
        caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('app.html') : undefined))
      )
    );
  }
});
