/* 余烬·尸潮 — 画面：地形预渲染、带遮挡的手电光照、角色与丧尸、特效、小地图 */
(function () {
"use strict";
const T = YJ.TILE, WH = 16, TAU = Math.PI * 2, G = YJ.G;
const Rn = { cv: null, ctx: null, W: 0, H: 0, dpr: 1, sc: 1 };
YJ.Render = Rn;
function h2(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); return `rgb(${Math.min(255, (n >> 16) * k) | 0},${Math.min(255, ((n >> 8) & 255) * k) | 0},${Math.min(255, (n & 255) * k) | 0})`; };

Rn.init = function (cv) { Rn.cv = cv; Rn.ctx = cv.getContext("2d"); Rn.light = document.createElement("canvas"); Rn.lctx = Rn.light.getContext("2d"); Rn.resize(); };
Rn.resize = function () {
  const r = Rn.cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); if (r.width < 10) return;
  Rn.W = r.width; Rn.H = r.height; Rn.dpr = dpr; Rn.cv.width = Math.round(r.width * dpr); Rn.cv.height = Math.round(r.height * dpr);
  Rn.sc = Math.max(.8, Math.min(1.5, Math.min(r.width, r.height) / 400)); // 短边大约看到 10 格
  Rn.light.width = Math.ceil(r.width / 2); Rn.light.height = Math.ceil(r.height / 2);
};

