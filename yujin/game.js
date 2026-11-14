/* 余烬·尸潮 — 引擎：地图生成、角色、敌人 AI、子弹、掉落、关卡目标 */
(function () {
"use strict";
const T = YJ.TILE, TAU = Math.PI * 2;
const rnd = Math.random, R = (a, b) => a + rnd() * (b - a), RI = (a, b) => Math.floor(R(a, b + 1)), pick = a => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, hyp = Math.hypot;
function wpick(o) { let s = 0; for (const k in o) s += o[k]; let x = rnd() * s; for (const k in o) { x -= o[k]; if (x < 0) return k; } return Object.keys(o)[0]; }
const G = YJ.G = { state: "title", L: null, pl: null, P: null, S: null, inp: { mx: 0, my: 0, ax: 0, ay: 0, fire: false, dash: false, gren: false, med: false, reload: false }, shake: 0, slow: 1, bot: /[?&]bot=1/.test(location.search) };
const SFX = (n, v) => { try { YJ.Audio && YJ.Audio.play(n, v); } catch {} };

/* ================= 存档与物品 ================= */
YJ.newSave = function () {
  const P = { lv: 1, xp: 0, pts: 0, tal: {}, eq: { weapon: null, armor: null, boots: null, charm: null }, inv: [], scrap: 0, med: 1, chapter: 0, uid: 1, kills: 0 };
  G.P = P; P.eq.weapon = YJ.makeItem(1, { slot: "weapon", base: "pistol", rar: 0 }); return P;
};
YJ.save = () => { try { localStorage.setItem("yj.save", JSON.stringify(G.P)); } catch {} };
YJ.load = () => { try { const s = JSON.parse(localStorage.getItem("yj.save")); if (s && s.eq && s.eq.weapon) { G.P = s; return s; } } catch {} return null; };
YJ.xpNeed = lv => Math.round(45 + 30 * Math.pow(lv, 1.55));
function rollRar(m) { return +wpick({ 0: 60, 1: 30 * m, 2: 9 * m * m, 3: 1.5 * m * m }); }
YJ.makeItem = function (ilvl, o = {}) {
  const P = G.P, slot = o.slot || wpick({ weapon: 44, armor: 20, boots: 17, charm: 19 });
  const rar = o.rar != null ? o.rar : rollRar(G.S ? G.S.mfM : 1);
  const it = { id: P.uid++, slot, base: null, rar, ilvl: Math.max(1, ilvl), aff: [], leg: null };
  if (slot === "weapon") { const w = {}; for (const k in YJ.WEAPONS) w[k] = YJ.WEAPONS[k].w; it.base = o.base || wpick(w); }
  YJ.rollAffixes(it); return it;
};
YJ.rollAffixes = function (it) {
  it.aff = []; it.leg = null;
  const n = [0, RI(1, 2), RI(3, 4), 4][it.rar], pool = YJ.AFFIX.filter(a => a.s.split(",").includes(it.slot)), q = Math.min(1, (it.ilvl - 1) / 10);
  for (let i = 0; i < n && pool.length; i++) {
    let s = 0; for (const a of pool) s += a.w; let x = rnd() * s, A = pool[0]; for (const a of pool) { x -= a.w; if (x < 0) { A = a; break; } }
    pool.splice(pool.indexOf(A), 1);
    let v = A.a + (A.b - A.a) * (rnd() * .6 + q * .4); if (A.grow) v *= 1 + .1 * (it.ilvl - 1);
    it.aff.push({ k: A.k, v: A.dec ? Math.round(v * 10) / 10 : Math.max(1, Math.round(v)) });
  }
  if (it.rar === 3) it.leg = pick(Object.keys(YJ.LEG).filter(k => YJ.LEG[k].s === it.slot));
};
YJ.itemName = it => (it.leg ? "【" + YJ.LEG[it.leg].n + "】" : "") + (it.slot === "weapon" ? YJ.WEAPONS[it.base].name : YJ.GEAR[it.slot].name);
YJ.affText = a => YJ.AFFIX.find(x => x.k === a.k).t.replace("{}", a.v);
YJ.wScale = it => 1 + .13 * (it.ilvl - 1);
YJ.impOf = it => { const o = {}; if (it.slot !== "weapon") for (const k in YJ.GEAR[it.slot].imp) o[k] = Math.round(YJ.GEAR[it.slot].imp[k] * (k === "hp" ? 1 + .12 * (it.ilvl - 1) : 1 + .04 * (it.ilvl - 1))); return o; };
YJ.scrapOf = it => Math.round((3 + it.ilvl * 1.5) * [1, 2, 5, 14][it.rar]);
YJ.upCost = it => Math.round(12 * Math.pow(1.32, it.ilvl) * [1, 1.3, 1.8, 2.6][it.rar]);
YJ.rerollCost = it => Math.round((10 + it.ilvl * 6) * [0, 1, 2.2, 4][it.rar]);
/* 汇总属性。alt：假设把某件装备换上去（用来做对比） */
YJ.calcStats = function (alt) {
  const P = G.P, a = { dmg: 0, rate: 0, crit: 0, critd: 0, hp: 0, regen: 0, ms: 0, armor: 0, lok: 0, pierce: 0, multi: 0, mag: 0, reload: 0, burn: 0, shock: 0, xp: 0, mf: 0, gren: 0, dash: 0 }, legs = {};
  for (const t of YJ.TALENTS) { const n = P.tal[t.k] || 0; for (const k in t.st) a[k] += t.st[k] * n; }
  const eq = { ...P.eq }; if (alt) eq[alt.slot] = alt;
  for (const s in eq) { const it = eq[s]; if (!it) continue; for (const x of it.aff) a[x.k] += x.v; const im = YJ.impOf(it); for (const k in im) a[k] += im[k]; if (it.leg) legs[it.leg] = 1; }
  const w = eq.weapon, B = YJ.WEAPONS[w.base], sc = YJ.wScale(w);
  const S = { a, legs, base: w.base, B, maxhp: Math.round(100 + (P.lv - 1) * 9 + a.hp), dmgM: 1 + a.dmg / 100, rate: B.rate * (1 + a.rate / 100), critC: Math.min(.8, .05 + a.crit / 100), critM: 1.6 + a.critd / 100,
    msM: 1 + a.ms / 100, armor: Math.min(.7, a.armor / 100), regen: a.regen, lok: a.lok, pierce: B.pierce + a.pierce, pellets: B.pellets + a.multi * (B.pellets > 1 ? 2 : 1), mag: Math.round(B.mag * (1 + a.mag / 100)), reload: B.reload / (1 + a.reload / 100),
    burn: a.burn / 100, shock: a.shock / 100, xpM: 1 + a.xp / 100, mfM: 1 + a.mf / 100, grenM: 1 + a.gren / 100, dashCd: 2.6 * (1 - Math.min(.6, a.dash / 100)), wdmg: B.dmg * sc };
  S.dps = Math.round(S.wdmg * S.dmgM * S.pellets * S.rate * (1 + S.critC * (S.critM - 1)));
  if (!alt) G.S = S; return S;
};

/* ================= 地图生成 ================= */
function endlessDef() { const th = pick(["street", "subway", "hospital", "base", "lab"]);
  return { name: "无尽 · 废土巡猎", theme: th, act: 4, size: 72, rooms: 22, rw: [7, 11], rh: [6, 9], cw: 3, dens: .06, lvl: Math.max(1, G.P.lv - 1), endless: 1, mix: { walker: 9, runner: 5, crawler: 4, spitter: 3, bloater: 2 }, horde: [26, 6], obj: { t: "endless" }, goal: "活下去，完成电台委托", exitName: "", radio: {} }; }
function genLevel(i) {
  const def = i < 0 ? endlessDef() : YJ.LEVELS[i], W = def.size, H = def.size, g = new Uint8Array(W * H).fill(1), rooms = [];
  const carve = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x > 1 && y > 1 && x < W - 2 && y < H - 2) g[y * W + x] = 0; };
  if (def.arena) { const c = W >> 1; rooms.push({ x: c - 4, y: H - 11, w: 8, h: 7 }, { x: c - 13, y: 7, w: 26, h: 21 }, { x: 4, y: 12, w: 7, h: 8 }, { x: W - 11, y: 12, w: 7, h: 8 }); }
  else for (let t = 0; t < 600 && rooms.length < def.rooms; t++) {
    const w = RI(def.rw[0], def.rw[1]), h = RI(def.rh[0], def.rh[1]), x = RI(3, W - w - 4), y = RI(3, H - h - 4);
    if (!rooms.some(r => x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y)) rooms.push({ x, y, w, h });
  }
  for (const r of rooms) { carve(r.x, r.y, r.w, r.h); r.cx = r.x + (r.w >> 1); r.cy = r.y + (r.h >> 1); }
  const link = (a, b) => { const cw = def.cw, o = cw >> 1; let x = a.cx, y = a.cy;
    const hz = () => { carve(Math.min(x, b.cx) - o, y - o, Math.abs(b.cx - x) + cw, cw); x = b.cx; }, vt = () => { carve(x - o, Math.min(y, b.cy) - o, cw, Math.abs(b.cy - y) + cw); y = b.cy; };
    if (rnd() < .5) { hz(); vt(); } else { vt(); hz(); } };
  if (def.arena) { link(rooms[0], rooms[1]); link(rooms[2], rooms[1]); link(rooms[3], rooms[1]); }
  else { rooms.sort((a, b) => a.cx + a.cy - b.cx - b.cy);
    for (let k = 1; k < rooms.length; k++) { let best = 0, bd = 1e9; for (let j = 0; j < k; j++) { const d = hyp(rooms[j].cx - rooms[k].cx, rooms[j].cy - rooms[k].cy); if (d < bd) { bd = d; best = j; } } link(rooms[k], rooms[best]); }
    for (let k = 0; k < 2; k++) { const a = pick(rooms), b = rooms.filter(r => r !== a).sort((p, q) => hyp(p.cx - a.cx, p.cy - a.cy) - hyp(q.cx - a.cx, q.cy - a.cy))[1]; if (b) link(a, b); } }
  const L = { i, def, th: YJ.THEMES[def.theme], W, H, g, rooms, en: [], bul: [], drops: [], fx: [], parts: [], nums: [], objs: [], barrels: [], lamps: [], decals: [], time: 0, kills: 0, objN: 0, objDone: def.obj.t === "exit", hordeT: def.horde[0], hordeN: 0, pools: [], bodies: [], spawnQ: [], score: 0, explored: new Uint8Array(W * H), flow: new Uint16Array(W * H), flowT: 0, radio: {}, loot: 0, lvl: def.lvl + (def.endless ? 0 : (G.P.ng || 0) * 20), misT: 18, misN: 0, mis: null, ambT: 20, base: 0 };
  L.base = L.lvl;
  setLvl(L, L.lvl);
  // 从起点量距离：最远的房间放出口
  const start = rooms[0], dist = bfs(L, start.cx, start.cy);
  for (const r of rooms) r.d = dist[r.cy * W + r.cx];
  const far = rooms.slice(1).sort((a, b) => b.d - a.d), exitR = def.arena ? rooms[1] : far[0];
  L.start = { x: (start.cx + .5) * T, y: (start.cy + .5) * T };
  L.exit = def.arena ? { x: (exitR.cx + .5) * T, y: (exitR.y + 1.5) * T } : { x: (exitR.cx + .5) * T, y: (exitR.cy + .5) * T };
  // 掩体与油桶
  for (const r of rooms) { if (r === start) continue;
    for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      if (Math.abs(x - r.cx) < 2 && Math.abs(y - r.cy) < 2) continue;
      if ((x - r.x) % 3 === 1 && (y - r.y) % 3 === 1 && rnd() < (def.arena && r === rooms[1] ? .12 : .3)) g[y * W + x] = 3;
      else if (rnd() < .012) L.barrels.push({ x: (x + .5) * T, y: (y + .5) * T, hp: 20, r: 11 });
    }
    if (rnd() < .55) L.lamps.push({ x: (r.cx + .5) * T, y: (r.cy + .5) * T, r: 130 + Math.min(r.w, r.h) * 9, c: L.th.lamp, f: rnd() * 9, fl: rnd() < (L.th.flicker ? .8 : .45) });
  }
  { const ex = Math.floor(L.exit.x / T), ey = Math.floor(L.exit.y / T); for (let y = ey - 1; y <= ey + 1; y++) for (let x = ex - 1; x <= ex + 1; x++) if (g[y * W + x] === 3) g[y * W + x] = 0; } // 出口周围不放掩体
  L.lamps.push({ x: L.start.x, y: L.start.y, r: 200, c: "#ffe0b0", f: 0 });
  // 敌人
  const freeIn = r => { for (let t = 0; t < 30; t++) { const x = RI(r.x, r.x + r.w - 1), y = RI(r.y, r.y + r.h - 1); if (g[y * W + x] === 0) return { x: (x + .5) * T, y: (y + .5) * T }; } return { x: (r.cx + .5) * T, y: (r.cy + .5) * T }; };
  L.freeIn = freeIn;
  for (const r of rooms) { if (r === start) continue; let n = Math.round(r.w * r.h * def.dens * (r === exitR && !def.arena ? 1.4 : 1)); if (def.arena && r === rooms[1]) n = 0;
    for (let k = 0; k < n; k++) { const p = freeIn(r); spawn(L, wpick(def.mix), p.x, p.y, false); } }
  // 目标
  const mid = far.slice(1), o = def.obj;
  if (o.t === "collect" || o.t === "activate") for (let k = 0; k < o.n; k++) { const r = mid[Math.floor((k + .5) * mid.length / o.n)] || far[0], p = { x: (r.cx + .5) * T, y: (r.cy + .5) * T }; L.objs.push({ t: o.t === "collect" ? "fuse" : "gen", x: p.x, y: p.y, prog: 0, done: false, on: false }); }
  if (o.t === "elite") { const r = far[1] || far[0]; L.eliteE = spawn(L, "elite", (r.cx + .5) * T, (r.cy + .5) * T, false); L.eliteE.nm = o.ename; L.eliteE.look = o.look; if (o.look) { L.eliteE.cloth = "#2b3036"; L.eliteE.sumOff = 1; } }
  // 散落的补给：偏僻房间里放几件装备和零件，鼓励探索
  if (!def.arena) for (const r of mid.slice().sort(() => rnd() - .5).slice(0, 4)) { const p = freeIn(r); L.drops.push({ t: "item", it: YJ.makeItem(L.lvl + 1, { rar: Math.max(1, rollRar(1.3)) }), x: p.x, y: p.y, age: 0 }); const q = freeIn(r); L.drops.push({ t: "scrap", n: Math.round(R(4, 8) * (1 + L.lvl * .3)), x: q.x, y: q.y, age: 0 }); }
  if (o.t === "boss") L.bossE = spawn(L, "boss", (rooms[1].cx + .5) * T, (rooms[1].cy - 2 + .5) * T, false);
  return L;
}
function setLvl(L, lv) { L.lvl = lv; L.hpM = 1 + .3 * (lv - 1); L.dmgM = 1 + .11 * (lv - 1); }
function bfs(L, sx, sy, out) {
  const { W, H, g } = L, d = out || new Uint16Array(W * H); d.fill(65535); const q = new Int32Array(W * H); let h = 0, t = 0; d[sy * W + sx] = 0; q[t++] = sy * W + sx;
  while (h < t) { const c = q[h++], x = c % W, nd = d[c] + 1; for (const n of [c - 1, c + 1, c - W, c + W]) { if (n < 0 || n >= W * H || d[n] <= nd || g[n] !== 0) continue; if (Math.abs(n % W - x) > 1) continue; d[n] = nd; q[t++] = n; } }
  return d;
}
YJ.bfs = bfs;
const solid = (L, x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return tx < 0 || ty < 0 || tx >= L.W || ty >= L.H || L.g[ty * L.W + tx] !== 0; };
YJ.solid = solid;
function blocked(L, x, y, r) {
  const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { if (tx >= 0 && ty >= 0 && tx < L.W && ty < L.H && L.g[ty * L.W + tx] === 0) continue;
    const cx = clamp(x, tx * T, tx * T + T), cy = clamp(y, ty * T, ty * T + T); if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true; }
  return false;
}
function move(L, e, dx, dy) { if (dx && !blocked(L, e.x + dx, e.y, e.r)) e.x += dx; else if (dx) e.hitW = 1; if (dy && !blocked(L, e.x, e.y + dy, e.r)) e.y += dy; else if (dy) e.hitW = 1; }
/* 射线：返回沿 ang 方向到墙的距离（不超过 max） */
function ray(L, x, y, ang, max) {
  const dx = Math.cos(ang), dy = Math.sin(ang); let tx = Math.floor(x / T), ty = Math.floor(y / T);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, ddx = Math.abs(T / (dx || 1e-9)), ddy = Math.abs(T / (dy || 1e-9));
  let mx = (dx > 0 ? (tx + 1) * T - x : x - tx * T) / Math.abs(dx || 1e-9), my = (dy > 0 ? (ty + 1) * T - y : y - ty * T) / Math.abs(dy || 1e-9), d = 0;
  while (d < max) { if (mx < my) { d = mx; mx += ddx; tx += sx; } else { d = my; my += ddy; ty += sy; } if (tx < 0 || ty < 0 || tx >= L.W || ty >= L.H || L.g[ty * L.W + tx] === 1) return Math.min(d, max); }
  return max;
}
YJ.ray = ray;
const los = (L, a, b) => { const d = hyp(b.x - a.x, b.y - a.y); return ray(L, a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x), d) >= d - 1; };

