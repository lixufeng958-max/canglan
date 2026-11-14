/* 余烬·尸潮 — 画面：地形预渲染、带遮挡的手电光照、角色与丧尸、特效、小地图 */
(function () {
"use strict";
const T = YJ.TILE, WH = 26, SX = 9, TAU = Math.PI * 2, G = YJ.G;
const Rn = { cv: null, ctx: null, W: 0, H: 0, dpr: 1, sc: 1 };
YJ.Render = Rn;
function h2(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); return `rgb(${Math.min(255, (n >> 16) * k) | 0},${Math.min(255, ((n >> 8) & 255) * k) | 0},${Math.min(255, (n & 255) * k) | 0})`; };

Rn.init = function (cv) { Rn.cv = cv; Rn.ctx = cv.getContext("2d"); Rn.light = document.createElement("canvas"); Rn.lctx = Rn.light.getContext("2d"); Rn.resize(); };
Rn.resize = function () {
  const r = Rn.cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); if (r.width < 10) return;
  Rn.W = r.width; Rn.H = r.height; Rn.dpr = dpr; Rn.cv.width = Math.round(r.width * dpr); Rn.cv.height = Math.round(r.height * dpr);
  Rn.sc = Math.max(.72, Math.min(1.5, Math.min(r.width, r.height) / 450)); // 短边大约看到 11 格
  Rn.light.width = Math.ceil(r.width / 2); Rn.light.height = Math.ceil(r.height / 2);
};

