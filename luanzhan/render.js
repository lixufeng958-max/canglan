/* 地图渲染（写实地形）：按海拔着色 + 光照起伏 + 雪顶，森林树冠、沼泽水洼、河流海岸，城池按民风与人口画出贫富强弱 */
(function (root) {
"use strict";
const { TERR, TRAITS, WORLD, RW, CELL, h2, fbm, MT, terrainFns, UNITS } = root.LZ;
const TEX = 1000, TS = WORLD / TEX, INK = 1600, FOG = 500;
const UIF = '"Noto Serif SC","Songti SC","STSong",serif';
const NUMF = '"Noto Serif SC",ui-rounded,-apple-system,sans-serif';
const TRAITCOL = { rich: "#E0B13F", fertile: "#7FBF4A", strong: "#D9483B", barren: "#A89B86", fort: "#8FA3B5", ruin: "#6E635A" };
const DARK = "#1A1A1C";

function hexRGB(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

function Renderer(canvas, sim, me) {
  this.cv = canvas; this.ctx = canvas.getContext("2d"); this.sim = sim; this.me = me;
  this.cam = { x: 500, y: 500, z: 1 }; this.hl = { regions: null, armies: null, sel: null, mark: null };
  this.shake = 0; this.key = ""; this.lastFx = new Set();
  this.buildStatic();
  { const ras = sim.map.ras; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let k = 0; k < ras.length; k++) if (ras[k] !== 255) { const i = k % RW, j = (k - i) / RW; x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
    const pad = 70; this.bb = { x0: Math.max(0, x0 * CELL - pad), y0: Math.max(0, y0 * CELL - pad), x1: Math.min(WORLD, (x1 + 1) * CELL + pad), y1: Math.min(WORLD, (y1 + 1) * CELL + pad) }; }
  this.tex = document.createElement("canvas"); this.tex.width = TEX; this.tex.height = TEX;
  this.tctx = this.tex.getContext("2d"); this.img = this.tctx.createImageData(TEX, TEX);
  this.fog = document.createElement("canvas"); this.fog.width = FOG; this.fog.height = FOG;
  this.fctx = this.fog.getContext("2d"); this.fimg = this.fctx.createImageData(FOG, FOG);
  this.buildBorders();
  this.buildInk();
  this.bindInput();
  if (document.fonts) { const clr = () => { if (this.sp) this.sp.clear(); }; document.fonts.ready.then(clr); document.fonts.addEventListener && document.fonts.addEventListener("loadingdone", clr, { signal: this.ac.signal }); }
  const cap = sim.map.regions[sim.P[me].capital];
  this.resize(); this.cam.x = cap.x; this.cam.y = cap.y; this.cam.z = this.fitZ() * 1.5; this.clamp();
}

/* ---------- 静态图层：区域栅格、海拔、光照、底色（只算一次） ---------- */
Renderer.prototype.buildStatic = function () {
  const sim = this.sim, seed = sim.cfg.seed, ras = sim.map.ras, N = TEX * TEX, regs = sim.map.regions, riv = sim.map.riv;
  const T = terrainFns(seed);
  const rid = new Uint8Array(N), elev = new Float32Array(N), mtv = new Float32Array(N), canopy = new Float32Array(N), wat = new Uint8Array(N), landv = new Float32Array(N);
  for (let j = 0; j < TEX; j++) for (let i = 0; i < TEX; i++) {
    const x = (i + .5) * TS, y = (j + .5) * TS, k = j * TEX + i;
    const jx = x + (fbm(x / 38, y / 38, seed + 3) - .45) * 11, jy = y + (fbm(x / 38 + 9, y / 38, seed + 4) - .45) * 11;
    const ci = Math.min(RW - 1, Math.max(0, Math.floor(jx / CELL))), cj = Math.min(RW - 1, Math.max(0, Math.floor(jy / CELL)));
    rid[k] = ras[cj * RW + ci];
    const lv = T.land(x, y); landv[k] = lv;
    const m = rid[k] === 255 ? 0 : T.mtn(x, y); mtv[k] = m;
    canopy[k] = fbm(x / 13, y / 13, seed + 21);
    // 海拔：离海越远越高，再叠上山脉；小起伏让平原也有坡
    elev[k] = rid[k] === 255 ? Math.min(0, (lv - .5) * 1.5) : clamp01((lv - .5) * .9) * .35 + m * 1.1 + (canopy[k] - .5) * .05;
    // 河：在 5 单位网格上做双线性插值，边缘带一点抖动
    if (rid[k] !== 255) {
      const rx = x + (fbm(i / 9, j / 9, seed + 61) - .45) * 3, ry = y + (fbm(i / 9 + 4, j / 9, seed + 62) - .45) * 3;
      const gx = rx / CELL - .5, gy = ry / CELL - .5, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
      const at = (a, b) => (a < 0 || b < 0 || a >= RW || b >= RW) ? 0 : riv[b * RW + a] ? 1 : 0;
      wat[k] = Math.round((at(ix, iy) * (1 - fx) * (1 - fy) + at(ix + 1, iy) * fx * (1 - fy) + at(ix, iy + 1) * (1 - fx) * fy + at(ix + 1, iy + 1) * fx * fy) * 255);
    }
  }
  // 到区域边界的距离（≤6），以及边界另一侧是哪个区域
  const ed = new Uint8Array(N).fill(255), nb = new Uint8Array(N).fill(255), q = new Int32Array(N); let qh = 0, qt = 0;
  for (let k = 0; k < N; k++) {
    const i = k % TEX, a = rid[k];
    const o = i < TEX - 1 && rid[k + 1] !== a ? rid[k + 1] : i > 0 && rid[k - 1] !== a ? rid[k - 1] : k + TEX < N && rid[k + TEX] !== a ? rid[k + TEX] : k >= TEX && rid[k - TEX] !== a ? rid[k - TEX] : -1;
    if (o >= 0) { ed[k] = 0; nb[k] = o; q[qt++] = k; }
  }
  while (qh < qt) {
    const k = q[qh++], d = ed[k]; if (d >= 6) continue;
    const i = k % TEX;
    for (const n of [i < TEX - 1 ? k + 1 : -1, i > 0 ? k - 1 : -1, k + TEX < N ? k + TEX : -1, k >= TEX ? k - TEX : -1]) {
      if (n < 0 || ed[n] !== 255 || rid[n] !== rid[k]) continue;
      ed[n] = d + 1; nb[n] = nb[k]; q[qt++] = n;
    }
  }
  // 海上到陆地的距离（≤40）
  const sd = new Uint8Array(N).fill(255); qh = 0; qt = 0;
  for (let k = 0; k < N; k++) if (rid[k] === 255 && ed[k] === 0) { sd[k] = 0; q[qt++] = k; }
  while (qh < qt) {
    const k = q[qh++], d = sd[k]; if (d >= 40) continue;
    const i = k % TEX;
    for (const n of [i < TEX - 1 ? k + 1 : -1, i > 0 ? k - 1 : -1, k + TEX < N ? k + TEX : -1, k >= TEX ? k - TEX : -1]) {
      if (n < 0 || sd[n] !== 255 || rid[n] !== 255) continue;
      sd[n] = d + 1; q[qt++] = n;
    }
  }
  // 陆地离海岸的距离（≤6）：画沙滩
  const ld = new Uint8Array(N).fill(255); qh = 0; qt = 0;
  for (let k = 0; k < N; k++) if (rid[k] !== 255 && ed[k] === 0 && nb[k] === 255) { ld[k] = 0; q[qt++] = k; }
  while (qh < qt) {
    const k = q[qh++], d = ld[k]; if (d >= 6) continue;
    const i = k % TEX;
    for (const n of [i < TEX - 1 ? k + 1 : -1, i > 0 ? k - 1 : -1, k + TEX < N ? k + TEX : -1, k >= TEX ? k - TEX : -1]) {
      if (n < 0 || ld[n] !== 255 || rid[n] === 255) continue;
      ld[n] = d + 1; q[qt++] = n;
    }
  }
  this.rid = rid; this.ed = ed; this.nb = nb; this.sd = sd; this.mtv = mtv; this.wat = wat;
  // 光照：西北来光，按海拔梯度算明暗
  const base = new Uint8ClampedArray(N * 3);
  const BIO = { plain: [[152, 168, 84], [176, 178, 96]], forest: [[52, 92, 46], [72, 110, 52]], hill: [[128, 136, 80], [150, 134, 92]], marsh: [[78, 112, 84], [96, 122, 90]] };
  const ROCK = [122, 112, 100], ROCK2 = [150, 142, 130], SNOW = [238, 240, 244], SAND = [214, 200, 150], WATER = [62, 118, 150], DEEP = [20, 52, 88], SHALLOW = [78, 150, 168];
  const terrOf = k => rid[k] === 255 ? null : regs[rid[k]].terr;
  for (let j = 0; j < TEX; j++) for (let i = 0; i < TEX; i++) {
    const k = j * TEX + i, r = rid[k];
    let c;
    if (r === 255) {
      const d = sd[k], depth = clamp01(-elev[k] * 2.2);
      c = mix(SHALLOW, DEEP, Math.max(depth, d < 40 ? d / 48 : 1));
      if (d <= 2) c = mix(c, SAND, .35 - d * .1);
      const w = canopy[k]; c = mix(c, [255, 255, 255], (w > .72 ? (w - .72) * 1.2 : 0) * (d > 3 ? 1 : 0)); // 浪花
      c = c.map(v => v * (.96 + canopy[k] * .08));
    } else {
      const terr = terrOf(k), m = mtv[k], n = canopy[k];
      // 相邻区域的地貌在边界处混合，不留生硬的块
      let tA = terr, tB = ed[k] < 6 && nb[k] !== 255 ? regs[nb[k]].terr : terr, bt = ed[k] < 6 && nb[k] !== 255 ? (6 - ed[k]) / 12 : 0;
      const bio = t => { const B = BIO[t]; return mix(B[0], B[1], n); };
      c = mix(bio(tA), bio(tB), bt);
      if (terr === "forest" || (terr === "hill" && m < .35) || n > .62) { // 树冠：深浅斑驳
        const f = terr === "forest" ? 1 : terr === "hill" ? .45 : terr === "marsh" ? .25 : .18;
        const can = clamp01((n - .38) * 2.2) * f; c = mix(c, [38, 70, 36], can * .85);
        if (terr === "forest" && n > .55) c = mix(c, [86, 130, 58], (n - .55) * 1.4); // 树冠受光面
      }
      if (terr === "marsh") { if (n > .6) c = mix(c, [66, 98, 112], clamp01((n - .6) * 5)); c = mix(c, [60, 84, 64], .15); } // 水洼
      if (terr === "plain" && n < .34) c = mix(c, [192, 178, 104], (.34 - n) * 1.6); // 枯草地
      // 山：越高越秃，顶上积雪
      if (m > .3) { const t = clamp01((m - .3) / .45); c = mix(c, mix(ROCK, ROCK2, n), t * .95); }
      if (m > .86) c = mix(c, SNOW, clamp01((m - .86) / .16 + (n - .5) * .25) * .9);
      else if (m > .72) c = mix(c, [176, 170, 162], clamp01((m - .72) / .14) * .45);
      if (ld[k] <= 2 && m < .3) c = mix(c, SAND, (3 - ld[k]) / 3 * .75);
      const w = wat[k]; if (w > 95) { c = w < 135 ? mix(c, [70, 90, 70], .5) : mix(c, WATER, .9); }
    }
    // 光照
    const kl = Math.max(0, k - 1), kr = Math.min(N - 1, k + 1), ku = Math.max(0, k - TEX), kd = Math.min(N - 1, k + TEX);
    const dx = (elev[kr] - elev[kl]) * 26, dy = (elev[kd] - elev[ku]) * 26;
    const nl = 1 / Math.sqrt(dx * dx + dy * dy + 1), lx = -.55, ly = -.6, lz = .58;
    let light = (-dx * lx - dy * ly + lz) * nl / Math.sqrt(lx * lx + ly * ly + lz * lz);
    light = .55 + clamp01(light) * .68;
    if (r === 255) light = .9 + light * .1;
    const grain = .96 + h2(i, j, seed) * .08;
    base[k * 3] = c[0] * light * grain; base[k * 3 + 1] = c[1] * light * grain; base[k * 3 + 2] = c[2] * light * grain;
  }
  this.base3 = base;
};
Renderer.prototype.buildBorders = function () {
  const ras = this.sim.map.ras, seg = this.sim.map.regions.map(() => []);
  for (let j = 0; j < RW; j++) for (let i = 0; i < RW; i++) {
    const a = ras[j * RW + i]; if (a === 255) continue;
    const right = i + 1 < RW ? ras[j * RW + i + 1] : 255, down = j + 1 < RW ? ras[(j + 1) * RW + i] : 255;
    const left = i > 0 ? ras[j * RW + i - 1] : 255, up = j > 0 ? ras[(j - 1) * RW + i] : 255;
    const x0 = i * CELL, y0 = j * CELL, x1 = x0 + CELL, y1 = y0 + CELL;
    if (right !== a) seg[a].push([x1, y0, x1, y1]); if (left !== a) seg[a].push([x0, y0, x0, y1]);
    if (down !== a) seg[a].push([x0, y1, x1, y1]); if (up !== a) seg[a].push([x0, y0, x1, y0]);
  }
  this.seg = seg;
};
Renderer.prototype.ridAt = function (x, y) { const i = Math.floor(x / TS), j = Math.floor(y / TS); if (i < 0 || j < 0 || i >= TEX || j >= TEX) return 255; return this.rid[j * TEX + i]; };

/* ---------- 细节图层：官道、桥、树、岩石、水洼、罗盘 ---------- */
Renderer.prototype.buildInk = function () {
  const cv = document.createElement("canvas"); cv.width = INK; cv.height = INK;
  const c = cv.getContext("2d"), sim = this.sim, seed = sim.cfg.seed, regs = sim.map.regions;
  c.scale(INK / WORLD, INK / WORLD); c.lineCap = "round"; c.lineJoin = "round";
  const rnd = (a, b) => h2(a, b, seed + 991);
  const edAt = (x, y) => { const i = Math.floor(x / TS), j = Math.floor(y / TS); return this.ed[j * TEX + i]; };
  const mtAt = (x, y) => { const i = Math.floor(x / TS), j = Math.floor(y / TS); return i < 0 || j < 0 || i >= TEX || j >= TEX ? 0 : this.mtv[j * TEX + i]; };
  const watAt = (x, y) => { const i = Math.floor(x / TS), j = Math.floor(y / TS); return i < 0 || j < 0 || i >= TEX || j >= TEX ? 0 : this.wat[j * TEX + i]; };
  const nearCity = (x, y, d) => regs.some(g => (g.x - x) ** 2 + (g.y - y) ** 2 < d * d);
  // 官道：土路，带深色路肩
  c.save();
  for (const key in sim.map.routes) {
    const pts = sim.map.routes[key];
    c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.strokeStyle = "rgba(70,52,30,.45)"; c.lineWidth = 3; c.stroke();
    c.strokeStyle = "rgba(196,170,120,.85)"; c.lineWidth = 1.7; c.stroke();
  }
  for (const b of sim.map.bridges) { // 石桥
    c.save(); c.translate(b.x, b.y); c.rotate(b.a);
    c.fillStyle = "#9A9690"; c.strokeStyle = "rgba(40,36,32,.8)"; c.lineWidth = .7;
    c.beginPath(); c.rect(-7, -2.4, 14, 4.8); c.fill(); c.stroke();
    c.strokeStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.moveTo(-7, -1.2); c.lineTo(7, -1.2); c.stroke();
    c.fillStyle = "rgba(40,36,32,.6)"; for (const dx of [-3.5, 0, 3.5]) { c.beginPath(); c.arc(dx, 2.6, 1.1, Math.PI, 0); c.fill(); }
    c.restore();
  }
  c.restore();
  const roadPts = []; for (const key in sim.map.routes) for (const q of sim.map.routes[key]) roadPts.push(q);
  const nearRoad = (x, y, d) => roadPts.some(q => (q[0] - x) ** 2 + (q[1] - y) ** 2 < d * d);
  // 树、岩石、水洼
  const step = 9;
  for (let gy = 0; gy < WORLD; gy += step) for (let gx = 0; gx < WORLD; gx += step) {
    const x = gx + rnd(gx, gy + 1) * step, y = gy + rnd(gy + 1, gx + 7) * step;
    const r = this.ridAt(x, y); if (r === 255) continue;
    const m = mtAt(x, y); if (watAt(x, y) > 60 || nearCity(x, y, 26) || nearRoad(x, y, 4)) continue;
    const g = regs[r], v = rnd(gx + 3, gy + 5), s2 = 2.6 + rnd(x | 0, y | 0) * 2.2;
    if (m > MT + .08) { if (v < .25) this.rock(c, x, y, s2 * (1 + (m - MT) * 2), rnd(gx + 1, gy)); continue; }
    if (m > MT - .05) { if (v < .12) this.tree(c, x, y, s2 * .8, 1); continue; }
    if (g.terr === "forest") { if (v < .62) this.tree(c, x, y, s2 * 1.15, rnd(gx + 1, gy)); }
    else if (g.terr === "marsh") { if (v < .18) this.tree(c, x, y, s2 * .9, .2); else if (v < .3) this.reed(c, x, y, s2); }
    else if (g.terr === "hill") { if (v < .3) this.tree(c, x, y, s2 * .9, .9); else if (v < .36) this.rock(c, x, y, s2 * .8, rnd(gx + 1, gy)); }
    else if (v < .07) this.tree(c, x, y, s2, rnd(gx + 2, gy));
  }
  // 罗盘放在海上空旷处
  const B = this.bb, corners = [[B.x1 - 55, B.y0 + 60], [B.x0 + 45, B.y0 + 60], [B.x1 - 55, B.y1 - 60], [B.x0 + 45, B.y1 - 60], [870, 125], [130, 125]];
  const open = ([x, y]) => [[0, 0], [60, 0], [-60, 0], [0, 60], [0, -60]].every(([dx, dy]) => this.ridAt(x + dx, y + dy) === 255);
  const free = corners.filter(open);
  if (free[0]) this.compass(c, free[0][0], free[0][1], 40);
  this.ink = cv;
};
// 树：俯视树冠，带影子和受光面
Renderer.prototype.tree = function (c, x, y, s, v) {
  const pine = v > .55;
  c.fillStyle = "rgba(20,30,16,.35)"; c.beginPath(); c.ellipse(x + s * .5, y + s * .45, s * .95, s * .6, 0, 0, 7); c.fill();
  if (pine) {
    c.fillStyle = "#2E5A2C"; c.beginPath(); c.moveTo(x, y - s * 1.3); c.lineTo(x + s * .9, y + s * .5); c.lineTo(x - s * .9, y + s * .5); c.closePath(); c.fill();
    c.fillStyle = "#4C8A3E"; c.beginPath(); c.moveTo(x, y - s * 1.3); c.lineTo(x - s * .55, y + s * .3); c.lineTo(x - s * .1, y + s * .2); c.closePath(); c.fill();
  } else {
    c.fillStyle = "#2F6630"; c.beginPath(); c.arc(x, y, s, 0, 7); c.fill();
    c.fillStyle = "#5C9A44"; c.beginPath(); c.arc(x - s * .3, y - s * .32, s * .55, 0, 7); c.fill();
  }
};
Renderer.prototype.rock = function (c, x, y, s, v) {
  c.fillStyle = "rgba(30,28,26,.35)"; c.beginPath(); c.ellipse(x + s * .4, y + s * .4, s * 1.1, s * .55, 0, 0, 7); c.fill();
  c.fillStyle = v > .5 ? "#8E8880" : "#A49E94"; c.beginPath(); c.moveTo(x - s, y + s * .4); c.lineTo(x - s * .5, y - s * .7); c.lineTo(x + s * .2, y - s); c.lineTo(x + s, y + s * .1); c.lineTo(x + s * .6, y + s * .6); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.moveTo(x - s * .5, y - s * .7); c.lineTo(x + s * .2, y - s); c.lineTo(x, y - s * .2); c.closePath(); c.fill();
};
Renderer.prototype.reed = function (c, x, y, s) {
  c.fillStyle = "rgba(70,110,120,.7)"; c.beginPath(); c.ellipse(x, y, s * 1.6, s * .9, .3, 0, 7); c.fill();
  c.strokeStyle = "#6F8A3C"; c.lineWidth = .6; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x + k * s * .6, y); c.lineTo(x + k * s * .6 + s * .3, y - s * 1.6); c.stroke(); }
};
Renderer.prototype.compass = function (c, x, y, r) {
  c.save(); c.translate(x, y); c.globalAlpha = .85;
  c.strokeStyle = "rgba(240,236,220,.8)"; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke();
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 - Math.PI / 2;
    c.beginPath(); c.moveTo(Math.cos(a) * r * .95, Math.sin(a) * r * .95); c.lineTo(Math.cos(a + Math.PI / 2) * r * .14, Math.sin(a + Math.PI / 2) * r * .14); c.lineTo(Math.cos(a - Math.PI / 2) * r * .14, Math.sin(a - Math.PI / 2) * r * .14); c.closePath();
    c.fillStyle = k === 0 ? "#D9483B" : "rgba(240,236,220,.85)"; c.fill();
  }
  c.fillStyle = "#F2EEE2"; c.font = `700 ${r * .42}px ${UIF}`; c.textAlign = "center"; c.fillText("北", 0, -r - 5);
  c.restore();
};