/* ================= 敌人 ================= */
function spawn(L, type, x, y, awake) {
  const E = YJ.ENEMY[type], e = { type, E, x, y, r: E.r, hp: E.hp * L.hpM * (E.elite ? 1 : R(.85, 1.15)), ang: rnd() * TAU, awake, sp: E.sp * R(.9, 1.1), cd: 0, t: R(0, 1), losT: rnd() * .4, see: false, walk: rnd() * 9, flash: 0, slow: 0, burn: 0, kx: 0, ky: 0, cloth: pick(E.cloth), v: rnd(), st: "", w: 0, n: 0, sum: 6, stag: 0 };
  e.maxhp = e.hp; L.en.push(e); return e;
}
function wake(L, x, y, rad) { for (const e of L.en) if (!e.awake && (e.x - x) ** 2 + (e.y - y) ** 2 < rad * rad) { e.awake = true; if (rnd() < .25) SFX("groan", .5); } }
function horde(L, n, types) {
  const pl = G.pl, c = []; for (let k = 0; k < L.flow.length; k++) { const d = L.flow[k]; if (d >= 9 && d <= 15) c.push(k); }
  if (!c.length) return; const k0 = pick(c);
  for (let i = 0; i < n; i++) { const k = i % 3 ? k0 : pick(c), x = (k % L.W + .5) * T + R(-10, 10), y = (Math.floor(k / L.W) + .5) * T + R(-10, 10); if (!blocked(L, x, y, 12)) L.spawnQ.push({ t: 1.3 + i * .07, type: wpick(types || { walker: 6, runner: 4 }), x, y }); }
  SFX("horde");
}
function updEnemy(L, e, dt) {
  const pl = G.pl, E = e.E, dx = pl.x - e.x, dy = pl.y - e.y, d = hyp(dx, dy);
  if (e.hp <= 0) return kill(L, e);
  e.flash -= dt; e.cd -= dt; e.walk += dt * (e.awake ? e.sp / 14 : 1.5);
  if (e.burn > 0) { e.burn -= dt; e.hp -= e.burnD * dt; if (rnd() < dt * 8) part(L, e.x + R(-8, 8), e.y + R(-8, 8), R(-10, 10), R(-50, -20), .5, "#ff9a30", 3, 1); if (e.hp <= 0) return kill(L, e); }
  if (e.slow > 0) e.slow -= dt; if (e.stag > 0) e.stag -= dt;
  if (e.type === "crawler" && e.awake && rnd() < dt * 1.5) L.decals.push({ t: "blood", x: e.x - Math.cos(e.ang) * 8, y: e.y - Math.sin(e.ang) * 8, r: R(2, 4), c: "#3a0606" });
  if (e.kx || e.ky) { move(L, e, e.kx * dt, e.ky * dt); e.kx *= .85; e.ky *= .85; if (Math.abs(e.kx) + Math.abs(e.ky) < 4) e.kx = e.ky = 0; }
  e.losT -= dt; if (e.losT <= 0) { e.losT = .35; e.see = d < 640 && los(L, e, pl); }
  if (!e.awake) { if ((d < 230 && e.see) || d < 70) { e.awake = true; wake(L, e.x, e.y, 150); if (rnd() < .5) SFX("groan", .6); if (e.type === "boss") { G.radio("mid"); SFX("roar"); } }
    else { e.t -= dt; if (e.t <= 0) { e.t = R(1, 3); e.ang += R(-1.2, 1.2); } move(L, e, Math.cos(e.ang) * 8 * dt, Math.sin(e.ang) * 8 * dt); return; } }
  // 方向：看得见就直冲，否则顺着寻路场走
  let tx = dx / (d || 1), ty = dy / (d || 1);
  if (!e.see || d > 600) { const cx = Math.floor(e.x / T), cy = Math.floor(e.y / T), W = L.W; let best = L.flow[cy * W + cx], bx = 0, by = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { if (!ox && !oy) continue; const nx = cx + ox, ny = cy + oy, v = L.flow[ny * W + nx]; if (v === undefined || v >= best) continue;
      if (ox && oy && (L.g[cy * W + nx] !== 0 || L.g[ny * W + cx] !== 0)) continue; best = v; bx = ox; by = oy; }
    if (bx || by) { const gx = (cx + bx + .5) * T - e.x, gy = (cy + by + .5) * T - e.y, gl = hyp(gx, gy) || 1; tx = gx / gl; ty = gy / gl; } }
  let sp = e.sp * (e.slow > 0 ? .5 : 1) * (.55 + .45 * Math.max(0, e.hp / e.maxhp)), mv = e.stag <= 0; // 血越少越迟缓；被打中会踉跄
  const ai = E.ai;
  if (e.st === "wind") { e.w -= dt; mv = false; e.ang = e.tele.ang; if (e.w <= 0) doAttack(L, e); }
  else if (e.st === "dash") { e.w -= dt; mv = false; e.hitW = 0; move(L, e, Math.cos(e.ang) * 340 * dt, Math.sin(e.ang) * 340 * dt);
    if (d < e.r + pl.r + 4) { hurtPlayer(E.dmg * L.dmgM * 1.3, e); e.w = 0; }
    if (e.w <= 0 || e.hitW) { e.st = ""; e.cd = e.type === "crawler" ? 2.2 : .5; if (e.hitW) { G.shake = Math.max(G.shake, 6); for (let k = 0; k < 8; k++) part(L, e.x, e.y, R(-90, 90), R(-90, 90), .5, "#8a8a8a", 3); } } }
  else if (ai === "spit" && e.see && d < 330) { mv = false; e.ang = Math.atan2(dy, dx); // 站在远处不动，朝玩家脚下吐酸
    if (e.cd <= 0) { e.cd = R(2.4, 3.2); const a = e.ang + R(-.08, .08), dd = Math.min(d, 330), v = 240, life = Math.max(.35, dd / v); L.bul.push({ x: e.x + Math.cos(a) * 14, y: e.y + Math.sin(a) * 14, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, dmg: E.dmg * L.dmgM, enemy: 1, acid: 1 }); SFX("spit", .5); } }
  else if (ai === "leap" && e.see && d < 125 && e.cd <= 0 && e.stag <= 0) { tele(e, "leap", .28, Math.atan2(dy, dx)); }
  else if ((ai === "slam" || e.look === "brute") && e.see && d < 92 && e.cd <= 0 && e.st === "") { tele(e, "pound", .7, Math.atan2(dy, dx)); }
  else if (ai === "boom" && d < e.r + pl.r + 14) return kill(L, e);
  else if ((ai === "charge" || ai === "boss") && e.see) {
    e.t -= dt;
    if (ai === "charge" && e.t <= 0 && d > 110 && d < 400) { e.t = R(4, 6); tele(e, "charge", .65, Math.atan2(dy, dx)); }
    if (E.summon && !e.sumOff) { e.sum -= dt; if (e.sum <= 0) { e.sum = 9; for (let k = 0; k < 4; k++) { const a = rnd() * TAU; if (!blocked(L, e.x + Math.cos(a) * 46, e.y + Math.sin(a) * 46, 12)) spawn(L, "runner", e.x + Math.cos(a) * 46, e.y + Math.sin(a) * 46, true); } SFX("roar", .7); } }
    if (ai === "boss" && e.t <= 0) { const p2 = e.hp < e.maxhp * .5; e.t = p2 ? 2.2 : 3.2; const a = ["charge", "volley", "slam", "summon", "volley"][e.n++ % 5];
      if (a === "summon") { for (let k = 0; k < (p2 ? 7 : 5); k++) { const an = rnd() * TAU, x = e.x + Math.cos(an) * 70, y = e.y + Math.sin(an) * 70; if (!blocked(L, x, y, 14)) spawn(L, wpick({ runner: 5, walker: 3, bloater: p2 ? 2 : 0 }), x, y, true); } SFX("roar"); }
      else tele(e, a, a === "slam" ? .95 : a === "charge" ? .6 : .5, Math.atan2(dy, dx)); }
  }
  if (mv && e.st === "") { e.ang = Math.atan2(ty, tx); move(L, e, tx * sp * dt, ty * sp * dt);
    if (d < e.r + pl.r + 5 && e.cd <= 0 && ai !== "boom" && ai !== "slam") { e.cd = .85; hurtPlayer(E.dmg * L.dmgM, e); } }
}
function tele(e, type, t, ang) { e.st = "wind"; e.w = t; e.tele = { type, t, ang }; }
function doAttack(L, e) {
  const pl = G.pl, a = e.tele.type, p2 = e.hp < e.maxhp * .5; e.st = "";
  if (a === "leap") { e.st = "dash"; e.w = .34; e.ang = e.tele.ang; SFX("groan", .5); }
  else if (a === "pound") { const x = e.x + Math.cos(e.tele.ang) * 34, y = e.y + Math.sin(e.tele.ang) * 34; explode(L, x, y, 92, e.E.dmg * L.dmgM * 1.3, 2, "#8f8a80"); L.decals.push({ t: "crack", x, y, r: 44 }); e.cd = 1.7; }
  else if (a === "charge") { e.st = "dash"; e.w = e.type === "boss" ? 1.1 : .9; e.ang = e.tele.ang; SFX("roar", .6); }
  else if (a === "volley") { const base = Math.atan2(pl.y - e.y, pl.x - e.x), n = p2 ? 22 : 14;
    for (let k = 0; k < n; k++) { const an = p2 ? k / n * TAU + e.n : base + (k - (n - 1) / 2) * .16; L.bul.push({ x: e.x + Math.cos(an) * 30, y: e.y + Math.sin(an) * 30, vx: Math.cos(an) * 230, vy: Math.sin(an) * 230, life: 2.6, dmg: e.E.dmg * L.dmgM * .7, enemy: 1 }); } SFX("spit"); }
  else if (a === "slam") { explode(L, e.x, e.y, 170, e.E.dmg * L.dmgM * 1.4, 2); }
}

