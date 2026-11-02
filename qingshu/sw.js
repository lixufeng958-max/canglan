// 离线缓存：先用网络取最新版（绕过浏览器 HTTP 缓存），断网时用缓存。改了文件就把版本号 +1
const CACHE = "qingshu-v11";
const FILES = ["./", "./index.html", "./app.js", "./sim.js", "./art.js", "./net.js", "./audio.js", "./config.js", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" }).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