/* ---------- 动态底图：势力染色、迷雾、边界 ---------- */
Renderer.prototype.paintTexture = function () {
  const sim = this.sim, me = this.me, px = this.img.data, N = TEX * TEX;
  const regs = sim.map.regions, R = sim.R, nR = regs.length;
  const vis = new Uint8Array(nR), own = new Array(nR), or = new Float32Array(nR), og = new Float32Array(nR), ob = new Float32Array(nR), m0 = new Float32Array(nR), fl = new Uint8Array(nR), ru = new Uint8Array(nR);
  for (let i = 0; i < nR; i++) {
    const o = R[i].owner, v = sim.visible(me, i); vis[i] = v ? 1 : 0; own[i] = o || null; fl[i] = R[i].floodUntil > sim.t ? 1 : 0; ru[i] = R[i].trait === "ruin" ? 1 : 0;
    if (o) { const oc = hexRGB(sim.P[o].color); or[i] = oc[0]; og[i] = oc[1]; ob[i] = oc[2]; m0[i] = v ? (o === me ? .26 : .22) : .1; } else m0[i] = -1;
  }
  const rid = this.rid, ed = this.ed, nb = this.nb, base = this.base3;
  for (let k = 0; k < N; k++) {
    const r = rid[k];
    let cr = base[k * 3], cg = base[k * 3 + 1], cb = base[k * 3 + 2];
    if (r !== 255) {
      const e = ed[k], n2 = nb[k];
      if (ru[r]) { const l = cr * .3 + cg * .5 + cb * .2; cr = l * .7; cg = l * .62; cb = l * .55; }
      if (fl[r]) { cr = cr * .7 + 60 * .3; cg = cg * .7 + 110 * .3; cb = cb * .7 + 150 * .3; }
      if (m0[r] >= 0) {
        let m = m0[r];
        if (e <= 5 && (n2 === 255 ? null : own[n2]) !== own[r]) m += (5 - e) * .07; // 疆界内侧加深
        cr += (or[r] - cr) * m; cg += (og[r] - cg) * m; cb += (ob[r] - cb) * m;
      }
      if (!vis[r]) { const l = cr * .3 + cg * .5 + cb * .2; cr = (cr * .35 + l * .65) * .62; cg = (cg * .35 + l * .65) * .62; cb = (cb * .35 + l * .65) * .66; }
      if (e === 0) {
        if (n2 === 255) { cr *= .45; cg *= .45; cb *= .5; } // 海岸线
        else if (own[r] !== own[n2] && (own[r] || own[n2]) && (vis[r] || vis[n2])) { const o = own[r] ? r : n2; cr = or[o] * .8; cg = og[o] * .8; cb = ob[o] * .8; }
        else { cr *= .78; cg *= .78; cb *= .78; }
      } else if (e === 1 && n2 !== 255 && own[r] !== own[n2] && (own[r] || own[n2]) && (vis[r] || vis[n2])) { const o = own[r] ? r : n2; cr = cr * .4 + or[o] * .6; cg = cg * .4 + og[o] * .6; cb = cb * .4 + ob[o] * .6; }
    }
    const q = k * 4; px[q] = cr; px[q + 1] = cg; px[q + 2] = cb; px[q + 3] = 255;
  }
  this.tctx.putImageData(this.img, 0, 0);
  // 迷雾云（噪声只算一次）
  const fp = this.fimg.data;
  if (!this.fogN) { const seed = sim.cfg.seed; this.fogN = new Float32Array(FOG * FOG); for (let j = 0; j < FOG; j++) for (let i = 0; i < FOG; i++) this.fogN[j * FOG + i] = 70 + fbm(i / 28, j / 28, seed + 55) * 90; }
  for (let j = 0; j < FOG; j++) for (let i = 0; i < FOG; i++) {
    const r = rid[(j * 2) * TEX + i * 2], q = (j * FOG + i) * 4;
    if (r === 255 || vis[r]) { fp[q + 3] = 0; continue; }
    fp[q] = 44; fp[q + 1] = 48; fp[q + 2] = 56; fp[q + 3] = this.fogN[j * FOG + i];
  }
  this.fctx.putImageData(this.fimg, 0, 0);
  if (!this.base) { this.base = document.createElement("canvas"); this.base.width = INK; this.base.height = INK; this.bctx = this.base.getContext("2d"); }
  const b = this.bctx; b.imageSmoothingEnabled = true; b.imageSmoothingQuality = "high";
  b.globalCompositeOperation = "source-over"; b.drawImage(this.tex, 0, 0, INK, INK);
  b.drawImage(this.ink, 0, 0);
  b.drawImage(this.fog, 0, 0, INK, INK);
};
Renderer.prototype.stateKey = function () {
  const sim = this.sim, me = this.me;
  return sim.R.map((R, i) => (R.owner || "-") + (sim.visible(me, i) ? 1 : 0) + (R.floodUntil > sim.t ? "f" : "") + (R.trait === "ruin" ? "x" : "")).join("");
};

/* ---------- 相机与输入 ---------- */
Renderer.prototype.resize = function () {
  const dpr = Math.min(2, window.devicePixelRatio || 1), r = this.cv.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  const zr = this.W ? this.cam.z / this.fitZ() : null; // 横竖屏切换时保持相对缩放
  this.W = r.width; this.H = r.height; this.dpr = dpr;
  this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
  if (zr) { this.cam.z = zr * this.fitZ(); this.clamp(); }
  this.vg = null; if (this.sp) this.sp.clear();
};
Renderer.prototype.fitZ = function () { const b = this.bb; return Math.min(this.W / (b.x1 - b.x0), (this.H - (this.H > this.W ? 150 : 90)) / (b.y1 - b.y0)); };
Renderer.prototype.clamp = function () {
  const zmin = this.fitZ() * .9, zmax = this.fitZ() * 6; this.cam.z = Math.max(zmin, Math.min(zmax, this.cam.z));
  const b = this.bb; this.cam.x = Math.max(b.x0, Math.min(b.x1, this.cam.x)); this.cam.y = Math.max(b.y0, Math.min(b.y1, this.cam.y));
};
Renderer.prototype.toScreen = function (x, y) { return { x: (x - this.cam.x) * this.cam.z + this.W / 2, y: (y - this.cam.y) * this.cam.z + this.H / 2 }; };
Renderer.prototype.toWorld = function (sx, sy) { return { x: (sx - this.W / 2) / this.cam.z + this.cam.x, y: (sy - this.H / 2) / this.cam.z + this.cam.y }; };
Renderer.prototype.regionAt = function (wx, wy) { const r = this.ridAt(wx, wy); return r === 255 ? null : r; };
Renderer.prototype.focus = function (r) { const g = this.sim.map.regions[r]; this.cam.x = g.x; this.cam.y = g.y; this.cam.z = Math.max(this.cam.z, this.fitZ() * 2); this.clamp(); };
// 结束一局时调用：卸掉这一局挂在地图上的所有监听。
// 否则（尤其是添加到主屏幕、App 不刷新时）每开一局就多一套点击处理，旧的那套还按上一局的视角算城池，
// 会导致：调兵面板被换成城池信息、卡牌目标砸偏。
Renderer.prototype.destroy = function () { this.dead = true; if (this.ac) this.ac.abort(); this.onTap = null; if (this.sp) this.sp.clear(); };
Renderer.prototype.bindInput = function () {
  const cv = this.cv, pts = new Map(); let start = null, moved = false, pinch = null;
  this.ac = new AbortController(); const sig = { signal: this.ac.signal };
  cv.addEventListener("pointerdown", e => {
    if (this.dead) return;
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y, t: performance.now() }; moved = false; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.cam.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, cx: this.cam.x, cy: this.cam.y }; moved = true; }
  }, sig);
  cv.addEventListener("pointermove", e => {
    if (this.dead || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), rect = cv.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
      const wx = (pinch.mx - rect.left - this.W / 2) / pinch.z + pinch.cx, wy = (pinch.my - rect.top - this.H / 2) / pinch.z + pinch.cy;
      this.cam.z = pinch.z * d / pinch.d; this.clamp();
      this.cam.x = wx - (mx - this.W / 2) / this.cam.z; this.cam.y = wy - (my - this.H / 2) / this.cam.z; this.clamp();
    } else if (pts.size === 1 && start) {
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 14) moved = true;
      if (moved) { this.cam.x = start.cx - dx / this.cam.z; this.cam.y = start.cy - dy / this.cam.z; this.clamp(); }
    }
  }, sig);
  const up = e => {
    if (this.dead || !pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size === 0) {
      if (!moved && start && performance.now() - start.t < 800 && this.onTap) {
        const rect = cv.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top;
        const w = this.toWorld(sx, sy);
        // 点在城池图标附近就算点中这座城（不会因为靠近边界而点到隔壁）；军队要比城更近才算点军队
        const poly = this.regionAt(w.x, w.y);
        let city = null, dc = 24 * 24;
        this.sim.map.regions.forEach((g, i) => { const p = this.toScreen(g.x, g.y), d = (p.x - sx) ** 2 + (p.y - sy) ** 2; if (d < dc) { dc = d; city = i; } });
        const army = this.armyAt(sx, sy, city != null ? dc : null);
        if (this.onTap) this.onTap({ region: city != null ? city : poly, poly, army, sx, sy });
      }
      start = null; pinch = null;
    } else if (pts.size === 1) { const [a] = [...pts.values()]; start = { x: a.x, y: a.y, cx: this.cam.x, cy: this.cam.y, t: 0 }; pinch = null; }
  };
  cv.addEventListener("pointerup", up, sig); cv.addEventListener("pointercancel", up, sig);
  // 触屏：抬手后不要再补发“点击”事件（它会落到刚弹出的面板上）
  cv.addEventListener("touchend", e => { if (e.cancelable) e.preventDefault(); }, { passive: false, signal: this.ac.signal });
  cv.addEventListener("wheel", e => {
    e.preventDefault();
    const rect = cv.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top, w = this.toWorld(sx, sy);
    this.cam.z *= Math.exp(-e.deltaY * .0015); this.clamp();
    this.cam.x = w.x - (sx - this.W / 2) / this.cam.z; this.cam.y = w.y - (sy - this.H / 2) / this.cam.z; this.clamp();
  }, { passive: false, signal: this.ac.signal });
};