/* ================= 伤害、击杀、爆炸 ================= */
function part(L, x, y, vx, vy, life, c, s, glow, k) { if (L.parts.length < 460) L.parts.push({ x, y, vx, vy, life, max: life, c, s, glow, k }); }
function addPool(L, x, y, r, life, dmg) { L.pools.push({ x, y, r, life, max: life, dmg, t: 0 }); L.decals.push({ t: "acid", x, y, r }); }
function blood(L, x, y, n, ang, c) { for (let k = 0; k < n; k++) { const a = ang + R(-.9, .9), v = R(50, 240); part(L, x, y, Math.cos(a) * v, Math.sin(a) * v, R(.25, .6), c || (rnd() < .5 ? "#7a0f0f" : "#4f0909"), R(2, 4.5), 0, "bl"); }
  const dd = R(8, 34); L.decals.push({ t: "blood", x: x + Math.cos(ang) * dd, y: y + Math.sin(ang) * dd, r: R(4, 12), c: c || "#430707", ang, sp: 1 }); }
function hurt(L, e, dmg, crit, ang, src) {
  const S = G.S; if (S.legs.fury && G.pl.hp < S.maxhp * .4) dmg *= 1.35;
  e.hp -= dmg; e.flash = .09; e.awake = true; if (!e.E.elite && e.type !== "brute" && e.st === "") e.stag = e.type === "walker" ? .22 : .12;
  L.nums.push({ x: e.x + R(-6, 6), y: e.y - e.r - 26, v: Math.round(dmg), crit, life: .7 });
  blood(L, e.x, e.y, crit ? 9 : 4, ang, e.type === "bloater" && rnd() < .5 ? "#4f6a16" : 0);
  if (!e.E.elite) { e.kx += Math.cos(ang) * (crit ? 150 : 70); e.ky += Math.sin(ang) * (crit ? 150 : 70); }
  if (src !== "chain") {
    if (S.burn && rnd() < S.burn) { e.burn = 3; e.burnD = dmg * .35; }
    if (S.legs.frost) e.slow = 2;
    if ((S.shock && rnd() < S.shock) || S.legs.chain) { let n = 0; for (const o of L.en) { if (o === e || n >= 2) continue; const d2 = (o.x - e.x) ** 2 + (o.y - e.y) ** 2; if (d2 < 130 * 130) { n++; L.fx.push({ t: "arc", x: e.x, y: e.y, x2: o.x, y2: o.y, life: .15 }); hurt(L, o, dmg * .5, false, Math.atan2(o.y - e.y, o.x - e.x), "chain"); } } if (n) SFX("zap", .4); }
  }
  if (e.hp <= 0 && !e.dead) kill(L, e);
}
function kill(L, e) {
  if (e.dead) return; e.dead = true; const S = G.S, pl = G.pl, P = G.P, E = e.E;
  L.kills++; P.kills++; if (L.def.obj.t === "purge" && !L.objDone) { L.objN++; if (L.objN === Math.floor(L.def.obj.n / 2)) G.radio("mid"); if (L.objN >= L.def.obj.n) { L.objDone = true; G.radio("done"); SFX("key"); } } L.score += Math.round(E.xp * 10 * (1 + (L.lvl - 1) * .1)); gainXp(E.xp * (1 + .2 * (L.lvl - 1)) * S.xpM);
  pl.hp = Math.min(S.maxhp, pl.hp + S.lok + (S.legs.vamp ? S.maxhp * .03 : 0)); if (S.legs.haste) pl.hasteT = 3;
  blood(L, e.x, e.y, 12, rnd() * TAU);
  if (E.ai === "boom") { explode(L, e.x, e.y, 105, E.dmg * L.dmgM, 1, "#8fbf2a"); addPool(L, e.x, e.y, 46, 5, E.dmg * L.dmgM * .3); // 炸开：酸液、碎肉，波及周围丧尸
    for (let k = 0; k < 9; k++) { const a = rnd() * TAU, v = R(80, 300); part(L, e.x, e.y, Math.cos(a) * v, Math.sin(a) * v, R(.4, .8), pick(["#6a1a14", "#5a7a1a", "#7a2a20"]), R(4, 8), 0, "bl"); L.decals.push({ t: "gib", x: e.x + Math.cos(a) * R(20, 90), y: e.y + Math.sin(a) * R(20, 90), r: R(3, 7), ang: a }); } }
  else { const fa = Math.atan2(e.ky, e.kx); L.bodies.push({ type: e.type, x: e.x, y: e.y, r: e.r, ang: (e.kx || e.ky) ? fa : e.ang + Math.PI, c: e.cloth, skin: E.skin, t: 0, dur: e.type === "runner" ? 1.5 : e.type === "brute" ? .55 : .3, v: e.v });
    if (e.type === "crawler") L.decals.push({ t: "smear", x: e.x, y: e.y, ang: e.ang, r: 46 });
    if (e.type === "brute") { G.shake = Math.max(G.shake, 12); SFX("boom", .5); for (const o of L.en) if (o !== e && !o.dead && !o.E.elite && o.r < 20 && hyp(o.x - e.x, o.y - e.y) < 62) { o.hp = 0; blood(L, o.x, o.y, 8, rnd() * TAU); } } }
  if (E.ai !== "boom" && S.legs.boom) explode(L, e.x, e.y, 70, S.wdmg * S.dmgM * 1.2, 0);
  SFX("die", .5);
  // 掉落
  const il = L.lvl + (E.elite ? 2 : 0) + (rnd() < .2 ? 1 : 0), ch = E.elite ? 1 : e.type === "brute" ? .7 : .11;
  if (rnd() < ch) drop(L, e.x, e.y, { t: "item", it: YJ.makeItem(il, E.elite ? { rar: Math.max(2, rollRar(S.mfM)) } : {}) });
  if (E.elite) for (let k = 0; k < 3; k++) drop(L, e.x, e.y, { t: "item", it: YJ.makeItem(il) });
  if (rnd() < (E.elite ? 1 : .03)) drop(L, e.x, e.y, { t: "med" });
  if (rnd() < .28 || E.elite) drop(L, e.x, e.y, { t: "scrap", n: Math.round(R(1, 3) * (E.elite ? 15 : 1) * (1 + L.lvl * .3)) });
  if (e === L.eliteE && !L.def.endless) { L.objDone = true; G.radio("done"); G.toast("取得" + (L.def.obj.name || "门禁卡"), "gold"); SFX("key"); }
  if (e === L.bossE) { L.objDone = true; G.slow = .25; setTimeout(() => G.slow = 1, 1600); G.radio("done"); G.shake = 30; for (const o of L.en) if (o !== e) o.hp = 0; }
}
function drop(L, x, y, o) { const a = rnd() * TAU, d = R(8, 26); let nx = x + Math.cos(a) * d, ny = y + Math.sin(a) * d; if (blocked(L, nx, ny, 8)) { nx = x; ny = y; } L.drops.push({ ...o, x: nx, y: ny, age: 0 }); }
/* who：0 玩家造成（不伤自己）1 敌方爆炸（都伤）2 首领震地（只伤玩家） */
function explode(L, x, y, r, dmg, who, col) {
  const pl = G.pl;
  if (who !== 2) for (const e of L.en.slice()) { const d = hyp(e.x - x, e.y - y); if (d < r + e.r && !e.dead) hurt(L, e, dmg * (1 - d / (r + e.r) * .6), false, Math.atan2(e.y - y, e.x - x), "ex"); }
  if (who) { const d = hyp(pl.x - x, pl.y - y); if (d < r + pl.r) hurtPlayer(dmg * (who === 2 ? 1 : .8) * (1 - d / (r + pl.r) * .5)); }
  for (const b of L.barrels) if (!b.dead && hyp(b.x - x, b.y - y) < r + 10) b.hp = 0;
  L.fx.push({ t: "boom", x, y, r, life: .45, max: .45, c: col || "#ffb347" });
  for (let k = 0; k < 16; k++) { const a = rnd() * TAU, v = R(60, 260); part(L, x, y, Math.cos(a) * v, Math.sin(a) * v, R(.3, .8), col || pick(["#ffb347", "#ff6a1a", "#ffe08a", "#555"]), R(3, 6), 1); }
  for (let k = 0; k < 9; k++) { const a = rnd() * TAU, v = R(10, 70); part(L, x + Math.cos(a) * r * .25, y + Math.sin(a) * r * .25, Math.cos(a) * v, Math.sin(a) * v - 26, R(.9, 1.7), who === 2 ? "#6a665e" : "#2a2a2a", R(r * .22, r * .42), 0, "smoke"); }
  if (who !== 2) L.decals.push({ t: "scorch", x, y, r: r * .7 }); G.shake = Math.max(G.shake, Math.min(22, r / 6)); SFX("boom", clamp(1 - hyp(pl.x - x, pl.y - y) / 700, .15, 1)); wake(L, x, y, 500);
}
function hurtPlayer(dmg, src) {
  const pl = G.pl, S = G.S, L = G.L; if (pl.dashT > 0 || pl.inv > 0 || pl.hp <= 0 || G.state !== "play") return;
  dmg *= (1 - S.armor) * (G.bot ? .12 : 1); pl.hp -= dmg; pl.inv = .3; pl.hurtT = .35; G.shake = Math.max(G.shake, 8); SFX("hurt");
  blood(L, pl.x, pl.y, 5, rnd() * TAU);
  if (S.legs.nova && pl.novaCd <= 0) { pl.novaCd = 2; explode(L, pl.x, pl.y, 120, S.wdmg * S.dmgM * 1.5, 0, "#7fd4ff"); for (const e of L.en) { const d = hyp(e.x - pl.x, e.y - pl.y); if (d < 140 && !e.E.elite) { e.kx += (e.x - pl.x) / d * 320; e.ky += (e.y - pl.y) / d * 320; } } }
  if (pl.hp <= 0) { pl.hp = 0; G.state = "dead"; G.slow = .3; SFX("dead"); setTimeout(() => { G.slow = 1; YJ.UI.dead(); }, 1500); }
}
function gainXp(n) { const P = G.P; P.xp += n; while (P.xp >= YJ.xpNeed(P.lv)) { P.xp -= YJ.xpNeed(P.lv); P.lv++; P.pts++; YJ.calcStats(); G.pl.hp = G.S.maxhp; G.toast("升级！Lv." + P.lv + "　获得 1 点天赋", "gold"); SFX("level"); G.L.fx.push({ t: "ring", x: G.pl.x, y: G.pl.y, r: 90, life: .6, max: .6, c: "#ffd23f" }); } }