/* ---------- 预渲染地面与墙体：阴暗的金属基地 ---------- */
const el = (c, x, y, rx, ry, rot) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); c.fill(); };
const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
Rn.build = function (L) {
  CELLS = new Map();
  const { W, H, g, th } = L, seed = (L.i + 1) * 977, theme = L.def.theme;
  const f = Rn.floor = document.createElement("canvas"), t = Rn.top = document.createElement("canvas"); f.width = t.width = W * T; f.height = t.height = H * T;
  const c = f.getContext("2d"), tc = t.getContext("2d"), at = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? 1 : g[y * W + x];
  Rn.reds = [];
  c.fillStyle = "#030404"; c.fillRect(0, 0, f.width, f.height);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = at(x, y), px = x * T, py = y * T, n = h2(x, y, seed), n2 = h2(x, y, seed + 31);
    if (v !== 1) { // —— 地面 ——
      const grate = (x * 3 + y * 5) % 11 === 0 || n > .95, tread = !grate && n < .2;
      if (grate) { c.fillStyle = "#060807"; c.fillRect(px, py, T, T); c.fillStyle = shade(th.floor, .75); for (let k = 0; k < 7; k++) c.fillRect(px + 3, py + 4 + k * 5, T - 6, 2); c.fillStyle = shade(th.floor, .5); c.fillRect(px + T / 2 - 1, py + 3, 2, T - 6);
        c.strokeStyle = shade(th.floor, 1.25); c.lineWidth = 2; c.strokeRect(px + 1.5, py + 1.5, T - 3, T - 3); c.fillStyle = shade(th.lamp, .5); c.globalAlpha = .05; c.fillRect(px + 3, py + 3, T - 6, T - 6); c.globalAlpha = 1; }
      else { c.fillStyle = shade(n2 < .5 ? th.floor : th.floor2, .9 + n * .18); c.fillRect(px, py, T, T);
        if (tread) { c.strokeStyle = "rgba(255,255,255,.07)"; c.lineWidth = 1.2; c.beginPath(); for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) { const cx = px + 4 + i * 8, cy = py + 4 + j * 8, d = (i + j) % 2 ? 2.2 : -2.2; c.moveTo(cx - 2.2, cy - d); c.lineTo(cx + 2.2, cy + d); } c.stroke(); }
        // 钢板接缝（两格一块）与铆钉
        if (x % 2 === 0) { c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect(px, py, 1.5, T); c.fillStyle = "rgba(255,255,255,.05)"; c.fillRect(px + 1.5, py, 1, T); }
        if (y % 2 === 0) { c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect(px, py, T, 1.5); c.fillStyle = "rgba(255,255,255,.05)"; c.fillRect(px, py + 1.5, T, 1); }
        if (x % 2 === 0 && y % 2 === 0) { for (const [rx, ry] of [[5, 5], [T * 2 - 5, 5], [5, T * 2 - 5]]) { if (rx > T || ry > T) continue; c.fillStyle = "rgba(0,0,0,.5)"; circ(c, px + rx, py + ry, 1.8); c.fillStyle = "rgba(255,255,255,.14)"; circ(c, px + rx - .5, py + ry - .5, .9); } }
        if (theme === "lab" && x % 5 === 0) { c.fillStyle = "rgba(90,220,230,.10)"; c.fillRect(px + T / 2 - 1, py, 2, T); }
        if (theme === "street" && n > .88) { c.fillStyle = "rgba(8,12,14,.6)"; el(c, px + 20, py + 20, 15, 9, n * 6); c.strokeStyle = "rgba(150,180,190,.14)"; c.lineWidth = 1; c.beginPath(); c.ellipse(px + 17, py + 18, 9, 4, n * 6, 3.4, 5); c.stroke(); } }
      // 污渍、锈迹
      for (let k = 0; k < 5; k++) { const a = h2(x * 7 + k, y * 3, seed + 5), b = h2(x, y * 5 + k, seed + 9); c.fillStyle = a > .6 ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.18)"; c.fillRect(px + a * T, py + b * T, 2 + b * 4, 1.5 + a * 2); }
      if (n2 > .8) { c.fillStyle = "rgba(90,50,20,.13)"; el(c, px + n * T, py + n2 * 30, 9 + n * 8, 5 + n2 * 4, n * 5); }
      if (n2 < .12) { c.fillStyle = "rgba(0,0,0,.3)"; el(c, px + 20, py + 22, 13, 8, n * 3); }
      // 陈旧血迹与弹壳
      if (n > .5 && n2 > .9) { c.fillStyle = "rgba(60,8,8,.55)"; el(c, px + 18, py + 20, 10 + n * 6, 6 + n * 4, n * 9); for (let k = 0; k < 4; k++) circ(c, px + 18 + (h2(x, k, 3) - .5) * 44, py + 20 + (h2(k, y, 4) - .5) * 40, 1.5 + h2(x + k, y, 6) * 2); }
      if (n < .5 && n2 > .84) for (let k = 0; k < 3; k++) { c.save(); c.translate(px + h2(x, k, 11) * T, py + h2(k, y, 12) * T); c.rotate(h2(x + k, y, 13) * 6); c.fillStyle = "#8a6f2e"; c.fillRect(-1.6, -.7, 3.2, 1.4); c.restore(); }
      // 墙根警示条
      if (at(x, y - 1) === 1 && n > .55) { for (let k = 0; k < 5; k++) { c.fillStyle = k % 2 ? "#141414" : th.acc; c.globalAlpha = .75; c.fillRect(px + k * 8, py + 2, 8, 4); } c.globalAlpha = 1; }
      // 墙脚阴影
      const sh = (x0, y0, x1, y1, r) => { const gr = c.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, "rgba(0,0,0,.6)"); gr.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = gr; c.fillRect(...r); };
      // 墙投在地上的影子：光从左上来，影子落在墙的下方和右方
      if (at(x, y - 1) === 1) sh(0, py, 0, py + 26, [px, py, T, 26]); if (at(x - 1, y) === 1) sh(px, 0, px + 22, 0, [px, py, 22, T]); else if (at(x - 1, y - 1) === 1) { const gr = c.createRadialGradient(px, py, 0, px, py, 22); gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = gr; c.fillRect(px, py, 22, 22); }
    }
    if (v === 3) prop(c, tc, px, py, th.prop, n, th);
  }
  // 第二遍：墙。每堵墙是一个有高度的方块——顶面最亮、左侧面中等、正面最暗，棱上有一条高光
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (at(x, y) !== 1) continue; const px = x * T, py = y * T, n = h2(x, y, seed), n2 = h2(x, y, seed + 31);
    let near = false; for (let oy = -2; oy <= 2 && !near; oy++) for (let ox = -2; ox <= 1; ox++) if (at(x + ox, y + oy) !== 1) { near = true; break; } if (!near) continue;
    if (at(x - 1, y) !== 1) { // 左侧面
      const gr = c.createLinearGradient(px, 0, px + SX, 0); gr.addColorStop(0, shade(th.wall, .62)); gr.addColorStop(1, shade(th.wall, .82)); c.fillStyle = gr; c.beginPath(); c.moveTo(px, py); c.lineTo(px + SX, py - WH); c.lineTo(px + SX, py + T - WH); c.lineTo(px, py + T); c.closePath(); c.fill();
      c.strokeStyle = "rgba(0,0,0,.4)"; c.lineWidth = 1; c.beginPath(); c.moveTo(px, py + T * .5); c.lineTo(px + SX, py + T * .5 - WH); c.moveTo(px + .5, py); c.lineTo(px + .5, py + T); c.stroke(); }
    if (at(x, y + 1) !== 1) { // 正面：金属板、管道、通风口（跟着斜切）
      const yb = py + T, k = -SX / WH, fy = yb - WH; c.save(); c.transform(1, 0, k, 1, -k * yb, 0);
      const gr = c.createLinearGradient(0, fy, 0, yb); gr.addColorStop(0, shade(th.wall, .62)); gr.addColorStop(1, shade(th.wall, .26)); c.fillStyle = gr; c.fillRect(px, fy, T + .6, WH);
      c.fillStyle = "rgba(0,0,0,.4)"; c.fillRect(px, fy, 1, WH); c.fillRect(px, yb - 3, T, 3);
      if (n > .78) { c.fillStyle = "#050607"; c.fillRect(px + 8, fy + 6, 24, 12); c.fillStyle = shade(th.wall, .6); for (let q = 0; q < 4; q++) c.fillRect(px + 8, fy + 7 + q * 3, 24, 1.2); }
      else { c.fillStyle = shade(th.pipe, .5); c.fillRect(px, fy + 6, T + .6, 5); c.fillStyle = shade(th.pipe, 1); c.fillRect(px, fy + 6, T + .6, 1.6); c.fillStyle = shade(th.pipe, .3); c.fillRect(px, fy + 10, T + .6, 1);
        c.fillStyle = "#3d2717"; c.fillRect(px, fy + 16, T + .6, 2.4); c.fillStyle = "#6a4324"; c.fillRect(px, fy + 16, T + .6, .9);
        if (x % 3 === 0) { c.fillStyle = shade(th.pipe, .75); c.fillRect(px + 16, fy + 4.5, 5, 8); c.fillStyle = "rgba(0,0,0,.5)"; c.fillRect(px + 20, fy + 4.5, 1, 8); } }
      if (n < .07) { c.fillStyle = "#3a0a08"; c.fillRect(px + 16, fy + 1, 8, 4); Rn.reds.push({ x: px + 20 + SX * .8, y: fy + 3, f: n * 90 }); }
      if (n2 > .86) { c.fillStyle = "rgba(80,8,8,.6)"; c.fillRect(px + n * 24, fy + 3, 5 + n2 * 4, WH - 4); el(c, px + n * 24 + 3, fy + 5, 6, 3); }
      c.restore(); }
    // 顶面（画在上层，整体向右上偏移）
    const tx = px + SX, ty = py - WH; tc.fillStyle = shade(th.wall, n < .5 ? 1.22 : 1.12); tc.fillRect(tx, ty, T + .6, T + .6);
    tc.fillStyle = "rgba(255,255,255,.04)"; tc.fillRect(tx + 4, ty + 4, T - 8, T - 8); tc.fillStyle = "rgba(0,0,0,.22)"; tc.fillRect(tx, ty, T, 1); tc.fillRect(tx + T - 1, ty, 1, T);
    if (n2 > .7) { tc.fillStyle = "rgba(0,0,0,.25)"; tc.fillRect(tx + 8 + n * 14, ty + 8 + n2 * 10, 9, 6); }
    tc.lineWidth = 2; tc.strokeStyle = "rgba(0,0,0,.75)"; tc.beginPath(); if (at(x, y - 1) !== 1) { tc.moveTo(tx, ty + 1); tc.lineTo(tx + T, ty + 1); } if (at(x + 1, y) !== 1) { tc.moveTo(tx + T - 1, ty); tc.lineTo(tx + T - 1, ty + T); } tc.stroke();
    tc.strokeStyle = "rgba(255,255,255,.34)"; tc.lineWidth = 1.6; tc.beginPath(); if (at(x - 1, y) !== 1) { tc.moveTo(tx + .8, ty); tc.lineTo(tx + .8, ty + T); } if (at(x, y + 1) !== 1) { tc.moveTo(tx, ty + T - .8); tc.lineTo(tx + T, ty + T - .8); } tc.stroke();
  }
};
function prop(c, tc, px, py, kind, n, th) {
  c.fillStyle = "rgba(0,0,0,.5)"; el(c, px + 22, py + 35, 21, 8);
  if (kind === "tank") { c.fillStyle = "#14222a"; c.fillRect(px + 5, py + 24, 30, 14); tc.fillStyle = "#1d343f"; circ(tc, px + 20, py + 16, 15); const gr = tc.createRadialGradient(px + 20, py + 16, 2, px + 20, py + 16, 13); gr.addColorStop(0, "rgba(140,240,235,.85)"); gr.addColorStop(1, "rgba(30,130,150,.25)"); tc.fillStyle = gr; circ(tc, px + 20, py + 16, 12); tc.fillStyle = "rgba(15,45,38,.85)"; el(tc, px + 20, py + 17, 4, 7, n); tc.strokeStyle = "#0a1418"; tc.lineWidth = 2; tc.beginPath(); tc.arc(px + 20, py + 16, 15, 0, TAU); tc.stroke(); return; }
  const col = kind === "crate" ? "#4b5236" : kind === "bed" ? "#8f9a94" : "#6c706c", h = kind === "bed" ? 9 : 14;
  c.fillStyle = shade(col, .45); c.fillRect(px + 3, py + T - h - 3, T - 6, h); c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(px + 3, py + T - 6, T - 6, 3);
  tc.fillStyle = col; tc.fillRect(px + 3, py + 9 - h, T - 6, T - 12); tc.strokeStyle = "rgba(0,0,0,.7)"; tc.lineWidth = 1.5; tc.strokeRect(px + 3, py + 9 - h, T - 6, T - 12);
  if (kind === "crate") { tc.fillStyle = "rgba(0,0,0,.25)"; tc.fillRect(px + 3, py + 9 - h + 8, T - 6, 2); tc.fillRect(px + 3, py + 9 - h + 18, T - 6, 2); tc.fillStyle = "rgba(220,220,200,.35)"; tc.fillRect(px + 9, py + 9 - h + 11, 10, 5); tc.fillStyle = shade(col, 1.3); tc.fillRect(px + 3, py + 9 - h, T - 6, 1.5); }
  else if (kind === "bed") { tc.fillStyle = "#b9c2bd"; tc.fillRect(px + 6, py + 2, 10, T - 18); tc.fillStyle = "rgba(110,14,14,.7)"; el(tc, px + 25, py + 11, 6 + n * 5, 5, n * 3); }
  else { for (let k = 0; k < 4; k++) { tc.fillStyle = k % 2 ? "#151515" : th.acc; tc.fillRect(px + 4 + k * 8, py + 6, 8, 6); } }
}
/* 尸体：k 是倒地进度 0→1。活动画面和烙进地面都用它 */
function drawCorpse(c, d, k, tw) {
  const r = d.r, sk = shade(d.skin, .6), cl = shade(d.c, .55), v = d.v || .5, big = d.type === "brute" || d.type === "elite" || d.type === "boss";
  c.save(); c.translate(d.x, d.y); c.rotate(d.ang + tw);
  c.fillStyle = "rgba(52,5,5,.85)"; el(c, 0, 0, r * (.9 + .8 * k), r * (.7 + .55 * k), v * 3); el(c, r * (.6 + v * .5) * k, r * (v - .5) * 1.2, r * .6 * k, r * .45 * k); el(c, -r * .8 * k, r * (.5 - v), r * .5 * k, r * .35 * k);
  const s = .82 + .18 * k; c.scale(s, s); c.lineCap = "round";
  if (d.type !== "crawler") { c.strokeStyle = "#17191c"; c.lineWidth = r * .36; c.beginPath(); c.moveTo(-r * .5, -r * .3); c.lineTo(-r * 1.5, -r * (.4 + v * .3)); c.moveTo(-r * .5, r * .3); c.lineTo(-r * 1.1, r * .5); c.lineTo(-r * 1.5, r * (.1 + v * .3)); c.stroke(); }
  else { c.fillStyle = "#3a0606"; c.beginPath(); c.moveTo(-r * .7, -r * .5); c.lineTo(-r * 1.5, 0); c.lineTo(-r * .7, r * .5); c.fill(); }
  c.fillStyle = big && d.type === "brute" ? "#1f2327" : cl; el(c, 0, 0, r * .95, r * .7); c.strokeStyle = "#080a09"; c.lineWidth = 1.6; c.stroke(); c.fillStyle = "rgba(70,6,6,.7)"; el(c, r * (v - .5) * .8, r * (.5 - v) * .6, r * .4, r * .3);
  c.strokeStyle = sk; c.lineWidth = r * (big ? .34 : .25); c.beginPath(); c.moveTo(r * .3, -r * .6); c.lineTo(r * (.7 + v * .4), -r * 1.2 + tw * r * 3); c.moveTo(r * .3, r * .6); c.lineTo(r * 1.25, r * (.6 + v * .5) - tw * r * 3); c.stroke();
  c.fillStyle = sk; circ(c, r * 1.0, r * .1, r * (big ? .34 : .42)); c.strokeStyle = "#080a09"; c.lineWidth = 1.4; c.stroke(); c.fillStyle = "rgba(60,5,5,.8)"; circ(c, r * 1.05, r * .0, r * .16);
  c.restore();
}
/* 把新的血迹、尸体、弹壳、焦痕烙进地面图：越打越脏，永久保留 */
function bake(L) {
  const c = Rn.floor.getContext("2d");
  for (const d of L.decals) {
    if (d.t === "blood") { c.fillStyle = d.c; c.globalAlpha = .78; el(c, d.x, d.y, d.r, d.r * .7, d.x); if (d.sp) for (let k = 0; k < 5; k++) { const a = d.ang + (h2(d.x, k, 1) - .5) * 1.1, l = d.r * (1.2 + h2(k, d.y, 2) * 3); el(c, d.x + Math.cos(a) * l, d.y + Math.sin(a) * l, 1 + h2(k, d.x, 5) * 2.6, .8 + h2(d.y, k, 6) * 1.4, a); } c.globalAlpha = 1; }
    else if (d.t === "shell") { c.save(); c.translate(d.x, d.y); c.rotate(d.ang); c.fillStyle = "#9a7c34"; c.fillRect(-1.7, -.8, 3.4, 1.6); c.fillStyle = "#d9bc6a"; c.fillRect(-1.7, -.8, 3.4, .6); c.restore(); }
    else if (d.t === "scorch") { const g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r); g.addColorStop(0, "rgba(0,0,0,.8)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2); }
    else if (d.t === "crack") { c.strokeStyle = "rgba(0,0,0,.7)"; c.lineWidth = 1.6; c.beginPath(); for (let k = 0; k < 9; k++) { const a = k / 9 * TAU + h2(d.x, k, 3), l = d.r * (.5 + h2(k, d.y, 4) * .6); c.moveTo(d.x, d.y); c.lineTo(d.x + Math.cos(a) * l * .5 + 3, d.y + Math.sin(a) * l * .5); c.lineTo(d.x + Math.cos(a + .2) * l, d.y + Math.sin(a + .2) * l); } c.stroke(); c.fillStyle = "rgba(0,0,0,.45)"; circ(c, d.x, d.y, d.r * .3); }
    else if (d.t === "acid") { const g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r); g.addColorStop(0, "rgba(40,60,10,.55)"); g.addColorStop(.7, "rgba(60,80,14,.35)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; circ(c, d.x, d.y, d.r); }
    else if (d.t === "gib") { c.fillStyle = "rgba(60,6,6,.8)"; el(c, d.x, d.y, d.r * 1.6, d.r * 1.1, d.ang); c.fillStyle = "#6a1c16"; el(c, d.x, d.y, d.r, d.r * .7, d.ang); c.fillStyle = "rgba(200,120,110,.35)"; circ(c, d.x - 1, d.y - 1, d.r * .3); }
    else if (d.t === "smear") { c.save(); c.translate(d.x, d.y); c.rotate(d.ang + Math.PI); const g = c.createLinearGradient(0, 0, d.r, 0); g.addColorStop(0, "rgba(70,6,6,.8)"); g.addColorStop(1, "rgba(70,6,6,0)"); c.fillStyle = g; c.fillRect(0, -4.5, d.r, 9); c.restore(); }
    else drawCorpse(c, d, 1, 0);
  }
  L.decals.length = 0;
}

/* ---------- 角色：带骨骼的人体模型，按约 60° 俯角投影（斜 3/4 视角） ----------
   关节（髋/膝/踝/肩/肘/腕）先在三维里摆好姿势，再投影到屏幕、按远近排序画出来。
   走路是 8 帧循环：脚跟着地 → 全脚掌支撑 → 脚尖离地 → 屈膝前摆；步幅和移动距离绑定，落地的脚不打滑 */
const PX = 40, YK = .76, ZK = .7, OUTC = "rgba(6,8,7,.9)", _sd = {};
const sd = (hex, k) => _sd[hex + k] || (_sd[hex + k] = shade(hex, k));
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], add3 = (a, x, y, z) => [a[0] + x, a[1] + y, a[2] + z];
const BODY = {
  player: { s: 1, hipH: .9, hipW: .09, shW: .2, tor: .5, lean: .12, stride: .26, lift: .1, arm: "gun", m: 1.05 },
  walker: { s: 1, hipH: .88, hipW: .09, shW: .19, tor: .5, lean: .3, tilt: .3, stride: .17, lift: .05, arm: "reach", m: 1, drag: 1 },
  runner: { s: .95, hipH: .86, hipW: .08, shW: .17, tor: .47, lean: .55, tilt: -.25, stride: .34, lift: .16, arm: "flail", m: .8 },
  spitter: { s: 1, hipH: .86, hipW: .1, shW: .19, tor: .48, lean: .38, tilt: -.35, stride: .12, lift: .04, arm: "hang", m: 1 },
  bloater: { s: 1.3, hipH: .8, hipW: .17, shW: .23, tor: .46, lean: .05, stride: .12, lift: .04, arm: "hang", out: .55, m: 1.45 },
  brute: { s: 1.45, hipH: .9, hipW: .11, shW: .27, tor: .52, lean: .2, tilt: .1, stride: .2, lift: .07, arm: "swing", m: 1.28 },
  crawler: { s: 1, stride: .14, m: 1 }
};
const BK = { player: "player", walker: "walker", runner: "runner", spitter: "spitter", bloater: "bloater", brute: "brute", elite: "brute", elite2: "brute", crawler: "crawler" };
const CYC = k => 4 * BODY[BK[k]].stride * PX * BODY[BK[k]].s;
function pose(B, p, stand) {
  const J = {}, TW = TAU, hz = B.hipH - .03 - (stand ? 0 : .02 * Math.cos(2 * TW * p)), th = .45 * B.hipH / .9, sn = .43 * B.hipH / .9;
  for (let i = 0; i < 2; i++) { const sy = i ? 1 : -1, q = (p + (i ? .5 : 0)) % 1, dr = B.drag && i === 0, st = B.stride * (dr ? .4 : 1), lf = dr ? .006 : B.lift, off = dr ? -.1 : 0; let fx = off + (stand ? (i ? .03 : -.03) : 0), fz = 0, pit = 0;
    if (!stand) { if (q < .5) { const t = q * 2; fx = off + st * (1 - 2 * t); pit = t < .2 ? -(1 - t / .2) * .45 : t > .7 ? (t - .7) / .3 * .65 : 0; } else { const t = (q - .5) * 2, e = t * t * (3 - 2 * t); fx = off + st * (-1 + 2 * e); fz = lf * Math.sin(Math.PI * t); pit = .65 * (1 - t) - .45 * t; } if (dr) pit = .55; }
    let ax = fx, az = .07 + fz + Math.max(0, pit) * .09, dx = ax, dz = az - hz, Ld = Math.hypot(dx, dz); const mx = th + sn - .004; if (Ld > mx) { ax = dx / Ld * mx; az = hz + dz / Ld * mx; Ld = mx; dx = ax; dz = az - hz; }
    const a1 = Math.atan2(dx, -dz) + Math.acos(Math.max(-1, Math.min(1, (th * th + Ld * Ld - sn * sn) / (2 * th * Ld))));
    J["hip" + i] = [0, sy * B.hipW, hz]; J["knee" + i] = [Math.sin(a1) * th, sy * B.hipW * 1.05, hz - Math.cos(a1) * th]; J["ank" + i] = [ax, sy * B.hipW * 1.1, az];
    J["heel" + i] = [ax - .06, sy * B.hipW * 1.1, fz + Math.max(0, pit) * .1 + .025]; J["toe" + i] = [ax + .17, sy * (B.hipW * 1.1 + .025), fz + Math.max(0, -pit) * .11 + .025]; }
  const ln = B.lean, sx = Math.sin(ln), cz = Math.cos(ln); J.waist = [sx * .13, 0, hz + cz * .13]; J.chest = [sx * B.tor, 0, hz + cz * B.tor];
  for (let i = 0; i < 2; i++) { const sy = i ? 1 : -1, q = (p + (i ? .5 : 0)) % 1, sw = stand ? 0 : Math.cos(TW * q), S = [J.chest[0] - sy * (stand ? 0 : .035 * Math.cos(TW * p)), sy * B.shW, J.chest[2] - .03], ua = .29, fa = .27; let t1, bend, out = B.out || .1;
    if (B.arm === "swing") { t1 = ln - .55 * sw; bend = .25 + .35 * Math.max(0, -sw); } else if (B.arm === "reach") { t1 = ln + (i ? 1.2 : .9) + .1 * sw; bend = .25; out = .03; } else if (B.arm === "flail") { t1 = ln + .7 - 1.1 * sw; bend = 1.1; out = .25; } else { t1 = ln * .5 + .12 - .08 * sw; bend = .2; }
    const el = [S[0] + Math.sin(t1) * ua, S[1] + sy * out * ua, S[2] - Math.cos(t1) * ua]; J["sh" + i] = S; J["el" + i] = el; J["ha" + i] = [el[0] + Math.sin(t1 + bend) * fa, el[1] + sy * out * .1, el[2] - Math.cos(t1 + bend) * fa]; }
  const hl = ln + (B.tilt || 0); J.head = [J.chest[0] + Math.sin(hl) * .2, 0, J.chest[2] + Math.cos(hl) * .2]; return J;
}
/* 给人形骨架穿衣服。S：皮肤/上衣/裤子/鞋 等颜色与开关 */
function humanoid(F, J, B, S) { const { seg, ball, quad, fn, pr } = F, m = B.m;
  for (let i = 0; i < 2; i++) { const hip = J["hip" + i], kn = J["knee" + i], an = J["ank" + i], bare = S.bareShin && S.bareShin[i];
    seg(hip, kn, .15 * m, S.pants); seg(kn, an, .105 * m, bare ? S.skin : S.pants); if (bare) seg(kn, lerp3(kn, an, .3), .125 * m, S.pants, .001);
    if (S.boot) seg(lerp3(kn, an, .55), an, .125 * m, S.shoe, .002); seg(J["heel" + i], J["toe" + i], .095 * m, S.barefoot ? S.skin : S.shoe, .003);
    if (S.kneepad) { ball(add3(kn, .035, 0, 0), .072 * m, S.kneepad, .01); }
    const sh = J["sh" + i], el = J["el" + i], ha = J["ha" + i]; seg(sh, el, .1 * m, S.sleeve ? S.shirt : S.skin); if (!S.sleeve) ball(sh, .066 * m, S.shirt, -.001);
    seg(el, ha, .082 * m, S.sleeve === 2 ? S.shirt : S.skin); ball(ha, (S.fist || .05) * m, S.glove || S.skin, .002); }
  seg(J.hip0, J.hip1, .2 * m, S.pants, .004);
  const wl = add3(J.waist, 0, -B.hipW * 1.5, 0), wr = add3(J.waist, 0, B.hipW * 1.5, 0), tk = .19 * m * (S.chest || 1); quad([J.sh0, J.sh1, wr, wl], tk, S.shirt, .006);
  // 衣服褶皱
  fn(lerp3(J.chest, J.waist, .5), .02, (g, c, K) => { g.strokeStyle = "rgba(0,0,0,.28)"; g.lineWidth = 1; g.lineCap = "round"; for (const [a, b, t1, t2] of [[J.sh0, wl, .35, .55], [J.sh1, wr, .5, .3], [J.sh0, wl, .7, .85]]) { const p1 = pr(lerp3(lerp3(a, b, t1), J.chest, .25)), p2 = pr(lerp3(lerp3(J.sh1, wr, t2), J.chest, .2)); g.beginPath(); g.moveTo(p1[0], p1[1]); g.quadraticCurveTo((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 + 2, p2[0], p2[1]); g.stroke(); } });
  seg(add3(J.chest, 0, 0, -.02), J.head, .078 * m, S.skin, 0);
  const hr = (S.hr || .108) * (S.headM || 1); ball(J.head, hr, S.skin, .02); if (S.hair) ball(add3(J.head, -.04, 0, .03), hr * .93, S.hair, .021);
  return { wl, wr, hr };
}
function zFace(F, J, hr, o) { const { pr } = F, hc = pr(J.head), eyes = []; o = o || {};
  for (const sy of [-1, 1]) { const e = pr(add3(J.head, hr * .82, sy * hr * .42, .0)); if (e[2] > hc[2] - .012) eyes.push(e); }
  const mo = pr(add3(J.head, hr * .88, 0, -hr * .5));
  F.fn(add3(J.head, hr, 0, 0), .06, g => { if (mo[2] > hc[2] - .02) { g.fillStyle = o.mouth || "#260505"; g.beginPath(); g.ellipse(mo[0], mo[1], o.open ? 2.3 : 1.6, o.open ? 2 : 1.1, 0, 0, TAU); g.fill(); }
    for (const e of eyes) { g.fillStyle = "rgba(255,40,20,.35)"; g.beginPath(); g.arc(e[0], e[1], 1.7, 0, TAU); g.fill(); g.fillStyle = "#ff3a26"; g.beginPath(); g.arc(e[0], e[1], .85, 0, TAU); g.fill(); } });
  return eyes.map(e => [e[0], e[1]]); }
const stain = (F, P, r, col) => F.ball(P, r, col || "#6a0f0f", 0, 1);
const DRESS = {
  player(F, J, B, base, M) { const { seg, ball, quad, fn, pr } = F, C = J.chest;
    const GL = { pistol: .2, smg: .5, shotgun: .78, rifle: .8, sniper: 1, flamer: .74, launcher: .72 }[base], pis = base === "pistol";
    const g0 = pis ? add3(C, .4, .05, -.1) : add3(C, .04, .14, -.1), g1 = add3(g0, GL, pis ? 0 : -.07, -.04), gp = t => lerp3(g0, g1, t);
    // 双手持枪：右手握把，左手托护木
    J.ha1 = add3(gp(pis ? .1 : .3), 0, 0, -.04); J.el1 = add3(J.sh1, .03, .1, -.25); J.ha0 = add3(gp(pis ? .12 : .62), 0, -.03, -.04); J.el0 = add3(lerp3(J.sh0, J.ha0, .5), 0, -.07, -.1);
    const S = { skin: "#b08a68", shirt: "#4b5a43", sleeve: 2, pants: "#414f3b", shoe: "#131415", boot: 1, kneepad: "#22262a", glove: "#17191a" }, R = humanoid(F, J, B, S);
    quad([lerp3(J.sh0, C, .18), lerp3(J.sh1, C, .18), add3(R.wr, 0, -.02, .03), add3(R.wl, 0, .02, .03)], .225, "#2c342a", .012); // 战术背心
    for (const [t, y] of [[.45, -.075], [.45, .075], [.72, 0]]) ball(add3(lerp3(C, J.waist, t), .125, y, 0), .046, "#39422f"); // 弹匣包
    seg(add3(C, -.17, 0, -.05), add3(J.waist, -.16, 0, .05), .24, "#38452e"); seg(add3(C, -.18, -.1, .02), add3(C, -.18, .1, .02), .085, "#565b45", .004); // 背包 + 卷毯
    ball(add3(J.head, 0, 0, .028), .128, "#4c5c41", .03); ball(add3(J.head, .1, 0, .05), .03, "#141617", .04); // 头盔
    fn(add3(J.head, 0, 0, .1), .08, (g, c) => { g.strokeStyle = "rgba(210,220,190,.35)"; g.lineWidth = .8; g.beginPath(); g.moveTo(c[0] - 3, c[1] + 2); g.lineTo(c[0] - .5, c[1] + 3.2); g.moveTo(c[0] + 1.5, c[1] + .5); g.lineTo(c[0] + 3, c[1] + 2); g.stroke(); g.strokeStyle = "rgba(0,0,0,.4)"; g.beginPath(); g.arc(c[0], c[1] + 4.5, 5.2, .25, 2.9); g.stroke(); }); // 头盔划痕与帽檐
    for (let i = 0; i < 2; i++) fn(add3(J["knee" + i], .06, 0, 0), .02, (g, c) => { g.fillStyle = "rgba(190,195,180,.3)"; g.fillRect(c[0] - 1, c[1] - 1, 2, 1.2); }); // 护膝磨损
    // 步枪：枪托、机匣、弹匣、护木、枪管、枪口
    if (!pis) seg(g0, gp(.24), .06, "#3b2c1f"); seg(gp(pis ? 0 : .24), gp(pis ? .6 : .52), base === "launcher" ? .11 : .074, base === "flamer" ? "#7a3a20" : "#1d1f22", .002);
    seg(gp(pis ? .6 : .52), gp(.76), base === "launcher" ? .1 : .058, "#282b2f", .002); seg(gp(.74), g1, base === "shotgun" ? .04 : base === "launcher" ? .09 : .028, "#0d0e0f", .002); ball(g1, base === "launcher" ? .05 : .022, "#18191b", .003);
    if (base === "rifle" || base === "smg" || base === "sniper") seg(gp(.42), add3(gp(.45), .01, 0, -.13), .046, "#141618", .001); if (base === "sniper") seg(add3(gp(.3), 0, 0, .06), add3(gp(.55), 0, 0, .06), .04, "#111314", .004);
    if (base === "flamer") ball(add3(C, -.2, .12, -.2), .09, "#8a3f20", .001);
    M.muz = pr(add3(g1, .04, 0, 0)); M.gun = pr(gp(.5)); },
  walker(F, J, B, v, M) { const sk = "#73836d", S = { skin: sk, shirt: ["#aeb0a4", "#9aa4ab", "#b0a590"][v % 3], sleeve: 0, pants: "#3d5380", bareShin: [0, 1], shoe: "#1a1c1e", hair: ["#1f1a15", "#3a2e22", "#15171a"][v % 3] }, R = humanoid(F, J, B, S), C = J.chest;
    stain(F, add3(lerp3(C, J.waist, .4), .11, .04, 0), .05); stain(F, add3(lerp3(C, J.waist, .75), .1, -.06, 0), .038); stain(F, add3(C, -.1, .05, -.1), .045); stain(F, add3(J.sh1, 0, 0, .05), .035, "#4a0808"); // 血渍、肩上的咬痕
    stain(F, lerp3(J.el0, J.ha0, .5), .028, "#3f5a3a"); stain(F, lerp3(J.el1, J.ha1, .4), .026, "#3f5a3a"); stain(F, lerp3(J.knee1, J.ank1, .6), .03, "#5a0d0d"); stain(F, add3(J.ha0, .02, 0, 0), .03, "#4a0808"); stain(F, add3(J.ha1, .02, 0, 0), .03, "#4a0808");
    for (const t of [.1, .4, .65, .92]) { const a = lerp3(R.wl, R.wr, t); F.seg(a, add3(a, .01 - t * .02, 0, -.06 - (t * 7 % 1) * .06), .04, sd(S.shirt, .85), .005); } // 撕烂的衣摆
    M.eyes = zFace(F, J, R.hr); },
  runner(F, J, B, v, M) { const sk = "#9d9c84", S = { skin: sk, shirt: "#6a3a34", chest: .82, sleeve: 0, pants: "#33302c", bareShin: [1, 1], barefoot: 1 }, R = humanoid(F, J, B, S), C = J.chest;
    stain(F, add3(lerp3(C, J.waist, .5), .09, 0, 0), .04); stain(F, add3(C, -.08, -.04, -.12), .04); stain(F, lerp3(J.knee0, J.ank0, .5), .025, "#5a0d0d"); stain(F, add3(J.head, -.03, .02, .09), .03, "#5a0d0d");
    for (let i = 0; i < 3; i++) F.fn(lerp3(C, J.waist, .3 + i * .2), .03, (g, c) => { g.strokeStyle = "rgba(0,0,0,.3)"; g.lineWidth = .8; g.beginPath(); g.moveTo(c[0] - 3, c[1]); g.lineTo(c[0] + 3, c[1]); g.stroke(); }); // 肋骨
    M.eyes = zFace(F, J, R.hr, { open: 1 }); },
  spitter(F, J, B, v, M) { const sk = "#a3aa4c", S = { skin: sk, shirt: "#8d9440", sleeve: 0, pants: "#454a2e", bareShin: [1, 1], barefoot: 1, hair: "#3a4a12" }, R = humanoid(F, J, B, S), C = J.chest;
    for (const [x, y, z, r] of [[-.13, -.08, -.06, .052], [-.14, .07, -.12, .058], [-.12, -.03, -.24, .045], [-.11, .1, -.3, .04], [-.06, -.16, -.1, .04]]) F.ball(add3(C, x, y, z), r, "#e2d870"); // 背上的脓包
    F.ball(add3(C, .12, 0, -.1), .078, "#b4e85a", .01); M.sac = F.pr(add3(C, .12, 0, -.1)); stain(F, add3(lerp3(C, J.waist, .7), .1, .03, 0), .04, "#55701c"); M.eyes = zFace(F, J, R.hr, { open: 1, mouth: "#8fd838" }); },
  bloater(F, J, B, v, M) { const sk = "#7f9a48", S = { skin: sk, shirt: "#5c5a44", sleeve: 0, pants: "#4c4a34", bareShin: [1, 1], barefoot: 1, headM: .85 }, R = humanoid(F, J, B, S), bc = add3(J.waist, .07, 0, .1), br = .36;
    F.ball(bc, br, sk, .01); for (const [x, y, z, r] of [[.2, .12, .2, .06], [.1, -.2, .22, .055], [-.1, .1, .3, .05], [.25, -.05, .05, .05], [0, .28, .1, .05], [-.2, -.15, .2, .045], [.05, 0, .34, .045]]) F.ball(add3(bc, x, y, z), r, "#e8de78", .012);
    F.fn(add3(bc, 0, 0, br), .2, (g, c, K) => { const r = br * K; g.fillStyle = "rgba(255,255,255,.38)"; g.beginPath(); g.ellipse(c[0] - r * .32, c[1] + r * .55, r * .3, r * .14, -.6, 0, TAU); g.fill(); g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.arc(c[0] - r * .5, c[1] + r * .78, r * .06, 0, TAU); g.fill(); g.strokeStyle = "rgba(24,44,10,.45)"; g.lineWidth = .9; g.beginPath(); g.moveTo(c[0], c[1] + r); g.quadraticCurveTo(c[0] + r * .4, c[1] + r * 1.1, c[0] + r * .6, c[1] + r * 1.5); g.moveTo(c[0], c[1] + r); g.quadraticCurveTo(c[0] - r * .3, c[1] + r * 1.4, c[0] - r * .1, c[1] + r * 1.8); g.stroke(); }); // 肚皮的高光和青筋
    for (const t of [.15, .5, .85]) { const a = lerp3(J.sh0, J.sh1, t); F.seg(a, add3(a, .04, 0, -.12), .05, "#55533e", .02); } M.eyes = zFace(F, J, R.hr); },
  brute(F, J, B, o, M) { o = o || { vest: "#3a4048", pad: "#23272c", cap: "#2a2f34" }; const sk = o.skin || "#6a7566", S = { skin: sk, shirt: sd(o.vest, .8), sleeve: 0, pants: "#2c3238", boot: 1, shoe: "#0f1011", kneepad: "#2a2e32", fist: .062, headM: .95 }, R = humanoid(F, J, B, S), C = J.chest;
    F.quad([lerp3(J.sh0, C, .12), lerp3(J.sh1, C, .12), add3(R.wr, 0, 0, .04), add3(R.wl, 0, 0, .04)], .235, o.vest, .012); for (let i = 0; i < 2; i++) F.ball(add3(J["sh" + i], 0, 0, .03), .078, o.pad, .014);
    stain(F, add3(lerp3(C, J.waist, .45), .16, .05, 0), .06); stain(F, add3(C, -.15, -.06, -.12), .05); stain(F, add3(J.ha0, .03, 0, 0), .05, "#4a0808"); stain(F, add3(J.ha1, .03, 0, 0), .05, "#4a0808");
    F.ball(add3(J.head, -.035, 0, .035), R.hr * .98, o.cap, .03);
    if (o.cross) F.fn(add3(J.head, 0, 0, .13), .1, (g, c) => { g.fillStyle = "#b3261c"; g.fillRect(c[0] - 3, c[1] + 4, 6, 2); g.fillRect(c[0] - 1, c[1] + 2, 2, 6); }); else F.fn(add3(J.head, 0, 0, .13), .1, (g, c) => { g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 1; g.beginPath(); g.moveTo(c[0] - 3, c[1] + 2); g.lineTo(c[0], c[1] + 5); g.lineTo(c[0] - 1, c[1] + 9); g.stroke(); });
    M.eyes = zFace(F, J, R.hr); },
  elite(F, J, B, v, M) { DRESS.brute(F, J, B, { vest: "#cdd6d0", pad: "#9aa69f", cap: "#eef1ef", cross: 1, skin: "#9aa89c" }, M); },
  elite2(F, J, B, v, M) { DRESS.brute(F, J, B, { vest: "#4a2a2a", pad: "#6a1c18", cap: "#3a1512" }, M); },
  crawler(F, J0, B, v, M) { const sk = "#5b6858", p = F.p, J = { head: [.33, 0, .22], chest: [.14, 0, .17] }, st = [-.3, 0, .09];
    F.fn([-.6, 0, 0], -9, (g) => { const a = F.pr([-.3, 0, 0]), b = F.pr([-.85, 0, 0]), q = g.createLinearGradient(a[0], a[1], b[0], b[1]); q.addColorStop(0, "rgba(95,8,8,.85)"); q.addColorStop(1, "rgba(95,8,8,0)"); g.strokeStyle = q; g.lineWidth = 8; g.lineCap = "round"; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }); // 身后的血痕
    for (let i = 0; i < 2; i++) { const sy = i ? 1 : -1, sw = F.stand ? 0 : Math.cos(TAU * (p + i * .5)), sh = [.14, sy * .17, .16], el = [.24 + .06 * sw, sy * .33, .12 + .05 * Math.max(0, sw)], ha = [.46 + .14 * sw, sy * .22, .03 + .05 * Math.max(0, Math.sin(TAU * (p + i * .5)))];
      J["sh" + i] = sh; F.seg(sh, el, .095, sk); F.seg(el, ha, .08, sk); F.ball(ha, .05, sk, .002); stain(F, add3(ha, .02, 0, 0), .03, "#4a0808"); F.ball(sh, .065, "#454d52", -.001); }
    F.quad([J.sh0, J.sh1, [-.3, .1, .09], [-.3, -.1, .09]], .17, "#454d52", .004); F.ball(st, .07, "#5a0c0c", -.002); F.ball(add3(st, -.06, .04, -.03), .045, "#6a1410", -.003); F.seg(st, add3(st, -.12, -.02, -.05), .025, "#d8d0b8", -.004);
    stain(F, [0, .05, .26], .05); stain(F, [-.15, -.06, .2], .04); F.seg([.2, 0, .18], J.head, .075, sk); F.ball(J.head, .108, sk, .02); F.ball(add3(J.head, -.04, 0, .03), .1, "#15130f", .021); M.eyes = zFace(F, J, .108); }
};
/* 画一个角色到 g 的原点（脚下）。返回眼睛、枪口等位置 */
function figure(g, type, v, ang, p, stand) {
  const B = BODY[BK[type]], K = PX * B.s, ca = Math.cos(ang), sa = Math.sin(ang), parts = [], M = { eyes: [] };
  const pr = P => { const wy = P[0] * sa + P[1] * ca; return [(P[0] * ca - P[1] * sa) * K, wy * K * YK - P[2] * K * ZK, wy * .5 + P[2] * .87]; };
  const F = { pr, p, stand, seg: (A, Bq, w, col, bias) => { const a = pr(A), b = pr(Bq); parts.push([(a[2] + b[2]) / 2 + (bias || 0), 0, a, b, w * K, col]); }, ball: (C, r, col, bias, flat) => { const c = pr(C); parts.push([c[2] + (bias || 0) + (flat ? .03 : 0), 1, c, r * K, col, flat]); },
    quad: (pts, w, col, bias) => { const q = pts.map(pr); parts.push([(q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4 + (bias || 0), 2, q, w * K, col]); }, fn: (C, bias, f) => { const c = pr(C); parts.push([c[2] + bias, 3, c, f]); } };
  const J = type === "crawler" ? null : pose(B, p, stand); DRESS[type](F, J, B, v, M); if (J) { const h = pr(J.head); M.top = h[1] - .13 * K; M.chest = pr(J.chest); } else { M.top = -16; M.chest = [0, -6]; }
  parts.sort((a, b) => a[0] - b[0]); g.lineCap = "round"; g.lineJoin = "round";
  for (const q of parts) { const k = q[1];
    if (k === 0) { const a = q[2], b = q[3], w = q[4], col = q[5]; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = OUTC; g.lineWidth = w + 1.3; g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke();
      if (w > 2.4) { g.globalAlpha = .4; g.strokeStyle = sd(col, 1.45); g.lineWidth = w * .3; g.beginPath(); g.moveTo(a[0] - w * .2, a[1] - w * .22); g.lineTo(b[0] - w * .2, b[1] - w * .22); g.stroke(); g.strokeStyle = sd(col, .5); g.beginPath(); g.moveTo(a[0] + w * .22, a[1] + w * .24); g.lineTo(b[0] + w * .22, b[1] + w * .24); g.stroke(); g.globalAlpha = 1; } }
    else if (k === 1) { const c = q[2], r = q[3], col = q[4]; g.beginPath(); g.arc(c[0], c[1], r, 0, TAU); if (q[5]) { const hh = h2(c[0] * 7 | 0, c[1] * 5 | 0, 9); g.globalAlpha = .78; g.fillStyle = col; g.beginPath(); g.ellipse(c[0], c[1], r, r * .55, hh * 3, 0, TAU); g.ellipse(c[0] + r * (hh - .5), c[1] + r * .5, r * .5, r * .35, hh * 5, 0, TAU); g.ellipse(c[0] - r * .7, c[1] - r * .3 * hh, r * .3, r * .22, 0, 0, TAU); g.fill(); g.globalAlpha = 1; } else { const gr = g.createRadialGradient(c[0] - r * .35, c[1] - r * .4, r * .1, c[0], c[1], r); gr.addColorStop(0, sd(col, 1.45)); gr.addColorStop(.55, col); gr.addColorStop(1, sd(col, .5)); g.fillStyle = gr; g.fill(); g.strokeStyle = OUTC; g.lineWidth = 1; g.stroke(); } }
    else if (k === 2) { const P = q[2], w = q[3], col = q[4], path = () => { g.beginPath(); g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < 4; i++) g.lineTo(P[i][0], P[i][1]); g.closePath(); }; path(); g.strokeStyle = OUTC; g.lineWidth = w + 1.3; g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); g.fillStyle = col; g.fill();
      g.globalAlpha = .3; g.strokeStyle = sd(col, 1.45); g.lineWidth = w * .34; g.beginPath(); g.moveTo(P[0][0] - w * .2, P[0][1] - w * .2); g.lineTo(P[1][0] - w * .2, P[1][1] - w * .2); g.stroke(); g.strokeStyle = sd(col, .5); g.beginPath(); g.moveTo(P[3][0] + w * .2, P[3][1] + w * .22); g.lineTo(P[2][0] + w * .2, P[2][1] + w * .22); g.stroke(); g.globalAlpha = 1; }
    else q[3](g, q[2], K); }
  return M;
}
/* 丧尸精灵缓存：16 个朝向（右半边 9 个，左半边镜像）× 8 帧走路 + 1 帧站立，用到哪格画哪格 */
let CELLS = new Map();
function cell(type, v, k, f) { const key = type + v + "_" + k + "_" + f; let c = CELLS.get(key); if (c) return c;
  const big = BODY[BK[type]].s > 1.2, CL = big ? 160 : 104, SS = big ? 1.25 : 1.6, cv = document.createElement("canvas"); cv.width = cv.height = Math.round(CL * SS); const g = cv.getContext("2d"); g.setTransform(SS, 0, 0, SS, CL / 2 * SS, CL * .74 * SS);
  c = { cv, CL, M: figure(g, type, v, -Math.PI / 2 + k * Math.PI / 8, f / 8, f === 8) }; CELLS.set(key, c); return c; }
function gait(o, cyc, hold) { const mv = Math.hypot(o.x - (o._lx === undefined ? o.x : o._lx), o.y - (o._ly === undefined ? o.y : o._ly)); o._lx = o.x; o._ly = o.y; if (mv > .04 && mv < 30 && !hold) { o.gp = ((o.gp || 0) + mv / cyc) % 1; o.still = 0; } else if (!G.pausedDraw) o.still = (o.still || 0) + 1; return o.still > 7; }
/* 影子：椭圆，朝背光方向偏移拉长；身体起伏时略微缩放 */
function shadow(c, x, y, r, ang, k, sm) { c.save(); c.translate(x + Math.cos(ang) * r * .7 * k, y + Math.sin(ang) * r * .7 * k); c.rotate(ang); c.fillStyle = "rgba(0,0,0,.5)"; c.beginPath(); c.ellipse(0, 0, r * (.85 + .6 * k) * sm, r * .5 * sm, 0, 0, TAU); c.fill(); c.restore(); }
Rn.figure = figure;
function drawPlayer(c, pl, S) {
  const stand = gait(pl, CYC("player"), pl.dashT > 0) && pl.dashT <= 0, p = pl.dashT > 0 ? (pl.dashT * 7) % 1 : pl.gp || 0, up = stand ? 0 : (1 - Math.cos(2 * TAU * p)) / 2;
  shadow(c, pl.x, pl.y, 11, pl.va + Math.PI, .7, 1 - up * .08);
  c.save(); c.translate(pl.x, pl.y); const M = figure(c, "player", S.base, pl.va, p, stand);
  if (pl.hurtT > 0 && Math.sin(pl.hurtT * 60) > 0) { c.globalCompositeOperation = "lighter"; c.globalAlpha = .6; figure(c, "player", S.base, pl.va, p, stand); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; }
  Rn.muz = { x: pl.x + M.muz[0], y: pl.y + M.muz[1], a: Math.atan2(M.muz[1] - M.gun[1], M.muz[0] - M.gun[0]) };
  if (pl.flashT > 0 && !S.B.flame) { c.translate(M.muz[0], M.muz[1]); c.rotate(Rn.muz.a); const g = c.createRadialGradient(5, 0, 0, 5, 0, 20); g.addColorStop(0, "rgba(255,250,220,1)"); g.addColorStop(.35, "rgba(255,190,70,.85)"); g.addColorStop(1, "rgba(255,120,20,0)"); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(11, -8); c.lineTo(9, -2); c.lineTo(26, 0); c.lineTo(9, 2); c.lineTo(11, 8); c.closePath(); c.fill(); }
  c.restore();
}
function eKey(e) { return e.type === "elite" ? (e.look === "brute" ? "elite2" : "elite") : e.type; }
function drawEnemy(c, e, time, pl) {
  const E = e.E, r = e.r, fl = e.flash > 0, t = e.type; let top = -r - 16;
  if (t === "boss") { shadow(c, e.x, e.y, r, Math.atan2(e.y - pl.y, e.x - pl.x), 1, 1); const k = r / 13, C = x => fl ? "#fff" : x; c.save(); c.translate(e.x, e.y - 10); c.scale(1, .8); c.rotate(e.ang); c.scale(k, k); c.lineCap = "round";
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.sin(time * 2 + i) * .3, p = [Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a + .5) * 18, Math.sin(a + .5) * 18, Math.cos(a + Math.sin(time * 3 + i) * .6) * 24, Math.sin(a + Math.sin(time * 3 + i) * .6) * 24]; for (const [col, w] of [[OUTC, 5.2], [C("#5a3f6a"), 3.4]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(p[0], p[1]); c.quadraticCurveTo(p[2], p[3], p[4], p[5]); c.stroke(); } }
    c.fillStyle = fl ? "#fff" : "#c9c9cf"; el(c, 0, 0, 9, 11.5); c.strokeStyle = OUTC; c.lineWidth = 1; c.stroke(); c.fillStyle = C("#5a0d0d"); el(c, -2, 3, 4, 3); c.fillStyle = C("#75687f"); circ(c, 3, 0, 5.6); c.stroke(); c.fillStyle = C(`rgba(255,70,160,${.7 + Math.sin(time * 4) * .3})`); circ(c, -1, 0, 4.5); c.restore(); e._eyes = null; }
  else { const key = eKey(e), v = t === "walker" ? (e.v * 3) | 0 : 0, stand = gait(e, CYC(key), e.stag > 0 || e.st === "wind"), f = stand ? 8 : Math.floor((e.gp || 0) * 8) & 7;
    let a = ((e.ang % TAU) + TAU + Math.PI) % TAU - Math.PI, flip = false; if (Math.cos(a) < -1e-6) { a = Math.PI - a; if (a > Math.PI) a -= TAU; flip = true; } const k = Math.max(0, Math.min(8, Math.round((a + Math.PI / 2) / (Math.PI / 8)))), cl = cell(key, v, k, f), CL = cl.CL, M = cl.M;
    const up = f < 8 ? (1 - Math.cos(f / 8 * 2 * TAU)) / 2 : 0, tk = Math.floor(time * 9), jx = e.awake && h2(tk, (e.v * 997) | 0, 3) > .86 ? (h2(tk, 5, (e.v * 99) | 0) - .5) * 3 : 0;
    const wind = e.st === "wind" ? 1 - e.w / e.tele.t : 0, sq = e.st === "wind" ? (e.tele.type === "leap" ? 1 - wind * .2 : 1 + wind * .12) : 1;
    shadow(c, e.x, e.y, r * .85, Math.atan2(e.y - pl.y, e.x - pl.x), t === "crawler" ? .2 : 1, 1 - up * .08);
    c.save(); c.translate(e.x + jx, e.y); c.scale(flip ? -1 : 1, sq); c.drawImage(cl.cv, -CL / 2, -CL * .74, CL, CL); if (fl) { c.globalCompositeOperation = "lighter"; c.drawImage(cl.cv, -CL / 2, -CL * .74, CL, CL); c.drawImage(cl.cv, -CL / 2, -CL * .74, CL, CL); c.globalCompositeOperation = "source-over"; } c.restore();
    const sgn = flip ? -1 : 1; e._eyes = M.eyes.length ? M.eyes.map(q => [e.x + jx + q[0] * sgn, e.y + q[1] * sq]) : null; top = M.top * sq;
    if (t === "spitter" && e.cd < .9 && !fl) { const ch = 1 - Math.max(0, e.cd) / .9; c.fillStyle = `rgba(200,255,110,${.5 + ch * .4})`; circ(c, e.x + M.sac[0] * sgn, e.y + M.sac[1], 3 + ch * 4.5); }
    if (e.burn > 0) { c.fillStyle = "rgba(255,140,40,.5)"; circ(c, e.x + M.chest[0] * sgn, e.y + M.chest[1], r * .8); } }
  if (e.slow > 0) { c.strokeStyle = "rgba(140,220,255,.8)"; c.lineWidth = 1.5; c.beginPath(); c.ellipse(e.x, e.y, r, r * .6, 0, 0, TAU); c.stroke(); }
  if (e.hp < e.maxhp && !E.elite) { const w = Math.max(20, r * 1.6); c.fillStyle = "rgba(0,0,0,.7)"; c.fillRect(e.x - w / 2 - 1, e.y + top - 9, w + 2, 4); c.fillStyle = "#b3261c"; c.fillRect(e.x - w / 2, e.y + top - 8, w * Math.max(0, e.hp / e.maxhp), 2); }
}