/* ---------- 军队 ---------- */
Renderer.prototype.armyWorld = function (a, frac) {
  const sim = this.sim, A = a.path[a.idx], B = a.path[a.idx + 1];
  const d = Math.min(sim.segLen(A, B), a.d + sim.armyStep(a) * frac);
  return sim.routePt(A, B, d);
};
// 官道折线（按 a→b 方向）
Renderer.prototype.routeOf = function (a, b) { const sim = this.sim, pts = sim.map.routes[a < b ? a + "," + b : b + "," + a]; return a < b ? pts : pts.slice().reverse(); };
Renderer.prototype.tracePath = function (ctx, path, from, d0) { // 从第 from 段的 d0 处开始，沿官道描出整条路线
  const sim = this.sim; let first = true;
  for (let k = from; k < path.length - 1; k++) {
    const pts = this.routeOf(path[k], path[k + 1]);
    if (k === from && d0 > 0) { const p = sim.routePt(path[k], path[k + 1], d0); ctx.moveTo(p.x, p.y); first = false; let acc = 0; for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc > d0) ctx.lineTo(pts[i][0], pts[i][1]); } continue; }
    pts.forEach(([x, y], i) => { if (first) { ctx.moveTo(x, y); first = false; } else if (i || k === from) ctx.lineTo(x, y); });
  }
};
Renderer.prototype.nearestSeen = function () { return null; };
Renderer.prototype.visibleArmies = function () { return this.sim.armies.filter(a => this.sim.armyVisibleTo(a, this.me)); };
Renderer.prototype.armyAt = function (sx, sy, cityD) {
  let best = null, bd = cityD != null ? Math.min(32 * 32, cityD * .5) : 32 * 32;
  for (const a of this.visibleArmies()) { const w = this.armyWorld(a, this.frac || 0), s = this.toScreen(w.x, w.y), d = (s.x - sx) ** 2 + (s.y - sy - 6) ** 2; if (d < bd) { bd = d; best = a.id; } }
  return best;
};

/* ---------- 每帧绘制 ---------- */
Renderer.prototype.draw = function (simNow) {
  const sim = this.sim, me = this.me, ctx = this.ctx, dpr = this.dpr;
  const frac = Math.max(0, Math.min(1, simNow - sim.t)); this.frac = frac;
  if (!this.key || sim.t !== this.keyT) { this.keyT = sim.t; const key = this.stateKey(); if (key !== this.key) { this.key = key; this.paintTexture(); } }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#13263A"; ctx.fillRect(0, 0, this.W, this.H);
  let shx = 0, shy = 0;
  if (this.shake > 0) { shx = (Math.random() - .5) * this.shake; shy = (Math.random() - .5) * this.shake; this.shake *= .9; if (this.shake < .3) this.shake = 0; }
  const z = this.cam.z, now = simNow;
  const regs = sim.map.regions, R = sim.R, P = sim.P[me];
  ctx.save();
  ctx.translate(this.W / 2 + shx, this.H / 2 + shy); ctx.scale(z, z); ctx.translate(-this.cam.x, -this.cam.y);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "medium";
  ctx.drawImage(this.base, 0, 0, WORLD, WORLD);
  // 选中 / 可选目标
  const outline = (r, col, w, dash) => { ctx.save(); if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = -now * 12; } ctx.beginPath(); for (const s of this.seg[r]) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); } ctx.strokeStyle = col; ctx.lineWidth = w / z; ctx.lineCap = "round"; ctx.stroke(); ctx.restore(); };
  if (this.hl.regions) for (const r of this.hl.regions) outline(r, `rgba(255,214,90,${.6 + .35 * Math.sin(now * 5)})`, 2.8, [6, 4]);
  if (this.hl.sel != null) { outline(this.hl.sel, "rgba(255,255,255,.95)", 5); outline(this.hl.sel, "#1A1A1C", 2.2); }
  // 持续状态
  R.forEach((x, i) => {
    if (!sim.visible(me, i)) return;
    const g = regs[i];
    if (x.wallUntil > sim.t || x.ironUntil > sim.t) { ctx.save(); ctx.globalAlpha = .7 + .15 * Math.sin(now * 3); this.hexagon(g.x, g.y, 30, x.ironUntil > sim.t ? "#C9D6E6" : "#6E9BC9", 2.6 / z * 1.4); ctx.restore(); }
    if (x.harvestUntil > sim.t) this.sparkle(g.x, g.y, now, "#F2C14E", 4, 22);
    for (const am of x.ambush) if (am.by === me && am.until > sim.t) { ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(217,72,59,.9)"; ctx.lineWidth = 2 / z * 1.3; ctx.beginPath(); ctx.arc(g.x, g.y, 28, 0, 7); ctx.stroke(); ctx.restore(); }
    if (x.patrols.some(q => q.by === me && q.until > sim.t)) { ctx.save(); ctx.setLineDash([2, 5]); ctx.strokeStyle = "rgba(120,200,255,.8)"; ctx.lineWidth = 1.6 / z * 1.3; ctx.lineDashOffset = -now * 6; ctx.beginPath(); ctx.arc(g.x, g.y, 34, 0, 7); ctx.stroke(); ctx.restore(); }
  });
  // 行军路线：自己的全程；盟友的全程；敌军只看得到它正在走的这一段（去向）
  const armies = this.visibleArmies();
  for (const a of armies) {
    const col = sim.P[a.owner].color, own = a.owner === me, ally = !own && sim.relOf(me, a.owner) === "ally", d0 = a.d + sim.armyStep(a) * frac;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (own || ally) {
      ctx.strokeStyle = col; ctx.lineWidth = 3.2 / z * 1.2; ctx.setLineDash([.1, 9 / z * 1.2]); ctx.lineDashOffset = -now * 18;
      ctx.beginPath(); this.tracePath(ctx, a.path, a.idx, d0); ctx.stroke();
      if (own) { const g = regs[a.path[a.path.length - 1]]; ctx.setLineDash([3, 3]); ctx.lineWidth = 2.4 / z * 1.3; ctx.beginPath(); ctx.arc(g.x, g.y, 16 + 3 * Math.sin(now * 4), 0, 7); ctx.stroke(); }
      if (own && a.hunt) { const e = sim.armies.find(x => x.id === a.hunt); if (e) { const w = this.armyWorld(e, frac); ctx.setLineDash([]); ctx.strokeStyle = "rgba(255,80,60,.9)"; ctx.lineWidth = 2 / z * 1.3; const rr = 14 + 2 * Math.sin(now * 6); ctx.beginPath(); ctx.arc(w.x, w.y - 4, rr, 0, 7); ctx.moveTo(w.x - rr - 5, w.y - 4); ctx.lineTo(w.x - rr + 4, w.y - 4); ctx.moveTo(w.x + rr - 4, w.y - 4); ctx.lineTo(w.x + rr + 5, w.y - 4); ctx.moveTo(w.x, w.y - 4 - rr - 5); ctx.lineTo(w.x, w.y - 4 - rr + 4); ctx.moveTo(w.x, w.y - 4 + rr - 4); ctx.lineTo(w.x, w.y - 4 + rr + 5); ctx.stroke(); } }
    } else {
      ctx.strokeStyle = "rgba(255,70,50,.9)"; ctx.lineWidth = 3 / z * 1.2; ctx.setLineDash([7 / z * 1.2, 5 / z * 1.2]); ctx.lineDashOffset = -now * 24;
      ctx.beginPath(); this.tracePath(ctx, a.path.slice(0, a.idx + 2), a.idx, d0); ctx.stroke();
      const g = regs[a.path[a.idx + 1]]; ctx.setLineDash([]); ctx.lineWidth = 2.2 / z * 1.3; ctx.beginPath(); ctx.arc(g.x, g.y, 14 + 3 * Math.sin(now * 4), 0, 7); ctx.stroke();
      for (let k = 0; k < 3; k++) { const p = sim.routePt(a.path[a.idx], a.path[a.idx + 1], Math.min(sim.segLen(a.path[a.idx], a.path[a.idx + 1]), d0 + 18 + k * 14)); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.fillStyle = "rgba(255,70,50,.9)"; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-3, -4); ctx.lineTo(-3, 4); ctx.closePath(); ctx.fill(); ctx.restore(); }
    }
    ctx.restore();
  }
  // 废墟
  R.forEach((x, i) => { if (x.trait === "ruin") this.ruinMark(regs[i].x, regs[i].y); });
  ctx.restore();

  // —— 屏幕空间 ——
  const S = (x, y) => this.toScreen(x, y);
  const k = Math.max(.75, Math.min(1.35, z / this.fitZ() / 1.7)); // 图标缩放
  const showName = z > this.fitZ() * 1.3;
  R.forEach((x, i) => {
    const g = regs[i], p = S(g.x, g.y);
    if (p.x < -70 || p.y < -70 || p.x > this.W + 70 || p.y > this.H + 70) return;
    const vis = sim.visible(me, i), own = x.owner === me, snap = P.snap[i];
    let troops = null, stale = false, beast = 0, owner = x.owner, pop = 4000;
    if (own) { troops = x.troops; pop = x.pop; }
    else if (vis && snap) { troops = snap.troops; beast = snap.beast; owner = snap.owner; stale = sim.t - snap.t > 20; pop = snap.pop; }
    const trait = own ? x.trait : vis && snap ? snap.trait : null;
    const capital = owner && sim.P[owner] && sim.P[owner].capital === i && (own || vis);
    const popS = Math.max(.85, Math.min(1.3, .85 + pop / 14000 * .55));
    if (x.trait !== "ruin") this.town(p.x, p.y, 12 * k * popS, { capital, trait: trait || "normal", known: !!trait, pop, owner: owner && (vis || own) ? sim.P[owner].color : null, faint: !vis && !own, now: now + i });
    if (showName || own || capital) {
      const fs = Math.round(Math.max(12, Math.min(17, z * 11)));
      this.label(p.x, p.y + 20 * k + fs * .6, g.name, fs, !(vis || own));
    }
    if (troops != null && owner) {
      const el = own ? x.el : snap && snap.el ? snap.el : null;
      const ntr = own ? Math.round(x.troops) : Math.round(troops - (el ? Object.values(el).reduce((a, b) => a + b, 0) : 0));
      let yy = p.y - 13 * k; const hasEl = el && Object.values(el).some(n => n > 0);
      if (ntr > 0 || !hasEl) { this.seal(p.x + 17 * k, yy, Math.max(0, ntr), sim.P[owner].color, stale); yy -= 20; }
      if (hasEl) for (const u in el) if (el[u] > 0) { this.seal(p.x + 17 * k + 6, yy, el[u], sim.P[owner].color, stale, UNITS[u].g); yy -= 20; }
    }
    if (trait && TRAITCOL[trait] && trait !== "ruin" && (showName || own)) this.tag(p.x - 17 * k, p.y - 12 * k, TRAITS[trait].tag, TRAITCOL[trait]);
    if (own && x.pend && x.pend.by === me) { const b = Math.abs(Math.sin(now * 5)) * 5; this.stamp(p.x, p.y - 30 * k - b, "?", "#D9483B", 20); }
    else if (own && x.loyalty < 25) { ctx.save(); ctx.globalAlpha = .6 + .4 * Math.sin(now * 4); this.stamp(p.x, p.y - 28 * k, "怨", "#D9483B", 17); ctx.restore(); }
    if (vis && beast > 0 && !own) { this.paw(p.x - 2, p.y - 26 * k, 7); ctx.font = `700 12px ${NUMF}`; ctx.fillStyle = "#E8D6FF"; ctx.textAlign = "left"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(20,20,24,.9)"; ctx.strokeText(Math.round(beast), p.x + 7, p.y - 22 * k); ctx.fillText(Math.round(beast), p.x + 7, p.y - 22 * k); }
    if (x.beacon && vis) this.flame(p.x + 13 * k, p.y - 2, now, 1.1);
  });
  // 兵团：联机时迟到的指令会让推演回退一小步，画面上平滑过渡
  const tnow = performance.now(), dt = Math.min(.1, (tnow - (this.lastT || tnow)) / 1000); this.lastT = tnow;
  if (!this.apos) this.apos = new Map();
  const live = new Set();
  for (const a of armies) {
    const tw = this.armyWorld(a, frac); live.add(a.id);
    let q = this.apos.get(a.id);
    if (!q || Math.hypot(q.x - tw.x, q.y - tw.y) > 60) q = { x: tw.x, y: tw.y };
    else { const k = Math.min(1, dt * 12); q.x += (tw.x - q.x) * k; q.y += (tw.y - q.y) * k; }
    this.apos.set(a.id, q);
    const w = { x: q.x, y: q.y, ang: tw.ang }, p = S(w.x, w.y);
    if (a.hiddenUntil > sim.t && a.owner === me) ctx.globalAlpha = .55;
    this.troop(p.x, p.y, w.ang, sim.P[a.owner].color, a, now, (this.hl.armies && this.hl.armies.includes(a.id)) || this.hl.mark === a.id);
    ctx.globalAlpha = 1;
  }
  for (const id of this.apos.keys()) if (!live.has(id)) this.apos.delete(id);
  // 刚下达、还没生效的命令：立刻画出来，手感不用等网络
  if (this.pend && this.pend.length) {
    const col = sim.P[me].color, t = performance.now() / 1000;
    for (const q of this.pend) {
      const a = q.a || {};
      if (a.from != null && (a.to != null || a.hunt != null) && regs[a.from]) {
        const A = S(regs[a.from].x, regs[a.from].y);
        let path = q.path;
        if (!path) { if (a.hunt != null) { const pl = sim.huntPlan(me, a.from, a.hunt); path = typeof pl === "string" ? null : pl.path; } else path = sim.path(a.from, a.to); q.path = path || []; }
        ctx.save(); ctx.strokeStyle = a.hunt != null ? "#FF5A40" : col; ctx.globalAlpha = .55 + .35 * Math.sin(t * 8); ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 40; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        if (path && path.length > 1) { ctx.translate(this.W / 2, this.H / 2); ctx.scale(z, z); ctx.translate(-this.cam.x, -this.cam.y); ctx.lineWidth = 3 / z; ctx.setLineDash([8 / z, 6 / z]); ctx.lineDashOffset = -t * 40 / z; this.tracePath(ctx, path, 0, 0); }
        ctx.stroke(); ctx.restore();
        this.stamp(A.x, A.y - 30, a.hunt != null ? "截" : "令", "#D9483B", 18);
      } else if (a.r != null && regs[a.r]) {
        const P2 = S(regs[a.r].x, regs[a.r].y), ph = (t * 1.5) % 1;
        ctx.save(); ctx.strokeStyle = "#FFD65A"; ctx.globalAlpha = 1 - ph; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(P2.x, P2.y, 14 + ph * 22, 0, 7); ctx.stroke(); ctx.restore();
      }
    }
  }
  // 特效
  for (const f of sim.fx) {
    const age = now - f.t0; if (age < 0 || age > 4) continue;
    if (f.vis && !f.vis.includes(me)) continue;
    this.fx(f, age, S, now);
  }
  // 天时的全图氛围：大雾飘过、大旱泛黄
  if (sim.W && sim.W.fog > sim.t) {
    const left = sim.W.fog - simNow, a = Math.min(1, (90 - left) / 3, left / 3);
    ctx.save(); ctx.globalAlpha = Math.max(0, a) * .35; ctx.fillStyle = "#DDE3EA"; ctx.fillRect(0, 0, this.W, this.H);
    for (let i = 0; i < 7; i++) { const x = ((h2(i, 1, 5) * this.W + now * (12 + i * 3)) % (this.W + 300)) - 150, y = h2(i, 2, 5) * this.H; const g = ctx.createRadialGradient(x, y, 0, x, y, 140 + i * 12); g.addColorStop(0, "rgba(236,240,246,.6)"); g.addColorStop(1, "rgba(236,240,246,0)"); ctx.globalAlpha = Math.max(0, a) * .9; ctx.fillStyle = g; ctx.fillRect(x - 160, y - 160, 320, 320); }
    ctx.restore();
  } else if (sim.W && sim.W.drought > sim.t) { ctx.save(); ctx.fillStyle = "rgba(214,150,60,.12)"; ctx.fillRect(0, 0, this.W, this.H); ctx.restore(); }
  if (!this.vg || this.vgW !== this.W || this.vgH !== this.H) {
    this.vgW = this.W; this.vgH = this.H;
    this.vg = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * .45, this.W / 2, this.H / 2, Math.max(this.W, this.H) * .75);
    this.vg.addColorStop(0, "rgba(0,0,0,0)"); this.vg.addColorStop(1, "rgba(0,0,0,.3)");
  }
  ctx.fillStyle = this.vg; ctx.fillRect(0, 0, this.W, this.H);
};

