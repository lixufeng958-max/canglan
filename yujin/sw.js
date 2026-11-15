// 离线缓存：先用网络取最新版（绕过浏览器 HTTP 缓存），断网时用缓存。改了文件就把版本号 +1
const CACHE = "yujin-v9";
const FILES = ["./", "./index.html", "./data.js", "./game.js", "./render.js", "./audio.js", "./ui.js", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./spr/hero_full.png", "./spr/hero_head.png", "./spr/hero_leg_l.png", "./spr/hero_leg_r.png", "./spr/hero_torso.png", "./spr/zombie_bloater_full.png", "./spr/zombie_bloater_head.png", "./spr/zombie_bloater_leg_l.png", "./spr/zombie_bloater_leg_r.png", "./spr/zombie_bloater_torso.png", "./spr/zombie_ordinary_full.png", "./spr/zombie_ordinary_head.png", "./spr/zombie_ordinary_leg_l.png", "./spr/zombie_ordinary_leg_r.png", "./spr/zombie_ordinary_torso.png", "./spr/zombie_runner_full.png", "./spr/zombie_runner_head.png", "./spr/zombie_runner_leg_l.png", "./spr/zombie_runner_leg_r.png", "./spr/zombie_runner_torso.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" }).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