/* ---------- 预渲染地面与墙体 ---------- */
Rn.build = function (L) {
  const { W, H, g, th } = L, seed = (L.i + 1) * 977, theme = L.def.theme;
  const f = Rn.floor = document.createElement("canvas"), t = Rn.top = document.createElement("canvas"); f.width = t.width = W * T; f.height = t.height = H * T;
  const c = f.getContext("2d"), tc = t.getContext("2d"), at = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? 1 : g[y * W + x];
  c.fillStyle = "#050607"; c.fillRect(0, 0, f.width, f.height);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = at(x, y), px = x * T, py = y * T, n = h2(x, y, seed);
    if (v !== 1) { // 地面
      c.fillStyle = n < .5 ? th.floor : th.floor2; c.fillRect(px, py, T, T);
      if (theme === "hospital") { if ((x + y) % 2) { c.fillStyle = "rgba(255,255,255,.05)"; c.fillRect(px, py, T, T); } c.strokeStyle = "rgba(0,0,0,.25)"; c.strokeRect(px + .5, py + .5, T, T); }
      else if (theme === "subway") { c.strokeStyle = "rgba(0,0,0,.3)"; c.strokeRect(px + .5, py + .5, T / 2, T / 2); c.strokeRect(px + T / 2 + .5, py + T / 2 + .5, T / 2, T / 2); if (at(x, y - 1) === 1 && n > .5) { c.fillStyle = "rgba(220,180,40,.35)"; c.fillRect(px, py + T - 6, T, 4); } }
      else if (theme === "lab") { c.strokeStyle = "rgba(0,0,0,.4)"; c.strokeRect(px + .5, py + .5, T, T); if (x % 4 === 0) { c.fillStyle = "rgba(90,220,255,.18)"; c.fillRect(px + T / 2 - 1, py, 2, T); } if (n > .93) { c.fillStyle = "rgba(90,220,255,.12)"; c.fillRect(px + 6, py + 6, T - 12, T - 12); } }
      else if (theme === "base") { if (x % 3 === 0) { c.fillStyle = "rgba(0,0,0,.22)"; c.fillRect(px, py, 1.5, T); } if (y % 3 === 0) { c.fillStyle = "rgba(0,0,0,.22)"; c.fillRect(px, py, T, 1.5); } if (at(x, y - 1) === 1 && n > .7) for (let k = 0; k < 5; k++) { c.fillStyle = k % 2 ? "#1a1a1a" : "#c9a227"; c.fillRect(px + k * 8, py + WH + 2, 8, 5); } }
      else { if (n > .9) { c.fillStyle = "rgba(10,14,22,.55)"; c.beginPath(); c.ellipse(px + 20, py + 20, 15, 9, n * 6, 0, TAU); c.fill(); c.strokeStyle = "rgba(160,190,230,.18)"; c.beginPath(); c.ellipse(px + 17, py + 18, 9, 4, n * 6, 3.4, 5); c.stroke(); } if (n < .04) { c.fillStyle = "#1c1d20"; c.beginPath(); c.arc(px + 20, py + 20, 11, 0, TAU); c.fill(); c.strokeStyle = "#3a3c40"; c.stroke(); } }
      for (let k = 0; k < 5; k++) { const a = h2(x * 7 + k, y * 3, seed + 5), b = h2(x, y * 5 + k, seed + 9); c.fillStyle = a > .5 ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.14)"; c.fillRect(px + a * T, py + b * T, 2 + b * 3, 2 + a * 2); }
      if (n > .6 && n < .66) { c.strokeStyle = "rgba(0,0,0,.4)"; c.lineWidth = 1; c.beginPath(); c.moveTo(px + n * 20, py + 4); c.lineTo(px + 18, py + 20); c.lineTo(px + 30 - n * 10, py + 37); c.stroke(); }
      // 墙脚阴影
      const sh = (x0, y0, x1, y1, r) => { const gr = c.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, "rgba(0,0,0,.5)"); gr.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = gr; c.fillRect(...r); };
      if (at(x, y - 1) === 1) sh(0, py, 0, py + 18, [px, py, T, 18]); if (at(x - 1, y) === 1) sh(px, 0, px + 10, 0, [px, py, 10, T]); if (at(x + 1, y) === 1) sh(px + T, 0, px + T - 10, 0, [px + T - 10, py, 10, T]);
    }
    if (v === 1) { let near = false; for (let oy = -2; oy <= 2 && !near; oy++) for (let ox = -1; ox <= 1; ox++) if (at(x + ox, y + oy) !== 1) { near = true; break; } if (!near) continue;
      if (at(x, y + 1) !== 1) { // 正面
        const gr = c.createLinearGradient(0, py + T - WH, 0, py + T); gr.addColorStop(0, shade(th.wall, .95)); gr.addColorStop(1, shade(th.wall, .5)); c.fillStyle = gr; c.fillRect(px, py + T - WH, T, WH);
        c.strokeStyle = "rgba(0,0,0,.3)"; c.lineWidth = 1; c.beginPath(); c.moveTo(px, py + T - WH / 2); c.lineTo(px + T, py + T - WH / 2); for (let k = 0; k < 3; k++) { c.moveTo(px + k * 14 + 6, py + T - WH); c.lineTo(px + k * 14 + 6, py + T - WH / 2); c.moveTo(px + k * 14 + 13, py + T - WH / 2); c.lineTo(px + k * 14 + 13, py + T); } c.stroke();
        if (n > .82) { c.fillStyle = "rgba(90,10,10,.5)"; c.fillRect(px + n * 20, py + T - WH + 2, 6, WH - 3); } }
      tc.fillStyle = n < .5 ? th.top : shade(th.top, .93); tc.fillRect(px, py - WH, T, T);
      tc.fillStyle = "rgba(0,0,0,.12)"; tc.fillRect(px + h2(x, y, 3) * 28, py - WH + h2(x, y, 4) * 28, 8, 6);
      tc.strokeStyle = "rgba(0,0,0,.55)"; tc.lineWidth = 2; tc.beginPath();
      if (at(x, y - 1) !== 1) { tc.moveTo(px, py - WH + 1); tc.lineTo(px + T, py - WH + 1); } if (at(x - 1, y) !== 1) { tc.moveTo(px + 1, py - WH); tc.lineTo(px + 1, py + T - WH); } if (at(x + 1, y) !== 1) { tc.moveTo(px + T - 1, py - WH); tc.lineTo(px + T - 1, py + T - WH); } tc.stroke();
      if (at(x, y + 1) !== 1) { tc.fillStyle = "rgba(255,255,255,.14)"; tc.fillRect(px, py + T - WH - 2, T, 2); }
    }
    if (v === 3) prop(c, tc, px, py, th.prop, n, th);
  }
};
function prop(c, tc, px, py, kind, n, th) {
  c.fillStyle = "rgba(0,0,0,.4)"; c.beginPath(); c.ellipse(px + 21, py + 34, 20, 7, 0, 0, TAU); c.fill();
  if (kind === "tank") { c.fillStyle = "#1a2a33"; c.fillRect(px + 5, py + 24, 30, 14); tc.fillStyle = "#25404d"; tc.beginPath(); tc.ellipse(px + 20, py + 16, 15, 15, 0, 0, TAU); tc.fill(); const gr = tc.createRadialGradient(px + 20, py + 16, 2, px + 20, py + 16, 13); gr.addColorStop(0, "rgba(150,255,255,.9)"); gr.addColorStop(1, "rgba(40,160,200,.25)"); tc.fillStyle = gr; tc.beginPath(); tc.arc(px + 20, py + 16, 12, 0, TAU); tc.fill(); tc.fillStyle = "rgba(20,60,50,.8)"; tc.beginPath(); tc.ellipse(px + 20, py + 17, 4, 7, n, 0, TAU); tc.fill(); tc.strokeStyle = "#0c1a20"; tc.lineWidth = 2; tc.beginPath(); tc.arc(px + 20, py + 16, 15, 0, TAU); tc.stroke(); return; }
  const col = kind === "crate" ? "#6b5333" : kind === "bed" ? "#c9d2cf" : "#8a8d90", h = kind === "bed" ? 8 : 12;
  c.fillStyle = shade(col, .55); c.fillRect(px + 3, py + T - h - 3, T - 6, h);
  tc.fillStyle = col; tc.fillRect(px + 3, py + 3 - h + 6, T - 6, T - 12); tc.strokeStyle = "rgba(0,0,0,.6)"; tc.lineWidth = 1.5; tc.strokeRect(px + 3, py + 3 - h + 6, T - 6, T - 12);
  if (kind === "crate") { tc.strokeStyle = "rgba(0,0,0,.35)"; tc.beginPath(); tc.moveTo(px + 3, py - 3); tc.lineTo(px + T - 3, py + T - 15); tc.moveTo(px + T - 3, py - 3); tc.lineTo(px + 3, py + T - 15); tc.stroke(); }
  else if (kind === "bed") { tc.fillStyle = "#eef2f0"; tc.fillRect(px + 6, py, 10, T - 18); tc.fillStyle = "rgba(120,20,20,.55)"; tc.beginPath(); tc.ellipse(px + 25, py + 10, 6 + n * 5, 5, n * 3, 0, TAU); tc.fill(); }
  else { for (let k = 0; k < 4; k++) { tc.fillStyle = k % 2 ? "#d8d8d8" : "#c0392b"; tc.fillRect(px + 4 + k * 8, py + 12, 8, 6); } }
}
/* 把新的血迹、尸体、焦痕烙进地面图 */
function bake(L) {
  const c = Rn.floor.getContext("2d");
  for (const d of L.decals) {
    if (d.t === "blood") { c.fillStyle = d.c; c.globalAlpha = .7; c.beginPath(); c.ellipse(d.x, d.y, d.r, d.r * .7, d.x, 0, TAU); c.fill(); c.globalAlpha = 1; }
    else if (d.t === "scorch") { const g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r); g.addColorStop(0, "rgba(0,0,0,.75)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2); }
    else { c.save(); c.translate(d.x, d.y); c.rotate(d.ang); c.fillStyle = "rgba(60,6,6,.75)"; c.beginPath(); c.ellipse(0, 0, d.r * 1.5, d.r * 1.2, 0, 0, TAU); c.fill(); c.fillStyle = shade(d.c, .55); c.beginPath(); c.ellipse(-2, 0, d.r * .95, d.r * .75, 0, 0, TAU); c.fill(); c.fillStyle = shade(d.skin, .6); c.beginPath(); c.arc(d.r * .8, 2, d.r * .45, 0, TAU); c.fill(); c.fillRect(-d.r * .2, -d.r - 3, d.r * .9, 4); c.restore(); }
  }
  L.decals.length = 0;
}

/* ---------- 角色 ---------- */
function drawPlayer(c, pl, S) {
  c.save(); c.translate(pl.x, pl.y); c.fillStyle = "rgba(0,0,0,.4)"; c.beginPath(); c.ellipse(0, 4, 14, 9, 0, 0, TAU); c.fill(); c.rotate(pl.ang);
  if (pl.dashT > 0) c.scale(1.25, .8);
  const sw = Math.sin(pl.walk) * 5; c.fillStyle = "#23272e"; c.beginPath(); c.ellipse(sw - 2, -5, 6, 3.5, 0, 0, TAU); c.ellipse(-sw - 2, 5, 6, 3.5, 0, 0, TAU); c.fill();
  c.fillStyle = "#2c3a2c"; c.fillRect(-13, -7, 7, 14); // 背包
  c.fillStyle = pl.hurtT > 0 ? "#c05050" : "#3f5166"; c.beginPath(); c.ellipse(0, 0, 9, 12, 0, 0, TAU); c.fill(); c.fillStyle = "#2a3644"; c.fillRect(-4, -9, 8, 18);
  c.strokeStyle = "#3f5166"; c.lineWidth = 5; c.lineCap = "round"; c.beginPath(); c.moveTo(2, -10); c.lineTo(13, -3); c.moveTo(2, 10); c.lineTo(10, 3); c.stroke();
  const b = S.base, len = { pistol: 9, smg: 14, shotgun: 19, rifle: 21, sniper: 26, flamer: 20, launcher: 18 }[b]; c.fillStyle = "#15171a"; c.fillRect(9, -2.5, len, b === "launcher" ? 7 : 5); c.fillStyle = b === "flamer" ? "#b0502a" : "#3a3d42"; c.fillRect(9, -2.5, 6, 5);
  if (pl.flashT > 0 && !S.B.flame) { c.fillStyle = "#fff3c0"; c.beginPath(); const x = 9 + len; c.moveTo(x, 0); c.lineTo(x + 16, -5); c.lineTo(x + 11, 0); c.lineTo(x + 22, 0); c.lineTo(x + 11, 1); c.lineTo(x + 16, 6); c.closePath(); c.fill(); }
  c.fillStyle = "#c79b75"; c.beginPath(); c.arc(13, -2, 2.6, 0, TAU); c.arc(11, 3, 2.6, 0, TAU); c.fill();
  c.fillStyle = "#4b5c47"; c.beginPath(); c.arc(1, 0, 6.5, 0, TAU); c.fill(); c.fillStyle = "#2e3a2c"; c.beginPath(); c.arc(1, 0, 6.5, -1.1, 1.1); c.fill(); c.fillStyle = "#9fd8ff"; c.fillRect(5, -3, 2, 6);
  c.restore();
}
function drawEnemy(c, e, time) {
  const E = e.E, r = e.r, k = r / 13; c.save(); c.translate(e.x, e.y);
  c.fillStyle = "rgba(0,0,0,.4)"; c.beginPath(); c.ellipse(0, 4, r * 1.1, r * .7, 0, 0, TAU); c.fill(); c.rotate(e.ang); c.scale(k, k);
  const sw = Math.sin(e.walk) * 4, fl = e.flash > 0, skin = fl ? "#fff" : E.skin, cl = fl ? "#fff" : e.cloth;
  c.fillStyle = "#1e2024"; c.beginPath(); c.ellipse(sw - 2, -5, 5, 3, 0, 0, TAU); c.ellipse(-sw - 2, 5, 5, 3, 0, 0, TAU); c.fill();
  if (e.type === "boss") { c.strokeStyle = fl ? "#fff" : "#5a3a6a"; c.lineWidth = 3.5; c.lineCap = "round"; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.sin(time * 2 + i) * .3; c.beginPath(); c.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); c.quadraticCurveTo(Math.cos(a + .5) * 18, Math.sin(a + .5) * 18, Math.cos(a + Math.sin(time * 3 + i) * .6) * 24, Math.sin(a + Math.sin(time * 3 + i) * .6) * 24); c.stroke(); } }
  c.fillStyle = cl; c.beginPath(); c.ellipse(0, 0, e.type === "runner" ? 7 : 9, e.type === "runner" ? 9 : 11.5, 0, 0, TAU); c.fill();
  c.fillStyle = "rgba(70,8,8,.6)"; c.beginPath(); c.arc(-2 + e.v * 5, -4 + e.v * 7, 3.2, 0, TAU); c.fill();
  c.strokeStyle = skin; c.lineWidth = 3.6; c.lineCap = "round"; const reach = e.type === "runner" ? 9 : 14; c.beginPath(); c.moveTo(2, -9); c.lineTo(reach, -5 + sw * .6); c.moveTo(2, 9); c.lineTo(reach - 2, 5 - sw * .6); c.stroke();
  if (e.type === "brute" || e.type === "elite") { c.fillStyle = fl ? "#fff" : "#2a2e30"; c.fillRect(-6, -12.5, 9, 5); c.fillRect(-6, 7.5, 9, 5); }
  if (e.type === "bloater") { const p = .6 + Math.sin(time * 5 + e.v * 9) * .3; c.fillStyle = `rgba(230,220,90,${p})`; c.beginPath(); c.arc(-3, -5, 4, 0, TAU); c.arc(2, 6, 3.4, 0, TAU); c.arc(-5, 4, 2.6, 0, TAU); c.fill(); }
  c.fillStyle = skin; c.beginPath(); c.arc(3, 0, e.type === "brute" || e.type === "elite" ? 4.5 : 5.6, 0, TAU); c.fill();
  c.fillStyle = "#2a1a14"; c.beginPath(); c.arc(1.5, 0, 5.2, 1.9, 4.4); c.fill(); c.fillStyle = "#3a0a0a"; c.fillRect(6, -1.5, 2.4, 3);
  if (e.type === "spitter") { c.fillStyle = `rgba(150,255,80,${.6 + Math.sin(time * 6) * .3})`; c.beginPath(); c.arc(8, 0, 3.4, 0, TAU); c.fill(); }
  if (e.type === "elite") { c.fillStyle = "#f2f2f2"; c.fillRect(-1, -4, 4, 8); c.fillStyle = "#c0392b"; c.fillRect(0, -1, 2, 2); }
  if (e.type === "boss") { const p = .7 + Math.sin(time * 4) * .3; c.fillStyle = `rgba(255,70,160,${p})`; c.beginPath(); c.arc(-1, 0, 4.5, 0, TAU); c.fill(); }
  if (e.burn > 0) { c.fillStyle = "rgba(255,140,40,.55)"; c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.fill(); }
  if (e.slow > 0) { c.strokeStyle = "rgba(140,220,255,.8)"; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.stroke(); }
  c.restore();
  if (e.hp < e.maxhp && !E.elite) { c.fillStyle = "rgba(0,0,0,.6)"; c.fillRect(e.x - 13, e.y - r - 10, 26, 3.5); c.fillStyle = "#c0392b"; c.fillRect(e.x - 13, e.y - r - 10, 26 * Math.max(0, e.hp / e.maxhp), 3.5); }
}