/* ================= 玩家 ================= */
function fire(L) {
  const pl = G.pl, S = G.S, B = S.B; pl.fireCd = 1 / S.rate; pl.mag--; pl.flashT = .07;
  const gx = pl.x + Math.cos(pl.ang) * 22, gy = pl.y + Math.sin(pl.ang) * 22, n = S.pellets;
  for (let k = 0; k < n; k++) { const fan = B.pellets > 1 || n === 1 ? 0 : (k - (n - 1) / 2) * .09, a = pl.ang + fan + R(-B.spread, B.spread), sp = B.speed * R(.92, 1.06);
    L.bul.push({ x: gx, y: gy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: B.range / sp * (B.flame ? R(.7, 1.1) : 1), dmg: S.wdmg * S.dmgM, pierce: S.pierce, crit: rnd() < S.critC, ex: B.ex, flame: B.flame, hit: [] }); }
  if (!B.flame) { G.shake = Math.max(G.shake, B.kick); { const sa = pl.ang + 1.8 + R(-.3, .3), sv = R(60, 110); part(L, pl.x, pl.y, Math.cos(sa) * sv, Math.sin(sa) * sv, .35, "#d8b25a", 2); L.decals.push({ t: "shell", x: pl.x + Math.cos(sa) * sv * .28, y: pl.y + Math.sin(sa) * sv * .28, ang: rnd() * 3 }); } }
  SFX(B.flame ? "flame" : S.base, .8); wake(L, pl.x, pl.y, B.flame ? 200 : 430);
  if (pl.mag <= 0) startReload();
}
function startReload() { const pl = G.pl; if (pl.rel > 0 || pl.mag >= G.S.mag) return; pl.rel = G.S.reload; pl.relMax = pl.rel; SFX("reload", .6); }
function updPlayer(L, dt) {
  const pl = G.pl, S = G.S, I = G.inp; if (G.bot) autopilot(L);
  pl.inv -= dt; pl.hurtT -= dt; pl.fireCd -= dt; pl.dashCd -= dt; pl.gCd -= dt; pl.flashT -= dt; pl.hasteT -= dt; pl.novaCd -= dt; pl.medCd -= dt;
  pl.hp = Math.min(S.maxhp, pl.hp + S.regen * dt);
  let mx = I.mx, my = I.my; const ml = hyp(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  if (I.dash && pl.dashCd <= 0 && pl.dashT <= 0) { pl.dashT = .28; pl.dashCd = S.dashCd; const a = ml > .2 ? Math.atan2(my, mx) : pl.ang; pl.dx = Math.cos(a); pl.dy = Math.sin(a); SFX("dash"); }
  I.dash = false;
  if (pl.dashT > 0) { pl.dashT -= dt; move(L, pl, pl.dx * 430 * dt, pl.dy * 430 * dt); if (rnd() < .6) part(L, pl.x, pl.y, 0, 0, .3, "#8a9a94", 7, 0, "smoke"); }
  else { const sp = 172 * S.msM * (pl.hasteT > 0 ? 1.25 : 1) * (I.fire && !S.B.flame ? .86 : 1); move(L, pl, mx * sp * dt, my * sp * dt); if (ml > .1) pl.walk += dt * 11; }
  for (const b of L.barrels) { if (b.dead) continue; const d = hyp(pl.x - b.x, pl.y - b.y); if (d < pl.r + b.r && d > 0) move(L, pl, (pl.x - b.x) / d * (pl.r + b.r - d), (pl.y - b.y) / d * (pl.r + b.r - d)); }
  // 瞄准：有瞄准输入用输入；触屏没输入时自动瞄最近的可见敌人
  let fireNow = I.fire;
  pl.auto = false; if (hyp(I.ax, I.ay) > .2) pl.ang = Math.atan2(I.ay, I.ax);
  else if (YJ.autoAim) { let best = null, bd = (S.B.range * .9) ** 2; for (const e of L.en) { if (!e.see) continue; const d2 = ((e.x - pl.x) ** 2 + (e.y - pl.y) ** 2) * (e === pl.tgt ? .55 : 1); if (d2 < bd) { bd = d2; best = e; } }
    pl.tgt = best; pl.auto = !!best;
    if (best) { const dist = hyp(best.x - pl.x, best.y - pl.y), lead = S.B.flame || !best.awake || best.stag > 0 ? 0 : dist / S.B.speed; pl.ang = Math.atan2(best.y + Math.sin(best.ang) * best.sp * lead - pl.y, best.x + Math.cos(best.ang) * best.sp * lead - pl.x); fireNow = true; }
    else if (ml > .2) pl.ang = Math.atan2(my, mx); }
  if (pl.rel > 0) { pl.rel -= dt; if (pl.rel <= 0) { pl.mag = S.mag; } }
  else if (I.reload) startReload();
  else if (fireNow && pl.fireCd <= 0 && pl.dashT <= 0) fire(L);
  I.reload = false;
  if (I.gren && pl.gCd <= 0) { pl.gCd = 6; const a = pl.ang; L.bul.push({ x: pl.x, y: pl.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: .75, gren: 1, dmg: (70 + G.P.lv * 12) * S.grenM }); SFX("throw"); }
  I.gren = false;
  if (I.med && G.P.med > 0 && pl.hp < S.maxhp && pl.medCd <= 0) { G.P.med--; pl.medCd = 1; pl.hp = Math.min(S.maxhp, pl.hp + S.maxhp * .45); SFX("heal"); L.fx.push({ t: "ring", x: pl.x, y: pl.y, r: 60, life: .5, max: .5, c: "#6bd08a" }); }
  I.med = false;
  // 画面用的朝向：转身有个过程，自动瞄准换目标时不会猛甩
  { let da = ((pl.ang - pl.va) % TAU + TAU + Math.PI) % TAU - Math.PI; const mxr = (pl.auto ? 9 : 22) * dt; pl.va += Math.abs(da) < mxr ? da : Math.sign(da) * mxr; }
  pl.mvx = mx; pl.mvy = my;
}
/* 测试用自动驾驶：沿寻路走向当前目标，见敌就打，太近就后撤 */
function autopilot(L) {
  const pl = G.pl, I = G.inp; let tgt = null, bd = 1e9; for (const e of L.en) { if (!e.see) continue; const d = hyp(e.x - pl.x, e.y - pl.y); if (d < bd) { bd = d; tgt = e; } }
  let goal = L.exit; if (!L.objDone) { const o = L.objs.filter(o => !o.done).sort((a, b) => hyp(a.x - pl.x, a.y - pl.y) - hyp(b.x - pl.x, b.y - pl.y))[0]; goal = o || L.eliteE || L.bossE; if (L.def.endless && L.mis) goal = L.mis.es && L.mis.es[0] ? L.mis.es[0] : L.mis;
    if (!goal && (L.def.obj.t === "purge" || L.def.endless)) { let bd2 = 1e12; for (const e of L.en) { const d2 = (e.x - pl.x) ** 2 + (e.y - pl.y) ** 2; if (d2 < bd2) { bd2 = d2; goal = e; } } }
    goal = goal || L.exit; }
  const gk = Math.floor(goal.x / T) + "," + Math.floor(goal.y / T); if (L.botK !== gk || !L.botD) { L.botK = gk; L.botD = bfs(L, Math.floor(goal.x / T), Math.floor(goal.y / T)); }
  const cx = Math.floor(pl.x / T), cy = Math.floor(pl.y / T), W = L.W; let best = L.botD[cy * W + cx], bx = 0, by = 0;
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = L.botD[(cy + oy) * W + cx + ox]; if (v < best) { best = v; bx = ox; by = oy; } }
  let mx = (cx + bx + .5) * T - pl.x, my = (cy + by + .5) * T - pl.y; if (!bx && !by) { mx = goal.x - pl.x; my = goal.y - pl.y; }
  const gen = L.objs.find(o => o.t === "gen" && !o.done && hyp(o.x - pl.x, o.y - pl.y) < 50);
  if (gen || (L.holdOn && !tgt)) { mx = my = 0; }
  if (tgt && bd < (tgt.E.elite ? 260 : 120) && !(L.holdOn && hyp(L.exit.x - pl.x, L.exit.y - pl.y) > 55)) { mx = pl.x - tgt.x + (pl.y - tgt.y) * .5; my = pl.y - tgt.y - (pl.x - tgt.x) * .5; }
  else if (tgt && bd < 300 && L.en.filter(e => e.awake).length > 5) { mx *= .2; my *= .2; }
  const ml = hyp(mx, my) || 1; I.mx = mx / ml; I.my = my / ml;
  if (tgt) { I.ax = tgt.x - pl.x; I.ay = tgt.y - pl.y; I.fire = true; if (bd < 200 && rnd() < .02) I.gren = true; } else { I.ax = I.ay = 0; I.fire = false; }
  if (pl.hp < G.S.maxhp * .4) I.med = true; if (tgt && bd < 50) I.dash = true;
}

