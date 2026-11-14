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
  Rn.sc = Math.max(.9, Math.min(1.8, Math.min(r.width, r.height) / 335)); // 镜头拉近：短边大约看到 8 格
  Rn.light.width = Math.ceil(r.width / 2); Rn.light.height = Math.ceil(r.height / 2);
};

/* ---------- 预渲染地面与墙体：阴暗的金属基地 ---------- */
const el = (c, x, y, rx, ry, rot) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); c.fill(); };
const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
Rn.build = function (L) {
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

/* ---------- 角色精灵：64×64，三层（腿 / 身体手臂 / 头）× 4 帧走路，预先画好缓存 ----------
   每个形状都带 2px 深色描边，身体用径向渐变（中间亮边缘暗）再加一处高光 */
const SS = 2, CS = 64 * SS, OUT = "#080a09", SHEETS = {};
const AR = { player: 13, walker: 13, runner: 11, crawler: 11, spitter: 13, bloater: 22, brute: 25, elite: 25, elite2: 25 }, VS = 1.22;
const EYE = { walker: [10.5, 2.7], runner: [9.5, 2.5], crawler: [11, 2.3], spitter: [9.5, 2.5], bloater: [20.5, 2.6], brute: [11.5, 3], elite: [11.5, 3], elite2: [11.5, 3] };
const GUN = { pistol: [0, 8, 4, 0], smg: [4, 10, 6, 1], shotgun: [7, 10, 14, 0], rifle: [7, 11, 12, 1], sniper: [8, 11, 19, 1], flamer: [3, 12, 9, 0], launcher: [5, 12, 9, 0] };
const MUZ = b => 9 + GUN[b][0] + GUN[b][1] + GUN[b][2];
function Pp(g, fill, fn, lw) { g.beginPath(); fn(g); g.fillStyle = fill; g.fill(); g.lineWidth = lw || 2; g.strokeStyle = OUT; g.lineJoin = "round"; g.stroke(); }
const EL = (x, y, rx, ry, rot) => g => g.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
const RR = (x, y, w, h, r) => g => { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const TORN = (x, y, rx, ry, seed, amp) => g => { const n = 22; for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 1 + (i % 2 ? -1 : 1) * amp * (.5 + h2(i, seed, 7) * .9), qx = x + Math.cos(a) * rx * k, qy = y + Math.sin(a) * ry * k; i ? g.lineTo(qx, qy) : g.moveTo(qx, qy); } g.closePath(); };
function rg(g, x, y, r, c0, c1) { const q = g.createRadialGradient(x - r * .35, y - r * .35, r * .05, x, y, r); q.addColorStop(0, c0); q.addColorStop(1, c1); return q; }
function limb(g, p, w, col, hi) { g.lineCap = "round"; g.lineJoin = "round"; const path = () => { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); };
  path(); g.strokeStyle = OUT; g.lineWidth = w + 3.2; g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); if (hi) { g.save(); g.translate(-.7, -.9); path(); g.strokeStyle = hi; g.lineWidth = w * .3; g.stroke(); g.restore(); } }
const gel = (g, col, x, y, rx, ry, rot) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, TAU); g.fill(); };
function zHead(g, x, r, skin, o) { o = o || {}; const L = shade(skin, 1.3), D = shade(skin, .55);
  Pp(g, rg(g, x, 0, r, L, D), EL(x, 0, r, r)); gel(g, "rgba(40,72,40,.55)", x - r * .3, r * .38, r * .36, r * .26); gel(g, "rgba(40,72,40,.5)", x + r * .05, -r * .52, r * .26, r * .2); gel(g, "rgba(90,12,12,.7)", x + r * .15, r * .1 - r * .5 * (o.w || 0), r * .22, r * .16);
  if (o.hair !== 0) { g.beginPath(); for (let i = 0; i <= 10; i++) { const a = 1.85 + i / 10 * 2.6, k = r * (i % 2 ? 1.04 : .72); g.lineTo(x + Math.cos(a) * k, Math.sin(a) * k); } g.closePath(); g.fillStyle = o.hair || "#1f1a15"; g.fill(); g.lineWidth = 1; g.strokeStyle = OUT; g.stroke(); }
  gel(g, o.mouth || "#2a0606", x + r * .74, 0, r * .22 * (o.open ? 1.7 : 1), r * .42 * (o.open ? 1.35 : 1)); if (o.open) { g.fillStyle = "#d8d0b8"; g.fillRect(x + r * .62, -r * .4, 1.2, 1.2); g.fillRect(x + r * .62, r * .25, 1.2, 1.2); }
  for (const sy of [-1, 1]) { gel(g, "rgba(255,40,20,.35)", x + r * .5, sy * r * .42, 2.5, 2.5); gel(g, "#ff3020", x + r * .5, sy * r * .42, 1.3, 1.3); }
  gel(g, "rgba(255,255,255,.2)", x - r * .32, -r * .38, r * .3, r * .2, -.6); }
