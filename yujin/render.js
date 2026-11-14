/* 余烬·尸潮 — 画面：地形预渲染、带遮挡的手电光照、角色与丧尸、特效、小地图 */
(function () {
"use strict";
const T = YJ.TILE, WH = 24, TAU = Math.PI * 2, G = YJ.G;
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
      if (at(x, y - 1) === 1) sh(0, py, 0, py + 22, [px, py, T, 22]); if (at(x - 1, y) === 1) sh(px, 0, px + 12, 0, [px, py, 12, T]); if (at(x + 1, y) === 1) sh(px + T, 0, px + T - 12, 0, [px + T - 12, py, 12, T]);
    }
    if (v === 1) { let near = false; for (let oy = -2; oy <= 2 && !near; oy++) for (let ox = -1; ox <= 1; ox++) if (at(x + ox, y + oy) !== 1) { near = true; break; } if (!near) continue;
      if (at(x, y + 1) !== 1) { // —— 墙的正面：金属板、管道、通风口 ——
        const fy = py + T - WH, gr = c.createLinearGradient(0, fy, 0, py + T); gr.addColorStop(0, shade(th.wall, 1.05)); gr.addColorStop(1, shade(th.wall, .45)); c.fillStyle = gr; c.fillRect(px, fy, T, WH);
        c.fillStyle = "rgba(0,0,0,.4)"; c.fillRect(px, fy, 1, WH); c.fillRect(px, py + T - 3, T, 3);
        if (n > .78) { c.fillStyle = "#07090a"; c.fillRect(px + 8, fy + 5, 24, 12); c.fillStyle = shade(th.wall, .8); for (let k = 0; k < 4; k++) c.fillRect(px + 8, fy + 6 + k * 3, 24, 1.2); }
        else { c.fillStyle = shade(th.pipe, .55); c.fillRect(px, fy + 5, T, 5); c.fillStyle = shade(th.pipe, 1.1); c.fillRect(px, fy + 5, T, 1.6); c.fillStyle = shade(th.pipe, .35); c.fillRect(px, fy + 9, T, 1);
          c.fillStyle = "#4a2f1c"; c.fillRect(px, fy + 14, T, 2.4); c.fillStyle = "#7a4d2a"; c.fillRect(px, fy + 14, T, .9);
          if (x % 3 === 0) { c.fillStyle = shade(th.pipe, .8); c.fillRect(px + 16, fy + 3.5, 5, 8); c.fillStyle = "rgba(0,0,0,.5)"; c.fillRect(px + 20, fy + 3.5, 1, 8); } }
        if (n < .07) { c.fillStyle = "#3a0a08"; c.fillRect(px + 16, fy + 1, 8, 4); Rn.reds.push({ x: px + 20, y: fy + 3, f: n * 90 }); }
        if (n2 > .86) { c.fillStyle = "rgba(80,8,8,.6)"; c.fillRect(px + n * 24, fy + 3, 5 + n2 * 4, WH - 4); el(c, px + n * 24 + 3, fy + 5, 6, 3); } }
      tc.fillStyle = n < .5 ? th.top : shade(th.top, .9); tc.fillRect(px, py - WH, T, T);
      tc.fillStyle = "rgba(255,255,255,.035)"; tc.fillRect(px + 3, py - WH + 3, T - 6, T - 6); tc.fillStyle = "rgba(0,0,0,.35)"; tc.fillRect(px, py - WH, T, 1); tc.fillRect(px, py - WH, 1, T);
      tc.strokeStyle = "rgba(0,0,0,.8)"; tc.lineWidth = 2; tc.beginPath();
      if (at(x, y - 1) !== 1) { tc.moveTo(px, py - WH + 1); tc.lineTo(px + T, py - WH + 1); } if (at(x - 1, y) !== 1) { tc.moveTo(px + 1, py - WH); tc.lineTo(px + 1, py + T - WH); } if (at(x + 1, y) !== 1) { tc.moveTo(px + T - 1, py - WH); tc.lineTo(px + T - 1, py + T - WH); } tc.stroke();
      if (at(x, y + 1) !== 1) { tc.fillStyle = "rgba(255,255,255,.16)"; tc.fillRect(px, py + T - WH - 2, T, 2); }
    }
    if (v === 3) prop(c, tc, px, py, th.prop, n, th);
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
  c.fillStyle = big && d.type === "brute" ? "#1f2327" : cl; el(c, 0, 0, r * .95, r * .7); c.fillStyle = "rgba(70,6,6,.7)"; el(c, r * (v - .5) * .8, r * (.5 - v) * .6, r * .4, r * .3);
  c.strokeStyle = sk; c.lineWidth = r * (big ? .34 : .25); c.beginPath(); c.moveTo(r * .3, -r * .6); c.lineTo(r * (.7 + v * .4), -r * 1.2 + tw * r * 3); c.moveTo(r * .3, r * .6); c.lineTo(r * 1.25, r * (.6 + v * .5) - tw * r * 3); c.stroke();
  c.fillStyle = sk; circ(c, r * 1.0, r * .1, r * (big ? .34 : .42)); c.fillStyle = "rgba(60,5,5,.8)"; circ(c, r * 1.05, r * .0, r * .16);
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

/* ---------- 角色：分层画（脚在地面、身体和头依次抬高），带一点 2.5D 的立体感 ---------- */
function lay(c, x, y, h, ang, k) { c.save(); c.translate(x, y - h); c.rotate(ang); c.scale(k, k); c.lineCap = "round"; }
function drawPlayer(c, pl, S) {
  const a = pl.va, sw = Math.sin(pl.walk) * 5, sq = pl.dashT > 0;
  c.fillStyle = "rgba(0,0,0,.5)"; el(c, pl.x + 3, pl.y + 6, 14, 8);
  lay(c, pl.x, pl.y, 0, a, 1); if (sq) c.scale(1.25, .8); c.fillStyle = "#15181b"; el(c, sw - 2, -5, 6.5, 3.6); el(c, -sw - 2, 5, 6.5, 3.6); c.restore();
  lay(c, pl.x, pl.y, 5, a, 1); if (sq) c.scale(1.25, .8);
  c.fillStyle = "#2a3326"; c.fillRect(-14, -7, 8, 14); c.fillStyle = "#1c231a"; c.fillRect(-14, -1, 8, 2); // 背包
  c.fillStyle = pl.hurtT > 0 ? "#a84444" : "#3c4a38"; el(c, 0, 0, 9, 12.5); c.fillStyle = "#23291f"; c.fillRect(-5, -8, 10, 16); c.fillStyle = "#4c5a44"; c.fillRect(-3, -6, 3, 4); c.fillRect(-3, 2, 3, 4); // 战术背心
  c.strokeStyle = "#3c4a38"; c.lineWidth = 5.4; c.beginPath(); c.moveTo(2, -11); c.lineTo(13, -3); c.moveTo(2, 11); c.lineTo(10, 3); c.stroke();
  const b = S.base, len = { pistol: 9, smg: 14, shotgun: 19, rifle: 21, sniper: 26, flamer: 20, launcher: 18 }[b]; c.fillStyle = "#0c0d0f"; c.fillRect(9, -2.5, len, b === "launcher" ? 7 : 5); c.fillStyle = b === "flamer" ? "#8a3f20" : "#2c2f33"; c.fillRect(9, -2.5, 6, 5); c.fillStyle = "#e8f4ff"; c.fillRect(9 + len - 4, 2.5, 3, 2); // 枪灯
  if (pl.flashT > 0 && !S.B.flame) { const x = 9 + len, g = c.createRadialGradient(x + 6, 0, 0, x + 6, 0, 22); g.addColorStop(0, "rgba(255,250,220,1)"); g.addColorStop(.35, "rgba(255,190,70,.8)"); g.addColorStop(1, "rgba(255,120,20,0)"); c.fillStyle = g; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 14, -9); c.lineTo(x + 12, -2); c.lineTo(x + 30, 0); c.lineTo(x + 12, 2); c.lineTo(x + 14, 9); c.closePath(); c.fill(); }
  c.fillStyle = "#1a1c1e"; circ(c, 13, -2, 2.8); circ(c, 11, 3, 2.8); c.restore();
  lay(c, pl.x, pl.y, 10, a, 1); c.fillStyle = "#3a4634"; circ(c, 1, 0, 6.8); c.fillStyle = "#2a3326"; c.beginPath(); c.arc(1, 0, 6.8, 1.4, 4.9); c.fill(); c.fillStyle = "#151a14"; c.fillRect(4.5, -4, 2.5, 8); c.fillStyle = "#7fd0c0"; c.fillRect(6, -3, 1.4, 2); c.fillRect(6, 1, 1.4, 2); c.restore();
}
function drawBig(c, e, time, C, sw, wob, o) { // 巨尸 / 护士长
  const k = e.r / 27, skin = C(e.E.skin), up = e.st === "wind" && e.tele.type === "pound" ? 1 - e.w / e.tele.t : 0;
  lay(c, e.x, e.y, 0, e.ang, k); c.fillStyle = C("#17191c"); el(c, sw * 5, -10, 9, 6); el(c, -sw * 5, 10, 9, 6); c.restore();
  lay(c, e.x, e.y, 6 * k, e.ang + wob * .5, k);
  c.fillStyle = skin; el(c, 0, 0, 13, 24); c.fillStyle = C(o.vest); c.fillRect(-9, -15, 17, 30); c.fillStyle = "rgba(0,0,0,.3)"; c.fillRect(-9, -5, 17, 1.5); c.fillRect(-9, 5, 17, 1.5); c.fillRect(-1, -15, 1.5, 30);
  c.fillStyle = skin; el(c, -3, 9, 4, 6, .4); c.fillStyle = C("#5a0d0d"); el(c, 2, -8, 5, 4, e.v * 3); el(c, -5, 2, 3, 5); c.fillStyle = C(o.mark); c.fillRect(-7, -3, 3, 6);
  c.fillStyle = C(o.pad); el(c, 1, -21, 8, 6); el(c, 1, 21, 8, 6);
  const fx = 21 - up * 12, fr = 6.5 + up * 4.5; c.strokeStyle = skin; c.lineWidth = 9; c.beginPath(); c.moveTo(3, -21); c.lineTo(fx, -14 + sw * 2); c.moveTo(3, 21); c.lineTo(fx, 14 - sw * 2); c.stroke(); c.fillStyle = C("#55605a"); circ(c, fx, -14 + sw * 2, fr); circ(c, fx, 14 - sw * 2, fr); c.fillStyle = C("#4a0a0a"); circ(c, fx + 2, -14 + sw * 2, fr * .5); circ(c, fx + 2, 14 - sw * 2, fr * .5);
  c.restore();
  lay(c, e.x, e.y, 13 * k, e.ang + wob, k); c.fillStyle = skin; circ(c, 6, 0, 7); c.fillStyle = C(o.cap); c.beginPath(); c.arc(5, 0, 7.5, 1.3, 5); c.fill(); if (o.cross) { c.fillStyle = C("#a8281e"); c.fillRect(-1, -1, 5, 2); c.fillRect(1, -3, 1.6, 6); } else { c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -4); c.lineTo(3, 0); c.lineTo(1, 4); c.stroke(); }
  c.fillStyle = C("#1a0606"); c.fillRect(11, -2, 2.4, 4); c.restore();
}
function drawEnemy(c, e, time) {
  const E = e.E, r = e.r, fl = e.flash > 0, C = x => fl ? "#fff" : x, skin = C(E.skin), cl = C(e.cloth), dk = C("#17191c"), bl = C("#5a0d0d");
  const sw = Math.sin(e.walk), cw = Math.cos(e.walk), tk = Math.floor(time * 9), tw = e.awake && h2(tk, (e.v * 997) | 0, 3) > .84 ? (h2(tk, 5, (e.v * 99) | 0) - .5) * .5 : 0, wob = Math.sin(e.walk * .5 + e.v * 9) * .13 + tw, jx = tw * 4;
  c.fillStyle = "rgba(0,0,0,.5)"; el(c, e.x + 3, e.y + r * .4, r * 1.05, r * .6);
  const t = e.type;
  if (t === "walker") { const k = r / 13;
    lay(c, e.x, e.y, 0, e.ang, k); c.fillStyle = dk; el(c, sw * 4 - 1, -5, 5, 3); c.translate(-5 + Math.min(0, sw) * 2.5, 5.5); c.rotate(.5); el(c, 0, 0, 7, 2.6); c.restore(); // 一条腿拖着
    lay(c, e.x + jx, e.y, 4 * k, e.ang + wob, k); c.fillStyle = cl; el(c, 0, 0, 7.5, 11.5); c.fillStyle = skin; el(c, -4, 7 + e.v * 2, 2.5, 3); el(c, 1, -9, 2, 2.5); c.fillStyle = bl; el(c, -2 + e.v * 5, -4 + e.v * 7, 3.6, 2.7); el(c, 3, 5 - e.v * 6, 2, 2.8);
    c.strokeStyle = C("#2a0505"); c.lineWidth = 1; c.setLineDash([1.2, 1.2]); c.beginPath(); c.arc(-3, 3 - e.v * 8, 2.6, 0, TAU); c.stroke(); c.setLineDash([]);
    c.strokeStyle = skin; c.lineWidth = 3.4; c.beginPath(); c.moveTo(2, -10); c.lineTo(9, -9 + sw); c.lineTo(16, -5 + sw * 2.5); c.moveTo(2, 10); c.lineTo(8, 9 - sw); c.lineTo(14, 5 - sw * 2.5); c.stroke(); c.fillStyle = C("#4a0a0a"); circ(c, 16, -5 + sw * 2.5, 2.3); circ(c, 14, 5 - sw * 2.5, 2.3); c.restore();
    lay(c, e.x + jx * 1.5, e.y, 8 * k, e.ang + wob * 1.6, k); c.fillStyle = skin; circ(c, 4, 0, 5.5); c.fillStyle = C("#262019"); c.beginPath(); c.arc(3.2, 0, 5.4, 1.8, 4.5); c.fill(); c.fillStyle = bl; el(c, 5, -3 + e.v * 5, 1.8, 1.3); c.fillStyle = C("#1a0606"); c.fillRect(8, -1.6, 2, 3.2); c.restore(); }
  else if (t === "runner") { const k = r / 10;
    lay(c, e.x, e.y, 0, e.ang, k); c.fillStyle = dk; el(c, sw * 6, -3.5, 5, 2.2); el(c, -sw * 6, 3.5, 5, 2.2); c.restore();
    lay(c, e.x + jx, e.y, 3 * k, e.ang + wob, k); c.fillStyle = cl; el(c, 1, 0, 5, 7.5); c.strokeStyle = C("rgba(0,0,0,.35)"); c.lineWidth = .8; c.beginPath(); for (let i = -2; i <= 2; i++) { c.moveTo(-2, i * 2.6); c.lineTo(4, i * 2.6); } c.stroke(); c.fillStyle = bl; el(c, -1, e.v * 6 - 3, 2.2, 1.8);
    c.strokeStyle = skin; c.lineWidth = 2.3; c.beginPath(); c.moveTo(2, -7); c.lineTo(6 + cw * 3, -12 - sw * 3); c.lineTo(11 + sw * 7, -13 + cw * 5); c.moveTo(2, 7); c.lineTo(6 - cw * 3, 12 - sw * 3); c.lineTo(11 - sw * 7, 13 + cw * 5); c.stroke(); c.restore();
    lay(c, e.x + jx * 1.5, e.y, 7 * k, e.ang + wob * 2, k); c.fillStyle = skin; circ(c, 5, 0, 4.6); c.fillStyle = C("#3a0505"); circ(c, 8, 0, 2.6); c.fillStyle = C("#ff2a1a"); c.fillRect(6, -3.4, 1.7, 1.7); c.fillRect(6, 1.7, 1.7, 1.7); c.restore(); }
  else if (t === "crawler") { const k = r / 10, cr = e.st === "wind" ? -4 : 0;
    lay(c, e.x + jx, e.y, 0, e.ang + wob * .6, k); c.translate(cr, 0); c.fillStyle = C("#4a0808"); c.beginPath(); c.moveTo(-9, -5); c.lineTo(-17, -2 - sw); c.lineTo(-12, 0); c.lineTo(-19, 3 + sw); c.lineTo(-9, 5); c.fill();
    c.fillStyle = C(shade(e.cloth, .8)); el(c, -3, 0, 8, 6); c.fillStyle = bl; el(c, -6, 1, 3, 2.4);
    const sk = C(shade(E.skin, .85)); c.strokeStyle = sk; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -5); c.lineTo(5, -11); c.lineTo(13 + sw * 5, -8); c.moveTo(0, 5); c.lineTo(5, 11); c.lineTo(13 - sw * 5, 8); c.stroke(); c.fillStyle = C("#3a0808"); circ(c, 13 + sw * 5, -8, 2); circ(c, 13 - sw * 5, 8, 2);
    c.fillStyle = sk; circ(c, 7, 0, 4.8); c.fillStyle = C("#1f1a15"); c.beginPath(); c.arc(6.4, 0, 4.7, 1.8, 4.5); c.fill(); c.fillStyle = C("#1a0606"); c.fillRect(10, -1.5, 2, 3); c.restore(); }
  else if (t === "bloater") { const k = r / 24, pu = 1 + Math.sin(time * 3 + e.v * 9) * .035, p = .55 + Math.sin(time * 5 + e.v * 9) * .3;
    lay(c, e.x, e.y, 0, e.ang, k); c.fillStyle = dk; el(c, sw * 3, -9, 7, 5); el(c, -sw * 3, 9, 7, 5); c.restore();
    lay(c, e.x, e.y, 5 * k, e.ang + wob * .5, k * pu);
    c.strokeStyle = skin; c.lineWidth = 6; c.beginPath(); c.moveTo(4, -18); c.lineTo(16, -14 + sw); c.moveTo(4, 18); c.lineTo(16, 14 - sw); c.stroke();
    if (fl) c.fillStyle = "#fff"; else { const g = c.createRadialGradient(-5, -6, 2, 0, 0, 21); g.addColorStop(0, "#c2d68a"); g.addColorStop(.45, E.skin); g.addColorStop(1, "#2f4018"); c.fillStyle = g; } circ(c, 0, 0, 20);
    c.strokeStyle = cl; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 17, -2.4, -1.2); c.stroke(); c.beginPath(); c.arc(0, 0, 17, 1.3, 2.3); c.stroke();
    c.strokeStyle = C("rgba(30,50,10,.5)"); c.lineWidth = 1; c.beginPath(); c.moveTo(-2, -2); c.quadraticCurveTo(6, -8, 12, -12); c.moveTo(-2, -2); c.quadraticCurveTo(-8, 6, -6, 15); c.moveTo(-2, -2); c.quadraticCurveTo(8, 4, 15, 6); c.stroke();
    c.fillStyle = C(`rgba(225,215,90,${p})`); circ(c, -8, -9, 4); circ(c, -11, 5, 3.2); circ(c, 3, 12, 3.6); circ(c, 6, -13, 2.6); c.fillStyle = "rgba(255,255,255,.3)"; el(c, -7, -9, 6, 3, -.6); c.restore();
    lay(c, e.x, e.y, 11 * k, e.ang + wob, k); c.fillStyle = skin; circ(c, 15, 0, 6.5); c.fillStyle = C("#1a0606"); c.fillRect(19, -2, 2.4, 4); c.fillStyle = bl; el(c, 14, -3, 2.4, 1.6); c.restore(); }
  else if (t === "spitter") { const k = r / 13, ch = Math.max(0, Math.min(1, 1 - e.cd / .9));
    lay(c, e.x, e.y, 0, e.ang, k); c.fillStyle = dk; el(c, -1, -5, 4.5, 3); el(c, -1, 5, 4.5, 3); c.restore();
    lay(c, e.x + jx, e.y, 4 * k, e.ang + wob * .5, k); c.strokeStyle = skin; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -10); c.lineTo(5, -12); c.moveTo(0, 10); c.lineTo(5, 12); c.stroke();
    c.fillStyle = skin; el(c, 0, 0, 7.5, 10.5); c.fillStyle = cl; c.globalAlpha = .7; el(c, -2, 0, 3.5, 9); c.globalAlpha = 1;
    c.fillStyle = C("#d4cc62"); circ(c, -5, -4, 3); circ(c, -6, 3, 3.4); circ(c, -3, 7.5, 2.4); circ(c, -2, -8, 2.2); c.fillStyle = "rgba(255,255,255,.35)"; circ(c, -5.6, -4.8, 1); circ(c, -6.6, 2.2, 1.1);
    c.fillStyle = C(`rgba(150,${200 + ch * 55 | 0},70,${.7 + ch * .3})`); circ(c, 5.5, 0, 3.5 + ch * 3.8); c.restore();
    lay(c, e.x + jx, e.y, 8 * k, e.ang + wob, k); c.fillStyle = skin; circ(c, 5, 0, 5.2); c.fillStyle = C("#b8ff50"); circ(c, 9, 0, 2 + ch * 1.4); c.fillStyle = C("#3a4a12"); c.beginPath(); c.arc(4.4, 0, 5.1, 1.9, 4.4); c.fill(); c.restore(); }
  else if (t === "brute") drawBig(c, e, time, C, sw, wob, { vest: "#2b3036", pad: "#1d2024", cap: "#1f2326", mark: "#8a8f8a" });
  else if (t === "elite") drawBig(c, e, time, C, sw, wob, { vest: e.cloth, pad: "#8f9a94", cap: "#e4e8e6", mark: "#a8281e", cross: 1 });
  else { const k = r / 13; lay(c, e.x, e.y, 6, e.ang, k); // 零号
    c.strokeStyle = fl ? "#fff" : "#4a3458"; c.lineWidth = 3.5; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.sin(time * 2 + i) * .3; c.beginPath(); c.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); c.quadraticCurveTo(Math.cos(a + .5) * 18, Math.sin(a + .5) * 18, Math.cos(a + Math.sin(time * 3 + i) * .6) * 24, Math.sin(a + Math.sin(time * 3 + i) * .6) * 24); c.stroke(); }
    c.fillStyle = cl; el(c, 0, 0, 9, 11.5); c.fillStyle = bl; el(c, -2, 3, 4, 3); c.fillStyle = skin; circ(c, 3, 0, 5.6); c.fillStyle = C(`rgba(255,70,160,${.7 + Math.sin(time * 4) * .3})`); circ(c, -1, 0, 4.5); c.fillStyle = C("#1a0606"); c.fillRect(6, -1.5, 2.4, 3); c.restore(); }
  if (e.burn > 0) { c.fillStyle = "rgba(255,140,40,.5)"; circ(c, e.x, e.y - 4, r * .85); }
  if (e.slow > 0) { c.strokeStyle = "rgba(140,220,255,.8)"; c.lineWidth = 1.5; c.beginPath(); c.arc(e.x, e.y, r, 0, TAU); c.stroke(); }
  if (e.hp < e.maxhp && !E.elite) { const w = Math.max(20, r * 1.6); c.fillStyle = "rgba(0,0,0,.7)"; c.fillRect(e.x - w / 2 - 1, e.y - r - 15, w + 2, 4); c.fillStyle = "#b3261c"; c.fillRect(e.x - w / 2, e.y - r - 14, w * Math.max(0, e.hp / e.maxhp), 2); }
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
  { const e = L.exit, open = L.objDone, p = .6 + Math.sin(time * 4) * .3, col = open ? "#39d98a" : "#b3261c"; c.save(); c.translate(e.x, e.y); c.fillStyle = open ? `rgba(57,217,138,${.2 * p})` : "rgba(179,38,28,.15)"; c.fillRect(-32, -32, 64, 64); c.strokeStyle = col; c.lineWidth = 2.5; const q = 32, n = 12; c.beginPath(); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.moveTo(a * q, b * (q - n)); c.lineTo(a * q, b * q); c.lineTo(a * (q - n), b * q); } c.stroke();
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
  for (const e of list) e === pl ? drawPlayer(c, pl, S) : drawEnemy(c, e, time);
  // 手雷、酸液弹（抛物线）
  for (const b of L.bul) {
    if (b.gren) { c.fillStyle = "rgba(0,0,0,.4)"; el(c, b.x + 2, b.y + 4, 5, 3); const h = Math.sin(Math.min(1, b.life / .75) * Math.PI) * 14; c.fillStyle = "#2a3324"; circ(c, b.x, b.y - h, 5); c.fillStyle = "#ff4020"; c.fillRect(b.x - 1, b.y - h - 1, 2, 2); }
    else if (b.enemy) { const h = b.acid ? Math.sin((1 - b.life / b.max) * Math.PI) * 26 : 0; if (b.acid) { c.fillStyle = "rgba(0,0,0,.35)"; el(c, b.x, b.y, 6, 3.5); } c.fillStyle = "rgba(150,240,60,.35)"; circ(c, b.x, b.y - h, 9); c.fillStyle = "#b8f050"; circ(c, b.x, b.y - h, 4.5); } }
  if (sw > 0 && shh > 0) c.drawImage(Rn.top, sx, sy, sw, shh, sx, sy, sw, shh);
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
  glow(L.exit.x, L.exit.y, 100, .45);
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
  // 黑暗里只有疯跑者和首领的眼睛发红光
  for (const e of list) { if (e === pl || !e.awake || !(e.type === "runner" || e.E.elite)) continue; const col = e.type === "boss" ? "#ff4fa0" : e.E.elite ? "#ffb030" : "#ff2a1a"; c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 7; const hh = e.type === "runner" ? 7 : 12, hx = e.x + Math.cos(e.ang) * e.r * .62, hy = e.y - hh + Math.sin(e.ang) * e.r * .62, px = -Math.sin(e.ang) * 2.6, py = Math.cos(e.ang) * 2.6; c.fillRect(hx + px - 1, hy + py - 1, 2, 2); c.fillRect(hx - px - 1, hy - py - 1, 2, 2); } c.shadowBlur = 0;
  for (const d of L.drops) if (d.t === "item" && vis(d.x, d.y, 40)) { const col = YJ.RAR[d.it.rar].c, g = c.createLinearGradient(0, d.y - 70, 0, d.y); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, col); c.fillStyle = g; c.globalAlpha = .5 + Math.sin(time * 5) * .2; c.fillRect(d.x - 1.5, d.y - 70, 3, 70); c.globalAlpha = 1; if (d.it.rar >= 1) { c.font = "700 10px monospace"; c.textAlign = "center"; c.fillStyle = col; c.fillText(YJ.itemName(d.it), d.x, d.y - 74); } }
  c.textAlign = "center"; for (const n of L.nums) { c.globalAlpha = Math.min(1, n.life * 2.5); c.font = `800 ${n.crit ? 16 : 11}px monospace`; c.fillStyle = n.crit ? "#ffcf3a" : "#e8e4d8"; c.strokeStyle = "rgba(0,0,0,.85)"; c.lineWidth = 3; c.strokeText(n.v, n.x, n.y); c.fillText(n.v, n.x, n.y); } c.globalAlpha = 1;
  if (pl.rel > 0) { c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 5; c.beginPath(); c.arc(pl.x, pl.y - 34, 9, 0, TAU); c.stroke(); c.strokeStyle = "#39d98a"; c.lineWidth = 3; c.beginPath(); c.arc(pl.x, pl.y - 34, 9, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - pl.rel / pl.relMax)); c.stroke(); }
  // 屏幕层：色调、雨、暗角、受伤泛红
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = th.tint; c.fillRect(0, 0, W, H);
  if (th.rain) { c.strokeStyle = "rgba(150,190,180,.16)"; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 46; i++) { const x = (h2(i, 1, 7) * (W + 200) + time * 240 * (.6 + h2(i, 2, 7))) % (W + 200) - 100, y = (h2(i, 3, 7) * H + time * 900 * (.7 + h2(i, 4, 7) * .5)) % H; c.moveTo(x, y); c.lineTo(x - 5, y + 16); } c.stroke(); }
  if (!Rn.vg || Rn.vgW !== W || Rn.vgH !== H) { Rn.vgW = W; Rn.vgH = H; Rn.vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .72); Rn.vg.addColorStop(0, "rgba(0,0,0,0)"); Rn.vg.addColorStop(1, "rgba(0,0,0,.75)"); }
  c.fillStyle = Rn.vg; c.fillRect(0, 0, W, H);
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
  dot(L.exit.x, L.exit.y, L.objDone ? "#4de38a" : "#b03030", 6);
  for (const e of L.en) if (e.awake && Math.hypot(e.x - pl.x, e.y - pl.y) < 420) dot(e.x, e.y, "#e03a30", 2.5);
  dot(pl.x, pl.y, "#d8ffe8", 4.5);
};
})();