/* ---------- 每帧 ---------- */
Rn.draw = function (time) {
  const L = G.L, pl = G.pl, c = Rn.ctx, S = G.S; if (!L || !pl) return;
  const dpr = Rn.dpr, W = Rn.W, H = Rn.H, sc = Rn.sc, th = L.th;
  if (L.decals.length) bake(L);
  // 镜头：缓慢跟随。自动瞄准时不跟着枪口甩，只朝移动方向稍微偏一点
  const cam = G.cam, va = pl.va, lx = pl.auto ? pl.mvx * 24 : Math.cos(va) * 40, ly = pl.auto ? pl.mvy * 24 : Math.sin(va) * 40; cam.lx += (lx - cam.lx) * .03; cam.ly += (ly - cam.ly) * .03;
  cam.x += (pl.x + cam.lx - cam.x) * .09; cam.y += (pl.y + cam.ly - (H > W ? 30 : 0) - cam.y) * .09;
  const sk = Math.min(10, G.shake * .55), shx = (Math.random() - .5) * sk, shy = (Math.random() - .5) * sk, ox = W / 2 / sc - cam.x + shx, oy = H / 2 / sc - cam.y + shy;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = "#020303"; c.fillRect(0, 0, W, H);
  c.setTransform(dpr * sc, 0, 0, dpr * sc, ox * dpr * sc, oy * dpr * sc);
  const vx0 = -ox, vy0 = -oy, vw = W / sc, vh = H / sc, sx = Math.max(0, vx0), sy = Math.max(0, vy0), sw = Math.min(Rn.floor.width - sx, vw + 2), shh = Math.min(Rn.floor.height - sy, vh + 2);
  if (sw > 0 && shh > 0) c.drawImage(Rn.floor, sx, sy, sw, shh, sx, sy, sw, shh);
  const vis = (x, y, m) => x > vx0 - m && y > vy0 - m && x < vx0 + vw + m && y < vy0 + vh + m;
  // 酸液池
  for (const q of L.pools) { if (!vis(q.x, q.y, 60)) continue; const a = Math.min(1, q.life / 1.2), g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r); g.addColorStop(0, `rgba(170,240,60,${.75 * a})`); g.addColorStop(.75, `rgba(110,180,30,${.6 * a})`); g.addColorStop(1, "rgba(80,140,20,0)"); c.fillStyle = g; el(c, q.x, q.y, q.r, q.r * .8);
    c.fillStyle = `rgba(220,255,140,${.7 * a})`; for (let k = 0; k < 4; k++) { const ph = (time * 1.3 + k * .27 + q.x) % 1; circ(c, q.x + Math.cos(k * 2.4 + q.y) * q.r * .5, q.y + Math.sin(k * 2.4 + q.y) * q.r * .4, 1 + ph * 3 * (1 - ph) * 2); } }
  // 出口
  if (!L.def.endless) { const e = L.exit, open = L.objDone, p = .6 + Math.sin(time * 4) * .3, col = open ? "#39d98a" : "#b3261c"; c.save(); c.translate(e.x, e.y); c.fillStyle = open ? `rgba(57,217,138,${.2 * p})` : "rgba(179,38,28,.15)"; c.fillRect(-32, -32, 64, 64); c.strokeStyle = col; c.lineWidth = 2.5; const q = 32, n = 12; c.beginPath(); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.moveTo(a * q, b * (q - n)); c.lineTo(a * q, b * q); c.lineTo(a * (q - n), b * q); } c.stroke();
    c.fillStyle = col; c.font = "700 11px monospace"; c.textAlign = "center"; c.fillText(open ? L.def.exitName : "LOCKED", 0, 4); c.restore(); }
  // 目标物、油桶、掉落
  for (const o of L.objs) { if (!vis(o.x, o.y, 60)) continue; c.save(); c.translate(o.x, o.y);
    if (o.t === "fuse") { if (!o.done) { const b = Math.sin(time * 4) * 3; c.fillStyle = "rgba(255,210,60,.2)"; circ(c, 0, 0, 18); c.fillStyle = "#e8b82a"; c.fillRect(-4, -10 + b, 8, 16); c.fillStyle = "#444"; c.fillRect(-5, -12 + b, 10, 4); c.fillRect(-5, 4 + b, 10, 4); } }
    else { c.fillStyle = "rgba(0,0,0,.5)"; el(c, 2, 14, 22, 8); c.fillStyle = "#23292c"; c.fillRect(-18, -18, 36, 30); c.fillStyle = "#31393d"; c.fillRect(-18, -18, 36, 10); c.fillStyle = o.done ? "#39d98a" : o.on ? "#e8b82a" : "#b3261c"; c.fillRect(-14, -4, 8, 6); c.fillStyle = "#0e1113"; c.fillRect(-2, -4, 16, 12); c.strokeStyle = "#090a0b"; c.lineWidth = 2; c.strokeRect(-18, -18, 36, 30);
      if (o.on && !o.done) { c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 6; c.beginPath(); c.arc(0, -36, 13, 0, TAU); c.stroke(); c.strokeStyle = "#e8b82a"; c.beginPath(); c.arc(0, -36, 13, -Math.PI / 2, -Math.PI / 2 + TAU * o.prog); c.stroke(); } }
    c.restore(); }
  for (const b of L.barrels) { if (b.dead || !vis(b.x, b.y, 30)) continue; c.fillStyle = "rgba(0,0,0,.5)"; el(c, b.x + 3, b.y + 6, 12, 7); c.fillStyle = "#5c1610"; c.fillRect(b.x - 11, b.y - 6, 22, 8); circ(c, b.x, b.y + 2, 11); c.fillStyle = "#8f2018"; circ(c, b.x, b.y - 6, 11); c.strokeStyle = "#3d0c08"; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x, b.y - 6, 11, 0, TAU); c.stroke(); c.fillStyle = "#d9b52a"; c.fillRect(b.x - 5, b.y - 8, 10, 4); c.fillStyle = "rgba(255,255,255,.2)"; circ(c, b.x - 3, b.y - 10, 3); }
  for (const d of L.drops) { if (!vis(d.x, d.y, 40)) continue; const bob = Math.sin(time * 4 + d.x) * 2;
    if (d.t === "scrap") { c.fillStyle = "#7f8890"; circ(c, d.x, d.y + bob, 4); c.fillStyle = "#d0d6dc"; c.fillRect(d.x - 1, d.y + bob - 1, 2, 2); }
    else if (d.t === "med") { c.fillStyle = "#d8dcd8"; c.fillRect(d.x - 7, d.y - 6 + bob, 14, 12); c.fillStyle = "#b3261c"; c.fillRect(d.x - 1.5, d.y - 4 + bob, 3, 8); c.fillRect(d.x - 4, d.y - 1.5 + bob, 8, 3); }
    else { const col = YJ.RAR[d.it.rar].c; c.fillStyle = col; c.globalAlpha = .25; el(c, d.x, d.y, 16, 9); c.globalAlpha = 1; c.fillStyle = "#14171a"; c.fillRect(d.x - 8, d.y - 5 + bob, 16, 10); c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(d.x - 8, d.y - 5 + bob, 16, 10); } }
  // 预警（冲锋线、砸地圈）。爬行者的扑咬没有预警
  for (const e of L.en) if (e.st === "wind") { const t = 1 - e.w / e.tele.t, ty = e.tele.type; if (ty === "leap") continue; c.save(); c.translate(e.x, e.y);
    if (ty === "slam" || ty === "pound") { const R0 = ty === "slam" ? 170 : 92; if (ty === "pound") c.translate(Math.cos(e.tele.ang) * 34, Math.sin(e.tele.ang) * 34); c.fillStyle = `rgba(200,40,30,${.1 + t * .2})`; circ(c, 0, 0, R0); c.strokeStyle = "rgba(230,60,50,.9)"; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, R0 * t, 0, TAU); c.stroke(); }
    else if (ty === "charge") { c.rotate(e.tele.ang); c.fillStyle = `rgba(200,40,30,${.1 + t * .25})`; c.fillRect(0, -e.r, 340, e.r * 2); }
    else { c.strokeStyle = `rgba(150,255,80,${.4 + t * .5})`; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, e.r + 8, 0, TAU * t); c.stroke(); }
    c.restore(); }
  // 正在倒下 / 抽搐的尸体
  for (const b of L.bodies) if (vis(b.x, b.y, 80)) drawCorpse(c, b, Math.min(1, b.t / .25), b.type === "runner" ? Math.sin(b.t * 42) * .16 * (1 - b.t / b.dur) : 0);
  // 角色按 y 排序
  const list = L.en.filter(e => vis(e.x, e.y, 70)); list.push(pl); list.sort((a, b) => a.y - b.y);
  { let i = 0; const r0 = Math.max(1, Math.floor(vy0 / T) - 1), r1 = Math.min(L.H - 1, Math.floor((vy0 + vh) / T) + 2), one = e => e === pl ? drawPlayer(c, pl, S) : drawEnemy(c, e, time, pl);
    for (let ty = r0; ty <= r1; ty++) { const lim = (ty + 1) * T; while (i < list.length && list[i].y < lim) one(list[i++]); const y0 = ty * T - WH; if (sw > 0 && y0 >= 0) c.drawImage(Rn.top, sx, y0, sw, T, sx, y0, sw, T); }
    while (i < list.length) one(list[i++]); }
  // 手雷、酸液弹（抛物线）
  for (const b of L.bul) {
    if (b.gren) { c.fillStyle = "rgba(0,0,0,.4)"; el(c, b.x + 2, b.y + 4, 5, 3); const h = Math.sin(Math.min(1, b.life / .75) * Math.PI) * 14; c.fillStyle = "#2a3324"; circ(c, b.x, b.y - h, 5); c.fillStyle = "#ff4020"; c.fillRect(b.x - 1, b.y - h - 1, 2, 2); }
    else if (b.enemy) { const h = b.acid ? Math.sin((1 - b.life / b.max) * Math.PI) * 26 : 0; if (b.acid) { c.fillStyle = "rgba(0,0,0,.35)"; el(c, b.x, b.y, 6, 3.5); } c.fillStyle = "rgba(150,240,60,.35)"; circ(c, b.x, b.y - h, 9); c.fillStyle = "#b8f050"; circ(c, b.x, b.y - h, 4.5); } }
  // 粒子：血滴、烟
  for (const p of L.parts) { const a = p.life / p.max; if (p.glow) continue;
    if (p.k === "smoke") { c.globalAlpha = Math.min(.5, a * .7); c.fillStyle = p.c; circ(c, p.x, p.y, p.s * (1.6 - a * .9)); }
    else if (p.k === "bl") { c.globalAlpha = Math.min(1, a * 2); c.fillStyle = p.c; el(c, p.x, p.y, p.s * .75, p.s * .45, Math.atan2(p.vy, p.vx)); }
    else { c.globalAlpha = Math.min(1, a * 1.5); c.fillStyle = p.c; c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); } } c.globalAlpha = 1;

  // —— 光照：大面积黑暗，只有手电锥形光 + 身边一圈光晕；枪口火光、爆炸会瞬间照亮周围 ——
  const lc = Rn.lctx, ls = sc / 2; lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = "source-over"; lc.fillStyle = `rgba(1,3,3,${th.dark})`; lc.fillRect(0, 0, Rn.light.width, Rn.light.height);
  lc.setTransform(ls, 0, 0, ls, ox * ls, oy * ls); lc.globalCompositeOperation = "destination-out";
  const NR = 90, pts = []; for (let i = 0; i < NR; i++) { const a = i / NR * TAU; let da = Math.abs(((a - va) % TAU + TAU + Math.PI) % TAU - Math.PI); const cone = da < .42 ? 1 : da < .8 ? 1 - (da - .42) / .38 : 0, max = 105 + cone * 370, d = YJ.ray(L, pl.x, pl.y, a, max) + 26; pts.push(pl.x + Math.cos(a) * d, pl.y + Math.sin(a) * d); }
  const pg = lc.createRadialGradient(pl.x, pl.y, 14, pl.x, pl.y, 500); pg.addColorStop(0, "rgba(0,0,0,1)"); pg.addColorStop(.22, "rgba(0,0,0,.82)"); pg.addColorStop(.6, "rgba(0,0,0,.5)"); pg.addColorStop(1, "rgba(0,0,0,0)");
  lc.fillStyle = pg; lc.beginPath(); lc.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) lc.lineTo(pts[i], pts[i + 1]); lc.closePath(); lc.fill();
  const glow = (x, y, r, a) => { if (!vis(x, y, r)) return; const g = lc.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, "rgba(0,0,0,0)"); lc.fillStyle = g; lc.fillRect(x - r, y - r, r * 2, r * 2); };
  for (const l of L.lamps) { let a = .34; if (l.fl) a = Math.sin(time * 9 + l.f) > .2 || Math.sin(time * 23 + l.f) > .6 ? .34 : .04; glow(l.x, l.y, l.r, a); }
  for (const l of Rn.reds) glow(l.x, l.y + 14, 70, .22 + Math.sin(time * 3 + l.f) * .14);
  if (!L.def.endless) glow(L.exit.x, L.exit.y, 100, .45);
  if (pl.flashT > 0 && !S.B.flame) glow(pl.x + Math.cos(va) * 30, pl.y + Math.sin(va) * 30, 330, .9);
  for (const f of L.fx) if (f.t === "boom") glow(f.x, f.y, f.r * 3.4, Math.min(1, f.life / f.max * 1.3));
  for (const b of L.bul) if (b.flame || b.enemy || b.ex) glow(b.x, b.y, b.flame ? 80 : 50, .5);
  for (const q of L.pools) glow(q.x, q.y, q.r * 1.8, .4 * Math.min(1, q.life));
  for (const e of L.en) if (e.burn > 0) glow(e.x, e.y, 80, .5);
  for (const o of L.objs) if (!o.done && o.t === "fuse") glow(o.x, o.y, 70, .5);
  for (const d of L.drops) if (d.t === "item") glow(d.x, d.y, 46, .4);
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.drawImage(Rn.light, 0, 0, W, H);
  // —— 发光的东西画在黑暗之上：曳光弹、火光、爆炸、红眼、掉落光柱 ——
  c.setTransform(dpr * sc, 0, 0, dpr * sc, ox * dpr * sc, oy * dpr * sc); c.globalCompositeOperation = "lighter"; c.lineCap = "round";
  for (const l of Rn.reds) if (vis(l.x, l.y, 60)) { const a = .16 + Math.sin(time * 3 + l.f) * .1, g = c.createRadialGradient(l.x, l.y + 10, 0, l.x, l.y + 10, 60); g.addColorStop(0, `rgba(255,30,20,${a})`); g.addColorStop(1, "rgba(255,30,20,0)"); c.fillStyle = g; c.fillRect(l.x - 60, l.y - 50, 120, 120); }
  for (const b0 of L.bul) { if (b0.flame || b0.gren || b0.enemy) continue; const b = { x: b0.x, y: b0.y - 30, vx: b0.vx, vy: b0.vy, ex: b0.ex, crit: b0.crit }, l = Math.hypot(b.vx, b.vy), k = (b.ex ? 16 : 46) / l, x0 = b.x - b.vx * k, y0 = b.y - b.vy * k, g = c.createLinearGradient(x0, y0, b.x, b.y), col = b.ex ? "255,140,50" : b.crit ? "255,240,170" : "255,205,110"; g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},.9)`);
    c.strokeStyle = g; c.lineWidth = b.ex ? 6 : 3.4; c.beginPath(); c.moveTo(x0, y0); c.lineTo(b.x, b.y); c.stroke(); c.strokeStyle = "rgba(255,255,240,.95)"; c.lineWidth = b.ex ? 2.4 : 1.1; c.beginPath(); c.moveTo(b.x - b.vx * k * .3, b.y - b.vy * k * .3); c.lineTo(b.x, b.y); c.stroke(); }
  if (pl.flashT > 0 && !S.B.flame && Rn.muz) { const mx = Rn.muz.x, my = Rn.muz.y, g = c.createRadialGradient(mx, my, 0, mx, my, 150); g.addColorStop(0, "rgba(255,190,90,.38)"); g.addColorStop(1, "rgba(255,120,20,0)"); c.fillStyle = g; c.fillRect(mx - 150, my - 150, 300, 300); }
  for (const p of L.parts) if (p.glow) { c.globalAlpha = Math.min(1, p.life / p.max * 1.5); c.fillStyle = p.c; c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); } c.globalAlpha = 1;
  for (const f of L.fx) { const t = 1 - f.life / (f.max || .15);
    if (f.t === "arc") { c.strokeStyle = "#bfe8ff"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(f.x, f.y); for (let k = 1; k < 5; k++) c.lineTo(f.x + (f.x2 - f.x) * k / 5 + (Math.random() - .5) * 16, f.y + (f.y2 - f.y) * k / 5 + (Math.random() - .5) * 16); c.lineTo(f.x2, f.y2); c.stroke(); }
    else { c.globalAlpha = 1 - t; if (f.t === "boom") { const rr = f.r * (.35 + t * .75), g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, rr); g.addColorStop(0, "#fffbe0"); g.addColorStop(.3, f.c); g.addColorStop(.7, "rgba(160,40,10,.5)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; circ(c, f.x, f.y, rr); }
      c.strokeStyle = f.c; c.lineWidth = 4 * (1 - t) + 1; c.beginPath(); c.arc(f.x, f.y, f.r * t, 0, TAU); c.stroke(); c.globalAlpha = 1; } }
  c.globalCompositeOperation = "source-over";
  // 丧尸的眼睛是发光的红点（面朝镜头时才看得见）：疯跑者和精英最亮，爬行者很暗
  for (const e of list) { if (e === pl || !e.awake || e.flash > 0 || !e._eyes) continue; const bright = e.type === "runner" || e.E.elite, col = e.E.elite ? "#ffb030" : "#ff2a1a", q = bright ? 2.2 : 1.6;
    c.globalAlpha = bright ? 1 : e.type === "crawler" ? .3 : .6; c.fillStyle = col; if (bright) { c.shadowColor = col; c.shadowBlur = 7; } for (const p of e._eyes) c.fillRect(p[0] - q / 2, p[1] - q / 2, q, q); c.shadowBlur = 0; } c.globalAlpha = 1;
  for (const d of L.drops) if (d.t === "item" && vis(d.x, d.y, 40)) { const col = YJ.RAR[d.it.rar].c, g = c.createLinearGradient(0, d.y - 70, 0, d.y); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, col); c.fillStyle = g; c.globalAlpha = .5 + Math.sin(time * 5) * .2; c.fillRect(d.x - 1.5, d.y - 70, 3, 70); c.globalAlpha = 1; if (d.it.rar >= 1) { c.font = "700 10px monospace"; c.textAlign = "center"; c.fillStyle = col; c.fillText(YJ.itemName(d.it), d.x, d.y - 74); } }
  c.textAlign = "center"; for (const n of L.nums) { c.globalAlpha = Math.min(1, n.life * 2.5); c.font = `800 ${n.crit ? 16 : 11}px monospace`; c.fillStyle = n.crit ? "#ffcf3a" : "#e8e4d8"; c.strokeStyle = "rgba(0,0,0,.85)"; c.lineWidth = 3; c.strokeText(n.v, n.x, n.y); c.fillText(n.v, n.x, n.y); } c.globalAlpha = 1;
  if (pl.rel > 0) { c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 5; c.beginPath(); c.arc(pl.x, pl.y - 60, 9, 0, TAU); c.stroke(); c.strokeStyle = "#39d98a"; c.lineWidth = 3; c.beginPath(); c.arc(pl.x, pl.y - 60, 9, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - pl.rel / pl.relMax)); c.stroke(); }
  // 屏幕层：色调、雨、暗角、受伤泛红
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = th.tint; c.fillRect(0, 0, W, H);
  if (th.rain) { c.strokeStyle = "rgba(150,190,180,.16)"; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 46; i++) { const x = (h2(i, 1, 7) * (W + 200) + time * 240 * (.6 + h2(i, 2, 7))) % (W + 200) - 100, y = (h2(i, 3, 7) * H + time * 900 * (.7 + h2(i, 4, 7) * .5)) % H; c.moveTo(x, y); c.lineTo(x - 5, y + 16); } c.stroke(); }
  if (!Rn.vg || Rn.vgW !== W || Rn.vgH !== H) { Rn.vgW = W; Rn.vgH = H; Rn.vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .72); Rn.vg.addColorStop(0, "rgba(0,0,0,0)"); Rn.vg.addColorStop(1, "rgba(0,0,0,.75)"); }
  c.fillStyle = Rn.vg; c.fillRect(0, 0, W, H);
  { const tg = L.def.endless ? L.mis : L.objDone ? L.exit : null; if (tg) { const px = (tg.x + ox) * sc, py = (tg.y + oy) * sc, m = 60; if (px < m || py < m + 60 || px > W - m || py > H - m - 110) { const a = Math.atan2(py - H / 2, px - W / 2), rx = W / 2 - 54, ry = H / 2 - 150, k = 1 / Math.max(Math.abs(Math.cos(a)) / rx, Math.abs(Math.sin(a)) / Math.max(60, ry)), ax = W / 2 + Math.cos(a) * k, ay = H / 2 + Math.sin(a) * k, col = L.def.endless ? "#e8b82a" : "#39d98a";
      c.save(); c.translate(ax, ay); c.rotate(a); c.fillStyle = col; c.globalAlpha = .7 + Math.sin(time * 5) * .25; c.beginPath(); c.moveTo(12, 0); c.lineTo(-6, -8); c.lineTo(-2, 0); c.lineTo(-6, 8); c.closePath(); c.fill(); c.restore(); c.fillStyle = col; c.font = "700 10px monospace"; c.textAlign = "center"; c.fillText(Math.round(Math.hypot(tg.x - pl.x, tg.y - pl.y) / 40) + "m", ax - Math.cos(a) * 22, ay - Math.sin(a) * 22 + 3); } } }
  const low = pl.hp / S.maxhp; if (pl.hurtT > 0 || low < .3) { const a = Math.max(pl.hurtT > 0 ? pl.hurtT * 1.6 : 0, low < .3 ? (.3 - low) * 1.4 * (.7 + Math.sin(time * 6) * .3) : 0); const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .7); g.addColorStop(0, "rgba(160,0,0,0)"); g.addColorStop(1, `rgba(170,10,10,${Math.min(.7, a)})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
};