const SKIN = { walker: "#6c7b68", runner: "#98987f", crawler: "#566254", spitter: "#a3aa4c", bloater: "#7f9a48", brute: "#6a7566", elite: "#9aa89c", elite2: "#6a7566" };
const ART = {
  player(g, layer, s, c, base) {
    if (layer === 0) { for (const sy of [-1, 1]) { const x = sy * -s * 6; Pp(g, rg(g, x - 3, sy * 6, 6, "#3b4a38", "#1c241b"), EL(x - 3, sy * 6, 6.5, 4.2)); Pp(g, rg(g, x + 4, sy * 6, 5, "#26282b", "#060707"), EL(x + 4, sy * 6, 6, 4)); gel(g, "rgba(255,255,255,.15)", x + 3, sy * 6 - 1.5, 2.5, 1); } return; }
    if (layer === 1) { const G0 = GUN[base], x0 = 9, st = G0[0], bd = G0[1], br = G0[2];
      Pp(g, rg(g, -13, 0, 11, "#4a5a40", "#1a2116"), RR(-19, -8.5, 10.5, 17, 3)); g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-19, -2.5); g.lineTo(-8.5, -2.5); g.moveTo(-19, 2.5); g.lineTo(-8.5, 2.5); g.moveTo(-14, -8.5); g.lineTo(-14, 8.5); g.stroke(); gel(g, "rgba(255,255,255,.14)", -15, -5.5, 3, 1.4);
      Pp(g, rg(g, 0, 0, 16, "#5c6e52", "#263023"), EL(0, 0, 10.5, 16));
      limb(g, [1, -13.5, 8, -10.5, x0 + st + 3, -1.5], 6.4, "#46553f", "#66785a"); limb(g, [1, 13.5, 12, 9.5, x0 + st + bd + 2, 1.5], 6.4, "#46553f", "#66785a");
      Pp(g, rg(g, 0, 0, 12, "#3a4336", "#141813"), RR(-7, -10.5, 14, 21, 3.5)); for (const py of [-8, -2.5, 3]) Pp(g, "#2a3127", RR(1, py, 5, 4.6, 1), 1.2); g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = 1; g.beginPath(); g.moveTo(-7, 0); g.lineTo(0, 0); g.stroke(); gel(g, "rgba(255,255,255,.16)", -3, -6, 3.5, 1.8, -.5);
      // 枪：枪托、机匣、弹匣、护木、枪管、枪口
      if (st) Pp(g, "#2a211a", RR(x0, -2.6, st + 1, 4.6, 1.2), 1.4);
      if (base === "flamer") Pp(g, rg(g, x0 + 4, 5, 5, "#b0562c", "#4a2010"), EL(x0 + 5, 5.5, 5.5, 3.2), 1.4);
      Pp(g, rg(g, x0 + st + bd / 2, -1, bd * .7, "#3a3d42", "#101113"), RR(x0 + st, -3.2, bd, base === "launcher" ? 7.5 : 5.8, 1.2), 1.4);
      if (G0[3]) { g.save(); g.translate(x0 + st + bd * .5, 2.4); g.rotate(-.18); Pp(g, "#17181a", RR(0, 0, 3.8, 6.2, .8), 1.3); g.restore(); }
      Pp(g, "#22252a", RR(x0 + st + bd, -2.3, br * .5, base === "launcher" ? 6 : 4, 1), 1.3); Pp(g, "#0c0d0f", RR(x0 + st + bd + br * .5 - 1, -1.1, br * .5 + 1, base === "launcher" ? 4.6 : base === "shotgun" ? 2.8 : 2, .6), 1.2); Pp(g, "#17181a", RR(x0 + st + bd + br - 2.5, -1.9, 2.8, base === "launcher" ? 5.6 : 3.6, .6), 1.1);
      if (base === "sniper") Pp(g, "#15171a", RR(x0 + st + 2, -5.4, 9, 2.6, 1), 1.1); g.fillStyle = "rgba(255,255,255,.3)"; g.fillRect(x0 + st + 1.5, -2.4, bd - 3, .9); gel(g, "#e8f4ff", x0 + st + bd + 2, 2.6, 1.2, 1.2);
      Pp(g, "#121416", EL(x0 + st + 3, -1.8, 3.2, 3)); Pp(g, "#121416", EL(x0 + st + bd + 2.5, 1.8, 3.2, 3)); return; }
    Pp(g, rg(g, 2, 0, 8.6, "#687b5e", "#232d1c"), EL(2, 0, 8.4, 8.4)); g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = 1.2; g.beginPath(); g.arc(2, 0, 6, .9, 5.4); g.stroke(); g.beginPath(); g.moveTo(-5, -3); g.lineTo(8, -3); g.moveTo(-5, 3); g.lineTo(8, 3); g.globalAlpha = .35; g.stroke(); g.globalAlpha = 1;
    Pp(g, "#121416", RR(8, -2.4, 3.6, 4.8, 1), 1.2); gel(g, "#6fd0b8", 10.6, -1, 1, .9); gel(g, "#6fd0b8", 10.6, 1, 1, .9); gel(g, "rgba(255,255,255,.3)", -1, -3.5, 3.2, 1.8, -.6);
  },
  walker(g, layer, s, c, v) { const sk = SKIN.walker, L = shade(sk, 1.3), D = shade(sk, .55), shirt = ["#b9b9ad", "#a8b0b6", "#b6aa98"][v % 3], a = s * 2.6;
    if (layer === 0) { g.save(); g.translate(-7 + s, 6.5); g.rotate(.38); Pp(g, rg(g, 0, 0, 9, "#4d6896", "#22324f"), TORN(0, 0, 9.5, 3.8, v + 9, .14)); Pp(g, "#141618", EL(-9, 0, 3.6, 3)); gel(g, "rgba(90,12,12,.75)", 2, 0, 3, 1.6); g.restore(); // 拖着的那条腿
      Pp(g, rg(g, s * 5, -6, 7, "#4d6896", "#22324f"), TORN(s * 5, -6, 7.2, 4, v + 3, .14)); Pp(g, "#141618", EL(s * 5 + 6.5, -6, 3.8, 3.2)); return; }
    if (layer === 1) { limb(g, [2, -13, 11, -12 + a, 20, -7 + a * 2], 4.8, sk, L); limb(g, [2, 13, 10, 11 - a, 18, 6 - a * 2], 4.8, sk, L);
      Pp(g, rg(g, 20, -7 + a * 2, 3.5, L, D), EL(20, -7 + a * 2, 3.4, 3)); Pp(g, rg(g, 18, 6 - a * 2, 3.5, L, D), EL(18, 6 - a * 2, 3.4, 3)); gel(g, "#5a0d0d", 21.5, -7 + a * 2, 1.6, 1.4); gel(g, "#5a0d0d", 19.5, 6 - a * 2, 1.6, 1.4);
      Pp(g, rg(g, 0, 0, 14.5, shirt, shade(shirt, .5)), TORN(0, 0, 9.6, 13.6, v, .15));
      gel(g, "rgba(105,14,14,.85)", -2 + (v % 3) * 2, -4, 4.2, 3.1, .5); gel(g, "rgba(105,14,14,.8)", 3, 6.5, 2.6, 3.4); gel(g, "rgba(0,0,0,.2)", -4.5, 2, 2.6, 7); g.strokeStyle = "rgba(0,0,0,.3)"; g.lineWidth = 1; g.beginPath(); g.moveTo(-6, 0); g.lineTo(8, 0); g.stroke();
      Pp(g, rg(g, 1, -12.5, 5, L, D), EL(1, -12.6, 4.8, 3.8)); gel(g, "rgba(40,72,40,.55)", 0, -12, 2, 1.4); g.strokeStyle = "#3a0707"; g.lineWidth = 1.1; g.setLineDash([1.3, 1.3]); g.beginPath(); g.arc(2, -12.6, 2.2, 0, TAU); g.stroke(); g.setLineDash([]);
      gel(g, "rgba(255,255,255,.18)", -3.5, -6.5, 4, 2.2, -.5); return; }
    zHead(g, 6, 7.2, sk, { w: (v % 3) * .5, hair: ["#1f1a15", "#3a2e22", "#15171a"][v % 3] });
  },
  runner(g, layer, s, c, v) { const sk = SKIN.runner, L = shade(sk, 1.25), D = shade(sk, .55), top = ["#6e3a33", "#34485a"][v % 2];
    if (layer === 0) { for (const sy of [-1, 1]) { const x = sy * -s * 8; Pp(g, rg(g, x, sy * 4.5, 7, "#3d3a35", "#191715"), TORN(x, sy * 4.5, 7.2, 3.1, v + sy + 4, .16)); Pp(g, rg(g, x + 7, sy * 4.5, 3, L, D), EL(x + 7.5, sy * 4.5, 3, 2.4)); } return; }
    if (layer === 1) { limb(g, [2, -8, 7 + c * 3, -14 - s * 3, 14 + s * 8, -15 + c * 5], 3.2, sk, L); limb(g, [2, 8, 7 - c * 3, 14 - s * 3, 14 - s * 8, 15 + c * 5], 3.2, sk, L);
      Pp(g, rg(g, 14 + s * 8, -15 + c * 5, 3, L, D), EL(14 + s * 8, -15 + c * 5, 2.6, 2.3)); Pp(g, rg(g, 14 - s * 8, 15 + c * 5, 3, L, D), EL(14 - s * 8, 15 + c * 5, 2.6, 2.3));
      Pp(g, rg(g, 1, -8.5, 4, L, D), EL(1, -8.6, 3.4, 2.8)); Pp(g, rg(g, 1, 8.5, 4, L, D), EL(1, 8.6, 3.4, 2.8));
      Pp(g, rg(g, 1, 0, 9.5, top, shade(top, .45)), TORN(1, 0, 6.4, 8.6, v + 2, .17)); g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = .9; g.beginPath(); for (let i = -2; i <= 2; i++) { g.moveTo(-2, i * 2.7); g.lineTo(5, i * 2.7); } g.stroke(); gel(g, "rgba(105,14,14,.85)", -1, 2, 2.6, 2); gel(g, "rgba(255,255,255,.16)", -1.5, -4, 2.6, 1.5, -.5); return; }
    zHead(g, 6, 5.8, sk, { open: 1, hair: 0 });
  },
  crawler(g, layer, s, c, v) { if (layer !== 1) return; const sk = SKIN.crawler, L = shade(sk, 1.25), D = shade(sk, .5);
    const q = g.createLinearGradient(-31, 0, -9, 0); q.addColorStop(0, "rgba(95,8,8,0)"); q.addColorStop(1, "rgba(95,8,8,.9)"); g.fillStyle = q; g.beginPath(); g.moveTo(-31, -2 + s); g.lineTo(-9, -5); g.lineTo(-9, 5); g.lineTo(-31, 3 - s); g.closePath(); g.fill(); // 身后的血痕
    Pp(g, "#5a0c0c", gg => { gg.moveTo(-8, -6); gg.lineTo(-16, -3 - s); gg.lineTo(-12, -1); gg.lineTo(-20, 2 + s); gg.lineTo(-13, 4); gg.lineTo(-8, 6); gg.closePath(); }, 1.6); limb(g, [-9, 0, -16, s], 1.6, "#d8d0b8");
    limb(g, [0, -6, 6, -13, 15 + s * 6, -9], 4.2, sk, L); limb(g, [0, 6, 6, 13, 15 - s * 6, 9], 4.2, sk, L); Pp(g, rg(g, 15 + s * 6, -9, 3, L, D), EL(15 + s * 6, -9, 3, 2.6)); Pp(g, rg(g, 15 - s * 6, 9, 3, L, D), EL(15 - s * 6, 9, 3, 2.6)); gel(g, "#5a0d0d", 16.5 + s * 6, -9, 1.4, 1.2); gel(g, "#5a0d0d", 16.5 - s * 6, 9, 1.4, 1.2);
    Pp(g, rg(g, -3, 0, 10, "#4a5258", "#1c2023"), TORN(-3, 0, 9, 7.2, v + 5, .17)); gel(g, "rgba(105,14,14,.85)", -6, 1, 3.2, 2.6); gel(g, "rgba(255,255,255,.12)", -4, -3, 3, 1.5, -.4);
    zHead(g, 8, 5.8, sk, { hair: "#15130f" });
  },
  spitter(g, layer, s, c, v) { const sk = SKIN.spitter, L = shade(sk, 1.25), D = shade(sk, .5);
    if (layer === 0) { for (const sy of [-1, 1]) { Pp(g, rg(g, -1 + sy * s, sy * 5.5, 6, "#454a2e", "#1c1f12"), EL(-1 + sy * s, sy * 5.5, 5.8, 3.8)); Pp(g, "#141618", EL(4 + sy * s, sy * 5.5, 3.2, 2.8)); } return; }
    if (layer === 1) { limb(g, [0, -11, 6, -13.5 + s], 4.4, sk, L); limb(g, [0, 11, 6, 13.5 - s], 4.4, sk, L);
      Pp(g, rg(g, 0, 0, 13, L, D), EL(0, 0, 8.8, 12.2)); Pp(g, rg(g, -2, 0, 9, "#565e36", "#22260f"), TORN(-2.5, 0, 4.4, 10, v + 1, .2)); gel(g, "rgba(40,72,40,.5)", 3, 6, 2.6, 2);
      for (const [x, y, r] of [[-5.5, -5, 3.6], [-6.5, 4, 4], [-3, 9.5, 2.8], [-2, -10, 2.6]]) { Pp(g, rg(g, x, y, r, "#f4ec9a", "#a39a2c"), EL(x, y, r, r), 1.3); gel(g, "rgba(255,255,255,.6)", x - r * .3, y - r * .35, r * .28, r * .2); }
      Pp(g, rg(g, 7, 0, 5, "#dcff88", "#5f9a1c"), EL(7, 0, 4.4 + Math.abs(s) * .8, 4.4 + Math.abs(s) * .8), 1.4); gel(g, "rgba(255,255,255,.5)", 5.6, -1.6, 1.4, .9); return; }
    zHead(g, 6, 6.2, sk, { open: 1, mouth: "#8fd838", hair: "#3a4a12" });
  },
  bloater(g, layer, s, c, v) { const sk = SKIN.bloater, L = shade(sk, 1.25), D = shade(sk, .45);
    if (layer === 0) { for (const sy of [-1, 1]) { Pp(g, rg(g, sy * -s * 3, sy * 10, 8, "#4c4a34", "#1c1b12"), EL(sy * -s * 3, sy * 10, 8.5, 6)); Pp(g, "#141618", EL(sy * -s * 3 + 7, sy * 10, 4, 3.6)); } return; }
    if (layer === 1) { limb(g, [4, -19, 15, -17.5 + s * 1.5], 7.4, sk, L); limb(g, [4, 19, 15, 17.5 - s * 1.5], 7.4, sk, L); Pp(g, rg(g, 16, -17 + s * 1.5, 4, L, D), EL(16.5, -17.5 + s * 1.5, 4, 3.6)); Pp(g, rg(g, 16, 17 - s * 1.5, 4, L, D), EL(16.5, 17.5 - s * 1.5, 4, 3.6));
      Pp(g, "#27351a", EL(0, 0, 21, 21)); // 肚子：三层渐变，越往里越亮
      let q = g.createRadialGradient(0, 0, 4, 0, 0, 21); q.addColorStop(0, sk); q.addColorStop(1, "rgba(39,53,26,0)"); gel(g, q, 0, 0, 20, 20);
      q = g.createRadialGradient(-3, -3, 1, -3, -3, 15); q.addColorStop(0, "#a9c86a"); q.addColorStop(1, "rgba(127,154,72,0)"); gel(g, q, -3, -3, 15, 15);
      q = g.createRadialGradient(-6, -6, 0, -6, -6, 9); q.addColorStop(0, "#e0f0a8"); q.addColorStop(1, "rgba(200,225,130,0)"); gel(g, q, -6, -6, 9, 9);
      g.strokeStyle = "rgba(24,44,10,.6)"; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-2, -2); g.quadraticCurveTo(7, -8, 13, -13); g.moveTo(-2, -2); g.quadraticCurveTo(-9, 7, -7, 16); g.moveTo(-2, -2); g.quadraticCurveTo(9, 4, 17, 7); g.moveTo(4, 2); g.quadraticCurveTo(6, 9, 3, 15); g.stroke();
      Pp(g, rg(g, 2, -17, 7, "#6a6850", "#2a2918"), gg => { for (let i = 0; i <= 8; i++) { const a = -2.5 + i / 8 * 1.5, k = i % 2 ? 21.5 : 17; gg.lineTo(Math.cos(a) * k, Math.sin(a) * k); } for (let i = 8; i >= 0; i--) { const a = -2.5 + i / 8 * 1.5; gg.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); } gg.closePath(); }, 1.3);
      Pp(g, rg(g, 2, 17, 7, "#6a6850", "#2a2918"), gg => { for (let i = 0; i <= 8; i++) { const a = 1.2 + i / 8 * 1.3, k = i % 2 ? 21.5 : 17.5; gg.lineTo(Math.cos(a) * k, Math.sin(a) * k); } for (let i = 8; i >= 0; i--) { const a = 1.2 + i / 8 * 1.3; gg.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); } gg.closePath(); }, 1.3);
      for (const [x, y, r] of [[-9, 8, 4.2], [4, 13, 3.6], [9, -11, 3.2], [-14, -4, 3], [12, 4, 2.8], [-2, -14, 2.4]]) { Pp(g, rg(g, x, y, r, "#f6ee9c", "#9c9a2a"), EL(x, y, r, r), 1.3); gel(g, "rgba(255,255,255,.65)", x - r * .3, y - r * .35, r * .3, r * .2); }
      gel(g, "rgba(255,255,255,.5)", -8.5, -9.5, 5.5, 2.6, -.65); gel(g, "rgba(255,255,255,.7)", -11, -6, 1.3, 1); return; }
    zHead(g, 17, 6.8, sk, { hair: 0, mouth: "#33400c" });
  },
  brute(g, layer, s, c, v, o) { o = o || { vest: "#3a4048", pad: "#23272c", cap: "#2a2f34", mark: "#9aa09a" }; const sk = o.skin || SKIN.brute, L = shade(sk, 1.25), D = shade(sk, .5);
    if (layer === 0) { for (const sy of [-1, 1]) { const x = sy * -s * 5; Pp(g, rg(g, x - 2, sy * 11, 9, "#2c3136", "#0e1012"), EL(x - 2, sy * 11, 9, 7)); Pp(g, rg(g, x + 6, sy * 11, 6, "#22252a", "#050606"), EL(x + 6, sy * 11, 7, 6)); } return; }
    if (layer === 1) { limb(g, [3, -22, 14, -21 + s * 2, 23, -15 + s * 3], 10, sk, L); limb(g, [3, 22, 14, 21 - s * 2, 23, 15 - s * 3], 10, sk, L);
      for (const sy of [-1, 1]) { const fx = 24, fy = sy * (15 - s * 3 * sy) * 1; Pp(g, rg(g, fx, sy * 15 - s * 3, 7, L, D), EL(fx, sy * 15 - s * 3 * 1, 7, 6.6)); gel(g, "#5a0d0d", fx + 3, sy * 15 - s * 3, 3, 3.4); }
      Pp(g, rg(g, 0, 0, 24, L, D), EL(0, 0, 14, 25)); Pp(g, rg(g, -1, 0, 18, o.vest, shade(o.vest, .35)), RR(-10, -16.5, 19.5, 33, 4)); g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 1.3; g.beginPath(); g.moveTo(-10, -5.5); g.lineTo(9.5, -5.5); g.moveTo(-10, 5.5); g.lineTo(9.5, 5.5); g.moveTo(0, -16.5); g.lineTo(0, 16.5); g.stroke();
      Pp(g, rg(g, -2, 10, 5, L, D), TORN(-2.5, 10, 4.6, 5.6, v + 4, .2), 1.3); Pp(g, o.mark, RR(2.5, -13.5, 5, 6, 1), 1.1); gel(g, "rgba(105,14,14,.85)", 3, 0, 5, 4, .4); gel(g, "rgba(105,14,14,.8)", -6, -9, 3, 4.5);
      for (const sy of [-1, 1]) { Pp(g, rg(g, 1, sy * 22, 9, shade(o.pad, 1.6), shade(o.pad, .5)), EL(1, sy * 22, 9.5, 7)); gel(g, "rgba(255,255,255,.3)", -2, sy * 22 - 2.5, 3.5, 1.6, -.3); gel(g, "#0a0b0c", 5, sy * 22, 1.1, 1.1); gel(g, "#0a0b0c", -3, sy * 22 + 2, 1.1, 1.1); }
      gel(g, "rgba(255,255,255,.16)", -5, -9, 4.5, 2.4, -.5); return; }
    zHead(g, 7, 7.8, sk, { hair: 0 }); Pp(g, rg(g, 5, 0, 9, shade(o.cap, 1.5), shade(o.cap, .5)), gg => { gg.arc(6, 0, 8.6, 1.25, 5.03); gg.closePath(); });
    if (o.cross) { g.fillStyle = "#b3261c"; g.fillRect(-1, -1.1, 5.5, 2.2); g.fillRect(.8, -3.2, 1.9, 6.4); } else { g.strokeStyle = "rgba(0,0,0,.7)"; g.lineWidth = 1.1; g.beginPath(); g.moveTo(0, -5); g.lineTo(3, -1); g.lineTo(1, 4); g.stroke(); gel(g, "rgba(140,190,200,.45)", 8, -5.5, 2.6, 1.6, .6); } gel(g, "rgba(255,255,255,.25)", 1, -4, 3, 1.6, -.6);
  },
  elite(g, l, s, c, v) { ART.brute(g, l, s, c, v, { vest: "#cdd6d0", pad: "#9aa69f", cap: "#eef1ef", mark: "#b3261c", cross: 1, skin: SKIN.elite }); },
  elite2(g, l, s, c, v) { ART.brute(g, l, s, c, v, { vest: "#3a2a2a", pad: "#5a1c18", cap: "#3a1512", mark: "#d9b52a" }); }
};
function sheet(type, v) { const key = type + "|" + v; let cv = SHEETS[key]; if (cv) return cv;
  cv = SHEETS[key] = document.createElement("canvas"); cv.width = cv.height = CS * 4; const g = cv.getContext("2d"), tmp = document.createElement("canvas"); tmp.width = tmp.height = CS; const tg = tmp.getContext("2d");
  for (let f = 0; f < 4; f++) { const s = [0, 1, 0, -1][f], c = [1, 0, -1, 0][f];
    for (let l = 0; l < 3; l++) { g.save(); g.beginPath(); g.rect(f * CS, l * CS, CS, CS); g.clip(); g.setTransform(SS, 0, 0, SS, f * CS + CS / 2, l * CS + CS / 2); ART[type](g, l, s, c, v); g.restore(); g.setTransform(1, 0, 0, 1, 0, 0); }
    tg.globalCompositeOperation = "source-over"; tg.clearRect(0, 0, CS, CS); for (let l = 0; l < 3; l++) tg.drawImage(cv, f * CS, l * CS, CS, CS, 0, 0, CS, CS); tg.globalCompositeOperation = "source-in"; tg.fillStyle = "#fff"; tg.fillRect(0, 0, CS, CS); g.drawImage(tmp, f * CS, 3 * CS); }
  return cv; }