/* ---------- 图标缓存：把城池、徽记等预先画成小图，每帧只贴图 ---------- */
Renderer.prototype.sprite = function (key, w, h, ox, oy, fn) {
  const dpr = this.dpr || 1, ck = key + "@" + dpr;
  if (!this.sp) this.sp = new Map();
  let cv = this.sp.get(ck);
  if (!cv) {
    if (this.sp.size > 900) this.sp.clear();
    cv = document.createElement("canvas"); cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
    const c = cv.getContext("2d"); c.scale(dpr, dpr);
    const main = this.ctx; this.ctx = c;
    try { fn(ox, oy); } finally { this.ctx = main; }
    this.sp.set(ck, cv);
  }
  return cv;
};
Renderer.prototype.town = function (x, y, s, o) {
  s = Math.round(s * 2) / 2;
  const wv = o.owner ? Math.round(Math.sin(o.now * 4) * 2) : 0, pb = Math.min(5, Math.floor(o.pop / 2500));
  const key = `t${o.capital ? 1 : 0}${o.known ? o.trait : "?"}${pb}${o.owner || ""}|${s}|${wv}`;
  const w = s * 5.2, h = s * 4.8, ox = s * 2.6, oy = s * 3.6;
  const cv = this.sprite(key, w, h, ox, oy, (X, Y) => this.townRaw(X, Y, s, { capital: o.capital, trait: o.known ? o.trait : "normal", known: o.known, pb, owner: o.owner, now: Math.asin(wv / 2) / 4 }));
  const c = this.ctx;
  if (o.faint) { c.save(); c.globalAlpha = .55; c.drawImage(cv, x - ox, y - oy, w, h); c.restore(); }
  else c.drawImage(cv, x - ox, y - oy, w, h);
};
Renderer.prototype.seal = function (x, y, n, col, stale, g) {
  const w = 30 + String(n).length * 8 + (g ? 16 : 0), h = 26;
  const cv = this.sprite(`s${n}|${col}|${stale ? 1 : 0}|${g || ""}`, w, h, w / 2, h / 2, (X, Y) => this.sealRaw(X, Y, n, col, stale, g));
  this.ctx.drawImage(cv, x - w / 2, y - h / 2, w, h);
};
Renderer.prototype.tag = function (x, y, ch, col) {
  const cv = this.sprite(`g${ch}|${col}`, 24, 24, 12, 12, (X, Y) => this.tagRaw(X, Y, ch, col));
  this.ctx.drawImage(cv, x - 12, y - 12, 24, 24);
};
Renderer.prototype.stamp = function (x, y, ch, col, sz) {
  const w = sz + 6;
  const cv = this.sprite(`p${ch}|${col}|${sz}`, w, w, w / 2, w / 2, (X, Y) => this.stampRaw(X, Y, ch, col, sz));
  this.ctx.drawImage(cv, x - w / 2, y - w / 2, w, w);
};
Renderer.prototype.label = function (x, y, text, fs, faded) {
  const w = text.length * fs + 12, h = fs + 12;
  const cv = this.sprite(`l${text}|${fs}|${faded ? 1 : 0}`, w, h, w / 2, h / 2 + fs * .35, (X, Y) => {
    const c = this.ctx; c.font = `700 ${fs}px ${UIF}`; c.textAlign = "center";
    c.lineWidth = 4; c.lineJoin = "round"; c.strokeStyle = "rgba(10,12,16,.85)"; c.fillStyle = faded ? "rgba(230,230,224,.6)" : "#F4F1E8";
    c.strokeText(text, X, Y); c.fillText(text, X, Y);
  });
  this.ctx.drawImage(cv, x - w / 2, y - (h / 2 + fs * .35), w, h);
};
/* ---------- 图元 ---------- */
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
/* 城池：按民风画出贫富强弱
 * 富庶：金瓦楼阁、市集彩棚；丰饶：四周良田；尚武：高墙箭楼、红旗；贫瘠：几间破屋；要塞：石砌关隘；国都：宫殿 */