/* ---------- 小地图 ---------- */
Rn.minimap = function (cv) {
  const L = G.L, pl = G.pl; if (!L) return; const c = cv.getContext("2d"), n = cv.width, k = n / L.W;
  c.fillStyle = "rgba(3,8,6,.9)"; c.fillRect(0, 0, n, n);
  for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) { if (!L.explored[y * L.W + x] || L.g[y * L.W + x] === 1) continue; c.fillStyle = "#2f6a4a"; c.fillRect(x * k, y * k, k + .5, k + .5); }
  const dot = (x, y, col, s) => { c.fillStyle = col; c.fillRect(x / T * k - s / 2, y / T * k - s / 2, s, s); };
  for (const o of L.objs) if (!o.done) dot(o.x, o.y, "#ffd23f", 5);
  if (L.eliteE && !L.eliteE.dead) dot(L.eliteE.x, L.eliteE.y, "#ff9a30", 6); if (L.bossE && !L.bossE.dead) dot(L.bossE.x, L.bossE.y, "#ff4fa0", 7);
  if (!L.def.endless) dot(L.exit.x, L.exit.y, L.objDone ? "#4de38a" : "#b03030", 6); else if (L.mis) dot(L.mis.x, L.mis.y, "#ffd23f", 7);
  for (const e of L.en) if (e.awake && Math.hypot(e.x - pl.x, e.y - pl.y) < 420) dot(e.x, e.y, "#e03a30", 2.5);
  dot(pl.x, pl.y, "#d8ffe8", 4.5);
};
})();
