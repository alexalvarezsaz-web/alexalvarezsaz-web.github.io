// Map tiles: served from the phone when saved, saved as they are seen. Everything else goes to the network as usual.
var TILES = 'estrat-tiles';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  var u = e.request.url;
  if (e.request.method !== 'GET' || !/server\.arcgisonline\.com\/.*\/tile\/|geoserveis\.icgc\.cat\/servei\/catalunya\/(geologia-territorial\/wms\?.*GetMap|mapa-base\/wmts)/i.test(u)) return;
  e.respondWith(caches.open(TILES).then(function (c) {
    return c.match(u).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (r) { if (r.ok) c.put(u, r.clone()); return r; });
    });
  }));
});