Renderer.prototype.townRaw = function (x, y, s, o) {
  const c = this.ctx, ink = "#1E1A16", tr = o.trait, cap = o.capital;
  const PAL = {
    normal: { wall: "#D8CBB0", wallD: "#B8A98C", roof: "#7A4A3A", roofD: "#5A3328" },
    rich: { wall: "#EEDFC2", wallD: "#CDB88F", roof: "#D9A93A", roofD: "#A87A1E" },
    fertile: { wall: "#DCCFB2", wallD: "#B9AA8C", roof: "#6E7E4A", roofD: "#4E5A30" },
    strong: { wall: "#9A9A96", wallD: "#6E6E6A", roof: "#8E2E28", roofD: "#5E1C18" },
    barren: { wall: "#B9A98E", wallD: "#8C7C62", roof: "#7E6E58", roofD: "#5A4C3A" },
    fort: { wall: "#9C9C98", wallD: "#6A6A66", roof: "#4E4A46", roofD: "#2E2A26" },
    ruin: { wall: "#8A8078", wallD: "#5E564E", roof: "#5A4E44", roofD: "#3A302A" }
  }[tr] || { wall: "#D8CBB0", wallD: "#B8A98C", roof: "#7A4A3A", roofD: "#5A3328" };
  c.save(); c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = ink;
  // 丰饶：田垄
  if (tr === "fertile" && o.known) {
    for (const [dx, dy, w2, h2] of [[-2.1, .35, 1.1, .5], [1.1, .4, 1.1, .5], [-1.4, .95, 1.2, .45], [.6, 1, 1.1, .45]]) {
      c.fillStyle = "#B9B84A"; c.fillRect(x + s * dx, y + s * dy, s * w2, s * h2);
      c.strokeStyle = "rgba(90,100,30,.7)"; c.lineWidth = .5; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + s * dx, y + s * (dy + h2 * i / 4)); c.lineTo(x + s * (dx + w2), y + s * (dy + h2 * i / 4)); c.stroke(); }
    }
    c.strokeStyle = ink;
  }
  // 投影
  c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.ellipse(x + s * .15, y + s * .66, s * 1.4, s * .34, 0, 0, 7); c.fill();
  const hip = (cx, by, w, h, col, colD) => { // 歇山顶
    c.beginPath(); c.moveTo(cx - w * .62, by); c.quadraticCurveTo(cx - w * .25, by - h * .25, cx - w * .3, by - h * .55); c.lineTo(cx, by - h); c.lineTo(cx + w * .3, by - h * .55); c.quadraticCurveTo(cx + w * .25, by - h * .25, cx + w * .62, by);
    c.quadraticCurveTo(cx, by - h * .18, cx - w * .62, by); c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = .8; c.strokeStyle = ink; c.stroke();
    c.fillStyle = colD || "rgba(0,0,0,.25)"; c.beginPath(); c.moveTo(cx, by - h); c.lineTo(cx + w * .3, by - h * .55); c.quadraticCurveTo(cx + w * .25, by - h * .25, cx + w * .62, by); c.quadraticCurveTo(cx + w * .3, by - h * .12, cx, by - h * .18); c.closePath(); c.fill();
  };
  if (tr === "fort") { // 关隘：石砌敌台 + 箭楼 + 两侧城墙延伸
    c.fillStyle = PAL.wallD; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(x - s * 1.6, y + s * .5); c.lineTo(x - s * 1.5, y - s * .1); c.lineTo(x - s * .7, y - s * .1); c.lineTo(x - s * .7, y + s * .5); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x + s * 1.6, y + s * .5); c.lineTo(x + s * 1.5, y - s * .1); c.lineTo(x + s * .7, y - s * .1); c.lineTo(x + s * .7, y + s * .5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = PAL.wall; c.beginPath(); c.moveTo(x - s * .8, y + s * .55); c.lineTo(x - s * .65, y - s * .6); c.lineTo(x + s * .65, y - s * .6); c.lineTo(x + s * .8, y + s * .55); c.closePath(); c.fill(); c.lineWidth = 1.3; c.stroke();
    c.strokeStyle = "rgba(0,0,0,.3)"; c.lineWidth = .5; for (let i = 0; i < 4; i++) { const yy = y - s * .4 + i * s * .27; c.beginPath(); c.moveTo(x - s * .72, yy); c.lineTo(x + s * .72, yy); c.stroke(); for (let q = -2; q <= 2; q++) { c.beginPath(); c.moveTo(x + q * s * .3 + (i % 2) * s * .15, yy); c.lineTo(x + q * s * .3 + (i % 2) * s * .15, yy + s * .27); c.stroke(); } } c.strokeStyle = ink;
    c.fillStyle = ink; c.beginPath(); c.moveTo(x - s * .18, y + s * .55); c.lineTo(x - s * .18, y + s * .05); c.quadraticCurveTo(x, y - s * .15, x + s * .18, y + s * .05); c.lineTo(x + s * .18, y + s * .55); c.fill();
    c.fillStyle = PAL.wall; c.lineWidth = 1; c.beginPath(); for (let i = -2; i <= 2; i++) c.rect(x + i * s * .3 - s * .08, y - s * .78, s * .16, s * .18); c.fill(); c.stroke();
    c.fillStyle = "#7E6E58"; c.fillRect(x - s * .45, y - s * 1.1, s * .9, s * .35); c.strokeRect(x - s * .45, y - s * 1.1, s * .9, s * .35);
    hip(x, y - s * 1.1, s * 1.2, s * .45, PAL.roof, PAL.roofD);
  } else if (tr === "barren" && !cap) { // 贫瘠：几间破屋、一圈篱笆
    c.strokeStyle = "#6E5A42"; c.lineWidth = .9; c.beginPath(); c.moveTo(x - s * 1.3, y + s * .5); c.lineTo(x - s * 1.1, y - s * .05); c.lineTo(x + s * 1.1, y - s * .05); c.lineTo(x + s * 1.3, y + s * .5); c.stroke();
    for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(x + i * s * .27, y - s * .05); c.lineTo(x + i * s * .27, y + s * .25); c.stroke(); }
    c.strokeStyle = ink;
    for (const [dx, hw, hh] of [[-.6, .8, .5], [.5, .7, .45]]) { const hx = x + s * dx, by = y + s * .05; c.fillStyle = PAL.wall; c.lineWidth = .7; c.fillRect(hx - s * hw * .4, by - s * hh * .55, s * hw * .8, s * hh * .55); c.strokeRect(hx - s * hw * .4, by - s * hh * .55, s * hw * .8, s * hh * .55);
      c.fillStyle = "#8A7A5A"; c.beginPath(); c.moveTo(hx - s * hw * .5, by - s * hh * .55); c.lineTo(hx, by - s * hh * 1.05); c.lineTo(hx + s * hw * .5, by - s * hh * .55); c.closePath(); c.fill(); c.stroke(); }
    c.fillStyle = "rgba(90,70,40,.5)"; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x + (i - 1.5) * s * .5, y + s * .4, s * .08, 0, 7); c.fill(); }
  } else {
    const strong = tr === "strong", w = s * (cap ? 1.5 : strong ? 1.35 : 1.15), h = s * (strong ? .78 : .62), top = y - h * .4;
    // 城墙后的屋舍：人口越多越密
    const n = Math.min(6, 2 + o.pb + (cap ? 1 : 0)), houses = [];
    for (let i = 0; i < n; i++) houses.push([(i - (n - 1) / 2) * (1.7 / Math.max(1, n - 1)) * .95, .8 + (i % 2) * .25, .5 + ((i * 7) % 3) * .08]);
    for (const [dx, hw, hh] of houses) { const hx = x + w * dx, by = top - s * .05; c.fillStyle = PAL.wall; c.lineWidth = .7; c.fillRect(hx - s * hw * .4, by - s * hh * .55, s * hw * .8, s * hh * .55); c.strokeStyle = ink; c.strokeRect(hx - s * hw * .4, by - s * hh * .55, s * hw * .8, s * hh * .55); hip(hx, by - s * hh * .55, s * hw, s * hh * .5, tr === "rich" ? "#C98F2E" : PAL.roof, tr === "rich" ? "#8E5E14" : PAL.roofD); }
    if (tr === "rich" && !cap) { // 富庶：高塔楼阁
      c.fillStyle = PAL.wall; c.fillRect(x - s * .22, top - s * 1.3, s * .44, s * .8); c.strokeRect(x - s * .22, top - s * 1.3, s * .44, s * .8);
      hip(x, top - s * 1.3, s * .7, s * .32, "#D9A93A", "#A87A1E"); hip(x, top - s * .9, s * .75, s * .3, "#D9A93A", "#A87A1E");
      c.fillStyle = "#F2D27A"; c.beginPath(); c.arc(x, top - s * 1.68, s * .09, 0, 7); c.fill();
    }
    if (cap) { // 宫阙：高台 + 两层殿宇
      const px = x, pb2 = top - s * .55;
      c.fillStyle = "#C9BBA0"; c.lineWidth = .9; c.fillRect(px - s * .62, pb2 - s * .18, s * 1.24, s * .18); c.strokeRect(px - s * .62, pb2 - s * .18, s * 1.24, s * .18);
      c.fillStyle = "#B23A32"; c.fillRect(px - s * .5, pb2 - s * .62, s, s * .44); c.strokeRect(px - s * .5, pb2 - s * .62, s, s * .44);
      c.strokeStyle = "rgba(255,230,180,.6)"; c.lineWidth = .5; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(px + i * s * .2, pb2 - s * .6); c.lineTo(px + i * s * .2, pb2 - s * .2); c.stroke(); } c.strokeStyle = ink;
      hip(px, pb2 - s * .62, s * 1.6, s * .55, "#C9A227", "#8E6E10");
      c.fillStyle = "#B23A32"; c.fillRect(px - s * .3, pb2 - s * 1.4, s * .6, s * .3); c.lineWidth = .7; c.strokeRect(px - s * .3, pb2 - s * 1.4, s * .6, s * .3);
      hip(px, pb2 - s * 1.4, s * 1.05, s * .5, "#C9A227", "#8E6E10");
      c.fillStyle = "#F2D27A"; c.beginPath(); c.arc(px, pb2 - s * 1.95, s * .1, 0, 7); c.fill();
    }
    // 城墙与垛口
    c.fillStyle = PAL.wall; c.lineWidth = 1.2; c.strokeStyle = ink;
    c.beginPath(); c.moveTo(x - w, top + h); c.lineTo(x - w * .96, top); c.lineTo(x + w * .96, top); c.lineTo(x + w, top + h); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "rgba(0,0,0,.18)"; c.beginPath(); c.moveTo(x - w, top + h); c.lineTo(x - w * .96, top); c.lineTo(x - w * .96 + s * .3, top); c.lineTo(x - w + s * .3, top + h); c.closePath(); c.fill();
    c.strokeStyle = "rgba(0,0,0,.3)"; c.lineWidth = .5; c.beginPath(); c.moveTo(x - w * .97, top + h * .5); c.lineTo(x + w * .97, top + h * .5); c.stroke(); for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * w * .28, top); c.lineTo(x + i * w * .28, top + h * .5); c.moveTo(x + (i + .5) * w * .28, top + h * .5); c.lineTo(x + (i + .5) * w * .28, top + h); c.stroke(); } c.strokeStyle = ink;
    const nm = cap ? 7 : strong ? 7 : 5, mw = w * 2 / (nm * 2 - 1);
    c.fillStyle = PAL.wall; c.lineWidth = .9; c.beginPath(); for (let i = 0; i < nm; i++) c.rect(x - w * .96 + i * mw * .96 * 2, top - s * .22, mw * .96, s * .22); c.fill(); c.stroke();
    // 两侧角楼（尚武更高，带箭楼与红旗）
    for (const sx of [-1, 1]) { const tx = x + sx * w * .86, th = strong ? .75 : .5; c.fillStyle = PAL.wall; c.fillRect(tx - s * .18, top - s * th, s * .36, s * th); c.strokeRect(tx - s * .18, top - s * th, s * .36, s * th); hip(tx, top - s * th, s * .52, s * .3, PAL.roof, PAL.roofD);
      if (strong) { c.fillStyle = ink; c.fillRect(tx - s * .05, top - s * .62, s * .1, s * .14); c.strokeStyle = ink; c.lineWidth = .8; c.beginPath(); c.moveTo(tx, top - s * th - s * .3); c.lineTo(tx, top - s * th - s * .85); c.stroke(); c.fillStyle = "#D9483B"; c.beginPath(); c.moveTo(tx, top - s * th - s * .85); c.lineTo(tx + sx * s * .42, top - s * th - s * .72); c.lineTo(tx, top - s * th - s * .58); c.closePath(); c.fill(); } }
    // 城门
    c.beginPath(); c.moveTo(x - s * .22, top + h); c.lineTo(x - s * .22, top + h * .45); c.quadraticCurveTo(x, top + h * .05, x + s * .22, top + h * .45); c.lineTo(x + s * .22, top + h); c.closePath(); c.fillStyle = ink; c.fill();
    c.fillStyle = tr === "rich" ? "#E0B13F" : "#C9A86A"; c.fillRect(x - s * .3, top - s * .22, s * .6, s * .12);
    if (tr === "rich") { // 市集彩棚
      for (const [dx, col] of [[-.95, "#D9483B"], [.55, "#3E7DB3"]]) { c.fillStyle = col; c.fillRect(x + s * dx, top + h + s * .02, s * .4, s * .16); c.fillStyle = "#F4E8C8"; c.fillRect(x + s * dx + s * .1, top + h + s * .02, s * .1, s * .16); c.fillRect(x + s * dx + s * .3, top + h + s * .02, s * .1, s * .16); }
    }
  }
  if (o.owner) { // 城头旗
    const fx = x + s * (tr === "fort" ? .62 : .98), fy = y - s * (cap ? 1.75 : tr === "fort" ? 1.5 : tr === "strong" ? 1.4 : 1.15), wv = Math.sin(o.now * 4) * 2;
    c.strokeStyle = ink; c.lineWidth = 1.3; c.beginPath(); c.moveTo(fx, fy + s * .75); c.lineTo(fx, fy - s * .1); c.stroke();
    c.beginPath(); c.moveTo(fx, fy - s * .1); c.quadraticCurveTo(fx + s * .5, fy - s * .28 + wv, fx + s * 1, fy + s * .02); c.quadraticCurveTo(fx + s * .5, fy + s * .16 + wv, fx, fy + s * .34); c.closePath();
    c.fillStyle = o.owner; c.fill(); c.lineWidth = .9; c.stroke();
    c.fillStyle = "#F2D27A"; c.beginPath(); c.arc(fx, fy - s * .14, s * .09, 0, 7); c.fill();
  }
  c.restore();
};
Renderer.prototype.sealRaw = function (x, y, n, col, stale, gl) { // 兵力徽记；精兵前面加一枚黑底兵种字
  const c = this.ctx, txt = String(n);
  c.save(); c.globalAlpha = stale ? .62 : 1;
  c.font = `800 12px ${NUMF}`; const tw = Math.max(22, c.measureText(txt).width + 10), gw = gl ? 16 : 0, w = tw + gw, h = 19;
  rr(c, x - w / 2, y - h / 2, w, h, 3); c.fillStyle = col; c.fill();
  c.lineWidth = 1.6; c.strokeStyle = "rgba(10,10,14,.9)"; if (stale) c.setLineDash([2, 2]); c.stroke(); c.setLineDash([]);
  if (gl) { rr(c, x - w / 2 + 1.5, y - h / 2 + 1.5, gw, h - 3, 2); c.fillStyle = "#15151A"; c.fill(); c.fillStyle = col; c.font = `700 12px ${UIF}`; c.textAlign = "center"; c.fillText(gl, x - w / 2 + 1.5 + gw / 2, y + 4.4); c.font = `800 12px ${NUMF}`; }
  c.strokeStyle = "rgba(255,255,255,.5)"; c.lineWidth = 1; rr(c, x - w / 2 + 2.5 + gw, y - h / 2 + 2.5, tw - 5, h - 5, 2); c.stroke();
  c.fillStyle = "#FFFFFF"; c.textAlign = "center"; c.fillText(txt, x + gw / 2, y + 4.3);
  c.restore();
};
Renderer.prototype.tagRaw = function (x, y, ch, col) {
  const c = this.ctx; c.save();
  c.beginPath(); c.arc(x, y, 9, 0, 7); c.fillStyle = "rgba(20,22,28,.92)"; c.fill(); c.lineWidth = 1.6; c.strokeStyle = col; c.stroke();
  c.fillStyle = col; c.font = `700 12px ${UIF}`; c.textAlign = "center"; c.fillText(ch, x, y + 4.3); c.restore();
};
Renderer.prototype.stampRaw = function (x, y, ch, col, s) {
  const c = this.ctx; c.save();
  rr(c, x - s / 2, y - s / 2, s, s, 3); c.fillStyle = col; c.fill(); c.lineWidth = 1.5; c.strokeStyle = "rgba(10,10,14,.85)"; c.stroke();
  c.fillStyle = "#FFF4E2"; c.font = `700 ${s * .72}px ${UIF}`; c.textAlign = "center"; c.fillText(ch, x, y + s * .27); c.restore();
};
Renderer.prototype.ruinMark = function (x, y) {
  const c = this.ctx; c.save(); c.strokeStyle = "rgba(30,26,22,.85)"; c.lineWidth = 2; c.lineCap = "round";
  [[-14, 4, -8, -6], [-6, -6, -2, 2], [4, 6, 8, -8], [8, -8, 14, -2]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(x + a, y + b); c.lineTo(x + d, y + e); c.stroke(); });
  c.fillStyle = "rgba(40,36,32,.45)"; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(x + (h2(i, 3, 9) - .5) * 30, y + 8 + (h2(i, 5, 9) - .5) * 10, 2 + h2(i, 7, 9) * 2, 0, 7); c.fill(); }
  c.restore();
};
/* ---------- 兵团：小人（按兵力多少排成方阵），逐帧预渲染后贴图 ---------- */
const SKIN = "#E8CFA6", INKD = "#1E1A16", STEEL = "#D9D2C2", WOOD = "#6E4A2C";
function shade(hex, k) { const c = hexRGB(hex); return `rgb(${c.map(v => Math.round(v * k)).join(",")})`; }
// 步卒：style 决定甲胄、头饰、兵器、盾牌；ph 为步伐相位
const FOOT = {
  army:     { armor: "lamellar", head: "dou", weapon: "ge", shield: "rect" },
  xianzhen: { armor: "black", head: "plume", weapon: "dao", shield: "tower", cape: 1 },
  wudang:   { armor: "cloth", head: "hat", weapon: "spear", shield: null, bow: 1 },
  daji:     { armor: "heavy", head: "crest", weapon: "ji", shield: "round" },
  lianu:    { armor: "leather", head: "cap", weapon: "nu", shield: null, quiver: 1 },
  tengjia:  { armor: "rattan", head: "band", weapon: "machete", shield: "rattan" },
  stealth:  { armor: "black", head: "band", weapon: "dao", shield: null, cape: 1 }
};
function footman(c, x, y, col, ph, sz, kind) {
  const S = FOOT[kind] || FOOT.army, sw = Math.sin(ph), bob = Math.abs(Math.cos(ph)) * .9, sh = sw * .6;
  c.save(); c.translate(x, y - bob); c.scale(sz, sz); c.lineCap = "round"; c.lineJoin = "round";
  const body = S.armor === "black" ? "#2E2A28" : S.armor === "rattan" ? "#B8913E" : S.armor === "leather" ? "#7A5636" : S.armor === "cloth" ? "#5E6B4A" : col;
  if (S.cape) { c.fillStyle = shade(col, .8); c.beginPath(); c.moveTo(-2.6, -15.4); c.quadraticCurveTo(-7.5, -10 + sw, -7 - sw, -3.6); c.lineTo(-2.4, -6); c.closePath(); c.fill(); }
  if (S.bow) { c.strokeStyle = WOOD; c.lineWidth = 1; c.beginPath(); c.arc(-2.6, -11.5, 5.4, -1.2, 1.4); c.stroke(); c.strokeStyle = "rgba(240,230,210,.8)"; c.lineWidth = .4; c.beginPath(); c.moveTo(-2.6 + 5.4 * Math.cos(-1.2), -11.5 + 5.4 * Math.sin(-1.2)); c.lineTo(-2.6 + 5.4 * Math.cos(1.4), -11.5 + 5.4 * Math.sin(1.4)); c.stroke(); }
  if (S.quiver) { c.fillStyle = "#5A3A22"; c.save(); c.translate(-3, -12); c.rotate(-.35); c.fillRect(-1.3, -4, 2.6, 8); c.fillStyle = "#E8DCC0"; c.fillRect(-1.1, -5.6, .7, 1.8); c.fillRect(.3, -5.9, .7, 2); c.restore(); }
  c.strokeStyle = "#3A2E24"; c.lineWidth = 2.1;
  c.beginPath(); c.moveTo(-.6, -7); c.lineTo(-.6 - sw * 3.2, -.4); c.stroke();
  c.strokeStyle = INKD; c.beginPath(); c.moveTo(.6, -7); c.lineTo(.6 + sw * 3.2, -.4); c.stroke();
  c.lineWidth = 2.6; c.beginPath(); c.moveTo(-.6 - sw * 3.2 - .3, 0); c.lineTo(-.6 - sw * 3.2 + 1.4, 0); c.moveTo(.6 + sw * 3.2 - .3, 0); c.lineTo(.6 + sw * 3.2 + 1.6, 0); c.stroke();
  const W2 = S.weapon;
  if (W2 === "ge" || W2 === "ji" || W2 === "spear") {
    const tx = 6.5, ty = -30 + sh;
    c.strokeStyle = WOOD; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-4.5, -1.5 + sh); c.lineTo(tx, ty); c.stroke();
    c.fillStyle = STEEL; c.strokeStyle = INKD; c.lineWidth = .6;
    if (W2 === "ge") { c.beginPath(); c.moveTo(tx - .6, ty + 1.6); c.lineTo(tx + 4.8, ty + 3.6); c.lineTo(tx + 4.2, ty + 4.6); c.lineTo(tx - 1, ty + 3.2); c.closePath(); c.fill(); c.stroke(); }
    else { c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + 2.1, ty - 5.4); c.lineTo(tx - 1.1, ty - .8); c.closePath(); c.fill(); c.stroke(); }
    if (W2 === "ji") { c.beginPath(); c.moveTo(tx - .3, ty + 1.5); c.quadraticCurveTo(tx + 4.6, ty + .4, tx + 4.2, ty + 4.8); c.quadraticCurveTo(tx + 2.4, ty + 3, tx - .8, ty + 3.4); c.closePath(); c.fill(); c.stroke(); }
    c.fillStyle = "#D9483B"; c.beginPath(); c.arc(tx - .6, ty + 1.2, 1.1, 0, 7); c.fill();
  }
  c.beginPath(); c.moveTo(-3.3, -15.5); c.lineTo(3.1, -15.5); c.lineTo(3.6, -8.6); c.lineTo(4.4, -5.2); c.lineTo(-4.4, -5.2); c.lineTo(-3.6, -8.6); c.closePath();
  c.fillStyle = body; c.fill(); c.strokeStyle = INKD; c.lineWidth = 1; c.stroke();
  if (S.armor === "lamellar" || S.armor === "heavy" || S.armor === "black") {
    c.fillStyle = S.armor === "black" ? "rgba(200,190,170,.35)" : "rgba(255,246,226,.42)";
    for (let r2 = 0; r2 < 3; r2++) for (let q = 0; q < 4; q++) c.fillRect(-2.7 + q * 1.5 + (r2 % 2) * .7, -14.4 + r2 * 2, .9, 1.2);
    if (S.armor === "heavy") { c.fillStyle = STEEL; c.beginPath(); c.ellipse(-2.6, -14.6, 2, 1.3, 0, 0, 7); c.fill(); c.stroke(); }
  } else if (S.armor === "rattan") { c.strokeStyle = "rgba(90,60,20,.6)"; c.lineWidth = .5; for (let q = -3; q <= 3; q++) { c.beginPath(); c.moveTo(q - 1, -15); c.lineTo(q + 1.5, -5.6); c.stroke(); } }
  else { c.fillStyle = col; c.fillRect(-3.7, -9.4, 7.4, 1.6); }
  c.strokeStyle = INKD; c.lineWidth = 1; c.beginPath(); c.moveTo(-3.6, -8.6); c.lineTo(3.6, -8.6); c.stroke();
  if (S.armor !== "lamellar" && S.armor !== "heavy" && S.armor !== "rattan") { c.fillStyle = col; c.beginPath(); c.moveTo(-1.6, -15.4); c.lineTo(1.6, -15.4); c.lineTo(.4, -11.6); c.closePath(); c.fill(); }
  c.beginPath(); c.arc(.3, -18.6, 2.8, 0, 7); c.fillStyle = SKIN; c.fill(); c.strokeStyle = INKD; c.lineWidth = .8; c.stroke();
  c.fillStyle = INKD; c.beginPath(); c.arc(1.9, -18.4, .45, 0, 7); c.fill();
  const H = S.head;
  if (H === "hat") { c.fillStyle = "#C9A86A"; c.beginPath(); c.moveTo(-5.2, -19.6); c.lineTo(.3, -24.6); c.lineTo(5.8, -19.6); c.closePath(); c.fill(); c.strokeStyle = INKD; c.lineWidth = .7; c.stroke(); c.strokeStyle = "rgba(90,60,30,.5)"; c.beginPath(); c.moveTo(-2.4, -21.6); c.lineTo(3, -21.6); c.stroke(); }
  else if (H === "band") { c.fillStyle = INKD; c.beginPath(); c.arc(.3, -19.2, 2.9, Math.PI, 0); c.fill(); c.strokeStyle = col; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-2.6, -19.4); c.lineTo(3.1, -19.4); c.stroke(); c.beginPath(); c.moveTo(-2.6, -19.4); c.quadraticCurveTo(-4.6, -18 + sw, -5.6, -16.6); c.stroke(); }
  else if (H === "cap") { c.fillStyle = "#4A3424"; c.beginPath(); c.arc(.3, -19.4, 3, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); c.fill(); c.fillRect(-.6, -24, 1.8, 2.6); }
  else {
    c.beginPath(); c.arc(.3, -19, 3.1, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(3.6, -18.2); c.lineTo(-3, -17.2); c.closePath(); c.fillStyle = H === "crest" ? "#6E6A62" : INKD; c.fill();
    c.strokeStyle = "#D9483B"; c.lineWidth = H === "plume" ? 2.2 : 1.6; c.beginPath(); c.moveTo(.2, -22); c.quadraticCurveTo(-1.6, -24.8, -3.8, -24 + sw * .5); c.stroke();
    if (H === "crest") { c.strokeStyle = INKD; c.lineWidth = .9; c.beginPath(); c.moveTo(.3, -22); c.lineTo(.3, -25.6); c.stroke(); c.fillStyle = "#D6B46A"; c.beginPath(); c.arc(.3, -25.8, .9, 0, 7); c.fill(); }
  }
  if (W2 === "nu") {
    c.strokeStyle = WOOD; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-1, -12.6); c.lineTo(8, -13.2); c.stroke();
    c.strokeStyle = INKD; c.lineWidth = .9; c.beginPath(); c.moveTo(7, -16.6); c.quadraticCurveTo(8.6, -13.2, 7, -9.8); c.stroke();
    c.strokeStyle = "rgba(240,230,210,.9)"; c.lineWidth = .4; c.beginPath(); c.moveTo(7, -16.6); c.lineTo(5.2, -13); c.lineTo(7, -9.8); c.stroke();
    c.fillStyle = SKIN; c.beginPath(); c.arc(1.4, -12.6, 1.1, 0, 7); c.arc(4.6, -12.9, 1.1, 0, 7); c.fill();
  } else if (W2 === "dao" || W2 === "machete") {
    c.fillStyle = SKIN; c.beginPath(); c.arc(2.6, -14.6, 1.2, 0, 7); c.fill();
    c.strokeStyle = STEEL; c.lineWidth = W2 === "dao" ? 1.5 : 1.8; c.beginPath(); c.moveTo(2.6, -14.6); c.quadraticCurveTo(W2 === "dao" ? 4.5 : 6.5, -20 + sh, W2 === "dao" ? 3.6 : 6, -25 + sh); c.stroke();
    c.strokeStyle = INKD; c.lineWidth = .5; c.stroke();
    if (W2 === "dao") { c.strokeStyle = "#D6B46A"; c.lineWidth = .8; c.beginPath(); c.arc(2.2, -13.4, .9, 0, 7); c.stroke(); }
  } else { c.fillStyle = SKIN; c.strokeStyle = INKD; c.lineWidth = .6; c.beginPath(); c.arc(1.9, -13.4, 1.25, 0, 7); c.fill(); c.stroke(); }
  const SH = S.shield;
  if (SH === "rect" || SH === "tower") {
    const h = SH === "tower" ? 11 : 8.4, w = SH === "tower" ? 5 : 4.2, top = SH === "tower" ? -16.4 : -14.6;
    c.fillStyle = "#6B4A2E"; c.strokeStyle = INKD; c.lineWidth = 1; c.beginPath(); c.rect(2.2, top, w, h); c.fill(); c.stroke();
    c.fillStyle = col; c.fillRect(2.8, top + 1, w - 1.2, h * .32); c.fillRect(2.8, top + h * .62, w - 1.2, h * .3);
    c.fillStyle = "#D6B46A"; c.beginPath(); c.arc(2.2 + w / 2, top + h / 2, .9, 0, 7); c.fill();
  } else if (SH === "round" || SH === "rattan") {
    c.beginPath(); c.ellipse(3.8, -10.8, 2.9, 4.6, 0, 0, 7); c.fillStyle = SH === "rattan" ? "#C49A48" : shade(col, .62); c.fill(); c.strokeStyle = INKD; c.lineWidth = 1; c.stroke();
    if (SH === "rattan") { c.strokeStyle = "rgba(90,60,20,.7)"; c.lineWidth = .5; for (let q = 1; q <= 2; q++) { c.beginPath(); c.ellipse(3.8, -10.8, 2.9 * q / 3, 4.6 * q / 3, 0, 0, 7); c.stroke(); } }
    else { c.beginPath(); c.arc(3.9, -10.8, 1, 0, 7); c.fillStyle = "#D6B46A"; c.fill(); }
  }
  c.restore();
}
// 骑兵：普通骑兵 / 虎豹骑（具装甲马，虎纹马铠）
function horseman(c, x, y, col, ph, sz, elite) {
  const g = Math.sin(ph), g2 = Math.sin(ph + 1.6), lift = Math.max(0, Math.sin(ph * 2)) * 1.2;
  c.save(); c.translate(x, y - lift); c.scale(sz, sz); c.lineCap = "round"; c.lineJoin = "round";
  const horse = elite ? "#3E2E24" : "#5B3E2A", hoof = INKD;
  const leg = (hx, hy, a1, a2, far) => {
    const kx = hx + Math.sin(a1) * 4.2, ky = hy + Math.cos(a1) * 4.2, fx = kx + Math.sin(a2) * 4, fy = ky + Math.cos(a2) * 4;
    c.strokeStyle = far ? "#2E2016" : horse; c.lineWidth = 2; c.beginPath(); c.moveTo(hx, hy); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
    c.strokeStyle = hoof; c.lineWidth = 2.2; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + .8, fy + .5); c.stroke();
  };
  leg(6, -8, g * .7, g * .7 - .5, 1); leg(-6, -8, -g2 * .7, -g2 * .7 + .4, 1);
  c.strokeStyle = INKD; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-9, -11); c.quadraticCurveTo(-14, -12 + g, -15.5, -6 + g * 1.5); c.stroke();
  c.beginPath(); c.ellipse(0, -10.5, 9.6, 4.6, 0, 0, 7); c.fillStyle = horse; c.fill(); c.strokeStyle = INKD; c.lineWidth = 1; c.stroke();
  c.beginPath(); c.moveTo(5.6, -13.5); c.quadraticCurveTo(8.6, -19, 11, -20.5); c.lineTo(15.6, -16.8); c.lineTo(14.4, -15.2); c.lineTo(10.8, -16.4); c.quadraticCurveTo(9.4, -12, 8.6, -9.4); c.closePath();
  c.fillStyle = horse; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(11.2, -20.4); c.lineTo(11.6, -22.6); c.lineTo(12.6, -20.2); c.fillStyle = horse; c.fill(); c.stroke();
  c.fillStyle = INKD; c.beginPath(); c.arc(12.6, -18.4, .55, 0, 7); c.fill();
  c.strokeStyle = INKD; c.lineWidth = 1.6; c.beginPath(); c.moveTo(10.6, -20.4); c.quadraticCurveTo(7.6, -19, 5.6, -14.4 + g * .4); c.stroke();
  if (elite) {
    c.beginPath(); c.moveTo(-8.6, -14); c.lineTo(7, -14.6); c.lineTo(9.4, -8.6); c.lineTo(-9.4, -7.6); c.closePath(); c.fillStyle = "#C9862E"; c.fill(); c.strokeStyle = INKD; c.lineWidth = .9; c.stroke();
    c.strokeStyle = "#2A1E14"; c.lineWidth = 1.1; for (let q = -6; q <= 6; q += 3) { c.beginPath(); c.moveTo(q, -14.2); c.quadraticCurveTo(q + 1.4, -11.6, q - .4, -8.4); c.stroke(); }
    c.fillStyle = "#8C8678"; c.beginPath(); c.moveTo(11, -20.4); c.lineTo(15.6, -16.8); c.lineTo(14.4, -15.2); c.lineTo(10.6, -17); c.closePath(); c.fill(); c.strokeStyle = INKD; c.lineWidth = .6; c.stroke();
    c.fillStyle = "#D9483B"; c.beginPath(); c.arc(11.4, -21.6, 1, 0, 7); c.fill();
  } else {
    c.beginPath(); c.moveTo(-4.6, -14.4); c.lineTo(3.6, -14.6); c.lineTo(4.2, -8.8); c.lineTo(-5.2, -8.8); c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = INKD; c.lineWidth = .8; c.stroke();
    c.strokeStyle = "#D6B46A"; c.lineWidth = .8; c.beginPath(); c.moveTo(-5, -9.8); c.lineTo(4, -9.8); c.stroke();
  }
  leg(6.5, -7.6, -g * .8, -g * .8 - .4, 0); leg(-5.5, -7.6, g2 * .8, g2 * .8 + .5, 0);
  const arm = elite ? "#2E2A28" : shade(col, .85);
  c.beginPath(); c.moveTo(-2.4, -14.5); c.lineTo(2.8, -14.5); c.lineTo(2.2, -22.4); c.lineTo(-1.8, -22.4); c.closePath(); c.fillStyle = arm; c.fill(); c.strokeStyle = INKD; c.lineWidth = .9; c.stroke();
  c.fillStyle = elite ? "rgba(214,180,106,.6)" : "rgba(255,246,226,.45)"; for (let r2 = 0; r2 < 3; r2++) for (let q = 0; q < 3; q++) c.fillRect(-1.5 + q * 1.3 + (r2 % 2) * .6, -21.4 + r2 * 2, .8, 1.1);
  if (elite) { c.fillStyle = col; c.beginPath(); c.moveTo(-1.8, -22); c.quadraticCurveTo(-6, -19 + g, -6.6 - g, -14); c.lineTo(-2, -15.4); c.closePath(); c.fill(); }
  c.beginPath(); c.arc(.4, -25, 2.5, 0, 7); c.fillStyle = SKIN; c.fill(); c.strokeStyle = INKD; c.lineWidth = .7; c.stroke();
  c.beginPath(); c.arc(.4, -25.4, 2.8, Math.PI, 0); c.lineTo(3.2, -24.4); c.lineTo(-2.4, -23.6); c.closePath(); c.fillStyle = elite ? "#6E6A62" : INKD; c.fill();
  c.strokeStyle = "#D9483B"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(.4, -28); c.quadraticCurveTo(-1.6, -30.4, -3.8, -29.4 + g * .6); c.stroke();
  c.strokeStyle = WOOD; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-6, -15); c.lineTo(18, -27.5); c.stroke();
  c.fillStyle = STEEL; c.strokeStyle = INKD; c.lineWidth = .6; c.beginPath(); c.moveTo(18, -27.5); c.lineTo(23, -30.4); c.lineTo(17.6, -28.6); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(16.4, -26.7); c.quadraticCurveTo(13.6, -27 + g, 11, -23.2 + g); c.lineTo(14.6, -24.6); c.closePath(); c.fillStyle = col; c.fill(); c.stroke();
  c.fillStyle = SKIN; c.beginPath(); c.arc(2.6, -18.6, 1.1, 0, 7); c.fill();
  c.restore();
}
// 牙旗：竖长旗、火焰牙边，旗面写主公名号首字
function standard(c, x, y, col, ch, wv, flip = 1, elite = false) {
  c.save(); c.translate(x, y); c.lineCap = "round"; c.lineJoin = "round";
  c.strokeStyle = WOOD; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -40); c.stroke();
  c.fillStyle = "#D6B46A"; c.beginPath(); c.arc(0, -41, 1.6, 0, 7); c.fill();
  const top = -38, bot = -16, w = 13;
  c.beginPath(); c.moveTo(0, top); c.quadraticCurveTo(-w * .5, top - 1 + wv * .4, -w, top + wv * .5);
  for (let i = 0; i <= 5; i++) { const yy = top + (bot - top) * i / 5, xx = -w + Math.sin(i * 1.3 + wv) * 1.1; c.lineTo(xx, yy); c.lineTo(xx - 2.4, yy + (bot - top) / 10); }
  c.lineTo(-w + 1, bot); c.quadraticCurveTo(-w * .5, bot + 1 + wv * .4, 0, bot); c.closePath();
  c.fillStyle = elite ? INKD : col; c.fill(); c.strokeStyle = elite ? col : INKD; c.lineWidth = elite ? 1.6 : 1; c.stroke();
  c.beginPath(); c.rect(-w + 2.4, top + 2.6, w - 4.4, bot - top - 5.2); c.strokeStyle = "rgba(255,240,215,.55)"; c.lineWidth = .8; c.stroke();
  c.fillStyle = elite ? "#F3DFA8" : "#FFF6E4"; c.font = `700 13px ${UIF}`; c.textAlign = "center"; c.textBaseline = "middle"; c.translate(-w / 2 + .6, (top + bot) / 2 + .5); c.scale(flip, 1); c.fillText(ch, 0, 0);
  c.restore();
}
const FOOT_POS = [[-3, 2], [5, 1], [1, -4], [12, 2], [-9, -3], [8, -5]];
Renderer.prototype.troop = function (x, y, ang, col, a, now, hl) {
  const c = this.ctx, face = Math.cos(ang) >= 0 ? 1 : -1, U = UNITS[a.kind];
  const cav = a.kind === "cavalry" || a.kind === "hubao" || (!U && a.kind !== "stealth" && a.speed > 1), elite = a.kind === "hubao";
  const sim = this.sim, P = sim.P[a.owner], ch = U ? U.g : a.hunt ? "截" : (P && P.name ? [...P.name][0] : "军");
  const n = cav ? (a.troops < 15 ? 1 : 2) : U ? (a.troops < 8 ? 2 : a.troops < 20 ? 3 : 4) : a.troops < 12 ? 2 : a.troops < 30 ? 3 : a.troops < 60 ? 4 : a.troops < 110 ? 5 : 6;
  const F = 8, fr = Math.floor(((now * (cav ? 2.2 : a.kind === "wudang" ? 1.7 : 1.3)) % 1) * F) % F;
  const zs = Math.max(.85, Math.min(1.3, this.cam.z / this.fitZ() / 1.7)), sz = Math.round(zs * 10) / 10 * (U ? 1.08 : 1);
  c.save();
  for (let i = 0; i < 3; i++) { const t = ((now * 1.4) + i / 3) % 1; c.globalAlpha = .28 * (1 - t); c.fillStyle = "#A08A6A"; c.beginPath(); c.arc(x - face * (12 + t * 16) * sz, y + 2 - t * 4, (3 + t * 5) * sz, 0, 7); c.fill(); }
  c.restore();
  if (hl) { c.save(); c.strokeStyle = `rgba(255,214,90,${.6 + .4 * Math.sin(now * 6)})`; c.lineWidth = 3; c.setLineDash([5, 4]); c.beginPath(); c.arc(x, y - 10 * sz, 28 * sz, 0, 7); c.stroke(); c.restore(); }
  if (U) { c.save(); c.globalAlpha = .5 + .25 * Math.sin(now * 4); c.fillStyle = col; c.beginPath(); c.ellipse(x, y + 2, 22 * sz, 6 * sz, 0, 0, 7); c.fill(); c.restore(); }
  const W = 70, H = 64, OY = 50, OX = face > 0 ? 34 : W - 34;
  const cv = this.sprite(`T${a.kind}${cav ? "c" : "f"}${n}|${col}|${ch}|${fr}|${face}|${sz}`, W * sz, H * sz, OX * sz, OY * sz, (X, Y) => {
    const g = this.ctx, ph = fr / F * Math.PI * 2;
    g.save(); g.translate(X, Y); g.scale(sz * face, sz);
    g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(2, 1.5, cav ? 20 : 19, 4.6, 0, 0, 7); g.fill();
    standard(g, -15, 3, col, ch, Math.sin(ph) * 2, face, !!U);
    if (cav) {
      if (n > 1) horseman(g, -5, -3, shade(col, .9), ph + 2.1, .86, elite);
      horseman(g, 3, 2, col, ph, 1, elite);
    } else {
      FOOT_POS.slice(0, n).map((p, i) => [p, i]).sort((A, B) => A[0][1] - B[0][1]).forEach(([p, i]) => footman(g, p[0], p[1], col, ph + i * 1.9, p[1] < 0 ? .9 : 1, U ? a.kind : a.kind === "stealth" ? "stealth" : "army"));
    }
    g.restore();
  });
  c.drawImage(cv, x - OX * sz, y - OY * sz, W * sz, H * sz);
  this.seal(x, y - 52 * sz, Math.round(a.troops), col, false, U ? U.g : null);
};
Renderer.prototype.hexagon = function (x, y, r, col, lw) { const c = this.ctx; c.beginPath(); for (let k = 0; k < 7; k++) { const a = Math.PI / 3 * k + Math.PI / 6; c[k ? "lineTo" : "moveTo"](x + r * Math.cos(a), y + r * Math.sin(a)); } c.strokeStyle = col; c.lineWidth = lw; c.stroke(); };
Renderer.prototype.sparkle = function (x, y, now, col, n, rad) { const c = this.ctx; c.save(); c.fillStyle = col; for (let k = 0; k < n; k++) { const ph = (now * .6 + k / n) % 1, a = k * 2.4; c.globalAlpha = 1 - ph; c.beginPath(); c.arc(x + Math.cos(a) * rad * .6, y - ph * rad, 1.8, 0, 7); c.fill(); } c.restore(); };
Renderer.prototype.flame = function (x, y, now, s) { const c = this.ctx; c.save(); c.globalAlpha = .92; c.fillStyle = "#E8551E"; c.beginPath(); c.ellipse(x, y, 3.2 * s, (5.5 + Math.sin(now * 12)) * s, 0, 0, 7); c.fill(); c.fillStyle = "#F7C040"; c.beginPath(); c.ellipse(x, y + 1, 1.6 * s, 3.2 * s, 0, 0, 7); c.fill(); c.restore(); };
Renderer.prototype.paw = function (x, y, s) { const c = this.ctx; c.save(); c.fillStyle = "#8E5AD6"; c.beginPath(); c.ellipse(x, y + s * .3, s * .55, s * .45, 0, 0, 7); c.fill(); for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x + (k - 1) * s * .5, y - s * .45, s * .22, 0, 7); c.fill(); } c.restore(); };
Renderer.prototype.splash = function (x, y, r, col, alpha, seed) {
  const c = this.ctx; c.save(); c.globalAlpha = alpha; c.fillStyle = col;
  c.beginPath(); c.arc(x, y, r * .5, 0, 7); c.fill();
  for (let i = 0; i < 11; i++) { const a = h2(seed, i, 3) * 7, d = r * (.4 + h2(seed, i, 5) * .8), rr2 = r * (.08 + h2(seed, i, 7) * .18); c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr2, 0, 7); c.fill(); }
  c.restore();
};

