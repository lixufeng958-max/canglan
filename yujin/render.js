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
    else drawBody(c, d, 6, 0);
  }
  L.decals.length = 0;
}

/* ---------- 角色：带骨骼的人体模型，按约 60° 俯角投影（斜 3/4 视角） ----------
   关节（髋/膝/踝/肩/肘/腕）先在三维里摆好姿势，再投影到屏幕、按远近排序画出来。
   走路是 8 帧循环：脚跟着地 → 全脚掌支撑 → 脚尖离地 → 屈膝前摆；步幅和移动距离绑定，落地的脚不打滑 */
const PX = 40, YK = .76, ZK = .7, OUTC = "rgba(6,8,7,.9)", _sd = {};
const hx = (hex, k) => _sd[hex + k] || (_sd[hex + k] = (() => { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, v * k | 0)).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); })());
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], add3 = (a, x, y, z) => [a[0] + x, a[1] + y, a[2] + z];
const BODY = {
  player: { s: 1, bob: .045, hipH: .9, hipW: .09, shW: .2, tor: .5, lean: .12, stride: .26, lift: .1, arm: "gun", m: 1.05 },
  walker: { s: 1, sway: .04, hipH: .88, hipW: .09, shW: .185, tor: .5, lean: .2, hunch: .09, crouch: .05, drop: .035, tilt: .5, side: .05, stride: .17, lift: .05, arm: "zombie", m: 1, drag: 1 },
  runner: { s: .95, side: .035, hipH: .86, hipW: .08, shW: .17, tor: .47, lean: .5, hunch: .05, crouch: .04, drop: .02, tilt: -.2, stride: .34, lift: .16, arm: "flail", m: .8 },
  spitter: { s: 1, sway: .02, side: -.03, hipH: .86, hipW: .1, shW: .185, tor: .48, lean: .26, hunch: .1, crouch: .04, drop: .03, tilt: -.25, stride: .12, lift: .04, arm: "hang", m: 1 },
  bloater: { s: 1.3, sway: .045, side: .03, hunch: .03, drop: .02, hipH: .8, hipW: .17, shW: .23, tor: .46, lean: .05, stride: .12, lift: .04, arm: "hang", out: .55, m: 1.45 },
  brute: { s: 1.45, sway: .028, side: -.03, hunch: .06, crouch: .04, drop: .03, hipH: .9, hipW: .11, shW: .27, tor: .52, lean: .16, tilt: .3, stride: .2, lift: .07, arm: "swing", m: 1.28 },
  crawler: { s: 1, stride: .14, m: 1 }
};
const BK = { player: "player", walker: "walker", runner: "runner", spitter: "spitter", bloater: "bloater", brute: "brute", elite: "brute", elite2: "brute", crawler: "crawler" };
const CYC = k => 4 * BODY[BK[k]].stride * PX * BODY[BK[k]].s;
function pose(B0, p, stand, o) {
  let B = B0; if (o && (o.lean || o.dead || o.atk)) { const t = o.dead || 0; B = { ...B0, lean: B0.lean + (o.lean || 0) - (1.5 + B0.lean) * t + (o.atk ? .22 * Math.sin(Math.PI * o.atk) : 0), hipH: B0.hipH * (1 - .7 * t), tilt: (B0.tilt || 0) - .5 * t }; }
  const J = {}, TW = TAU, hu = J.hunch = B.hunch || 0; const hz = J.hz = B.hipH - .03 - (B.crouch || 0) - (stand ? 0 : (B.bob || .02) * Math.cos(2 * TW * p)), th = .45 * B.hipH / .9, sn = .43 * B.hipH / .9;
  for (let i = 0; i < 2; i++) { const sy = i ? 1 : -1, q = (p + (i ? .5 : 0)) % 1, dr = B.drag && i === 0, st = B.stride * (dr ? .4 : 1), lf = dr ? .006 : B.lift, off = dr ? -.1 : 0; let fx = off + (stand ? (i ? .03 : -.03) : 0), fz = 0, pit = 0;
    if (!stand) { if (q < .5) { const t = q * 2; fx = off + st * (1 - 2 * t); pit = t < .2 ? -(1 - t / .2) * .45 : t > .7 ? (t - .7) / .3 * .65 : 0; } else { const t = (q - .5) * 2, e = t * t * (3 - 2 * t); fx = off + st * (-1 + 2 * e); fz = lf * Math.sin(Math.PI * t); pit = .65 * (1 - t) - .45 * t; } if (dr) pit = .55; }
    let ax = fx, az = .07 + fz + Math.max(0, pit) * .09, dx = ax, dz = az - hz, Ld = Math.hypot(dx, dz); const mx = th + sn - .004; if (Ld > mx) { ax = dx / Ld * mx; az = hz + dz / Ld * mx; Ld = mx; dx = ax; dz = az - hz; }
    const a1 = Math.atan2(dx, -dz) + Math.acos(Math.max(-1, Math.min(1, (th * th + Ld * Ld - sn * sn) / (2 * th * Ld))));
    J["hip" + i] = [0, sy * B.hipW, hz]; J["knee" + i] = [Math.sin(a1) * th, sy * B.hipW * 1.05, hz - Math.cos(a1) * th]; J["ank" + i] = [ax, sy * B.hipW * 1.1, az];
    J["heel" + i] = [ax - .06, sy * B.hipW * 1.1, fz + Math.max(0, pit) * .1 + .025]; J["toe" + i] = [ax + .17, sy * (B.hipW * 1.1 + .025), fz + Math.max(0, -pit) * .11 + .025]; }
  const ln = J.ln = B.lean, sx = Math.sin(ln), cz = Math.cos(ln); const sway = stand ? 0 : (B.sway || 0) * Math.sin(TW * p), atk = o && o.atk ? o.atk : 0; J.waist = [sx * .13, sway * .4, hz + cz * .13]; J.chest = [sx * B.tor + hu, sway, hz + cz * B.tor - hu * .3];
  for (let i = 0; i < 2; i++) { const sy = i ? 1 : -1, q = (p + (i ? .5 : 0)) % 1, sw = stand ? 0 : Math.cos(TW * q), S = [J.chest[0] - sy * (stand ? 0 : .035 * Math.cos(TW * p)), sy * B.shW + sway, J.chest[2] - .03 - (i === 0 ? B.drop || 0 : 0)], ua = .29, fa = .27; let t1, bend, out = B.out || .1;
    if (B.arm === "swing") { t1 = ln - .55 * sw; bend = .25 + .35 * Math.max(0, -sw); } else if (B.arm === "zombie") { if (i) { t1 = ln + .85 + .12 * sw; bend = .55; out = .05; } else { t1 = ln * .4 + .08 - .28 * sw; bend = .12; out = .06; } } // 右手半抬着往前够，左手垂着晃
    else if (B.arm === "reach") { t1 = ln + (i ? 1.2 : .9) + .1 * sw; bend = .25; out = .03; } else if (B.arm === "flail") { t1 = ln + .7 - 1.1 * sw; bend = 1.1; out = .25; } else { t1 = ln * .5 + .12 - .08 * sw; bend = .2; }
    if (atk) { t1 += .95 * Math.sin(TW * atk) + (B.arm === "reach" || (B.arm === "zombie" && i) ? 0 : 1.15 * Math.sin(Math.PI * atk)); bend = Math.max(.15, bend - .3 * Math.sin(Math.PI * atk)); } // 攻击：先扬起再砸下
    const el = [S[0] + Math.sin(t1) * ua, S[1] + sy * out * ua, S[2] - Math.cos(t1) * ua]; J["sh" + i] = S; J["el" + i] = el; J["ha" + i] = [el[0] + Math.sin(t1 + bend) * fa, el[1] + sy * out * .1, el[2] - Math.cos(t1 + bend) * fa]; }
  const hl = ln + (B.tilt || 0); J.head = [J.chest[0] + Math.sin(hl) * .215 + hu * .5, (B.side || 0) + sway * 1.4, J.chest[2] + Math.cos(hl) * .215 - hu * .35]; return J;
}
/* 给人形骨架"长肉穿衣"。不再用圆和胶囊拼接：
   · 躯干、头是一圈圈椭圆截面包出来的连续曲线轮廓（贝塞尔曲线闭合）
   · 四肢是上粗下细的锥形，肩/肘/膝处同一条轮廓连续过渡，没有接缝
   · 整个人只在最外圈描一道细边，内部靠明暗渐变区分 */