/* ---------- 每帧 ---------- */
Rn.draw = function (time) {
  const L = G.L, pl = G.pl, c = Rn.ctx, S = G.S; if (!L || !pl) return;
  const dpr = Rn.dpr, W = Rn.W, H = Rn.H, sc = Rn.sc, th = L.th;
  if (L.decals.length) bake(L);
  const cam = G.cam, tx = pl.x + Math.cos(pl.ang) * 50, ty = pl.y + Math.sin(pl.ang) * 50 - (H > W ? 40 : 0); cam.x += (tx - cam.x) * .12; cam.y += (ty - cam.y) * .12;
  const shx = (Math.random() - .5) * G.shake, shy = (Math.random() - .5) * G.shake, ox = W / 2 / sc - cam.x + shx, oy = H / 2 / sc - cam.y + shy;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = "#050607"; c.fillRect(0, 0, W, H);
  c.setTransform(dpr * sc, 0, 0, dpr * sc, ox * dpr * sc, oy * dpr * sc);
  const vx0 = -ox, vy0 = -oy, vw = W / sc, vh = H / sc, sx = Math.max(0, vx0), sy = Math.max(0, vy0), sw = Math.min(Rn.floor.width - sx, vw + 2), shh = Math.min(Rn.floor.height - sy, vh + 2);
  if (sw > 0 && shh > 0) c.drawImage(Rn.floor, sx, sy, sw, shh, sx, sy, sw, shh);
  const vis = (x, y, m) => x > vx0 - m && y > vy0 - m && x < vx0 + vw + m && y < vy0 + vh + m;
  // 出口
  { const e = L.exit, open = L.objDone, p = .6 + Math.sin(time * 4) * .3; c.save(); c.translate(e.x, e.y); c.fillStyle = open ? `rgba(60,220,120,${.25 * p})` : "rgba(200,50,50,.18)"; c.beginPath(); c.arc(0, 0, 34, 0, TAU); c.fill(); c.strokeStyle = open ? "#4de38a" : "#b03030"; c.lineWidth = 3; c.setLineDash([8, 6]); c.lineDashOffset = -time * 20; c.beginPath(); c.arc(0, 0, 28, 0, TAU); c.stroke(); c.setLineDash([]);
    c.fillStyle = open ? "#4de38a" : "#b03030"; c.font = "700 11px sans-serif"; c.textAlign = "center"; c.fillText(open ? L.def.exitName : "未解锁", 0, 4); c.restore(); }
  // 目标物、油桶、掉落
  for (const o of L.objs) { if (!vis(o.x, o.y, 60)) continue; c.save(); c.translate(o.x, o.y);
    if (o.t === "fuse") { if (!o.done) { const b = Math.sin(time * 4) * 3; c.fillStyle = "rgba(255,210,60,.25)"; c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.fill(); c.fillStyle = "#ffd23f"; c.fillRect(-4, -10 + b, 8, 16); c.fillStyle = "#555"; c.fillRect(-5, -12 + b, 10, 4); c.fillRect(-5, 4 + b, 10, 4); } }
    else { c.fillStyle = "#2c3238"; c.fillRect(-18, -14, 36, 26); c.fillStyle = o.done ? "#4de38a" : o.on ? "#ffd23f" : "#b03030"; c.fillRect(-14, -10, 8, 6); c.fillStyle = "#1a1d20"; c.fillRect(-2, -10, 16, 18); c.strokeStyle = "#111"; c.lineWidth = 2; c.strokeRect(-18, -14, 36, 26);
      if (o.on && !o.done) { c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 6; c.beginPath(); c.arc(0, -30, 13, 0, TAU); c.stroke(); c.strokeStyle = "#ffd23f"; c.beginPath(); c.arc(0, -30, 13, -Math.PI / 2, -Math.PI / 2 + TAU * o.prog); c.stroke(); } }
    c.restore(); }
  for (const b of L.barrels) { if (b.dead || !vis(b.x, b.y, 30)) continue; c.fillStyle = "rgba(0,0,0,.4)"; c.beginPath(); c.ellipse(b.x + 2, b.y + 5, 12, 7, 0, 0, TAU); c.fill(); c.fillStyle = "#a8281e"; c.beginPath(); c.arc(b.x, b.y, 11, 0, TAU); c.fill(); c.strokeStyle = "#5c120c"; c.lineWidth = 2; c.stroke(); c.fillStyle = "#e8c93a"; c.fillRect(b.x - 5, b.y - 2, 10, 4); c.fillStyle = "rgba(255,255,255,.25)"; c.beginPath(); c.arc(b.x - 3, b.y - 4, 3, 0, TAU); c.fill(); }
  for (const d of L.drops) { if (!vis(d.x, d.y, 40)) continue; const bob = Math.sin(time * 4 + d.x) * 2;
    if (d.t === "scrap") { c.fillStyle = "#9aa3ad"; c.beginPath(); c.arc(d.x, d.y + bob, 4, 0, TAU); c.fill(); c.fillStyle = "#e0e6ec"; c.fillRect(d.x - 1, d.y + bob - 1, 2, 2); }
    else if (d.t === "med") { c.fillStyle = "#f2f2f2"; c.fillRect(d.x - 7, d.y - 6 + bob, 14, 12); c.fillStyle = "#d0302a"; c.fillRect(d.x - 1.5, d.y - 4 + bob, 3, 8); c.fillRect(d.x - 4, d.y - 1.5 + bob, 8, 3); }
    else { const col = YJ.RAR[d.it.rar].c; c.fillStyle = col; c.globalAlpha = .28; c.beginPath(); c.ellipse(d.x, d.y, 16, 9, 0, 0, TAU); c.fill(); c.globalAlpha = 1; c.fillStyle = "#1c1e22"; c.fillRect(d.x - 8, d.y - 5 + bob, 16, 10); c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(d.x - 8, d.y - 5 + bob, 16, 10); } }
  // 预警（冲锋线、震地圈）
  for (const e of L.en) if (e.st === "wind") { const t = 1 - e.w / e.tele.t; c.save(); c.translate(e.x, e.y);
    if (e.tele.type === "slam") { c.fillStyle = `rgba(255,60,60,${.12 + t * .2})`; c.beginPath(); c.arc(0, 0, 170, 0, TAU); c.fill(); c.strokeStyle = "rgba(255,80,80,.9)"; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 170 * t, 0, TAU); c.stroke(); }
    else if (e.tele.type === "charge") { c.rotate(e.tele.ang); c.fillStyle = `rgba(255,60,60,${.12 + t * .25})`; c.fillRect(0, -e.r, 340, e.r * 2); }
    else { c.strokeStyle = `rgba(150,255,80,${.4 + t * .5})`; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, e.r + 8, 0, TAU * t); c.stroke(); }
    c.restore(); }
  // 角色按 y 排序
  const list = L.en.filter(e => vis(e.x, e.y, 60)); list.push(pl); list.sort((a, b) => a.y - b.y);
  for (const e of list) e === pl ? drawPlayer(c, pl, S) : drawEnemy(c, e, time);
  // 子弹
  for (const b of L.bul) { if (b.flame) continue;
    if (b.gren) { c.fillStyle = "#2f3b2a"; c.beginPath(); c.arc(b.x, b.y, 5, 0, TAU); c.fill(); c.fillStyle = "#ff5030"; c.fillRect(b.x - 1, b.y - 1, 2, 2); continue; }
    if (b.enemy) { c.fillStyle = "rgba(150,255,60,.35)"; c.beginPath(); c.arc(b.x, b.y, 9, 0, TAU); c.fill(); c.fillStyle = "#c8ff60"; c.beginPath(); c.arc(b.x, b.y, 4.5, 0, TAU); c.fill(); continue; }
    const l = Math.hypot(b.vx, b.vy), k = (b.ex ? 10 : 22) / l; c.strokeStyle = b.crit ? "#ffe9a0" : b.ex ? "#ff9a3a" : "#ffd98a"; c.lineWidth = b.ex ? 5 : 2.2; c.lineCap = "round"; c.beginPath(); c.moveTo(b.x - b.vx * k, b.y - b.vy * k); c.lineTo(b.x, b.y); c.stroke(); }
  if (sw > 0 && shh > 0) c.drawImage(Rn.top, sx, sy, sw, shh, sx, sy, sw, shh);
  // 粒子与特效
  for (const p of L.parts) { c.globalAlpha = Math.min(1, p.life / p.max * 1.5); c.fillStyle = p.c; c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); } c.globalAlpha = 1;
  for (const f of L.fx) { const t = 1 - f.life / (f.max || .15);
    if (f.t === "arc") { c.strokeStyle = "#bfe8ff"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(f.x, f.y); for (let k = 1; k < 5; k++) c.lineTo(f.x + (f.x2 - f.x) * k / 5 + (Math.random() - .5) * 16, f.y + (f.y2 - f.y) * k / 5 + (Math.random() - .5) * 16); c.lineTo(f.x2, f.y2); c.stroke(); }
    else { c.globalAlpha = 1 - t; if (f.t === "boom") { const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (.4 + t * .6)); g.addColorStop(0, "#fff"); g.addColorStop(.4, f.c); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, f.r * (.4 + t * .6), 0, TAU); c.fill(); }
      c.strokeStyle = f.c; c.lineWidth = 4 * (1 - t) + 1; c.beginPath(); c.arc(f.x, f.y, f.r * t, 0, TAU); c.stroke(); c.globalAlpha = 1; } }

  // —— 光照：可见范围多边形（被墙挡住）+ 灯 + 火光 ——
  const lc = Rn.lctx, ls = sc / 2; lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = "source-over"; lc.fillStyle = `rgba(4,6,10,${th.dark})`; lc.fillRect(0, 0, Rn.light.width, Rn.light.height);
  lc.setTransform(ls, 0, 0, ls, ox * ls, oy * ls); lc.globalCompositeOperation = "destination-out";
  const NR = 72, pts = []; for (let i = 0; i < NR; i++) { const a = i / NR * TAU; let da = Math.abs(((a - pl.ang) % TAU + TAU + Math.PI) % TAU - Math.PI); const cone = da < .5 ? 1 : da < .85 ? 1 - (da - .5) / .35 : 0, max = 150 + cone * 330, d = YJ.ray(L, pl.x, pl.y, a, max) + 20; pts.push(pl.x + Math.cos(a) * d, pl.y + Math.sin(a) * d); }
  const pg = lc.createRadialGradient(pl.x, pl.y, 20, pl.x, pl.y, 500); pg.addColorStop(0, "rgba(0,0,0,1)"); pg.addColorStop(.3, "rgba(0,0,0,.85)"); pg.addColorStop(1, "rgba(0,0,0,0)");
  lc.fillStyle = pg; lc.beginPath(); lc.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) lc.lineTo(pts[i], pts[i + 1]); lc.closePath(); lc.fill();
  const glow = (x, y, r, a) => { if (!vis(x, y, r)) return; const g = lc.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, "rgba(0,0,0,0)"); lc.fillStyle = g; lc.fillRect(x - r, y - r, r * 2, r * 2); };
  for (const l of L.lamps) { let a = .6; if (l.fl) a = Math.sin(time * 9 + l.f) > .2 || Math.sin(time * 23 + l.f) > .6 ? .6 : .1; glow(l.x, l.y, l.r, a); }
  glow(L.exit.x, L.exit.y, 110, .5);
  if (pl.flashT > 0) glow(pl.x, pl.y, 260, .7);
  for (const f of L.fx) if (f.t === "boom") glow(f.x, f.y, f.r * 3, f.life / f.max);
  for (const b of L.bul) if (b.flame || b.enemy || b.ex) glow(b.x, b.y, b.flame ? 70 : 50, .5);
  for (const e of L.en) if (e.burn > 0) glow(e.x, e.y, 80, .5);
  for (const o of L.objs) if (!o.done && o.t === "fuse") glow(o.x, o.y, 70, .5);
  for (const d of L.drops) if (d.t === "item") glow(d.x, d.y, 50, .45);
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.drawImage(Rn.light, 0, 0, W, H);
  // 黑暗里的东西：丧尸的眼睛、掉落光柱、伤害数字
  c.setTransform(dpr * sc, 0, 0, dpr * sc, ox * dpr * sc, oy * dpr * sc);
  for (const e of list) { if (e === pl || !e.awake) continue; const col = e.type === "boss" ? "#ff4fa0" : e.E.elite ? "#ffb030" : "#ff3b30"; c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 6; const hx = e.x + Math.cos(e.ang) * e.r * .45, hy = e.y + Math.sin(e.ang) * e.r * .45, px = -Math.sin(e.ang) * 2.4, py = Math.cos(e.ang) * 2.4; c.fillRect(hx + px - 1, hy + py - 1, 2, 2); c.fillRect(hx - px - 1, hy - py - 1, 2, 2); } c.shadowBlur = 0;
  for (const d of L.drops) if (d.t === "item" && vis(d.x, d.y, 40)) { const col = YJ.RAR[d.it.rar].c, g = c.createLinearGradient(0, d.y - 70, 0, d.y); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, col); c.fillStyle = g; c.globalAlpha = .55 + Math.sin(time * 5) * .2; c.fillRect(d.x - 1.5, d.y - 70, 3, 70); c.globalAlpha = 1; if (d.it.rar >= 1) { c.font = "700 10px sans-serif"; c.textAlign = "center"; c.fillStyle = col; c.fillText(YJ.itemName(d.it), d.x, d.y - 74); } }
  c.textAlign = "center"; for (const n of L.nums) { c.globalAlpha = Math.min(1, n.life * 2.5); c.font = `800 ${n.crit ? 17 : 12}px sans-serif`; c.fillStyle = n.crit ? "#ffd23f" : "#fff"; c.strokeStyle = "rgba(0,0,0,.8)"; c.lineWidth = 3; c.strokeText(n.v, n.x, n.y); c.fillText(n.v, n.x, n.y); } c.globalAlpha = 1;
  if (pl.rel > 0) { c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 5; c.beginPath(); c.arc(pl.x, pl.y - 28, 9, 0, TAU); c.stroke(); c.strokeStyle = "#ffd23f"; c.lineWidth = 3; c.beginPath(); c.arc(pl.x, pl.y - 28, 9, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - pl.rel / pl.relMax)); c.stroke(); }
  // 屏幕层：色调、雨、暗角、受伤泛红
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = th.tint; c.fillRect(0, 0, W, H);
  if (th.rain) { c.strokeStyle = "rgba(170,200,240,.22)"; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 46; i++) { const x = (h2(i, 1, 7) * (W + 200) + time * 240 * (.6 + h2(i, 2, 7))) % (W + 200) - 100, y = (h2(i, 3, 7) * H + time * 900 * (.7 + h2(i, 4, 7) * .5)) % H; c.moveTo(x, y); c.lineTo(x - 5, y + 16); } c.stroke(); }
  if (!Rn.vg || Rn.vgW !== W || Rn.vgH !== H) { Rn.vgW = W; Rn.vgH = H; Rn.vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75); Rn.vg.addColorStop(0, "rgba(0,0,0,0)"); Rn.vg.addColorStop(1, "rgba(0,0,0,.6)"); }
  c.fillStyle = Rn.vg; c.fillRect(0, 0, W, H);
  const low = pl.hp / S.maxhp; if (pl.hurtT > 0 || low < .3) { const a = Math.max(pl.hurtT > 0 ? pl.hurtT * 1.6 : 0, low < .3 ? (.3 - low) * 1.4 * (.7 + Math.sin(time * 6) * .3) : 0); const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .7); g.addColorStop(0, "rgba(160,0,0,0)"); g.addColorStop(1, `rgba(190,10,10,${Math.min(.7, a)})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
};

/* ---------- 小地图 ---------- */
Rn.minimap = function (cv) {
  const L = G.L, pl = G.pl; if (!L) return; const c = cv.getContext("2d"), n = cv.width, k = n / L.W;
  c.fillStyle = "rgba(8,10,14,.85)"; c.fillRect(0, 0, n, n);
  for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) { if (!L.explored[y * L.W + x] || L.g[y * L.W + x] === 1) continue; c.fillStyle = "#5a6672"; c.fillRect(x * k, y * k, k + .5, k + .5); }
  const dot = (x, y, col, s) => { c.fillStyle = col; c.fillRect(x / T * k - s / 2, y / T * k - s / 2, s, s); };
  for (const o of L.objs) if (!o.done) dot(o.x, o.y, "#ffd23f", 5);
  if (L.eliteE && !L.eliteE.dead) dot(L.eliteE.x, L.eliteE.y, "#ff9a30", 6); if (L.bossE && !L.bossE.dead) dot(L.bossE.x, L.bossE.y, "#ff4fa0", 7);
  dot(L.exit.x, L.exit.y, L.objDone ? "#4de38a" : "#b03030", 6);
  for (const e of L.en) if (e.awake && Math.hypot(e.x - pl.x, e.y - pl.y) < 420) dot(e.x, e.y, "#e03a30", 2.5);
  dot(pl.x, pl.y, "#fff", 4.5);
};
})();