/* ================= 子弹 ================= */
function updBullets(L, dt) {
  const pl = G.pl, grid = L.grid;
  for (let i = L.bul.length - 1; i >= 0; i--) { const b = L.bul[i]; b.life -= dt; let dead = b.life <= 0;
    if (b.gren) { b.vx *= .97; b.vy *= .97; const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt; if (solid(L, nx, b.y)) b.vx *= -.5; else b.x = nx; if (solid(L, b.x, ny)) b.vy *= -.5; else b.y = ny; if (dead) explode(L, b.x, b.y, 115, b.dmg, 0); }
    else { const steps = Math.max(1, Math.ceil(hyp(b.vx, b.vy) * dt / 12));
      for (let s = 0; s < steps && !dead; s++) { b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
        if (solid(L, b.x, b.y) && L.g[Math.floor(b.y / T) * L.W + Math.floor(b.x / T)] === 1) { dead = true; if (b.acid) { b.x -= b.vx * dt / steps; b.y -= b.vy * dt / steps; } if (!b.flame) for (let k = 0; k < 3; k++) part(L, b.x, b.y, R(-80, 80), R(-80, 80), .2, b.enemy ? "#9acd32" : "#ffd27a", 2, 1); break; }
        if (b.enemy) { if (hyp(pl.x - b.x, pl.y - b.y) < pl.r + 5 && (!b.acid || b.life < b.max * .35)) { hurtPlayer(b.dmg); dead = true; } continue; }
        for (const bl of L.barrels) if (!bl.dead && hyp(bl.x - b.x, bl.y - b.y) < bl.r) { bl.hp -= b.dmg; dead = !b.flame; }
        const c = grid.get((Math.floor(b.x / 80) << 8) | Math.floor(b.y / 80)); if (!c) continue;
        for (const e of c) { if (e.dead || b.hit.includes(e) || hyp(e.x - b.x, e.y - b.y) > e.r + 4) continue; b.hit.push(e);
          hurt(L, e, b.dmg * (b.crit ? G.S.critM : 1), b.crit, Math.atan2(b.vy, b.vx)); if (b.flame && rnd() < .25) { e.burn = 2.5; e.burnD = b.dmg * 1.6; }
          if (b.ex) { dead = true; break; } if (b.pierce-- <= 0) { dead = true; break; } b.dmg *= .8; } }
      if (b.flame && rnd() < .7) part(L, b.x, b.y, b.vx * .15 + R(-20, 20), b.vy * .15 + R(-20, 20), .25, pick(["#ffb347", "#ff6a1a", "#ffe08a"]), R(4, 9), 1);
      if (dead && b.ex) explode(L, b.x, b.y, b.ex, b.dmg, 0);
      if (dead && b.acid) { addPool(L, b.x, b.y, 30, 6, b.dmg * .35); for (let k = 0; k < 6; k++) part(L, b.x, b.y, R(-90, 90), R(-90, 90), .3, "#9acd32", 3, 1); } }
    if (dead) L.bul.splice(i, 1); }
  for (const b of L.barrels) if (!b.dead && b.hp <= 0) { b.dead = true; explode(L, b.x, b.y, 105, 90 * L.hpM, 1); }
}