function blit(c, sh, f, row, x, y, ang, sc, sx) { const d = 64 * sc; c.save(); c.translate(x, y); c.rotate(ang); if (sx) c.scale(sx, 1 / sx); c.drawImage(sh, f * CS, row * CS, CS, CS, -d / 2, -d / 2, d, d); c.restore(); }
/* 影子：椭圆，朝背光方向偏移并拉长 */
function shadow(c, x, y, r, ang, k) { c.save(); c.translate(x + Math.cos(ang) * r * .75 * k, y + Math.sin(ang) * r * .75 * k + r * .15); c.rotate(ang); c.fillStyle = "rgba(0,0,0,.5)"; c.beginPath(); c.ellipse(0, 0, r * (.95 + .65 * k), r * .62, 0, 0, TAU); c.fill(); c.restore(); }
function drawPlayer(c, pl, S) {
  const a = pl.va, sc = VS, sh = sheet("player", S.base), moving = Math.hypot(pl.mvx || 0, pl.mvy || 0) > .1, f = moving ? Math.floor(pl.walk / 1.5708) & 3 : 0, bob = (f & 1) * 1.3, sq = pl.dashT > 0 ? 1.22 : 0;
  shadow(c, pl.x, pl.y, 13, a + Math.PI, .9);
  blit(c, sh, f, 0, pl.x, pl.y, a, sc, sq);
  if (pl.hurtT > 0 && Math.sin(pl.hurtT * 60) > 0) blit(c, sh, f, 3, pl.x, pl.y - 6, a, sc, sq); else { blit(c, sh, f, 1, pl.x, pl.y - 6 - bob, a, sc, sq); blit(c, sh, f, 2, pl.x, pl.y - 12 - bob, a, sc, sq); }
  if (pl.flashT > 0 && !S.B.flame) { c.save(); c.translate(pl.x, pl.y - 6); c.rotate(a); c.scale(sc, sc); const x = MUZ(S.base), g = c.createRadialGradient(x + 6, 0, 0, x + 6, 0, 22); g.addColorStop(0, "rgba(255,250,220,1)"); g.addColorStop(.35, "rgba(255,190,70,.85)"); g.addColorStop(1, "rgba(255,120,20,0)"); c.fillStyle = g; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 13, -9); c.lineTo(x + 11, -2); c.lineTo(x + 30, 0); c.lineTo(x + 11, 2); c.lineTo(x + 13, 9); c.closePath(); c.fill(); c.restore(); }
}
function eKey(e) { return e.type === "elite" ? (e.look === "brute" ? "elite2" : "elite") : e.type; }
function drawEnemy(c, e, time, pl) {
  const E = e.E, r = e.r, fl = e.flash > 0, t = e.type;
  const tk = Math.floor(time * 9), tw = e.awake && h2(tk, (e.v * 997) | 0, 3) > .84 ? (h2(tk, 5, (e.v * 99) | 0) - .5) * .5 : 0, wob = Math.sin(e.walk * .5 + e.v * 9) * .13 + tw, jx = tw * 4;
  shadow(c, e.x, e.y, r, Math.atan2(e.y - pl.y, e.x - pl.x), t === "crawler" ? .3 : 1);
  if (t === "boss") { const k = r / 13, C = x => fl ? "#fff" : x; c.save(); c.translate(e.x, e.y - 6); c.rotate(e.ang); c.scale(k, k); c.lineCap = "round";
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.sin(time * 2 + i) * .3, p = [Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a + .5) * 18, Math.sin(a + .5) * 18, Math.cos(a + Math.sin(time * 3 + i) * .6) * 24, Math.sin(a + Math.sin(time * 3 + i) * .6) * 24]; for (const [col, w] of [[OUT, 5.4], [C("#5a3f6a"), 3.4]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(p[0], p[1]); c.quadraticCurveTo(p[2], p[3], p[4], p[5]); c.stroke(); } }
    Pp(c, fl ? "#fff" : rg(c, 0, 0, 12, "#e4e4ea", "#6a6a74"), EL(0, 0, 9, 11.5), 1.2); gel(c, C("#5a0d0d"), -2, 3, 4, 3); Pp(c, fl ? "#fff" : rg(c, 3, 0, 6, "#9a8aa6", "#3f3548"), EL(3, 0, 5.6, 5.6), 1.2); gel(c, C(`rgba(255,70,160,${.7 + Math.sin(time * 4) * .3})`), -1, 0, 4.5, 4.5); gel(c, C("#1a0606"), 7.2, 0, 1.2, 1.8); c.restore(); }
  else { const key = eKey(e), v = t === "walker" ? (e.v * 3) | 0 : t === "runner" ? (e.v * 2) | 0 : 0, sh = sheet(key, v), sc = r / AR[key] * (key === "bloater" || AR[key] === 25 ? 1.12 : VS), f = Math.floor(e.walk / 1.5708) & 3, bob = (f & 1) * 1.2 * sc, flat = t === "crawler";
    const up = e.st === "wind" && e.tele.type === "pound" ? 1 - e.w / e.tele.t : 0, cr = e.st === "wind" && e.tele.type === "leap" ? -5 : 0, bx = e.x + jx + Math.cos(e.ang) * cr, by = e.y + Math.sin(e.ang) * cr;
    if (fl) blit(c, sh, f, 3, bx, by - (flat ? 0 : 5 * sc), e.ang + wob, sc * (1 + up * .12));
    else { blit(c, sh, f, 0, e.x, e.y, e.ang, sc); blit(c, sh, f, 1, bx, by - (flat ? 0 : 6 * sc + bob), e.ang + wob * (flat ? .6 : 1), sc * (1 + up * .14)); blit(c, sh, f, 2, bx + jx * .5, by - (flat ? 0 : 12 * sc + bob + up * 3), e.ang + wob * 1.6, sc); }
    if (t === "spitter" && e.cd < .9 && !fl) { const ch = 1 - Math.max(0, e.cd) / .9; c.fillStyle = `rgba(200,255,110,${.5 + ch * .4})`; circ(c, e.x + Math.cos(e.ang) * 7 * sc, e.y - 6 * sc + Math.sin(e.ang) * 7 * sc, (3 + ch * 4.5) * sc); } }
  if (e.burn > 0) { c.fillStyle = "rgba(255,140,40,.5)"; circ(c, e.x, e.y - 6, r * .85); }
  if (e.slow > 0) { c.strokeStyle = "rgba(140,220,255,.8)"; c.lineWidth = 1.5; c.beginPath(); c.arc(e.x, e.y, r, 0, TAU); c.stroke(); }
  if (e.hp < e.maxhp && !E.elite) { const w = Math.max(20, r * 1.6); c.fillStyle = "rgba(0,0,0,.7)"; c.fillRect(e.x - w / 2 - 1, e.y - r - 21, w + 2, 4); c.fillStyle = "#b3261c"; c.fillRect(e.x - w / 2, e.y - r - 20, w * Math.max(0, e.hp / e.maxhp), 2); }
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
  for (const b of L.bul) { if (b.flame || b.gren || b.enemy) continue; const l = Math.hypot(b.vx, b.vy), k = (b.ex ? 16 : 46) / l, x0 = b.x - b.vx * k, y0 = b.y - b.vy * k, g = c.createLinearGradient(x0, y0, b.x, b.y), col = b.ex ? "255,140,50" : b.crit ? "255,240,170" : "255,205,110"; g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},.9)`);
    c.strokeStyle = g; c.lineWidth = b.ex ? 6 : 3.4; c.beginPath(); c.moveTo(x0, y0); c.lineTo(b.x, b.y); c.stroke(); c.strokeStyle = "rgba(255,255,240,.95)"; c.lineWidth = b.ex ? 2.4 : 1.1; c.beginPath(); c.moveTo(b.x - b.vx * k * .3, b.y - b.vy * k * .3); c.lineTo(b.x, b.y); c.stroke(); }
  if (pl.flashT > 0 && !S.B.flame) { const mx = pl.x + Math.cos(va) * 34, my = pl.y - 5 + Math.sin(va) * 34, g = c.createRadialGradient(mx, my, 0, mx, my, 150); g.addColorStop(0, "rgba(255,190,90,.38)"); g.addColorStop(1, "rgba(255,120,20,0)"); c.fillStyle = g; c.fillRect(mx - 150, my - 150, 300, 300); }
  for (const p of L.parts) if (p.glow) { c.globalAlpha = Math.min(1, p.life / p.max * 1.5); c.fillStyle = p.c; c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); } c.globalAlpha = 1;
  for (const f of L.fx) { const t = 1 - f.life / (f.max || .15);
    if (f.t === "arc") { c.strokeStyle = "#bfe8ff"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(f.x, f.y); for (let k = 1; k < 5; k++) c.lineTo(f.x + (f.x2 - f.x) * k / 5 + (Math.random() - .5) * 16, f.y + (f.y2 - f.y) * k / 5 + (Math.random() - .5) * 16); c.lineTo(f.x2, f.y2); c.stroke(); }
    else { c.globalAlpha = 1 - t; if (f.t === "boom") { const rr = f.r * (.35 + t * .75), g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, rr); g.addColorStop(0, "#fffbe0"); g.addColorStop(.3, f.c); g.addColorStop(.7, "rgba(160,40,10,.5)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; circ(c, f.x, f.y, rr); }
      c.strokeStyle = f.c; c.lineWidth = 4 * (1 - t) + 1; c.beginPath(); c.arc(f.x, f.y, f.r * t, 0, TAU); c.stroke(); c.globalAlpha = 1; } }
  c.globalCompositeOperation = "source-over";
  // 丧尸的眼睛是发光的红点：疯跑者和精英最亮，爬行者很暗
  for (const e of list) { if (e === pl || !e.awake || e.flash > 0) continue; const key = e.type === "boss" ? null : eKey(e), sc = key ? e.r / AR[key] * (key === "bloater" || AR[key] === 25 ? 1.12 : VS) : 1, ey = key ? EYE[key] : [e.r * .6, 2.6], bright = e.type === "runner" || e.E.elite, flat = e.type === "crawler";
    const col = e.type === "boss" ? "#ff4fa0" : e.E.elite ? "#ffb030" : "#ff2a1a", f = Math.floor(e.walk / 1.5708) & 3, hh = flat ? 0 : 12 * sc + (f & 1) * 1.2 * sc, hx = e.x + Math.cos(e.ang) * ey[0] * sc, hy = e.y - hh + Math.sin(e.ang) * ey[0] * sc, px = -Math.sin(e.ang) * ey[1] * sc, py = Math.cos(e.ang) * ey[1] * sc;
    c.globalAlpha = bright ? 1 : flat ? .3 : .6; c.fillStyle = col; if (bright) { c.shadowColor = col; c.shadowBlur = 7; } const q = bright ? 2.2 : 1.6; c.fillRect(hx + px - q / 2, hy + py - q / 2, q, q); c.fillRect(hx - px - q / 2, hy - py - q / 2, q, q); c.shadowBlur = 0; } c.globalAlpha = 1;
  for (const d of L.drops) if (d.t === "item" && vis(d.x, d.y, 40)) { const col = YJ.RAR[d.it.rar].c, g = c.createLinearGradient(0, d.y - 70, 0, d.y); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, col); c.fillStyle = g; c.globalAlpha = .5 + Math.sin(time * 5) * .2; c.fillRect(d.x - 1.5, d.y - 70, 3, 70); c.globalAlpha = 1; if (d.it.rar >= 1) { c.font = "700 10px monospace"; c.textAlign = "center"; c.fillStyle = col; c.fillText(YJ.itemName(d.it), d.x, d.y - 74); } }
  c.textAlign = "center"; for (const n of L.nums) { c.globalAlpha = Math.min(1, n.life * 2.5); c.font = `800 ${n.crit ? 16 : 11}px monospace`; c.fillStyle = n.crit ? "#ffcf3a" : "#e8e4d8"; c.strokeStyle = "rgba(0,0,0,.85)"; c.lineWidth = 3; c.strokeText(n.v, n.x, n.y); c.fillText(n.v, n.x, n.y); } c.globalAlpha = 1;
  if (pl.rel > 0) { c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 5; c.beginPath(); c.arc(pl.x, pl.y - 34, 9, 0, TAU); c.stroke(); c.strokeStyle = "#39d98a"; c.lineWidth = 3; c.beginPath(); c.arc(pl.x, pl.y - 34, 9, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - pl.rel / pl.relMax)); c.stroke(); }
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