function humanoid(F, J, B, S) { F.skin = S.skin; const m = B.m, hw = B.hipW, c = S.chest || 1, ln = J.ln, Z = S.z, tn = S.thin || 1, lo = S.loose || 1, spine = h => { const hq = (J.hunch || 0) * Math.min(1.2, h / B.tor) ** 2; return [Math.sin(ln) * h + hq, J.chest[1] * Math.min(1, h / B.tor), J.hz + Math.cos(ln) * h - hq * .3]; };
  for (let i = 0; i < 2; i++) { const hip = J["hip" + i], kn = J["knee" + i], an = J["ank" + i], bare = S.bareShin && S.bareShin[i];
    if (Z) { const mt = lerp3(hip, kn, .45), cf = lerp3(kn, an, .3); // 大腿、膝、小腿肚、脚踝：有肌肉起伏，裤腿比腿宽
      if (bare) { F.limb([kn, cf, an], [.05 * m * tn, .055 * m * tn, .033 * m * tn], [S.skin, S.skin], -.001); F.limb([hip, mt, kn, lerp3(kn, an, .12 + i * .1)], [.092 * m * lo, .084 * m * lo, .068 * m * lo, .07 * m * lo], [S.pants, S.pants, S.pants]); }
      else F.limb([hip, mt, kn, cf, an], [.092 * m * lo, .084 * m * lo, .064 * m * lo, .066 * m * lo, .056 * m * lo], [S.pants, S.pants, S.pants, S.pants]); }
    else { F.limb([hip, kn, an], [.088 * m, .06 * m, .04 * m], [S.pants, bare ? S.skin : S.pants]);
    if (bare) F.limb([lerp3(hip, kn, .6), kn, lerp3(kn, an, .22)], [.076 * m, .064 * m, .056 * m], [S.pants, S.pants], .001); }
    if (S.boot) F.limb([lerp3(kn, an, .5), an], [.058 * m, .052 * m], [S.shoe], .002);
    if (S.sole) F.limb([add3(J["heel" + i], -.01, 0, -.022), add3(J["toe" + i], .012, 0, -.022)], [.058 * m, .047 * m], [S.sole], .0025); // 鞋底
    F.limb([J["heel" + i], J["toe" + i]], [(S.boot ? .054 : .046) * m, (S.boot ? .042 : .034) * m], [S.barefoot ? S.skin : S.shoe], .003);
    if (S.laces) F.fn(add3(lerp3(J["heel" + i], J["toe" + i], .6), 0, 0, .05), .012, g => { g.strokeStyle = "rgba(200,196,170,.75)"; g.lineWidth = .55; g.beginPath(); for (const t of [.42, .56, .7]) { const c0 = lerp3(J["heel" + i], J["toe" + i], t), a = F.pr(add3(c0, 0, -.026, .045)), b = F.pr(add3(c0, .02, .026, .045)); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke(); const h0 = F.pr(add3(J["heel" + i], -.05, 0, -.03)), t0 = F.pr(add3(J["toe" + i], .04, 0, -.03)); g.strokeStyle = "rgba(120,120,110,.5)"; g.lineWidth = .5; g.setLineDash([1, 1.2]); g.beginPath(); g.moveTo(h0[0], h0[1] + .6); g.lineTo(t0[0], t0[1] + .6); g.stroke(); g.setLineDash([]); }); // 鞋带、鞋底纹
    if (S.elbow) F.ell(add3(J["el" + i], -.012, 0, -.005), [.052, .05, .056], S.elbow, .01);
    if (S.kneepad && S.laces) F.fn(add3(kn, .07, 0, 0), .015, g => { const a = F.pr(add3(kn, .02, -.065, .04)), b = F.pr(add3(kn, .02, .065, .04)), c2 = F.pr(add3(kn, .02, -.065, -.04)), d2 = F.pr(add3(kn, .02, .065, -.04)); g.strokeStyle = "rgba(12,13,12,.8)"; g.lineWidth = .9; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.moveTo(c2[0], c2[1]); g.lineTo(d2[0], d2[1]); g.stroke(); const k = F.pr(add3(kn, .08, 0, .01)); g.fillStyle = "rgba(200,205,190,.28)"; g.fillRect(k[0] - 1.2, k[1] - .8, 2.4, 1.1); }); // 护膝绑带和磨痕
    if (S.kneepad) F.ell(add3(kn, .03, 0, 0), [.05, .058, .062], S.kneepad, .01);
    const sh = J["sh" + i], el = J["el" + i], ha = J["ha" + i], d = [ha[0] - el[0], ha[1] - el[1], ha[2] - el[2]], dl = Math.hypot(d[0], d[1], d[2]) || 1, f = S.fist || .037;
    if (Z) { const bi = lerp3(sh, el, .4), fo = lerp3(el, ha, .3), u = [d[0] / dl, d[1] / dl, d[2] / dl], sy = i ? 1 : -1; // 上臂、肘、前臂、腕：瘦削的手臂从宽松的破袖口里伸出来
      F.limb([sh, bi, el, fo, ha], [.05 * m * tn, .047 * m * tn, .036 * m * tn, .041 * m * tn, .026 * m * tn], [S.skin, S.skin, S.skin, S.skin], -.001); F.limb([sh, lerp3(sh, el, i ? .46 : .3)], [.072 * m * lo, .063 * m * lo], [S.shirt], .001);
      F.limb([ha, add3(ha, u[0] * .05, u[1] * .05, u[2] * .05 - .01), add3(ha, u[0] * .09, u[1] * .09, u[2] * .09 - .025)], [.029 * m, .033 * m, .02 * m], [S.skin, S.skin], .002); // 手掌下垂
      for (const k of [-1, 0, 1]) F.limb([add3(ha, u[0] * .085, u[1] * .085 + k * .016, u[2] * .085 - .022), add3(ha, u[0] * .135 + .005, u[1] * .135 + k * .03, u[2] * .135 - .05)], [.0095 * m, .006 * m], [S.skin], .003); // 弯曲的手指
      F.limb([add3(ha, u[0] * .03, u[1] * .03 - sy * .028, u[2] * .03), add3(ha, u[0] * .075, u[1] * .075 - sy * .05, u[2] * .075 - .02)], [.011 * m, .007 * m], [S.skin], .003); }
    else { F.limb([sh, el, ha], [.06 * m, .044 * m, .031 * m], [S.sleeve ? S.shirt : S.skin, S.sleeve === 2 ? S.shirt : S.skin]);
    if (!S.sleeve) F.limb([sh, lerp3(sh, el, .32)], [.066 * m, .058 * m], [S.shirt], .001);
    F.limb([ha, add3(ha, d[0] / dl * .09, d[1] / dl * .09, d[2] / dl * .09)], [f * m, f * .72 * m], [S.glove || S.skin], .002); } }
  F.sect([[-.05, hw + .075, .1], [.16, .13 * c, .095 * c]], S.pants, .004);
  if (Z) F.sect([[.0, .152 * c * lo, .12 * c], [.17, .146 * c * lo, .112 * c], [.33, .166 * c, .12 * c], [B.tor - .03, B.shW + .012, .094 * c], [B.tor + .04, .075, .064]], S.shirt, .006); // 没扎进裤子的上衣，下摆松垮
  else F.sect([[.11, .137 * c, .1 * c], [.33, .168 * c, .118 * c], [B.tor - .03, B.shW + .01, .092 * c], [B.tor + .045, .07, .062]], S.shirt, .006);
  const wl = add3(J.waist, 0, -hw * 1.5, 0), wr = add3(J.waist, 0, hw * 1.5, 0);
  F.fn(lerp3(J.chest, J.waist, .5), .02, g => { g.strokeStyle = "rgba(0,0,0,.26)"; g.lineWidth = .9; g.lineCap = "round"; for (const [a, b, t1, t2] of [[J.sh0, wl, .35, .55], [J.sh1, wr, .5, .3], [J.sh0, wl, .7, .85]]) { const p1 = F.pr(lerp3(lerp3(a, b, t1), J.chest, .3)), p2 = F.pr(lerp3(lerp3(J.sh1, wr, t2), J.chest, .25)); g.beginPath(); g.moveTo(p1[0], p1[1]); g.quadraticCurveTo((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 + 2, p2[0], p2[1]); g.stroke(); } }); // 衣服褶皱
  const hm = S.headM || 1, nb = spine(B.tor + .03), H = J.head; F.limb([nb, lerp3(nb, H, .6)], Z ? [.05 * m, .04 * m] : [.054 * m, .046 * m], [S.skin], .012);
  F.pts(F.eps(H, [.1 * hm, .082 * hm, .115 * hm]).concat(F.eps(add3(H, .03, 0, -.07), [.06 * hm, .058 * hm, .055 * hm])), S.skin, .02); // 颅骨 + 下颌
  if (Z) { for (const sy of [-1, 1]) F.ell(add3(H, -.005, sy * .084 * hm, -.02), [.018, .012, .028], S.skin, .0195); F.ell(add3(H, .1 * hm, 0, -.035), [.022, .016, .022], S.skin, .0205); // 耳朵、鼻子
    if (S.hair) { const st = S.hairStyle || 0; if (st === 1) { for (const sy of [-1, 1]) F.ell(add3(H, -.04, sy * .05, .0), [.07 * hm, .05 * hm, .075 * hm], S.hair, .0208); F.ell(add3(H, -.075, 0, .0), [.045 * hm, .075 * hm, .08 * hm], S.hair, .0207); } // 秃顶，只剩两侧和后脑
      else { F.ell(add3(H, -.03, 0, .04), [.098 * hm, .086 * hm, .095 * hm], S.hair, .021); F.ell(add3(H, .035, .03, .075), [.06 * hm, .05 * hm, .045 * hm], S.hair, .0212); F.ell(add3(H, -.085, -.02, -.01), [.04 * hm, .07 * hm, .08 * hm], S.hair, .0206); if (st === 2) F.ell(add3(H, -.09, 0, -.11), [.045, .085, .1], S.hair, .0195); } // 乱发；2 = 披到肩上的长发
      F.fn(add3(H, 0, 0, .12 * hm), .06, (g, c) => { g.strokeStyle = hx(S.hair, 1.7); g.globalAlpha = .35; g.lineWidth = .5; g.beginPath(); for (let k = 0; k < 5; k++) { const a = h2(k, 3, 5) * 6, r = 2 + h2(k, 7, 1) * 2.5; g.moveTo(c[0] + Math.cos(a) * 1, c[1] + 3 + Math.sin(a) * 1); g.lineTo(c[0] + Math.cos(a) * r, c[1] + 3 + Math.sin(a) * r * .7); } g.stroke(); g.globalAlpha = 1; }); } }
  else if (S.hair) F.ell(add3(H, -.03, 0, .035), [.1 * hm, .086 * hm, .1 * hm], S.hair, .021);
  return { wl, wr, hr: .1 * hm, spine };
}
function zFace(F, J, hr, o) { const { pr } = F, hc = pr(J.head), eyes = [], soc = []; o = o || {};
  for (const sy of [-1, 1]) { const e = pr(add3(J.head, hr * .88, sy * hr * .4, -.012)); if (e[2] > hc[2] - .012) { soc.push(e); if (!F.dead) eyes.push(e); } }
  const mo = pr(add3(J.head, hr * .9, 0, -hr * .66)), ch = pr(add3(J.head, hr * .7, 0, -hr * 1.05));
  F.fn(add3(J.head, hr, 0, 0), .06, g => { for (const e of soc) { g.fillStyle = "rgba(18,10,10,.75)"; g.beginPath(); g.ellipse(e[0], e[1], 1.5, 1.1, 0, 0, TAU); g.fill(); } // 眼窝
    if (mo[2] > hc[2] - .02) { g.fillStyle = o.mouth || "#200404"; g.beginPath(); g.ellipse(mo[0], mo[1], o.open ? 2 : 1.5, o.open ? 1.7 : .9, 0, 0, TAU); g.fill(); g.fillStyle = o.drool || "rgba(70,8,8,.8)"; g.beginPath(); g.ellipse((mo[0] + ch[0]) / 2, (mo[1] + ch[1]) / 2 + .6, 1.3, 1.9, 0, 0, TAU); g.fill(); } // 嘴和下巴上的血
    for (const e of eyes) { g.fillStyle = "rgba(255,50,30,.28)"; g.beginPath(); g.arc(e[0], e[1], 1.3, 0, TAU); g.fill(); g.fillStyle = "#e8382a"; g.beginPath(); g.arc(e[0], e[1], .6, 0, TAU); g.fill(); } });
  return eyes.map(e => [e[0], e[1]]); }
/* 感染的痕迹：皮肤下发黑的血管 */
function veins(F, J, col) { F.fn(lerp3(J.el1, J.ha1, .5), .05, g => { g.strokeStyle = col || "rgba(38,44,58,.5)"; g.lineWidth = .45; g.lineCap = "round"; g.beginPath();
  for (const [A, Bq] of [[J.el1, J.ha1], [J.el0, J.ha0], [J.sh1, J.el1]]) { const a = F.pr(lerp3(A, Bq, .1)), m1 = F.pr(add3(lerp3(A, Bq, .45), 0, .012, .012)), b = F.pr(lerp3(A, Bq, .9)), m2 = F.pr(add3(lerp3(A, Bq, .6), 0, -.014, 0)); g.moveTo(a[0], a[1]); g.quadraticCurveTo(m1[0], m1[1], b[0], b[1]); g.moveTo(m1[0], m1[1]); g.lineTo(m2[0], m2[1]); }
  const n0 = F.pr(add3(J.head, -.02, .05, -.1)), n1 = F.pr(add3(J.head, .02, .07, -.02)), n2 = F.pr(add3(J.head, .06, .05, .03)); g.moveTo(n0[0], n0[1]); g.quadraticCurveTo(n1[0], n1[1], n2[0], n2[1]); g.stroke(); }); }
const WET = new Set(["#c9c486", "#cfc98a", "#a9c46a", "#8f9f6c"]);
const METAL = new Set(["#1d1f22", "#282b2f", "#0d0e0f", "#141618", "#15171a", "#1a1c1e", "#141617", "#111314", "#0f1011", "#7a3a20", "#eaf6ff", "#5a8aa0"]);
let _noise = null; function noisePat(g) { if (!_noise) { const cv = document.createElement("canvas"); cv.width = cv.height = 48; const c = cv.getContext("2d"); for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const n = h2(x, y, 77); c.fillStyle = n > .5 ? `rgba(255,255,255,${(n - .5) * 1.1})` : `rgba(0,0,0,${(.5 - n) * 1.5})`; c.fillRect(x, y, 1, 1); } _noise = cv; } return g.createPattern(_noise, "repeat"); }
const stain = (F, P, r, col) => F.ball(P, r, col || "#6a0f0f", 0, 1);
const DRESS = {
  player(F, J, B, base, M, o) { const C = J.chest, W = J.waist, GL = { pistol: .2, smg: .5, shotgun: .78, rifle: .8, sniper: 1, flamer: .74, launcher: .72 }[base], pis = base === "pistol", rec = (o && o.rec) || 0, add = add3, box = F.box;
    const g0 = pis ? add(C, .4 - rec, .05, -.1) : add(C, .04 - rec, .14, -.1), g1 = add(g0, GL, pis ? 0 : -.07, -.04), gp = t => lerp3(g0, g1, t);
    J.ha1 = add(gp(pis ? .1 : .3), 0, 0, -.045); J.el1 = add(J.sh1, .03 - rec * .5, .1, -.25); J.ha0 = add(gp(pis ? .12 : .62), 0, -.03, -.04); J.el0 = add(lerp3(J.sh0, J.ha0, .5), 0, -.07, -.1); // 右手握把，左手托护木
    const S = { skin: "#b98f6c", shirt: "#4d5c45", sleeve: 2, pants: "#45533e", shoe: "#1b1c1d", boot: 1, kneepad: "#272b2e", glove: "#1c1e1f", sole: "#0b0b0c", laces: 1, elbow: "#272b2e" }, R = humanoid(F, J, B, S);
    // 裤子口袋、腰带、腿挂枪套
    for (let i = 0; i < 2; i++) { const sy = i ? 1 : -1; box(add(lerp3(J["hip" + i], J["knee" + i], .5), 0, sy * .078, 0), [.04, .014, .06], "#3b4836"); }
    F.sect([[.1, .143, .106], [.145, .143, .106]], "#22251f", .007); F.fn(add(R.spine(.12), .11, 0, 0), .012, (g, c) => { g.fillStyle = "#8f8a6a"; g.fillRect(c[0] - 1.3, c[1] - .9, 2.6, 1.8); });
    box(add(lerp3(J.hip1, J.knee1, .32), .01, .1, 0), [.035, .028, .075], "#1d201e"); F.limb([add(lerp3(J.hip1, J.knee1, .2), .01, .1, .02), add(lerp3(J.hip1, J.knee1, .2), .0, .1, .09)], [.014, .016], ["#111213"], .001);
    // 战术背心：主体、领口、肩带
    F.sect([[.13, .153, .12], [.34, .184, .138], [B.tor - .06, .17, .114]], "#313a2d", .012); F.sect([[B.tor - .03, .1, .085], [B.tor + .02, .085, .075]], "#2a3227", .013);
    for (const sy of [-1, 1]) F.limb([add(C, .105, sy * .1, -.1), add(C, .03, sy * .115, .025), add(C, -.1, sy * .1, -.09)], [.024, .026, .024], ["#262d23", "#262d23"], .014);
    // 四个弹匣袋（带翻盖和按扣）+ 胸前电台 + 天线
    for (const y of [-.108, -.036, .036, .108]) { const pc = add(lerp3(C, W, .68), .14, y, 0); box(pc, [.03, .03, .06], "#3d4734"); F.fn(add(pc, .035, 0, .02), .012, g => { const a = F.pr(add(pc, .032, -.03, .012)), b = F.pr(add(pc, .032, .03, .012)), c2 = F.pr(add(pc, .034, 0, -.005)); g.strokeStyle = "rgba(15,18,13,.75)"; g.lineWidth = .7; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.fillStyle = "#9a9478"; g.beginPath(); g.arc(c2[0], c2[1], .65, 0, TAU); g.fill(); }); }
    box(add(lerp3(C, W, .28), .13, -.075, 0), [.028, .042, .05], "#262b25"); F.limb([add(lerp3(C, W, .2), .1, -.105, .03), add(C, .04, -.13, .27)], [.007, .004], ["#0e0f10"], .02);
    box(add(lerp3(C, W, .3), .135, .07, 0), [.012, .04, .028], "#56603f"); // 姓名条
    // 肩章、背包（主包 + 顶盖 + 侧袋 + 背带扣）、卷毯
    for (let i = 0; i < 2; i++) { const sy = i ? 1 : -1, pc = add(lerp3(J["sh" + i], J["el" + i], .32), 0, sy * .058, 0); box(pc, [.032, .01, .036], i ? "#7d7446" : "#6b2b24"); F.fn(add(pc, 0, sy * .014, 0), .01, (g, c) => { g.fillStyle = "rgba(230,225,200,.7)"; g.fillRect(c[0] - .9, c[1] - .5, 1.8, .9); }); }
    const bk = add(lerp3(C, W, .45), -.205, 0, 0); F.ell(bk, [.088, .135, .18], "#3a4730"); box(add(bk, -.01, 0, .15), [.075, .11, .035], "#44523a", .003); for (const sy of [-1, 1]) F.ell(add(bk, .0, sy * .14, -.06), [.05, .04, .08], "#35412c");
    F.fn(add(bk, -.09, 0, 0), .02, g => { g.strokeStyle = "rgba(15,18,13,.7)"; g.lineWidth = .8; g.beginPath(); for (const y of [-.06, .06]) { const a = F.pr(add(bk, -.088, y, .13)), b = F.pr(add(bk, -.088, y, -.12)); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke(); g.fillStyle = "#8f8a6a"; for (const y of [-.06, .06]) { const q = F.pr(add(bk, -.09, y, .02)); g.fillRect(q[0] - .8, q[1] - .6, 1.6, 1.2); } });
    F.limb([add(C, -.2, -.115, .035), add(C, -.2, .115, .035)], [.044, .044], ["#5c614a"], .004); F.fn(add(C, -.2, 0, .08), .02, g => { g.strokeStyle = "rgba(20,22,16,.8)"; g.lineWidth = .9; g.beginPath(); for (const y of [-.06, .06]) { const a = F.pr(add(C, -.2, y, .08)), b = F.pr(add(C, -.24, y, .0)); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke(); });
    // 头盔：盔体 + 盔沿 + 侧导轨 + 夜视仪支架 + 划痕
    const H = J.head; F.ell(add(H, .022, 0, -.022), [.146, .128, .034], "#44533a", .029); F.ell(add(H, 0, 0, .036), [.129, .115, .105], "#53633f", .03);
    for (const sy of [-1, 1]) box(add(H, -.005, sy * .113, .02), [.045, .01, .017], "#2a2f24", .031);
    box(add(H, .118, 0, .075), [.02, .03, .024], "#141617", .04); F.limb([add(H, .125, 0, .09), add(H, .085, 0, .15)], [.012, .014], ["#141617"], .041);
    F.fn(add(H, 0, 0, .14), .09, (g, c) => { g.strokeStyle = "rgba(215,222,195,.4)"; g.lineWidth = .6; g.beginPath(); g.moveTo(c[0] - 3.2, c[1] + 2.2); g.lineTo(c[0] - .8, c[1] + 3.4); g.moveTo(c[0] + 1.2, c[1] + 1); g.lineTo(c[0] + 2.8, c[1] + 2.6); g.moveTo(c[0] - 1, c[1] + 5); g.lineTo(c[0] + .6, c[1] + 5.6); g.stroke(); const a = F.pr(add(H, -.11, 0, .06)), b = F.pr(add(H, .1, 0, .06)); g.strokeStyle = "rgba(20,24,16,.45)"; g.lineWidth = .8; g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(c[0], c[1] + 6.5, b[0], b[1]); g.stroke(); });
    { const hc = F.pr(H), ey = []; for (const sy of [-1, 1]) { const e = F.pr(add(H, .09, sy * .04, -.025)); if (e[2] > hc[2] - .012) ey.push(e); } const ch = F.pr(add(H, .085, 0, -.085)); F.fn(add(H, .1, 0, -.03), .028, g => { g.fillStyle = "#1a1512"; for (const e of ey) { g.beginPath(); g.ellipse(e[0], e[1], 1, .7, 0, 0, TAU); g.fill(); } if (ch[2] > hc[2] - .03) { g.strokeStyle = "rgba(25,28,22,.8)"; g.lineWidth = .8; g.beginPath(); g.moveTo(ch[0] - 2.2, ch[1] - 1.5); g.quadraticCurveTo(ch[0], ch[1] + 1.2, ch[0] + 2.2, ch[1] - 1.5); g.stroke(); } }); } // 眼睛、头盔下颌带
    for (let i = 0; i < 2; i++) F.fn(add(J["ha" + i], .04, 0, .03), .02, (g, c) => { g.fillStyle = "rgba(120,125,118,.55)"; g.fillRect(c[0] - 1, c[1] - .5, 2, .9); }); // 手套护指
    // 枪：枪托 → 机匣 → 护木 → 枪管，一条连续的锥形轮廓，再加握把、弹匣、瞄具、战术灯
    const fat = base === "launcher" ? 1.6 : 1, rc = base === "flamer" ? "#7a3a20" : "#1d1f22", long = !pis;
    if (pis) { F.limb([g0, gp(.6), g1], [.034, .03, .016], [rc, "#0d0e0f"], .002); F.limb([gp(.1), add(gp(.05), -.01, 0, -.08)], [.02, .018], ["#141618"], .001); }
    else { F.limb([g0, gp(.22), gp(.5), gp(.76), g1], [.027, .036 * fat, .036 * fat, .026 * fat, (base === "shotgun" ? .02 : .013) * fat], ["#3a2b1f", rc, "#282b2f", "#0d0e0f"], .002);
      box(add(g0, -.012, 0, 0), [.01, .02, .045], "#0f1011", .0025); F.limb([gp(.3), add(gp(.27), -.02, 0, -.09)], [.021, .018], ["#141618"], .001); box(g1, [.02, .016 * fat, .016 * fat], "#15171a", .003); box(add(gp(.93), 0, 0, .03), [.008, .006, .016], "#15171a", .004);
      if (base === "rifle" || base === "smg" || base === "sniper") F.limb([gp(.42), add(gp(.44), .012, 0, -.075), add(gp(.47), .04, 0, -.135)], [.024, .023, .02], ["#141618", "#141618"], .001);
      if (base === "sniper") { F.limb([add(gp(.28), 0, 0, .062), add(gp(.56), 0, 0, .062)], [.02, .024], ["#111314"], .004); F.ell(add(gp(.57), 0, 0, .062), [.006, .02, .02], "#5a8aa0", .005); }
      else if (base !== "flamer" && base !== "launcher") { box(add(gp(.38), 0, 0, .056), [.036, .02, .022], "#15171a", .004); F.fn(add(gp(.34), 0, 0, .06), .02, (g, c) => { g.fillStyle = "rgba(255,50,40,.35)"; g.beginPath(); g.arc(c[0], c[1], 1.5, 0, TAU); g.fill(); g.fillStyle = "#ff4030"; g.beginPath(); g.arc(c[0], c[1], .7, 0, TAU); g.fill(); }); } // 红点瞄具
      F.limb([add(gp(.6), 0, .04, -.02), add(gp(.72), 0, .04, -.02)], [.016, .019], ["#1a1c1e"], .003); F.ell(add(gp(.735), 0, .04, -.02), [.006, .017, .017], "#eaf6ff", .004); // 战术灯
      F.fn(add(gp(.6), 0, 0, .05), .03, g => { g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = .6; g.beginPath(); for (let t = .54; t < .75; t += .04) { const a = F.pr(add(gp(t), 0, -.025, .01)), b = F.pr(add(gp(t), 0, .025, .01)); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke(); const a = F.pr(add(gp(.24), 0, 0, .037)), b = F.pr(add(gp(.74), 0, 0, .03)); g.strokeStyle = "rgba(235,240,245,.42)"; g.lineWidth = .6; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }); } // 护木防滑纹 + 金属高光条
    if (base === "flamer") { F.ell(add(C, -.2, .135, -.22), [.08, .08, .11], "#8a3f20", .001); }
    M.muz = F.pr(add(g1, .04, 0, 0)); M.gun = F.pr(gp(.5)); },
  walker(F, J, B, v, M) { const S = { z: 1, thin: .92, loose: 1.1, skin: ["#8c9684", "#96977f", "#84928a"][v % 3], shirt: ["#9c9e92", "#7f8c96", "#9a8e78"][v % 3], sleeve: 0, pants: ["#3a4b6c", "#47443c", "#35404a"][v % 3], bareShin: [0, 1], shoe: "#1c1c1b", hair: ["#231d17", "#4a3c2c", "#6f6a62"][v % 3], hairStyle: v % 3 }, R = humanoid(F, J, B, S), C = J.chest, W = J.waist;
    stain(F, add3(lerp3(C, W, .4), .11, .04, 0), .05); stain(F, add3(lerp3(C, W, .75), .1, -.06, 0), .04, "#4a0a0a"); stain(F, add3(C, -.1, .05, -.1), .045, "#4a0a0a"); stain(F, add3(lerp3(C, W, .55), -.1, -.05, 0), .04); // 干掉的血渍
    stain(F, add3(lerp3(C, W, .12), .13, 0, 0), .06, "#3d0a0a"); veins(F, J); // 从嘴流到胸口的血、发黑的血管
    rot(F, J, 1); bite(F, add3(J.sh1, .01, 0, .055)); bite(F, add3(lerp3(J.knee1, J.ank1, .55), .035, 0, 0)); // 皮肤斑块、肩和小腿上的咬痕
    gash(F, add3(lerp3(C, W, .3), .115, -.03, 0), .9, 5); gash(F, add3(lerp3(C, W, .6), -.105, .04, 0), 2.2, 4); // 衣服撕口
    bone(F, lerp3(J.el0, J.ha0, .35), lerp3(J.el0, J.ha0, .78)); stain(F, add3(J.ha0, .05, 0, 0), .028, "#4a0808"); stain(F, add3(J.ha1, .05, 0, 0), .028, "#4a0808"); // 左前臂露骨、沾血的手
    for (const t of [.08, .3, .52, .74, .94]) { const a = add3(lerp3(R.wl, R.wr, t), 0, 0, -.02); F.limb([a, add3(a, .012 - t * .024, 0, -.06 - (t * 7 % 1) * .07)], [.03, .011], [hx(S.shirt, .86)], .005); } // 撕烂的衣摆
    F.limb([add3(J.knee0, 0, -.02, -.02), add3(J.knee0, -.03, -.03, -.12)], [.026, .01], [hx(S.pants, .8)], .004); // 破裤腿
    M.eyes = zFace(F, J, R.hr, { open: F.atk }); },
  runner(F, J, B, v, M) { const S = { z: 1, thin: .8, loose: 1.02, skin: "#a09c88", shirt: "#5c3a35", chest: .84, sleeve: 0, pants: "#34312d", bareShin: [1, 1], barefoot: 1, hair: "#2a2622", hairStyle: 1 }, R = humanoid(F, J, B, S), C = J.chest, W = J.waist;
    stain(F, add3(lerp3(C, W, .5), .09, 0, 0), .04); stain(F, add3(C, -.08, -.04, -.12), .04, "#4a0a0a"); stain(F, add3(J.head, .07, 0, -.09), .035, "#5a0d0d"); stain(F, add3(J.head, -.03, .02, .09), .03, "#5a0d0d"); // 嘴边和头顶的血
    veins(F, J, "rgba(60,20,30,.5)"); rot(F, J, 0); bite(F, lerp3(J.sh0, J.el0, .5)); gash(F, add3(lerp3(C, W, .35), .095, .03, 0), .5, 5); gash(F, lerp3(J.hip1, J.knee1, .5), 1.4, 4);
    F.fn(add3(lerp3(C, W, .45), .09, 0, 0), .03, g => { g.strokeStyle = "rgba(20,10,8,.4)"; g.lineWidth = .6; g.beginPath(); for (let i = 0; i < 4; i++) { const a = F.pr(add3(lerp3(C, W, .2 + i * .14), .085, -.07, 0)), b = F.pr(add3(lerp3(C, W, .2 + i * .14), .085, .07, 0)); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke(); }); // 肋骨
    bone(F, add3(J.sh1, 0, .01, .04), add3(J.sh1, .01, .05, .06)); for (const t of [.2, .7]) { const a = add3(lerp3(R.wl, R.wr, t), 0, 0, -.03); F.limb([a, add3(a, 0, 0, -.09)], [.026, .01], ["#582f2a"], .005); }
    M.eyes = zFace(F, J, R.hr, { open: 1 }); },
  spitter(F, J, B, v, M) { const S = { z: 1, thin: .9, loose: 1.08, skin: "#96a07c", shirt: "#6f7a80", sleeve: 0, pants: "#40443a", bareShin: [1, 0], shoe: "#1c1c1b", hair: "#3a3a2a", hairStyle: 2 }, R = humanoid(F, J, B, S), C = J.chest, W = J.waist;
    for (const [x, y, z, r] of [[-.13, -.08, -.06, .05], [-.14, .07, -.12, .056], [-.12, -.03, -.24, .044], [-.11, .1, -.3, .04], [-.06, -.16, -.1, .038], [-.02, .17, -.08, .034]]) { F.ball(add3(C, x, y, z), r * .85, "#c9c486"); F.fn(add3(C, x - .02, y, z + r), .01, (g, c) => { g.fillStyle = "rgba(255,255,240,.6)"; g.beginPath(); g.arc(c[0] - .6, c[1] + .8, .6, 0, TAU); g.fill(); }); } // 背上的脓包
    const sr = F.atk ? .095 : .07; F.ell(add3(C, .12, 0, -.1), [sr, sr * 1.15, sr * 1.2], "#a9c46a", .01); stain(F, add3(lerp3(C, W, .35), .12, 0, 0), .075, "#6a8a24"); M.sac = F.pr(add3(C, .12, 0, -.1)); // 喉囊，吐酸时鼓起
    F.fn(add3(C, .19, 0, -.1), .02, g => { g.strokeStyle = "rgba(60,90,20,.6)"; g.lineWidth = .6; g.beginPath(); for (const y of [-.06, 0, .06]) { const a = F.pr(add3(C, .17, y * .4, -.02)), b = F.pr(add3(C, .15, y, -.2)); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke(); }); // 喉囊上的青筋
    stain(F, add3(lerp3(C, W, .7), .1, .03, 0), .045, "#55701c"); stain(F, add3(J.head, .09, 0, -.1), .03, "#7fc030"); veins(F, J, "rgba(70,90,20,.6)"); rot(F, J, 0, "#6f7a2a"); gash(F, add3(lerp3(C, W, .5), -.1, .02, 0), 1.2, 4); bite(F, lerp3(J.sh1, J.el1, .6));
    for (const t of [.15, .5, .85]) { const a = add3(lerp3(R.wl, R.wr, t), 0, 0, -.02); F.limb([a, add3(a, 0, 0, -.08)], [.026, .01], ["#3a3f26"], .005); }
    M.eyes = zFace(F, J, R.hr, { open: 1, mouth: "#5f8a20", drool: "rgba(120,170,40,.85)" }); },
  bloater(F, J, B, v, M) { const sk = "#8f9f6c", S = { z: 1, thin: 1.1, loose: 1.05, skin: sk, shirt: "#6a6452", chest: 1.25, sleeve: 0, pants: "#48463a", bareShin: [1, 1], barefoot: 1, headM: .88, hair: "#2a261e", hairStyle: 1 }, R = humanoid(F, J, B, S), bc = add3(J.waist, .07, J.waist[1] * .5, .1), br = .36;
    F.ell(bc, [br, br * 1.05, br * .95], sk, .01); for (const [x, y, z, r] of [[.2, .12, .2, .055], [.1, -.2, .22, .05], [-.1, .1, .3, .048], [.25, -.05, .05, .046], [0, .28, .1, .046], [-.2, -.15, .2, .042], [.05, 0, .34, .042], [.28, .14, -.05, .04]]) F.ball(add3(bc, x, y, z), r * .8, "#cfc98a", .012); veins(F, J, "rgba(40,60,20,.55)"); // 脓包、青筋
    F.fn(add3(bc, 0, 0, br), .2, (g, c, K) => { const r = br * K; g.fillStyle = "rgba(255,255,255,.34)"; g.beginPath(); g.ellipse(c[0] - r * .32, c[1] + r * .5, r * .3, r * .13, -.6, 0, TAU); g.fill(); g.strokeStyle = "rgba(24,44,10,.45)"; g.lineWidth = .9; g.beginPath(); g.moveTo(c[0], c[1] + r * .9); g.quadraticCurveTo(c[0] + r * .4, c[1] + r * 1, c[0] + r * .55, c[1] + r * 1.35); g.moveTo(c[0], c[1] + r * .9); g.quadraticCurveTo(c[0] - r * .3, c[1] + r * 1.25, c[0] - r * .1, c[1] + r * 1.6); g.moveTo(c[0] + r * .2, c[1] + r * .7); g.quadraticCurveTo(c[0] + r * .6, c[1] + r * .6, c[0] + r * .8, c[1] + r * .9); g.stroke(); }); // 肚皮的高光和青筋
    gash(F, add3(bc, br * .8, .08, .05), 1.3, 7); gash(F, add3(bc, br * .55, -.2, .15), .3, 5); // 撑裂的皮
    for (const t of [.12, .38, .62, .88]) { const a = add3(lerp3(J.sh0, J.sh1, t), .06, 0, -.06); F.limb([a, add3(a, .05, 0, -.12)], [.032, .012], ["#55533e"], .011); } // 撑破的上衣碎片
    rot(F, J, 0, "#55701c"); stain(F, add3(J.head, .07, 0, -.08), .03, "#5a0d0d"); stain(F, add3(bc, br * .7, .15, -.15), .06, "#55701c");
    M.eyes = zFace(F, J, R.hr, { open: F.atk }); },
  brute(F, J, B, o, M) { o = o && o.vest ? o : { vest: "#3a4048", pad: "#23272c", cap: "#2a2f34" }; const S = { z: 1, thin: 1.25, loose: 1.02, hair: "#1c1a18", hairStyle: 1, skin: o.skin || "#7d8878", shirt: hx(o.vest, .8), chest: 1.3, sleeve: 0, pants: "#2c3238", boot: 1, shoe: "#0f1011", sole: "#060607", kneepad: "#2a2e32", fist: .052, headM: .98 }, R = humanoid(F, J, B, S), C = J.chest, W = J.waist;
    F.sect([[.12, .2, .15], [.34, .25, .175], [B.tor - .06, .24, .14]], o.vest, .012); for (let i = 0; i < 2; i++) { F.ell(add3(J["sh" + i], 0, 0, .03), [.08, .085, .06], o.pad, .014); F.fn(add3(J["sh" + i], 0, 0, .1), .03, (g, c) => { g.fillStyle = "rgba(10,10,10,.7)"; for (const dx of [-1.6, 1.6]) { g.beginPath(); g.arc(c[0] + dx, c[1] + 2.4, .6, 0, TAU); g.fill(); } }); } // 防暴甲、护肩铆钉
    F.fn(add3(lerp3(C, W, .5), .2, 0, 0), .03, g => { g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = .8; g.beginPath(); for (const t of [.3, .55, .8]) { const a = F.pr(add3(lerp3(C, W, t), .17, -.2, 0)), b = F.pr(add3(lerp3(C, W, t), .17, .2, 0)); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } const a = F.pr(add3(lerp3(C, W, .15), .17, 0, 0)), b = F.pr(add3(lerp3(C, W, .95), .17, 0, 0)); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }); // 甲片接缝
    F.box(add3(lerp3(C, W, .25), .185, .1, 0), [.01, .05, .03], o.cross ? "#b3261c" : "#8a8f8a", .02); gash(F, add3(lerp3(C, W, .62), .18, -.1, 0), .7, 7); F.ell(add3(lerp3(C, W, .7), .15, -.12, 0), [.03, .05, .06], S.skin, .013); // 胸牌、甲上的破口露出皮肉
    stain(F, add3(lerp3(C, W, .45), .19, .05, 0), .06); stain(F, add3(C, -.16, -.06, -.12), .05, "#4a0a0a"); stain(F, add3(J.ha0, .06, 0, 0), .045, "#4a0808"); stain(F, add3(J.ha1, .06, 0, 0), .045, "#4a0808"); veins(F, J); rot(F, J, 0); bite(F, lerp3(J.sh0, J.el0, .55)); bone(F, lerp3(J.el1, J.ha1, .3), lerp3(J.el1, J.ha1, .7));
    F.ell(add3(J.head, -.03, 0, .035), [.105, .094, .1], o.cap, .03);
    if (o.cross) F.fn(add3(J.head, 0, 0, .13), .1, (g, c) => { g.fillStyle = "#b3261c"; g.fillRect(c[0] - 3, c[1] + 4, 6, 2); g.fillRect(c[0] - 1, c[1] + 2, 2, 6); }); else F.fn(add3(J.head, 0, 0, .13), .1, (g, c) => { g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 1; g.beginPath(); g.moveTo(c[0] - 3, c[1] + 2); g.lineTo(c[0], c[1] + 5); g.lineTo(c[0] - 1, c[1] + 9); g.moveTo(c[0], c[1] + 5); g.lineTo(c[0] + 3, c[1] + 6); g.stroke(); }); // 头盔裂纹
    M.eyes = zFace(F, J, R.hr, { open: F.atk }); },
  elite(F, J, B, v, M) { DRESS.brute(F, J, B, { vest: "#b9c2bc", pad: "#8f9a93", cap: "#d9dedb", cross: 1, skin: "#98a498" }, M); },
  elite2(F, J, B, v, M) { DRESS.brute(F, J, B, { vest: "#4a2a2a", pad: "#6a1c18", cap: "#3a1512" }, M); },
  crawler(F, J0, B, v, M) { const sk = "#6f7a6c", p = F.p, dead = F.dead || 0, lunge = F.atk ? Math.sin(Math.PI * F.atk) : 0, J = { head: [.34 + lunge * .08, 0, .22 - dead * .13 + lunge * .05] }, st = [-.3, 0, .09]; F.skin = sk;
    F.fn([-.6, 0, 0], -9, g => { const a = F.pr([-.3, 0, 0]), b = F.pr([-.85, 0, 0]), q = g.createLinearGradient(a[0], a[1], b[0], b[1]); q.addColorStop(0, "rgba(95,8,8,.85)"); q.addColorStop(1, "rgba(95,8,8,0)"); g.strokeStyle = q; g.lineWidth = 8; g.lineCap = "round"; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }); // 身后的血痕
    const shs = []; for (let i = 0; i < 2; i++) { const sy = i ? 1 : -1, ph = TAU * (p + i * .5), sw = lunge ? 1 : F.stand ? 0 : Math.cos(ph), sh = [.14, sy * .17, .16 - dead * .05], el = [.24 + .06 * sw - dead * .1, sy * (.33 + dead * .1), .12 + .05 * Math.max(0, sw) - dead * .09 + lunge * .08], ha = [.46 + .14 * sw + lunge * .1 - dead * .2, sy * (.22 + dead * .25), .03 + (F.stand ? 0 : .05 * Math.max(0, Math.sin(ph))) + lunge * .12];
      shs.push(sh); J["sh" + i] = sh; J["el" + i] = el; J["ha" + i] = ha; F.limb([sh, el, ha], [.058, .042, .03], [sk, sk]); F.limb([ha, add3(ha, .09, -sy * .02, -.01)], [.036, .026], [sk], .002); stain(F, add3(ha, .06, 0, 0), .028, "#4a0808"); F.limb([sh, lerp3(sh, el, .4)], [.064, .056], ["#454d52"], .001); }
    F.pts([shs[0], shs[1], [-.3, .1, .09], [-.3, -.1, .09], [0, .14, .15], [0, -.14, .15]], "#454d52", .004, .085); F.ell(st, [.08, .1, .06], "#5a0c0c", -.002); F.limb([st, add3(st, -.13, -.02, -.05)], [.016, .008], ["#d8d0b8"], -.004); F.limb([add3(st, -.02, .05, -.02), add3(st, -.16, .09, -.07), add3(st, -.24, .03, -.08)], [.02, .016, .012], ["#7a2a22", "#7a2a22"], -.005); // 断口、露出的脊骨、拖着的肠子
    stain(F, [0, .05, .26], .05); stain(F, [-.15, -.06, .2], .04, "#4a0a0a"); gash(F, [-.05, 0, .255], .2, 5); stain(F, lerp3(J.el0, J.ha0, .5), .024, "#3f5a3a"); stain(F, lerp3(J.sh1, J.el1, .6), .024, "#3f5a3a"); bite(F, lerp3(J.el1, J.ha1, .5));
    F.limb([[.2, 0, .18 - dead * .05], lerp3([.2, 0, .18], J.head, .6)], [.05, .044], [sk], .01);
    F.pts(F.eps(J.head, [.1, .082, .1]).concat(F.eps(add3(J.head, .05, 0, -.05), [.06, .058, .05])), sk, .02); F.ell(add3(J.head, -.03, 0, .03), [.1, .086, .09], "#15130f", .021); M.eyes = zFace(F, J, .1, { open: lunge > .2 }); }
};
/* 丧尸身上的细节：皮肤斑块、咬痕、撕口、露骨 */
function rot(F, J, bareR, col) { col = col || "#3f5a3a"; stain(F, lerp3(J.sh0, J.el0, .6), .026, col); stain(F, lerp3(J.el0, J.ha0, .3), .022, col); stain(F, lerp3(J.el1, J.ha1, .45), .024, col); stain(F, lerp3(J.sh1, J.el1, .35), .022, col); stain(F, add3(J.head, -.02, .06, .06), .03, col); stain(F, add3(J.head, .05, -.05, -.02), .022, col); if (bareR) stain(F, lerp3(J.knee1, J.ank1, .3), .026, col); }
function bite(F, P) { F.fn(P, .035, (g, c) => { g.fillStyle = "rgba(60,10,10,.8)"; g.beginPath(); g.ellipse(c[0], c[1], 2, 1.3, .4, 0, TAU); g.ellipse(c[0] + 1.2, c[1] + .9, 1, .7, 1, 0, TAU); g.fill(); g.fillStyle = "rgba(24,4,4,.85)"; g.beginPath(); g.ellipse(c[0] - .2, c[1], 1, .6, .4, 0, TAU); g.fill(); g.fillStyle = "rgba(20,4,4,.7)"; for (let i = 0; i < 5; i++) { const a = .6 + i * .5; g.beginPath(); g.arc(c[0] + Math.cos(a) * 2.5, c[1] + Math.sin(a) * 1.7, .32, 0, TAU); g.fill(); } }); } // 咬痕：撕开的伤口 + 一排牙印
function gash(F, P, ang, len) { F.fn(P, .035, (g, c) => { const dx = Math.cos(ang), dy = Math.sin(ang) * .8, path = () => { g.beginPath(); g.moveTo(c[0] - dx * len / 2, c[1] - dy * len / 2); for (let i = 1; i <= 4; i++) { const t = i / 4 - .5, o = (i % 2 ? 1 : -1) * .32; g.lineTo(c[0] + dx * len * t - dy * o, c[1] + dy * len * t + dx * o); } }; g.lineCap = "round"; g.lineJoin = "round"; path(); g.strokeStyle = "rgba(25,6,6,.85)"; g.lineWidth = 1.5; g.stroke(); path(); g.strokeStyle = "rgba(150,30,24,.9)"; g.lineWidth = .55; g.stroke(); }); }
function bone(F, A, Bq) { F.limb([A, Bq], [.011, .012], ["#dcd5bd"], .006); stain(F, A, .022, "#3a0606"); stain(F, Bq, .024, "#3a0606"); }
function hull2(P) { P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } lo.pop(); up.pop(); return lo.concat(up); }
/* 画一个角色到 g 的原点（脚下）。返回眼睛、枪口等位置 */
function figure(g, type, v, ang, p, stand, opt) {
  const org = type !== "player", gl = org ? 1.2 : 1.38, gd = org ? .66 : .5; const B = BODY[BK[type]], K = PX * B.s, ca = Math.cos(ang), sa = Math.sin(ang), parts = [], M = { eyes: [] };
  const pr = P => { const wy = P[0] * sa + P[1] * ca; return [(P[0] * ca - P[1] * sa) * K, wy * K * YK - P[2] * K * ZK, wy * .5 + P[2] * .87]; };
  const J = type === "crawler" ? null : pose(B, p, stand, opt), ln = J ? J.ln : 0;
  const eps = (C, r) => { const o = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, c = Math.cos(a), s = Math.sin(a); o.push([C[0] + r[0] * c, C[1] + r[1] * s, C[2]], [C[0] + r[0] * c, C[1], C[2] + r[2] * s], [C[0], C[1] + r[1] * c, C[2] + r[2] * s]); } return o; };
  const pts = (P3, col, bias, pad) => { let q = P3.map(pr), d = 0; for (const a of q) d += a[2]; d /= q.length; if (pad) { const r = pad * K, o = []; for (const a of q) for (let i = 0; i < 8; i++) o.push([a[0] + Math.cos(i * .785) * r, a[1] + Math.sin(i * .785) * r]); q = o; } parts.push([d + (bias || 0), 2, hull2(q), col, P3]); };
  const F = { pr, p, stand, eps, pts, dead: opt && opt.dead, atk: opt && opt.atk, fn: (C, bias, f) => { const c = pr(C); parts.push([c[2] + bias, 3, c, f]); },
    limb: (P, R, cols, bias) => { const q = P.map(pr), sg = []; let d = 0; for (const a of q) d += a[2]; for (let i = 0; i < q.length - 1; i++) sg.push([q[i], q[i + 1], R[i] * K, R[i + 1] * K, cols[i] || cols[cols.length - 1]]); parts.push([d / q.length + (bias || 0), 0, sg, 0, P, R]); },
    seg: (A, Bq, w, col, bias) => F.limb([A, Bq], [w / 2, w / 2], [col], bias), box: (C, r, col, bias) => { const o = []; for (let i = 0; i < 8; i++) o.push([C[0] + (i & 1 ? r[0] : -r[0]), C[1] + (i & 2 ? r[1] : -r[1]), C[2] + (i & 4 ? r[2] : -r[2])]); pts(o, col, bias, .007); }, ell: (C, r, col, bias) => pts(eps(C, r), col, bias),
    ball: (C, r, col, bias, flat) => { if (flat) { const c = pr(C); parts.push([c[2] + (bias || 0) + .03, 1, c, r * K, col]); } else pts(eps(C, [r, r, r]), col, bias); },
    sect: (L, col, bias) => { const o = []; for (const [h, w, d] of L) { const hq = (J.hunch || 0) * Math.min(1.2, Math.max(0, h / B.tor)) ** 2, cx = Math.sin(ln) * h + hq, cz = J.hz + Math.cos(ln) * h - hq * .3; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; o.push([cx + Math.cos(ln) * d * Math.cos(a), w * Math.sin(a), cz - Math.sin(ln) * d * Math.cos(a)]); } } pts(o, col, bias); } };
  DRESS[type](F, J, B, v, M, opt); if (J) { const h = pr(J.head); M.top = h[1] - .13 * K; M.chest = pr(J.chest); } else { M.top = -16; M.chest = [0, -6]; }
  parts.sort((a, b) => a[0] - b[0]); g.lineCap = "round"; g.lineJoin = "round";
  // 锥形肢体：两端半径不同的圆之间连切线，多段首尾相接成一条连续轮廓
  const taper = (a, b, ra, rb) => { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy); if (d < Math.abs(ra - rb) + .01) { const c = ra > rb ? a : b, r = Math.max(ra, rb); g.moveTo(c[0] + r, c[1]); g.arc(c[0], c[1], r, 0, TAU); return; } const ph = Math.atan2(dy, dx), be = Math.acos((ra - rb) / d); g.moveTo(a[0] + Math.cos(ph + be) * ra, a[1] + Math.sin(ph + be) * ra); g.arc(a[0], a[1], ra, ph + be, ph - be + TAU); g.arc(b[0], b[1], rb, ph - be, ph + be); g.closePath(); };
  const smooth = H => { const n = H.length; g.moveTo((H[n - 1][0] + H[0][0]) / 2, (H[n - 1][1] + H[0][1]) / 2); for (let i = 0; i < n; i++) { const q = H[(i + 1) % n]; g.quadraticCurveTo(H[i][0], H[i][1], (H[i][0] + q[0]) / 2, (H[i][1] + q[1]) / 2); } g.closePath(); };
  const path = q => { g.beginPath(); if (q[1] === 0) for (const s of q[2]) taper(s[0], s[1], s[2], s[3]); else smooth(q[2]); };
  // ① 投影层：把整个人按光的方向"拍"到地上，是跟着动作变化的真实影子
  if (!opt || !opt.noShadow) { const ps = P => { const wy = P[0] * sa + P[1] * ca; return [(P[0] * ca - P[1] * sa) * K + P[2] * K * .42, wy * K * YK + P[2] * K * .2]; }; g.beginPath();
    for (const q of parts) { if (q[1] === 0) { const P = q[4].map(ps), R = q[5]; for (let i = 0; i < P.length - 1; i++) taper(P[i], P[i + 1], R[i] * K, R[i + 1] * K); } else if (q[1] === 2 && q[4]) { const H = hull2(q[4].map(ps)); if (H.length > 2) smooth(H); } } g.fillStyle = "rgba(0,0,0,.36)"; g.fill("nonzero"); }
  // ② 描边层（先画在最底下）：每个部件用自己颜色的深色描一圈，被上面的填色盖住后只剩整个人最外圈一道细边，不用纯黑
  g.lineWidth = org ? 1.2 : 1.5; for (const q of parts) if (q[1] === 0 || q[1] === 2) { g.strokeStyle = hx(q[1] === 0 ? q[2][0][4] : q[3], .34); path(q); g.stroke(); }
  // ③④⑤ 身体/服装/装备按远近依次上色：亮面-中间色-暗面三层渐变，布料加噪点，金属加高光条，每块再点一处高光
  const tex = (col, x0, y0, x1, y1) => { if (METAL.has(col)) return; g.save(); g.clip(); g.globalAlpha = col === F.skin ? (org ? .2 : .1) : (org ? .24 : .16); g.fillStyle = noisePat(g); g.fillRect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2); g.restore(); };
  for (const q of parts) { const k = q[1];
    if (k === 0) { path(q); if (org) { g.strokeStyle = "rgba(0,0,0,.13)"; g.lineWidth = 3; g.stroke(); g.strokeStyle = "rgba(0,0,0,.2)"; g.lineWidth = 1.2; g.stroke(); } else { g.strokeStyle = hx(q[2][0][4], .42); g.globalAlpha = .55; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1; }
      for (const s of q[2]) { const a = s[0], b = s[1], r = Math.max(s[2], s[3]), col = s[4]; let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const nl = Math.hypot(nx, ny); if (nl < .01) { nx = -.7; ny = -.7; } else { nx /= nl; ny /= nl; if (nx + ny > 0) { nx = -nx; ny = -ny; } } const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, gr = g.createLinearGradient(mx + nx * r, my + ny * r, mx - nx * r, my - ny * r); gr.addColorStop(0, hx(col, gl)); gr.addColorStop(.42, col); gr.addColorStop(1, hx(col, gd)); g.fillStyle = gr; g.beginPath(); taper(a, b, s[2], s[3]); g.fill();
        if (r > 1.6) tex(col, Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r);
        if (METAL.has(col) && r > .9 && nl > 2) { g.strokeStyle = "rgba(235,240,245,.4)"; g.lineWidth = Math.max(.5, r * .28); g.beginPath(); g.moveTo(a[0] + nx * s[2] * .45, a[1] + ny * s[2] * .45); g.lineTo(b[0] + nx * s[3] * .45, b[1] + ny * s[3] * .45); g.stroke(); } } }
    else if (k === 2) { const H = q[2], col = q[3]; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const a of H) { if (a[0] < x0) x0 = a[0]; if (a[0] > x1) x1 = a[0]; if (a[1] < y0) y0 = a[1]; if (a[1] > y1) y1 = a[1]; } path(q); if (org) { g.strokeStyle = "rgba(0,0,0,.13)"; g.lineWidth = 3; g.stroke(); g.strokeStyle = "rgba(0,0,0,.2)"; g.lineWidth = 1.2; g.stroke(); } else { g.strokeStyle = hx(col, .42); g.globalAlpha = .55; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1; } const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, hx(col, gl + .02)); gr.addColorStop(.42, col); gr.addColorStop(1, hx(col, gd)); g.fillStyle = gr; g.fill();
      const w = x1 - x0, h = y1 - y0; if (w > 3 && h > 3) { tex(col, x0, y0, x1, y1); const cx = x0 + w * .32, cy = y0 + h * .3, rr = Math.min(w, h) * .3, hg = g.createRadialGradient(cx, cy, 0, cx, cy, rr); hg.addColorStop(0, METAL.has(col) ? "rgba(255,255,255,.34)" : org ? (WET.has(col) ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.03)") : "rgba(255,255,255,.17)"); hg.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = hg; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.fill(); } }
    else if (k === 1) { const c = q[2], r = q[3], hh = h2(c[0] * 7 | 0, c[1] * 5 | 0, 9); g.globalAlpha = .78; g.fillStyle = q[4]; g.beginPath(); g.ellipse(c[0], c[1], r, r * .55, hh * 3, 0, TAU); g.ellipse(c[0] + r * (hh - .5), c[1] + r * .5, r * .5, r * .35, hh * 5, 0, TAU); g.ellipse(c[0] - r * .7, c[1] - r * .3 * hh, r * .3, r * .22, 0, 0, TAU); g.fill(); g.globalAlpha = 1; }
    else q[3](g, q[2], K); }
  return M;
}
/* 丧尸精灵缓存：16 个朝向（右半边 9 个，左半边镜像）× 8 帧走路 + 1 帧站立，用到哪格画哪格 */
let CELLS = new Map();
function cell(type, v, k, f) { const key = type + v + "_" + k + "_" + f; let c = CELLS.get(key); if (c) return c;
  const big = BODY[BK[type]].s > 1.2, CL = big ? 160 : 104, SS = big ? 1.25 : 1.6, cv = document.createElement("canvas"); cv.width = cv.height = Math.round(CL * SS); const g = cv.getContext("2d"); g.setTransform(SS, 0, 0, SS, CL / 2 * SS, CL * .74 * SS);
  const o = f >= 15 ? { dead: (f - 14) / 6 } : f >= 13 ? { lean: f === 13 ? -.34 : -.17 } : f >= 9 ? { atk: (f - 9) / 4 + .125 } : null;
  c = { cv, CL, M: figure(g, type, v, -Math.PI / 2 + k * Math.PI / 8, f < 8 ? f / 8 : 0, f >= 8, o) }; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; const H0 = cv.height, ug = g.createLinearGradient(0, H0 * .3, 0, H0 * .78); ug.addColorStop(0, "rgba(34,40,38,.08)"); ug.addColorStop(1, "rgba(8,12,11,.34)"); g.fillStyle = ug; g.fillRect(0, 0, cv.width, H0); g.globalCompositeOperation = "source-over";
  CELLS.set(key, c); return c; }
function dirK(ang) { let a = ((ang % TAU) + TAU + Math.PI) % TAU - Math.PI, flip = false; if (Math.cos(a) < -1e-6) { a = Math.PI - a; if (a > Math.PI) a -= TAU; flip = true; } return [Math.max(0, Math.min(8, Math.round((a + Math.PI / 2) / (Math.PI / 8)))), flip]; }
/* 尸体：6 帧倒地 + 血泊扩散；疯跑者倒地后还会抽搐。c 可以是地面图（烙进去永久保留） */
function drawBody(c, b, k6, jx) { if (!b.key) return drawCorpse(c, b, Math.min(1, k6 / 3), 0); const [k, flip] = dirK(b.face), cl = cell(b.key, b.sv, k, 14 + k6), CL = cl.CL, d = k6 / 6, r = b.r, bx = -Math.cos(b.face) * r * 1.1 * d, by = -Math.sin(b.face) * r * .8 * d;
  c.fillStyle = "rgba(64,6,6,.82)"; el(c, b.x + bx, b.y + by, r * 1.9 * d, r * 1.25 * d, b.v * 3); el(c, b.x + bx * 1.8 + r * .5, b.y + by * 1.6 + r * .3, r * .8 * d, r * .5 * d, b.v * 5); el(c, b.x + bx * .4 - r * .9 * d, b.y + by + r * .5 * d, r * .5 * d, r * .32 * d, 1);
  c.save(); c.translate(b.x + (jx || 0), b.y); if (flip) c.scale(-1, 1); c.drawImage(cl.cv, -CL / 2, -CL * .74, CL, CL); c.restore(); }
function gait(o, cyc, hold) { const mv = Math.hypot(o.x - (o._lx === undefined ? o.x : o._lx), o.y - (o._ly === undefined ? o.y : o._ly)); o._lx = o.x; o._ly = o.y; if (mv > .04 && mv < 30 && !hold) { o.gp = ((o.gp || 0) + mv / cyc) % 1; o.still = 0; } else if (!G.pausedDraw) o.still = (o.still || 0) + 1; return o.still > 7; }
/* 影子：椭圆，朝背光方向偏移拉长；身体起伏时略微缩放 */
function shadow(c, x, y, r, ang, k, sm) { c.save(); c.translate(x + Math.cos(ang) * r * .7 * k, y + Math.sin(ang) * r * .7 * k); c.rotate(ang); c.fillStyle = "rgba(0,0,0,.5)"; c.beginPath(); c.ellipse(0, 0, r * (.85 + .6 * k) * sm, r * .5 * sm, 0, 0, TAU); c.fill(); c.restore(); }
Rn.figure = figure;
function drawPlayer(c, pl, S, time) {
  const dead = G.state === "dead"; if (dead) pl.deadT = pl.deadT === undefined ? time : pl.deadT; else pl.deadT = undefined;
  const dk = dead ? Math.min(6, Math.ceil((time - pl.deadT) / .1 + .01)) / 6 : 0; // 死亡 6 帧：后仰倒地
  const stand = (gait(pl, CYC("player"), pl.dashT > 0 || dead) && pl.dashT <= 0) || dead, p = pl.dashT > 0 ? (pl.dashT * 7) % 1 : pl.gp || 0;
  const hit = pl.hurtT > .23 ? 2 : pl.hurtT > .1 ? 1 : 0, rec = pl.flashT > 0 && !S.B.flame ? Math.ceil(pl.flashT / .07 * 4) / 4 * .04 : 0; // 受击 2 帧、开火后坐 4 帧
  const opt = { rec, lean: hit ? -.16 * hit : 0, dead: dk };
  if (dead) { c.fillStyle = "rgba(70,6,6,.85)"; el(c, pl.x - Math.cos(pl.va) * 14 * dk, pl.y - Math.sin(pl.va) * 10 * dk, 26 * dk, 17 * dk, pl.va); el(c, pl.x - Math.cos(pl.va) * 26 * dk + 6, pl.y - Math.sin(pl.va) * 18 * dk + 4, 12 * dk, 8 * dk, 1); } // 血泊扩散
  c.save(); c.translate(pl.x, pl.y); const M = figure(c, "player", S.base, pl.va, p, stand, opt);
  if (hit === 2) { c.globalCompositeOperation = "lighter"; c.globalAlpha = .75; figure(c, "player", S.base, pl.va, p, stand, { ...opt, noShadow: 1 }); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; } // 闪白
  Rn.muz = { x: pl.x + M.muz[0], y: pl.y + M.muz[1], a: Math.atan2(M.muz[1] - M.gun[1], M.muz[0] - M.gun[0]) };
  if (pl.flashT > 0 && !S.B.flame && !dead) { c.translate(M.muz[0], M.muz[1]); c.rotate(Rn.muz.a); const g = c.createRadialGradient(5, 0, 0, 5, 0, 20); g.addColorStop(0, "rgba(255,250,220,1)"); g.addColorStop(.35, "rgba(255,190,70,.85)"); g.addColorStop(1, "rgba(255,120,20,0)"); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(11, -8); c.lineTo(9, -2); c.lineTo(26, 0); c.lineTo(9, 2); c.lineTo(11, 8); c.closePath(); c.fill(); }
  c.restore();
}
function eKey(e) { return e.type === "elite" ? (e.look === "brute" ? "elite2" : "elite") : e.type; }
function drawEnemy(c, e, time, pl) {
  const E = e.E, r = e.r, fl = e.flash > 0, t = e.type; let top = -r - 16;
  if (t === "boss") { shadow(c, e.x, e.y, r, Math.atan2(e.y - pl.y, e.x - pl.x), 1, 1); const k = r / 13, C = x => fl ? "#fff" : x; c.save(); c.translate(e.x, e.y - 10); c.scale(1, .8); c.rotate(e.ang); c.scale(k, k); c.lineCap = "round";
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.sin(time * 2 + i) * .3, p = [Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a + .5) * 18, Math.sin(a + .5) * 18, Math.cos(a + Math.sin(time * 3 + i) * .6) * 24, Math.sin(a + Math.sin(time * 3 + i) * .6) * 24]; for (const [col, w] of [[OUTC, 5.2], [C("#5a3f6a"), 3.4]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(p[0], p[1]); c.quadraticCurveTo(p[2], p[3], p[4], p[5]); c.stroke(); } }
    c.fillStyle = fl ? "#fff" : "#c9c9cf"; el(c, 0, 0, 9, 11.5); c.strokeStyle = OUTC; c.lineWidth = 1; c.stroke(); c.fillStyle = C("#5a0d0d"); el(c, -2, 3, 4, 3); c.fillStyle = C("#75687f"); circ(c, 3, 0, 5.6); c.stroke(); c.fillStyle = C(`rgba(255,70,160,${.7 + Math.sin(time * 4) * .3})`); circ(c, -1, 0, 4.5); c.restore(); e._eyes = null; }
  else { const key = eKey(e), v = t === "walker" ? (e.v * 3) | 0 : 0, stand = gait(e, CYC(key), e.stag > 0 || e.st === "wind"), pw = e.st === "wind" ? 1 - e.w / e.tele.t : 0;
    const f = e.st === "wind" && e.tele.type !== "leap" ? 9 + Math.min(1, Math.floor(pw * 2)) : e.atk > 0 ? 9 + Math.min(3, Math.floor((1 - e.atk / .32) * 4)) : fl ? 13 : e.stag > 0 ? 14 : stand ? 8 : Math.floor((e.gp || 0) * 8) & 7; // 攻击 4 帧 / 受击 2 帧 / 走路 8 帧
    const [k, flip] = dirK(e.ang), cl = cell(key, v, k, f), CL = cl.CL, M = cl.M;
    const up = f < 8 ? (1 - Math.cos(f / 8 * 2 * TAU)) / 2 : 0, tk = Math.floor(time * 9), jx = e.awake && h2(tk, (e.v * 997) | 0, 3) > .86 ? (h2(tk, 5, (e.v * 99) | 0) - .5) * 3 : 0;
    const sq = e.st === "wind" && e.tele.type === "leap" ? 1 - pw * .2 : 1;
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
  for (const b of L.bodies) if (vis(b.x, b.y, 90)) drawBody(c, b, Math.max(1, Math.min(6, Math.ceil(b.t / .48 * 6))), b.type === "runner" && b.t > .48 ? Math.sin(b.t * 46) * 1.6 * (1 - b.t / b.dur) : 0);
  // 角色按 y 排序
  const list = L.en.filter(e => vis(e.x, e.y, 70)); list.push(pl); list.sort((a, b) => a.y - b.y);
  { let i = 0; const r0 = Math.max(1, Math.floor(vy0 / T) - 1), r1 = Math.min(L.H - 1, Math.floor((vy0 + vh) / T) + 2), one = e => e === pl ? drawPlayer(c, pl, S, time) : drawEnemy(c, e, time, pl);
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
