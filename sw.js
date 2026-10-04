/**
 * sw.js – Service Worker: speichert alle Dateien beim ersten Laden,
 * danach funktioniert die App komplett offline (Cache-first).
 * Bei Änderungen an Dateien CACHE-Version erhöhen.
 * © 2026 Michael Sedlazek
 */
const CACHE = 'ava-v3'; // v2: neues Aussehen (blond, Minirock), Outfit-Modell, neues Licht
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/main.js', './js/avatar.js', './js/responder.js', './js/speech.js',
  './vendor/three/three.module.js', './vendor/three/three.core.js',
  './vendor/three/addons/loaders/FBXLoader.js', './vendor/three/addons/libs/fflate.module.js',
  './vendor/three/addons/curves/NURBSCurve.js', './vendor/three/addons/curves/NURBSUtils.js',
  './vendor/three/addons/environments/RoomEnvironment.js',
  './assets/model/ava.fbx', './assets/model/ava_outfit.fbx',
  './assets/model/head_color.jpg', './assets/model/head_normal.jpg', './assets/model/head_spec.jpg',
  './assets/model/body_color.jpg', './assets/model/body_normal.jpg', './assets/model/body_spec.jpg',
  './assets/model/opacity_color.png',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const fresh = e.request.mode === 'navigate' || /\.(html|js|css|webmanifest)$/.test(url.pathname);
  const save = (res) => {
    if (res.ok && url.origin === location.origin) { const c = res.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); }
    return res;
  };
  if (fresh) {
    // Code/HTML: zuerst Netz (immer aktuell), offline aus dem Cache
    e.respondWith(fetch(e.request, { cache: 'no-store' }).then(save)
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((h) => h || caches.match('./index.html'))));
  } else {
    // Modelle/Texturen: Cache-first
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((h) => h || fetch(e.request).then(save)));
  }
});