/* ---------- 特效 ---------- */
Renderer.prototype.fx = function (f, age, S, now) {
  const c = this.ctx, sim = this.sim, regs = sim.map.regions, z = this.cam.z;
  const at = r => { const g = regs[r]; return S(g.x, g.y); };
  const k = (f.t0 * 7 + (f.r || 0) * 13) | 0, rnd = i => h2(k, i, 77);
  const ring = (p, r, col, w, a) => { c.save(); c.globalAlpha = Math.max(0, a); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(p.x, p.y, Math.max(0, r), 0, 7); c.stroke(); c.restore(); };
  const glyph = (p, ch, col, size, a) => { c.save(); c.globalAlpha = Math.max(0, a); c.font = `700 ${size}px ${UIF}`; c.textAlign = "center"; c.lineWidth = 4; c.strokeStyle = "rgba(10,12,16,.9)"; c.strokeText(ch, p.x, p.y); c.fillStyle = col; c.fillText(ch, p.x, p.y); c.restore(); };
  const sc = Math.max(.7, Math.min(1.8, z / this.fitZ() / 1.6));
  const melee = (p, ac, dc, au, du) => { // 两军交锋：小人相向冲杀
    if (age >= 1.9) return;
    const lunge = Math.abs(Math.sin(age * 9)) * 4, fade = age > 1.5 ? (1.9 - age) / .4 : 1;
    c.save(); c.globalAlpha = fade;
    const ak = UNITS[au] && au !== "hubao" ? au : "army", dk = UNITS[du] && du !== "hubao" ? du : "army";
    for (const [dx, dy, sc2, ph] of [[-15, 4, 1.45, 0], [-24, -2, 1.2, 1.7]]) { c.save(); c.translate(p.x + dx + lunge, p.y + dy); if (au === "hubao" || au === "cavalry") horseman(c, 0, 0, ac, age * 18 + ph, sc2 * .9, au === "hubao"); else footman(c, 0, 0, ac, age * 14 + ph, sc2, ak); c.restore(); }
    for (const [dx, dy, sc2, ph] of [[15, 4, 1.45, 2], [24, -2, 1.2, 3.1]]) { c.save(); c.translate(p.x + dx - lunge, p.y + dy); c.scale(-1, 1); if (du === "hubao" || du === "cavalry") horseman(c, 0, 0, dc, age * 18 + ph, sc2 * .9, du === "hubao"); else footman(c, 0, 0, dc, age * 14 + ph, sc2, dk); c.restore(); }
    c.restore();
  };
  const sparks = p => { if (age < 1.7) { c.save(); c.strokeStyle = "#FFD65A"; c.lineWidth = 1.6; c.lineCap = "round"; const cyc = (age * 5) % 1; c.globalAlpha = 1 - cyc; for (let i = 0; i < 6; i++) { const a = rnd(i + Math.floor(age * 5) * 7) * 7, d0 = 3 + cyc * 8, d1 = d0 + 6; c.beginPath(); c.moveTo(p.x + Math.cos(a) * d0, p.y - 8 + Math.sin(a) * d0); c.lineTo(p.x + Math.cos(a) * d1, p.y - 8 + Math.sin(a) * d1); c.stroke(); } c.restore(); } };
  const dust = (p, D, t) => { c.save(); for (let i = 0; i < 7; i++) { const a = rnd(i) * 7, d = 10 + t * 30; c.globalAlpha = .32 * (1 - t); c.fillStyle = "#B09A78"; c.beginPath(); c.arc(p.x + Math.cos(a) * d, p.y + 4 + Math.sin(a) * d * .45, 6 + t * 9, 0, 7); c.fill(); } c.restore(); };
  const blood = p => { if (age > 1.4) { const t2 = (age - 1.4) / 1.2; for (let i = 0; i < 8; i++) { const a = rnd(i) * 7, d = 8 + t2 * 30; c.fillStyle = `rgba(170,30,30,${1 - t2})`; c.beginPath(); c.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 2.4 * (1 - t2) + .8, 0, 7); c.fill(); } } };
  switch (f.kind) {
    case "march": { if (age > 1.2) return; const p = at(f.r), t = age / 1.2; for (let i = 0; i < 7; i++) { const a = rnd(i) * 7; c.fillStyle = `rgba(160,130,100,${.45 * (1 - t)})`; c.beginPath(); c.arc(p.x + Math.cos(a) * t * 26, p.y + 6 + Math.sin(a) * t * 12, 5 * (1 - t) + 2, 0, 7); c.fill(); } return; }
    case "battle": {
      const D = 2.6; if (age > D) return; const p = at(f.r), t = age / D;
      const ac = f.by && sim.P[f.by] ? sim.P[f.by].color : "#8E7A62", dc = f.def === "beast" ? "#8E5AD6" : f.def && sim.P[f.def] ? sim.P[f.def].color : "#A89B86";
      dust(p, D, t); melee(p, ac, dc, f.u, null); sparks(p); blood(p);
      if (age < 1.2) glyph({ x: p.x, y: p.y - 34 - age * 6 }, "战", "#FF5A40", 20, 1 - age / 1.2);
      return;
    }
    case "clash": { // 官道野战
      const D = 2.8; if (age > D) return; const p = S(f.x, f.y), t = age / D;
      const ac = f.by && sim.P[f.by] ? sim.P[f.by].color : "#8E7A62", dc = f.def && sim.P[f.def] ? sim.P[f.def].color : "#A89B86";
      dust(p, D, t); melee(p, ac, dc, f.u, f.u2); sparks(p); blood(p);
      if (age < 1.4) glyph({ x: p.x, y: p.y - 36 - age * 6 }, "截", "#FF5A40", 22, 1 - age / 1.4);
      ring(p, 10 + t * 40 * sc, "#FF5A40", 3 * (1 - t), (1 - t) * .7);
      return;
    }
    case "volley": {
      const D = 1.4; if (age > D) return; const p = at(f.r), t = age / D;
      c.save(); c.strokeStyle = "#1E1A16"; c.lineWidth = 1.2;
      for (let i = 0; i < 14; i++) { const a0 = rnd(i) * 7, tt = Math.min(1, Math.max(0, t * 1.6 - rnd(i + 40) * .5)); if (tt <= 0 || tt >= 1) continue;
        const fx2 = p.x + Math.cos(a0) * 70, fy2 = p.y - 60 + Math.sin(a0) * 20, x2 = fx2 + (p.x + (rnd(i + 9) - .5) * 30 - fx2) * tt, y2 = fy2 + (p.y + (rnd(i + 19) - .5) * 16 - fy2) * tt - Math.sin(tt * Math.PI) * 30;
        const ang = Math.atan2(p.y - fy2, p.x - fx2); c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - Math.cos(ang) * 7, y2 - Math.sin(ang) * 7); c.stroke(); }
      c.restore(); glyph({ x: p.x, y: p.y - 38 }, "弩", "#F4F1E8", 20, 1 - t); return;
    }
    case "train": { if (age > 1.8) return; const p = at(f.r), t = age / 1.8, U = UNITS[f.u]; ring(p, 10 + t * 30, "#F4F1E8", 3 * (1 - t) + .5, 1 - t); if (U) glyph({ x: p.x, y: p.y - 26 - t * 22 }, U.g, "#FF5A40", 22, 1 - t); return; }
    case "omen": {
      if (f.g || f.r == null) return; const D = 3.2; if (age > D) return; const p = at(f.r), t = age / D, col = f.good ? "#5BBF6E" : "#FF5A40";
      for (let i = 0; i < 2; i++) { const tt = ((age / 1.4) + i / 2) % 1; ring(p, 8 + tt * 46 * sc, col, 3 * (1 - tt) + .5, (1 - tt) * (1 - t)); }
      c.save(); c.globalAlpha = 1 - Math.max(0, t - .7) / .3; this.stamp(p.x, p.y - 34 - Math.min(1, age * 2) * 10, f.glyph, col, 24); c.restore();
      return;
    }
    case "capture": {
      if (age > 2.4) return; const p = at(f.r), col = f.by ? sim.P[f.by].color : "#F4F1E8", t = age / 2.4;
      ring(p, 10 + t * 50 * sc, col, 7 * (1 - t) + 1, (1 - t) * .8);
      const rise = Math.min(1, age * 2);
      c.save(); c.translate(p.x + 2, p.y - 6); c.globalAlpha = 1 - Math.max(0, t - .6) * 2.5;
      c.strokeStyle = "#1E1A16"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -34 * rise); c.stroke();
      c.beginPath(); c.moveTo(0, -34 * rise); c.lineTo(16, -29 * rise); c.lineTo(0, -23 * rise); c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 1; c.stroke();
      c.restore(); return;
    }
    case "reinforce": case "levy": case "settle": {
      if (age > 1.6) return; const p = at(f.r), t = age / 1.6, ch = f.kind === "settle" ? "民" : "兵";
      for (let i = 0; i < 3; i++) glyph({ x: p.x + (rnd(i) - .5) * 36, y: p.y - 10 - t * 34 - i * 6 }, i ? "+" : ch, f.kind === "settle" ? "#F2C14E" : "#5BBF6E", 16, 1 - t);
      return;
    }
    case "harvest": { if (age > 2.2) return; const p = at(f.r), t = age / 2.2; c.save(); for (let i = 0; i < 16; i++) { const a = rnd(i) * 7, d = 10 + rnd(i + 20) * 26; c.globalAlpha = 1 - t; c.fillStyle = i % 2 ? "#E0A82E" : "#F2C95E"; c.beginPath(); c.ellipse(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * .6 - t * 34, 1.6, 3, a, 0, 7); c.fill(); } c.restore(); glyph({ x: p.x, y: p.y - 26 - t * 10 }, "禾", "#F2C14E", 20, 1 - t); return; }
    case "mine": { if (age > 1.6) return; const p = at(f.r), t = age / 1.6; c.save(); for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + (rnd(i) - .5) * 2.4, d = t * (20 + rnd(i + 9) * 25); c.globalAlpha = 1 - t; c.fillStyle = i % 3 ? "#E0B13F" : "#9A9A96"; c.fillRect(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d + t * t * 30, 3, 3); } c.restore(); glyph({ x: p.x, y: p.y - 22 }, "矿", "#F2C14E", 18, 1 - t); return; }
    case "tax": {
      if (age > 1.8) return; const t = age / 1.8, me = this.me, capR = regs[sim.P[me].capital], cp = S(capR.x, capR.y);
      sim.R.forEach((x, i) => {
        if (x.owner !== me || i === sim.P[me].capital) return; const p = at(i);
        const cx = p.x + (cp.x - p.x) * t, cy = p.y + (cp.y - p.y) * t - Math.sin(t * Math.PI) * 30;
        c.save(); c.globalAlpha = 1 - t * .5; c.fillStyle = "#E0B13F"; c.strokeStyle = "#5A3E10"; c.lineWidth = 1.3; c.beginPath(); c.arc(cx, cy, 6, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#2A2A2E"; c.fillRect(cx - 2, cy - 2, 4, 4); c.restore();
      });
      ring(cp, 10 + t * 20, "#E0B13F", 3, 1 - t); return;
    }
    case "tame": case "beastRoar": case "beasts": {
      const D = f.kind === "beasts" ? 2.4 : 1.6; if (age > D) return; const p = at(f.r), t = age / D;
      c.save(); c.strokeStyle = `rgba(142,90,214,${1 - t})`; c.lineWidth = 4.5; c.lineCap = "round";
      for (let i = 0; i < 3; i++) { const o = (i - 1) * 10; c.beginPath(); c.moveTo(p.x - 16 + o, p.y - 18); c.lineTo(p.x - 16 + o + 26 * Math.min(1, t * 3), p.y - 18 + 30 * Math.min(1, t * 3)); c.stroke(); }
      if (f.kind === "beasts") { for (let i = 0; i < 6; i++) { const a = rnd(i) * 7, d = 18 + t * 30; this.paw(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 6); } c.fillStyle = `rgba(255,40,40,${1 - t})`; c.beginPath(); c.arc(p.x - 6, p.y - 4, 2.5, 0, 7); c.arc(p.x + 6, p.y - 4, 2.5, 0, 7); c.fill(); }
      c.restore(); if (f.kind === "tame") glyph({ x: p.x, y: p.y - 30 }, "驯", "#C9A6FF", 18, 1 - t); return;
    }
    case "swift": { if (age > 1.5) return; const a = sim.armies.find(x => x.id === f.army); if (!a) return; const w = this.armyWorld(a, this.frac), p = S(w.x, w.y); c.save(); c.strokeStyle = `rgba(244,241,232,${1 - age / 1.5})`; c.lineWidth = 1.6; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(p.x - 20 - i * 3, p.y - 12 + i * 6); c.lineTo(p.x - 38 - i * 3 - age * 10, p.y - 12 + i * 6); c.stroke(); } c.restore(); return; }
    case "rally": { if (age > 1.4) return; const a = at(f.r), b = at(f.r2), t = age / 1.4; c.save(); c.strokeStyle = `rgba(91,191,110,${1 - t})`; c.lineWidth = 3; c.setLineDash([2, 6]); c.lineCap = "round"; c.lineDashOffset = -age * 40; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.restore(); glyph({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - 8 }, "令", "#5BBF6E", 16, 1 - t * .5); return; }
    case "scout": case "hawk": {
      const D = 2.4; if (age > D) return; const p = at(f.r), t = age / D, R0 = (f.kind === "hawk" ? 120 : 70) * z;
      ring(p, t * R0, "#6EC6FF", 2.5, 1 - t); ring(p, t * R0 * .7, "#6EC6FF", 1, (1 - t) * .6);
      c.save(); c.globalAlpha = (1 - t) * .3; c.fillStyle = "#6EC6FF"; c.beginPath(); c.moveTo(p.x, p.y); c.arc(p.x, p.y, t * R0, age * 5, age * 5 + .6); c.closePath(); c.fill(); c.restore();
      if (f.kind === "hawk") { const hx = p.x + Math.cos(age * 3) * 34, hy = p.y - 24 + Math.sin(age * 3) * 12; c.save(); c.strokeStyle = `rgba(244,241,232,${1 - t})`; c.lineWidth = 2.2; c.beginPath(); c.moveTo(hx - 10, hy - 2); c.quadraticCurveTo(hx - 4, hy - 7 - Math.sin(age * 12) * 3, hx, hy); c.quadraticCurveTo(hx + 4, hy - 7 - Math.sin(age * 12) * 3, hx + 10, hy - 2); c.stroke(); c.restore(); }
      glyph({ x: p.x, y: p.y - 24 }, f.kind === "hawk" ? "鹰" : "探", "#6EC6FF", 20, 1 - t); return;
    }
    case "spy": { if (age > 2) return; sim.R.forEach((x, i) => { if (x.owner === f.p) ring(at(i), 10 + age * 8, "#C9A6FF", 2, 1 - age / 2); }); return; }
    case "wall": { if (age > 1.6) return; const p = at(f.r), t = age / 1.6; c.save(); c.globalAlpha = 1 - t * .5; this.hexagon(p.x, p.y, (14 + t * 20) * sc * 1.3, "#9FC2E8", 4 * (1 - t) + 1.5); c.restore(); glyph({ x: p.x, y: p.y - 30 }, "固", "#9FC2E8", 18, 1 - t); return; }
    case "ambushSet": { if (age > 1.6) return; const p = at(f.r), t = age / 1.6; c.save(); c.setLineDash([5, 4]); ring(p, 50 * (1 - t) + 20, "#FF5A40", 2.5, 1 - t * .3); c.restore(); glyph({ x: p.x, y: p.y - 28 }, "伏", "#FF5A40", 18, 1 - t); return; }
    case "ambushHit": case "intercept": {
      const D = 2; if (age > D) return; let p = at(f.r);
      if (f.army) { const a = sim.armies.find(x => x.id === f.army); if (a) { const w = this.armyWorld(a, this.frac); p = S(w.x, w.y); } }
      const src = f.r2 != null ? at(f.r2) : null, t1 = Math.min(1, age / .7);
      c.save(); c.strokeStyle = "#1E1A16"; c.lineWidth = 1.6;
      for (let i = 0; i < 9; i++) {
        const a = rnd(i) * 7, from = src && f.kind === "intercept" ? { x: src.x + (rnd(i + 3) - .5) * 30, y: src.y + (rnd(i + 5) - .5) * 30 } : { x: p.x + Math.cos(a) * 60, y: p.y + Math.sin(a) * 60 };
        const x = from.x + (p.x - from.x) * t1, y = from.y + (p.y - from.y) * t1 - Math.sin(t1 * Math.PI) * 25;
        if (age < .75) { const dx = (p.x - from.x) * .07, dy = (p.y - from.y) * .07; c.beginPath(); c.moveTo(x, y); c.lineTo(x - dx, y - dy); c.stroke(); }
      }
      c.restore();
      if (age > .6) { const t = (age - .6) / 1.4; this.splash(p.x, p.y, 16 + t * 12, "#B01E1E", (1 - t) * .7, k + 3); }
      return;
    }
    case "beacon": { if (age > 2) return; const p = at(f.r); ring(p, age * 60 * sc, "#FF7A30", 2, 1 - age / 2); this.flame(p.x, p.y - 10, now, 2 * (1 - age / 4)); return; }
    case "fire": {
      const D = 3; if (age > D) return; const p = at(f.r), src = f.r2 != null ? at(f.r2) : { x: p.x, y: p.y - 140 };
      if (age < .8) { const t = age / .8, x = src.x + (p.x - src.x) * t, y = src.y + (p.y - src.y) * t - Math.sin(t * Math.PI) * 60; c.save(); c.fillStyle = "#E8551E"; c.shadowColor = "#F7C040"; c.shadowBlur = 14; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); c.restore(); return; }
      const t = (age - .8) / 2.2; c.save();
      for (let i = 0; i < 18; i++) { const a = rnd(i) * 7, d = rnd(i + 30) * 26 * sc, ph = (age * 1.6 + rnd(i + 60)) % 1; c.globalAlpha = (1 - t) * (1 - ph); c.fillStyle = ph < .35 ? "#F7C040" : ph < .7 ? "#E8551E" : "#4A3A30"; c.beginPath(); c.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * .6 - ph * 32, 5 * (1 - ph) + 2, 0, 7); c.fill(); }
      c.restore(); glyph({ x: p.x, y: p.y - 34 }, "焚", "#FF5A40", 20, 1 - t); return;
    }
    case "quake": {
      const D = 2.4; if (age > D) return; const p = at(f.r), t = age / D;
      if (age < .1 && !this.lastFx.has(f)) { this.lastFx.add(f); this.shake = 14; }
      c.save(); c.strokeStyle = `rgba(40,30,20,${1 - t})`; c.lineWidth = 3;
      for (let i = 0; i < 7; i++) { let a = rnd(i) * 7, x = p.x, y = p.y; c.beginPath(); c.moveTo(x, y); for (let s = 0; s < 4; s++) { a += (rnd(i * 9 + s) - .5) * 1.2; x += Math.cos(a) * 11 * Math.min(1, t * 3); y += Math.sin(a) * 11 * Math.min(1, t * 3); c.lineTo(x, y); } c.stroke(); }
      ring(p, t * 50 * sc, "#A89B86", 3, 1 - t); c.restore(); glyph({ x: p.x, y: p.y - 30 }, "震", "#F4F1E8", 22, 1 - t); return;
    }
    case "plague": {
      const D = 3; if (age > D) return; const t = age / D;
      [f.r, ...regs[f.r].adj].forEach((r, j) => { const p = at(r); const tt = Math.max(0, t - (j ? .2 : 0)); for (let i = 0; i < 6; i++) { const a = rnd(i + j * 7) * 7, d = 6 + tt * 22; c.fillStyle = `rgba(120,160,60,${(1 - t) * .4})`; c.beginPath(); c.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * .6, 8 + tt * 6, 0, 7); c.fill(); } });
      glyph({ x: at(f.r).x, y: at(f.r).y - 26 }, "疫", "#B9E26E", 22, 1 - t); return;
    }
    case "flood": { const D = 3; if (age > D) return; const p = at(f.r); for (let i = 0; i < 3; i++) { const t = ((age / D) + i / 3) % 1; ring(p, t * 44 * sc + 4, "#6EC6FF", 2.5, (1 - t) * (1 - age / D)); } glyph({ x: p.x, y: p.y - 28 }, f.by ? "雨" : "洪", "#6EC6FF", 20, 1 - age / D); return; }
    case "sacrifice": {
      const D = 2.6; if (age > D) return; const p = at(f.r), t = age / D;
      c.save(); const g = c.createLinearGradient(p.x, p.y - 120, p.x, p.y); g.addColorStop(0, "rgba(140,20,24,0)"); g.addColorStop(1, `rgba(150,24,30,${(1 - t) * .7})`);
      c.fillStyle = g; c.fillRect(p.x - 10 - 10 * t, p.y - 120, 20 + 20 * t, 120); c.restore();
      ring(p, 10 + t * 40, "#B01E1E", 4, 1 - t); glyph({ x: p.x, y: p.y - 30 - t * 18 }, "祭", "#FF5A40", 24, 1 - t); return;
    }
    case "massacre": {
      const D = 3.5; if (age > D) return; const p = at(f.r), t = age / D;
      this.splash(p.x, p.y, 26 + t * 10, "#6E0E16", (1 - t) * .55, k + 9);
      for (let i = 0; i < 3; i++) { const tt = ((age / D) + i / 3) % 1; ring(p, 8 + tt * 60, "#6E0E16", 5 * (1 - tt), (1 - tt) * (1 - t)); }
      glyph({ x: p.x, y: p.y - 30 }, "屠", "#FF3A30", 26, 1 - t); return;
    }
    case "revolt": {
      const D = 2.5; if (age > D) return; const p = at(f.r), t = age / D;
      for (let i = 0; i < 6; i++) { const a = rnd(i) * 7, d = 14 + rnd(i + 9) * 20; this.flame(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * .6, now + i, 1.4 * (1 - t * .5)); }
      glyph({ x: p.x, y: p.y - 30 }, "叛", "#FF5A40", 20, 1 - t); return;
    }
    case "subvert": {
      const D = 2.4; if (age > D) return; const p = at(f.r), t = age / D;
      c.save(); c.strokeStyle = `rgba(201,166,255,${1 - t})`; c.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(p.x, p.y, 10 + i * 9 + t * 10, age * 4 + i * 2, age * 4 + i * 2 + 2.2); c.stroke(); }
      c.restore(); if (f.by) ring(p, 6 + t * 40, sim.P[f.by].color, 4 * (1 - t) + 1, 1 - t);
      glyph({ x: p.x, y: p.y - 30 }, "反", "#C9A6FF", 20, 1 - t); return;
    }
    case "heaven": case "golden": {
      const D = 2.4; if (age > D) return; const p = at(f.r), t = age / D;
      c.save(); const g = c.createLinearGradient(p.x, p.y - 160, p.x, p.y); g.addColorStop(0, "rgba(255,210,90,0)"); g.addColorStop(1, `rgba(255,190,60,${(1 - t) * .55})`);
      c.fillStyle = g; c.beginPath(); c.moveTo(p.x - 6, p.y - 160); c.lineTo(p.x + 6, p.y - 160); c.lineTo(p.x + 26, p.y); c.lineTo(p.x - 26, p.y); c.closePath(); c.fill(); c.restore();
      this.sparkle(p.x, p.y, now * 2, "#F2C14E", 8, 30); glyph({ x: p.x, y: p.y - 34 }, f.kind === "heaven" ? "天" : "盛", "#F2C14E", 22, 1 - t); return;
    }
    case "meteor": {
      const D = 3.4; if (age > D) return; const p = at(f.r);
      if (age < .9) { const t = age / .9, x = p.x + 260 * (1 - t), y = p.y - 320 * (1 - t); c.save(); c.strokeStyle = "rgba(255,200,120,.6)"; c.lineWidth = 7; c.lineCap = "round"; c.beginPath(); c.moveTo(x + 55, y - 66); c.lineTo(x, y); c.stroke(); c.fillStyle = "#E8551E"; c.shadowColor = "#F7C040"; c.shadowBlur = 22; c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); c.restore(); return; }
      if (!this.lastFx.has(f)) { this.lastFx.add(f); this.shake = 22; }
      const t = (age - .9) / 2.5; this.splash(p.x, p.y, 30 + t * 20, "#1E1A16", (1 - t) * .6, k + 21); ring(p, 10 + t * 80, "#E8551E", 8 * (1 - t) + 1, 1 - t);
      for (let i = 0; i < 14; i++) { const a = rnd(i) * 7, d = t * (30 + rnd(i + 4) * 50); c.fillStyle = `rgba(70,50,36,${1 - t})`; c.beginPath(); c.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * .7, 4, 0, 7); c.fill(); }
      return;
    }
    case "ping": {
      const D = 4; if (age > D) return; const p = at(f.r), t = age / D, b = Math.abs(Math.sin(age * 6)) * 8;
      ring(p, 10 + (age % 1) * 30, "#FF5A40", 3, (1 - t));
      this.stamp(p.x, p.y - 30 - b, "!", "#D9483B", 22); return;
    }
  }
};

root.LZRender = Renderer;
})(typeof window !== "undefined" ? window : globalThis);