/* ================= 无尽模式：威胁随时间上升，电台随机发委托 ================= */
function farRoom(L, min) { const pl = G.pl, c = L.rooms.filter(r => { const d = L.flow[r.cy * L.W + r.cx]; return d >= min && d < 60000; }); return c.length ? pick(c) : L.rooms.slice().sort((a, b) => L.flow[b.cy * L.W + b.cx] - L.flow[a.cy * L.W + a.cx])[0]; }
function newMission(L) {
  const pl = G.pl, type = pick(["supply", "beacon", "hunt", "nest", "supply", "hunt"]), M = YJ.MISSIONS[type], r = farRoom(L, 22), x = (r.cx + .5) * T, y = (r.cy + .5) * T;
  const a = Math.atan2(y - pl.y, x - pl.x), dir = ["东", "东南", "南", "西南", "西", "西北", "北", "东北"][((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
  const m = L.mis = { type, name: M.name, goal: M.goal, x, y, t: 0 };
  if (type === "supply") { m.ob = { t: "fuse", x, y, prog: 0, done: false, on: false }; L.objs.push(m.ob); for (let k = 0; k < 6; k++) { const p = L.freeIn(r); spawn(L, wpick(L.def.mix), p.x, p.y, false); } }
  else if (type === "beacon") { m.ob = { t: "gen", x, y, prog: 0, done: false, on: false }; L.objs.push(m.ob); }
  else if (type === "hunt") { const e = m.e = L.eliteE = spawn(L, "elite", x, y, false); e.nm = pick(YJ.ELITE_NAMES); e.look = "brute"; e.cloth = "#2b3036"; e.sumOff = 1; e.hp = e.maxhp = e.hp * .55; }
  else { m.es = []; for (let k = 0; k < 14 + L.misN * 2; k++) { const p = L.freeIn(r), e = spawn(L, wpick({ ...L.def.mix, brute: L.misN > 2 ? 1 : 0 }), p.x, p.y, false); m.es.push(e); } }
  G.say(pick(M.lines).map(l => [l[0], l[1].replace("{p}", dir)])); G.toast("新委托：" + M.name, "gold"); SFX("key", .7);
}
function updEndless(L, dt) {
  const pl = G.pl, P = G.P, m = L.mis;
  const lv = L.base + Math.floor(L.time / 75) + L.misN; if (lv !== L.lvl) { setLvl(L, lv); G.toast("威胁等级上升 → " + (lv - L.base + 1), "red"); if ((lv - L.base) % 3 === 0) L.def.mix = { ...L.def.mix, brute: (L.def.mix.brute || 0) + 1, runner: L.def.mix.runner + 1 }; }
  L.ambT -= dt; if (L.ambT <= 0 && L.en.length < 70) { L.ambT = 14; const r = farRoom(L, 16); for (let k = 0; k < 7; k++) { const p = L.freeIn(r); spawn(L, wpick(L.def.mix), p.x, p.y, false); } }
  if (!m) { L.misT -= dt; if (L.misT <= 0) newMission(L); return; }
  m.t += dt; let done = false; const d = hyp(m.x - pl.x, m.y - pl.y);
  if (m.type === "supply") { if (d < 30) { m.ob.done = true; done = true; } }
  else if (m.type === "beacon") { const ob = m.ob; if (d < 66) { if (!ob.on) { ob.on = true; horde(L, 9 + L.misN * 2, L.def.mix); G.toast("信标启动中，守住！", "gold"); SFX("gen"); } ob.prog += dt / 8; if (rnd() < dt * 1.3) horde(L, 2, L.def.mix); if (ob.prog >= 1) { ob.done = true; done = true; L.lamps.push({ x: ob.x, y: ob.y, r: 240, c: "#9effa0", f: 0 }); } } }
  else if (m.type === "hunt") { if (m.e.dead) { done = true; L.eliteE = null; } else { m.x = m.e.x; m.y = m.e.y; } }
  else { m.es = m.es.filter(e => !e.dead); m.left = m.es.length; if (!m.es.length) done = true; }
  if (done) { L.mis = null; L.misN++; L.misT = R(14, 22); L.score += 800 + L.misN * 200; SFX("win", .6); G.toast("委托完成！奖励已投放", "gold");
    drop(L, pl.x, pl.y, { t: "item", it: YJ.makeItem(L.lvl + 1, { rar: Math.max(L.misN % 4 === 0 ? 3 : 1, rollRar(1.6)) }) }); drop(L, pl.x, pl.y, { t: "scrap", n: 12 + L.lvl * 3 }); if (P.med < 4) drop(L, pl.x, pl.y, { t: "med" });
    G.say([[pick(["林夏", "林夏", "老周"]), pick(["干得漂亮。歇口气，下一个委托很快就来。", "收到。灯塔记你一功。", "你比军队管用多了。", "活着就好。别走远，频道里又有人在喊。"])]]); }
}

/* ================= 主循环 ================= */
YJ.startLevel = function (i) {
  const L = G.L = genLevel(i); YJ.calcStats();
  G.pl = { x: L.start.x, y: L.start.y, r: 12, ang: 0, hp: G.S.maxhp, fireCd: 0, mag: G.S.mag, rel: 0, relMax: 1, dashT: 0, dashCd: 0, gCd: 0, inv: 1, hurtT: 0, walk: 0, va: 0, mvx: 0, mvy: 0, hasteT: 0, flashT: 0, novaCd: 0, medCd: 0 };
  G.cam = { x: L.start.x, y: L.start.y, lx: 0, ly: 0 }; G.state = "play"; if (L.def.endless) setTimeout(() => G.say([["林夏", "这片区域没有出口，也没有尽头。活下去，频道里有人求救我就转给你。"]]), 600); G.slow = 1; G.shake = 0; G.inp.mx = G.inp.my = G.inp.ax = G.inp.ay = 0; G.inp.fire = false;
  YJ.Render.build(L); setTimeout(() => G.radio("start"), 600);
};
YJ.refreshWeapon = function () { YJ.calcStats(); if (G.pl) { G.pl.mag = Math.min(G.pl.mag, G.S.mag); G.pl.hp = Math.min(G.pl.hp, G.S.maxhp); } };
YJ.update = function (dtReal) {
  const L = G.L, pl = G.pl; if (!L || (G.state !== "play" && G.state !== "dead")) return;
  const dt = Math.min(1 / 30, dtReal) * G.slow; L.time += dt; G.shake *= Math.pow(.02, dt);
  // 空间网格（子弹判定用）
  const grid = L.grid = new Map(); for (const e of L.en) { const x0 = Math.floor((e.x - e.r) / 80), x1 = Math.floor((e.x + e.r) / 80), y0 = Math.floor((e.y - e.r) / 80), y1 = Math.floor((e.y + e.r) / 80); for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = (x << 8) | y; let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(e); } }
  if (G.state === "play") updPlayer(L, dt);
  L.flowT -= dt; if (L.flowT <= 0) { L.flowT = .25; bfs(L, Math.floor(pl.x / T), Math.floor(pl.y / T), L.flow);
    const cx = Math.floor(pl.x / T), cy = Math.floor(pl.y / T); for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) if (x >= 0 && y >= 0 && x < L.W && y < L.H && (x - cx) ** 2 + (y - cy) ** 2 < 52) L.explored[y * L.W + x] = 1; }
  for (const e of L.en.slice()) if (!e.dead) updEnemy(L, e, dt);
  // 互相挤开
  for (const c of grid.values()) for (let a = 0; a < c.length; a++) for (let b = a + 1; b < c.length; b++) { const p = c[a], q = c[b], dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy), m = p.r + q.r - 2; if (d < m && d > .01) { const f = (m - d) / d * .5 * (p.st === "dash" || q.st === "dash" ? 0 : 1); if (!p.E.elite) move(L, p, -dx * f, -dy * f); if (!q.E.elite) move(L, q, dx * f, dy * f); } }
  L.en = L.en.filter(e => !e.dead);
  updBullets(L, dt);
  for (let i = L.parts.length - 1; i >= 0; i--) { const p = L.parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; if (p.life <= 0) { if (p.k === "bl" && rnd() < .6 && !solid(L, p.x, p.y)) L.decals.push({ t: "blood", x: p.x, y: p.y, r: p.s * R(.6, 1.2), c: p.c }); L.parts.splice(i, 1); } }
  for (let i = L.bodies.length - 1; i >= 0; i--) { const b = L.bodies[i]; b.t += dt; if (b.t >= b.dur) { L.decals.push({ ...b, t: "corpse", type: b.type }); L.bodies.splice(i, 1); } }
  for (let i = L.spawnQ.length - 1; i >= 0; i--) { const q = L.spawnQ[i]; if ((q.t -= dt) <= 0) { spawn(L, q.type, q.x, q.y, true); L.spawnQ.splice(i, 1); } }
  for (let i = L.pools.length - 1; i >= 0; i--) { const q = L.pools[i]; q.life -= dt; q.t -= dt; if (q.life <= 0) { L.pools.splice(i, 1); continue; }
    if (q.t <= 0 && G.state === "play" && hyp(pl.x - q.x, pl.y - q.y) < q.r + 4 && pl.dashT <= 0) { q.t = .5; hurtPlayer(q.dmg); } }
  for (let i = L.fx.length - 1; i >= 0; i--) if ((L.fx[i].life -= dt) <= 0) L.fx.splice(i, 1);
  for (let i = L.nums.length - 1; i >= 0; i--) { const n = L.nums[i]; n.life -= dt; n.y -= 40 * dt; if (n.life <= 0) L.nums.splice(i, 1); }
  if (G.state !== "play") return;
  // 掉落
  for (let i = L.drops.length - 1; i >= 0; i--) { const d = L.drops[i]; d.age += dt; const dd = hyp(d.x - pl.x, d.y - pl.y);
    if (d.t !== "item" && dd < 100 && d.age > .4) { d.x += (pl.x - d.x) / dd * 260 * dt; d.y += (pl.y - d.y) / dd * 260 * dt; }
    if (dd < 26 && d.age > .35) { const P = G.P;
      if (d.t === "scrap") { P.scrap += d.n; SFX("pick", .5); }
      else if (d.t === "med") { if (P.med >= 4) continue; P.med++; G.toast("医疗包 +1"); SFX("pick"); }
      else { if (P.inv.length >= 30) { if (!d.full) { d.full = 1; G.toast("背包满了"); } continue; } P.inv.push(d.it); L.loot++; G.toast("拾取：" + YJ.itemName(d.it), ["", "blue", "gold", "orange"][d.it.rar]); SFX(d.it.rar >= 2 ? "rare" : "pick"); }
      L.drops.splice(i, 1); } }
  // 目标
  const o = L.def.obj;
  if (L.def.endless) updEndless(L, dt);
  else for (const ob of L.objs) { if (ob.done) continue; const d = hyp(ob.x - pl.x, ob.y - pl.y);
    if (ob.t === "fuse" && d < 30) { ob.done = true; L.objN++; SFX("key"); G.toast(o.name + " " + L.objN + "/" + o.n, "gold"); if (L.objN === 2) G.radio("mid"); }
    if (ob.t === "gen") { if (d < 62) { if (!ob.on) { ob.on = true; horde(L, 7 + L.objN * 3, { walker: 5, runner: 5, bloater: 2 }); G.toast("发电机启动中，守住！", "gold"); SFX("gen"); } ob.prog += dt / 8; if (rnd() < dt * 1.2) horde(L, 2); if (ob.prog >= 1) { ob.done = true; L.objN++; SFX("key"); G.toast(o.name + " " + L.objN + "/" + o.n, "gold"); L.lamps.push({ x: ob.x, y: ob.y, r: 240, c: "#9effa0", f: 0 }); if (L.objN === 2) G.radio("mid"); } } }
    if (L.objN >= o.n && !L.objDone) { L.objDone = true; G.radio("done"); } }
  // 尸潮
  if (L.def.horde[0]) { L.hordeT -= dt; if (L.hordeT <= 0 && L.en.length < 90) { L.hordeT = L.def.horde[0] * R(.8, 1.2); L.hordeN++; horde(L, L.def.horde[1] + L.hordeN, L.def.mix); if (L.hordeN === 1 && o.t !== "collect" && o.t !== "activate") G.radio("mid"); G.toast("尸群正在逼近……", "red"); } }
  if (L.objDone && !L.won) { const near = hyp(L.exit.x - pl.x, L.exit.y - pl.y) < 80, hold = L.def.arena ? 0 : YJ.holdTime(L);
    if (near && hold && !L.holdOn) { L.holdOn = true; L.holdP = 0; G.toast("正在开门——守住！", "red"); SFX("horde", .8); horde(L, Math.min(26, 8 + L.i * 2), L.def.mix); L.holdW = 5; }
    if (L.holdOn && near) { L.holdP += dt; L.holdW -= dt; if (L.holdW <= 0 && L.en.length < 90) { L.holdW = 5; horde(L, Math.min(14, 4 + L.i), L.def.mix); } }
    if (near && (!hold || L.holdP >= hold) && hyp(L.exit.x - pl.x, L.exit.y - pl.y) < (hold ? 80 : 34)) { L.won = true; G.state = "won"; SFX("win"); YJ.UI.win(); } }
};
YJ.holdTime = L => Math.min(30, 12 + L.i);
YJ.reloadNow = () => { G.inp.reload = true; };
})();
