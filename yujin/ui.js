/* 余烬·尸潮 — 界面：标题、过场动画、HUD、操作、背包/天赋、结算 */
(function () {
"use strict";
const G = YJ.G, TAU = Math.PI * 2, $ = s => document.querySelector(s);
const el = h => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SFX = (n, v) => { try { YJ.Audio.play(n, v); } catch {} };
const UI = YJ.UI = {};
const show = id => { document.querySelectorAll(".screen").forEach(s => s.hidden = s.id !== id); };
YJ.autoAim = true; try { YJ.autoAim = localStorage.getItem("yj.auto") !== "0"; } catch {}

/* ================= 过场动画：画出来的场景 + 打字机字幕 ================= */
const h2 = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const PAINT = {
  city(c, W, H, t, dawn) {
    const g = c.createLinearGradient(0, 0, 0, H); if (dawn) { g.addColorStop(0, "#2a3a5a"); g.addColorStop(.55, "#e08a4a"); g.addColorStop(.75, "#ffd9a0"); g.addColorStop(1, "#3a2a2a"); } else { g.addColorStop(0, "#07090f"); g.addColorStop(.6, "#1a1420"); g.addColorStop(.8, "#5a2a18"); g.addColorStop(1, "#0a0808"); }
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (dawn) { const s = c.createRadialGradient(W * .5, H * .72, 0, W * .5, H * .72, H * .6); s.addColorStop(0, "rgba(255,240,200,.95)"); s.addColorStop(.15, "rgba(255,200,120,.6)"); s.addColorStop(1, "rgba(255,160,80,0)"); c.fillStyle = s; c.fillRect(0, 0, W, H); }
    for (let layer = 0; layer < 3; layer++) { const base = H * (.62 + layer * .1), par = (t * (4 + layer * 5)) % 140; c.fillStyle = dawn ? ["#6a5a6a", "#3e3440", "#1c1820"][layer] : ["#15131c", "#0d0c13", "#060608"][layer];
      for (let i = -1; i < W / 70 + 2; i++) { const k = i + layer * 31, bw = 44 + h2(k, 1) * 50, bh = (60 + h2(k, 2) * 190) * (1 - layer * .22), x = i * 70 - par * (layer + 1) / 3; c.fillRect(x, base - bh, bw, bh + H);
        if (layer < 2) for (let wy = 0; wy < bh / 16 - 1; wy++) for (let wx = 0; wx < bw / 12 - 1; wx++) { const r = h2(k * 9 + wx, wy + layer * 77); if (r > .93) { c.fillStyle = dawn ? "rgba(255,230,180,.5)" : r > .975 ? "rgba(255,120,50,.9)" : "rgba(255,210,130,.5)"; c.fillRect(x + 5 + wx * 12, base - bh + 8 + wy * 16, 5, 7); c.fillStyle = dawn ? ["#6a5a6a", "#3e3440"][layer] : ["#15131c", "#0d0c13"][layer]; } } } }
    if (!dawn) { for (let i = 0; i < 4; i++) { const x = W * (.15 + i * .25) + Math.sin(i * 9) * 40, y = H * .66, f = .5 + Math.sin(t * 7 + i * 3) * .2 + Math.sin(t * 13 + i) * .15, s = c.createRadialGradient(x, y, 0, x, y, 110); s.addColorStop(0, `rgba(255,140,50,${f})`); s.addColorStop(1, "rgba(255,90,20,0)"); c.fillStyle = s; c.fillRect(x - 110, y - 110, 220, 220); }
      c.strokeStyle = "rgba(170,200,240,.18)"; c.beginPath(); for (let i = 0; i < 70; i++) { const x = (h2(i, 5) * (W + 100) + t * 160) % (W + 100) - 50, y = (h2(i, 6) * H + t * 700 * (.7 + h2(i, 7) * .5)) % H; c.moveTo(x, y); c.lineTo(x - 5, y + 18); } c.stroke();
      c.fillStyle = "#020203"; for (let i = 0; i < 7; i++) { const x = (h2(i, 11) * (W + 200) + t * (6 + h2(i, 12) * 8)) % (W + 200) - 100, y = H * .93, s = .8 + h2(i, 13) * .5, sw = Math.sin(t * 2 + i) * 3; c.beginPath(); c.ellipse(x, y - 34 * s, 7 * s, 16 * s, .15, 0, TAU); c.fill(); c.beginPath(); c.arc(x + 3, y - 56 * s, 6 * s, 0, TAU); c.fill(); c.fillRect(x - 5 * s + sw, y - 20 * s, 4 * s, 22 * s); c.fillRect(x + 2 * s - sw, y - 20 * s, 4 * s, 22 * s); c.fillRect(x + 4, y - 44 * s, 14 * s, 3 * s); } c.fillRect(0, H * .93, W, H); }
    else { c.fillStyle = "#0e0c10"; c.fillRect(0, H * .9, W, H); c.strokeStyle = "rgba(40,30,30,.8)"; c.lineWidth = 2; for (let i = 0; i < 5; i++) { const x = (W * .2 + i * 60 + t * 20) % (W + 60) - 30, y = H * .3 + Math.sin(i * 4 + t) * 20 + i * 12; c.beginPath(); c.moveTo(x - 7, y - 3); c.lineTo(x, y); c.lineTo(x + 7, y - 3); c.stroke(); } }
  },
  dawn(c, W, H, t) { PAINT.city(c, W, H, t, true); },
  room(c, W, H, t) {
    c.fillStyle = "#0a0b0e"; c.fillRect(0, 0, W, H);
    const wx = W * .58, wy = H * .14, ww = W * .3, wh = H * .34; c.fillStyle = "#1a2a40"; c.fillRect(wx, wy, ww, wh); for (let i = 0; i < 9; i++) { c.fillStyle = "#0a0b0e"; c.fillRect(wx, wy + i * wh / 9, ww, wh / 9 - 4); }
    const lg = c.createLinearGradient(wx, wy, wx - W * .4, H); lg.addColorStop(0, "rgba(120,160,220,.16)"); lg.addColorStop(1, "rgba(120,160,220,0)"); c.fillStyle = lg; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + ww, wy); c.lineTo(wx + ww * .4, H); c.lineTo(wx - W * .5, H); c.closePath(); c.fill();
    c.fillStyle = "#1c1612"; c.fillRect(W * .08, H * .66, W * .84, H * .05); c.fillRect(W * .12, H * .71, 12, H * .3); c.fillRect(W * .86, H * .71, 12, H * .3);
    const rx = W * .22, ry = H * .5; c.fillStyle = "#23282c"; c.fillRect(rx, ry, W * .26, H * .16); c.fillStyle = "#0c0f10"; c.fillRect(rx + 8, ry + 8, W * .12, H * .1); c.strokeStyle = "#39d98a"; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 30; i++) { const x = rx + 10 + i * (W * .12 - 4) / 30, y = ry + 8 + H * .05 + Math.sin(i * .9 + t * 8) * Math.sin(t * 3 + i * .2) * H * .035; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    c.fillStyle = Math.sin(t * 5) > 0 ? "#ff4030" : "#501810"; c.beginPath(); c.arc(rx + W * .21, ry + 16, 4, 0, TAU); c.fill(); c.strokeStyle = "#555"; c.lineWidth = 2; c.beginPath(); c.moveTo(rx + W * .24, ry); c.lineTo(rx + W * .28, ry - H * .2); c.stroke();
    const lx = W * .7, ly = H * .58, g = c.createRadialGradient(lx, ly, 0, lx, ly, W * .45); g.addColorStop(0, "rgba(255,200,120,.35)"); g.addColorStop(1, "rgba(255,200,120,0)"); c.fillStyle = g; c.fillRect(0, 0, W, H); c.fillStyle = "#3a3026"; c.fillRect(lx - 3, ly, 6, H * .08); c.fillStyle = "#c9a060"; c.beginPath(); c.moveTo(lx - 18, ly + 4); c.lineTo(lx + 18, ly + 4); c.lineTo(lx + 10, ly - 16); c.lineTo(lx - 10, ly - 16); c.closePath(); c.fill();
  },
  tunnel(c, W, H, t, o) {
    c.fillStyle = o.bg; c.fillRect(0, 0, W, H); const cx = W / 2, cy = H * .48;
    for (let i = 9; i >= 0; i--) { const k = ((i + (t * .15) % 1) / 10) ** 1.8, w = W * (.06 + k * 1.1), h = H * (.05 + k * .9), fl = o.flick && Math.sin(t * 11 + i * 2) > .7 ? .25 : 1; c.fillStyle = `rgba(${o.rgb},${(.05 + (1 - k) * .1) * fl})`; c.strokeStyle = `rgba(${o.rgb},${.35 * (1 - k * .6) * fl})`; c.lineWidth = 2 + k * 5;
      c.beginPath(); if (o.arch) { c.moveTo(cx - w / 2, cy + h / 2); c.lineTo(cx - w / 2, cy - h * .1); c.quadraticCurveTo(cx, cy - h * .75, cx + w / 2, cy - h * .1); c.lineTo(cx + w / 2, cy + h / 2); } else c.rect(cx - w / 2, cy - h / 2, w, h); c.stroke(); if (i % 3 === 0) { c.fillRect(cx - w * .2, cy - h / 2, w * .4, h * .04); } }
    c.strokeStyle = `rgba(${o.rgb},.3)`; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - W * .03, cy + H * .03); c.lineTo(cx - W * .5, H); c.moveTo(cx + W * .03, cy + H * .03); c.lineTo(cx + W * .5, H); c.stroke();
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, W * .2); g.addColorStop(0, o.glow); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (o.extra) o.extra(c, W, H, t, cx, cy);
  },
  subway(c, W, H, t) { PAINT.tunnel(c, W, H, t, { bg: "#07080a", rgb: "200,170,110", arch: 1, glow: "rgba(255,60,40,.35)", extra(c, W, H, t, cx, cy) { c.fillStyle = Math.sin(t * 3) > 0 ? "#ff3020" : "#601008"; c.beginPath(); c.arc(cx, cy, 5, 0, TAU); c.fill(); } }); },
  hospital(c, W, H, t) { PAINT.tunnel(c, W, H, t, { bg: "#0a100e", rgb: "170,230,210", flick: 1, glow: "rgba(170,255,220,.18)", extra(c, W, H, t, cx, cy) { c.fillStyle = "rgba(110,10,10,.5)"; c.beginPath(); c.moveTo(cx - 10, cy + H * .05); c.quadraticCurveTo(cx - W * .1, H * .8, cx - W * .3, H); c.lineTo(cx - W * .16, H); c.quadraticCurveTo(cx - W * .05, H * .8, cx + 6, cy + H * .05); c.fill(); c.fillStyle = "#020303"; c.fillRect(cx + W * .1, cy + H * .1, W * .16, H * .03); c.fillRect(cx + W * .11, cy + H * .13, 4, H * .07); c.fillRect(cx + W * .25, cy + H * .13, 4, H * .07); } }); },
  lab(c, W, H, t) {
    c.fillStyle = "#04090c"; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) { const x = W * (.08 + i * .17) - (t * 6) % (W * .17), tw = W * .1, ty = H * .2, th = H * .52, g = c.createLinearGradient(x, 0, x + tw, 0); g.addColorStop(0, "rgba(40,180,220,.15)"); g.addColorStop(.5, "rgba(120,240,255,.4)"); g.addColorStop(1, "rgba(40,180,220,.15)"); c.fillStyle = g; c.fillRect(x, ty, tw, th);
      c.fillStyle = "rgba(4,20,24,.85)"; const by = ty + th * .5 + Math.sin(t * 1.2 + i * 2) * 8; c.beginPath(); const bh = Math.min(th * .22, tw * .8); c.ellipse(x + tw / 2, by, tw * .16, bh, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x + tw / 2, by - bh - tw * .16, tw * .13, 0, TAU); c.fill(); c.fillRect(x + tw * .2, by - bh * .5, tw * .6, 3);
      for (let b = 0; b < 5; b++) { const yy = ty + th - ((t * 40 + b * 50 + i * 20) % th); c.fillStyle = "rgba(200,255,255,.5)"; c.beginPath(); c.arc(x + tw * (.25 + h2(i, b) * .5), yy, 2, 0, TAU); c.fill(); }
      c.fillStyle = "#12222a"; c.fillRect(x - 4, ty - 14, tw + 8, 14); c.fillRect(x - 4, ty + th, tw + 8, 22); }
    const g = c.createLinearGradient(0, H * .75, 0, H); g.addColorStop(0, "rgba(60,200,240,.12)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(0, H * .75, W, H * .25);
  },
  base(c, W, H, t) {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#080a10"); g.addColorStop(1, "#1a1a14"); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (const [bx, sp] of [[.25, .5], [.75, -.4]]) { const x = W * bx, y = H * .3, a = Math.PI / 2 + Math.sin(t * sp) * .9; c.fillStyle = "rgba(255,245,210,.12)"; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a - .12) * H, y + Math.sin(a - .12) * H); c.lineTo(x + Math.cos(a + .12) * H, y + Math.sin(a + .12) * H); c.closePath(); c.fill(); c.fillStyle = "#0a0b0c"; c.fillRect(x - 5, y, 10, H); c.fillRect(x - 22, y - 22, 44, 24); c.fillStyle = "#fff3c0"; c.beginPath(); c.arc(x, y - 4, 5, 0, TAU); c.fill(); }
    c.fillStyle = "#07080a"; c.fillRect(0, H * .72, W, H); c.strokeStyle = "#1c1f22"; c.lineWidth = 2; for (let i = 0; i < W / 22 + 1; i++) { c.beginPath(); c.moveTo(i * 22, H * .56); c.lineTo(i * 22, H * .72); c.stroke(); } c.beginPath(); for (let k = 0; k < 3; k++) { c.moveTo(0, H * (.58 + k * .05)); c.lineTo(W, H * (.58 + k * .05)); } c.stroke();
    c.fillStyle = "#07080a"; c.fillRect(W * .42, H * .6, W * .2, H * .12); c.fillRect(W * .48, H * .56, W * .08, H * .05); c.fillRect(W * .55, H * .575, W * .14, H * .012);
  }
};
let cut = null;
UI.cutscene = function (key, done) {
  const sc = YJ.SCENES[key]; if (!sc) return done();
  show("sCut"); G.state = "cut"; cut = { sc, i: 0, li: 0, ch: 0, t0: performance.now(), done, st: performance.now() };
  try { YJ.Audio.mood("cut"); } catch {}
  cutLine();
};
function cutLine() { const s = cut.sc[cut.i], l = s.lines[cut.li]; cut.ch = 0; cut.full = l[1]; $("#cutWho").textContent = l[0]; $("#cutWho").style.color = YJ.FACE[l[0]] || "#c9bfa8"; $("#cutWho").hidden = !l[0]; $("#cutTxt").textContent = ""; $("#cutTxt").className = l[0] ? "" : "narr"; }
function cutNext() { if (!cut) return; SFX("ui", .4);
  if (cut.ch < cut.full.length) { cut.ch = cut.full.length; $("#cutTxt").textContent = cut.full; return; }
  const s = cut.sc[cut.i]; if (++cut.li < s.lines.length) return cutLine();
  cut.li = 0; if (++cut.i < cut.sc.length) { cut.st = performance.now(); return cutLine(); }
  const d = cut.done; cut = null; d(); }
$("#sCut").addEventListener("click", e => { if (e.target.id === "cutSkip") { const d = cut.done; cut = null; d(); } else cutNext(); });
function cutFrame(now) {
  const cv = $("#cutCv"), r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  const c = cv.getContext("2d"), W = r.width, H = r.height, t = (now - cut.t0) / 1000, bar = H * .12; c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.save(); const z = 1.06 + Math.sin(t * .1) * .03; c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-W / 2 + Math.sin(t * .13) * 8, -H / 2); PAINT[cut.sc[cut.i].bg](c, W, H, t); c.restore();
  const fade = Math.min(1, (now - cut.st) / 700); if (fade < 1) { c.fillStyle = `rgba(0,0,0,${1 - fade})`; c.fillRect(0, 0, W, H); }
  c.fillStyle = "#000"; c.fillRect(0, 0, W, bar); c.fillRect(0, H - bar * 2.1, W, bar * 2.1);
  if (cut.ch < cut.full.length) { cut.ch = Math.min(cut.full.length, cut.ch + .55); $("#cutTxt").textContent = cut.full.slice(0, Math.floor(cut.ch)); if (Math.floor(cut.ch) % 3 === 0) SFX("type", .15); }
}

/* ================= 标题 ================= */
UI.title = function () { show("sTitle"); G.state = "title"; $("#tCont").hidden = !YJ.load(); try { YJ.Audio.mood("title"); } catch {} };
$("#tNew").onclick = () => { if (YJ.load() && !$("#tNew").dataset.ok) { $("#tNew").dataset.ok = 1; $("#tNew").textContent = "确定覆盖存档？再点一次"; return; } delete $("#tNew").dataset.ok; $("#tNew").textContent = "新的旅程"; YJ.newSave(); YJ.save(); UI.cutscene("intro", () => UI.safe()); };
$("#tCont").onclick = () => { YJ.load(); UI.safe(); };
$("#tHelp").onclick = () => UI.sheet("操作说明", `<div class="help"><p><b>手机</b>：左半屏拖动 = 移动；右半屏拖动 = 瞄准并开火。不碰右边时会<b>自动瞄准</b>最近的丧尸并开火（可在暂停菜单里关）。右下角按钮：翻滚（短暂无敌）、手雷、医疗包、换弹。建议横屏玩，竖屏也可以。</p><p><b>电脑</b>：WASD 移动，鼠标瞄准，按住左键开火，空格翻滚，G 或右键手雷，Q 医疗包，R 换弹，Tab / I 背包，Esc 暂停。</p><p><b>成长</b>：击杀丧尸得经验，升级得天赋点。丧尸会掉落装备：<span style="color:#B9B9B9">普通</span>、<span style="color:#4FA3FF">精良</span>、<span style="color:#FFD23F">稀有</span>、<span style="color:#FF7A2F">传说</span>（带独特特效）。不要的装备可以分解成零件，用零件强化或重铸装备。</p><p><b>提示</b>：枪声会吸引丧尸；红色油桶可以打爆；巨尸冲锋前地上会出现红色预警，翻滚躲开。</p></div>`);

/* ================= 安全屋 / 背包 / 天赋 ================= */
let tab = "bag", sel = null, inSafe = false;
UI.safe = function () { const P = G.P; if (P.chapter >= YJ.LEVELS.length) return UI.cleared(); inSafe = true; show("sSafe"); G.state = "safe"; YJ.calcStats(); YJ.save(); try { YJ.Audio.mood("safe"); } catch {}
  const d = YJ.LEVELS[P.chapter]; $("#sfT").textContent = d.name + (P.ng ? "（噩梦 " + P.ng + "）" : ""); $("#sfG").textContent = "目标：" + d.goal; $("#sfGo").hidden = false; panel($("#sfBody")); };
$("#sfGo").onclick = () => { inSafe = false; show("sGame"); YJ.Render.resize(); YJ.startLevel(G.P.chapter); hudInit(); try { YJ.Audio.mood("play"); } catch {} };
$("#sfBack").onclick = () => UI.title();
function panel(root) {
  const P = G.P, S = YJ.calcStats();
  root.innerHTML = `<div class="tabs"><button data-t="bag" class="${tab === "bag" ? "on" : ""}">装备</button><button data-t="tal" class="${tab === "tal" ? "on" : ""}">天赋${P.pts ? `<i>${P.pts}</i>` : ""}</button><button data-t="st" class="${tab === "st" ? "on" : ""}">属性</button></div><div class="pbody"></div>`;
  root.querySelectorAll(".tabs button").forEach(b => b.onclick = () => { tab = b.dataset.t; sel = null; panel(root); SFX("ui"); });
  const B = root.querySelector(".pbody");
  if (tab === "bag") {
    const cell = (it, slot) => `<button class="cell ${it ? "r" + it.rar : "empty"} ${sel && it && sel.id === it.id ? "sel" : ""}" data-id="${it ? it.id : ""}">${it ? `<b>${icon(it)}</b><small>${it.ilvl}</small>` : `<span>${YJ.SLOTS[slot] || ""}</span>`}</button>`;
    B.innerHTML = `<div class="eq">${Object.keys(YJ.SLOTS).map(s => `<div><label>${YJ.SLOTS[s]}</label>${cell(P.eq[s], s)}</div>`).join("")}<div class="scr">⚙ 零件<b>${P.scrap}</b><br>✚ 医疗包<b>${P.med}</b></div></div><div class="grid">${P.inv.map(it => cell(it)).join("")}${Array.from({ length: Math.max(0, 30 - P.inv.length) }, () => `<button class="cell empty"></button>`).join("")}</div>
      <div class="bagops"><button class="btn sm ghost" id="salvAll">分解全部普通/精良</button></div><div class="detail" id="dt"></div>`;
    B.querySelectorAll(".cell[data-id]").forEach(b => { if (b.dataset.id) b.onclick = () => { sel = [...Object.values(P.eq), ...P.inv].find(i => i && i.id == b.dataset.id); panel(root); SFX("ui"); }; });
    B.querySelector("#salvAll").onclick = () => { let n = 0; P.inv = P.inv.filter(it => { if (it.rar <= 1) { P.scrap += YJ.scrapOf(it); n++; return false; } return true; }); sel = null; SFX("pick"); panel(root); if (n) G.toast("分解了 " + n + " 件"); };
    if (sel) detail(B.querySelector("#dt"), sel, root); else B.querySelector("#dt").innerHTML = `<p class="tip">点一件装备查看详情。背包 ${P.inv.length}/30</p>`;
  } else if (tab === "tal") {
    B.innerHTML = `<p class="tip">每升一级得 1 点天赋，每项最多 5 级。剩余 <b style="color:#ffd23f">${P.pts}</b> 点　等级 ${P.lv}</p><div class="tals">${YJ.TALENTS.map(t => { const n = P.tal[t.k] || 0; return `<button class="tal ${n ? "has" : ""}" data-k="${t.k}" ${P.pts && n < 5 ? "" : "disabled"}><i>${t.ic}</i><b>${t.n}</b><small>${t.d}</small><span>${"●".repeat(n)}${"○".repeat(5 - n)}</span></button>`; }).join("")}</div>`;
    B.querySelectorAll(".tal").forEach(b => b.onclick = () => { const k = b.dataset.k; if (P.pts > 0 && (P.tal[k] || 0) < 5) { P.tal[k] = (P.tal[k] || 0) + 1; P.pts--; YJ.refreshWeapon(); SFX("level", .5); panel(root); } });
  } else {
    const row = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
    B.innerHTML = `<div class="stats">${row("等级", P.lv + "（" + Math.floor(P.xp) + " / " + YJ.xpNeed(P.lv) + "）")}${row("每秒伤害", S.dps)}${row("生命", S.maxhp)}${row("减伤", Math.round(S.armor * 100) + "%")}${row("暴击率", Math.round(S.critC * 100) + "%")}${row("暴击伤害", Math.round(S.critM * 100) + "%")}${row("射速", S.rate.toFixed(1) + " 发/秒")}${row("弹匣", S.mag)}${row("换弹", S.reload.toFixed(2) + " 秒")}${row("移动速度", Math.round(S.msM * 100) + "%")}${row("每秒回复", S.regen.toFixed(1))}${row("击杀回复", S.lok)}${row("掉落品质", Math.round(S.mfM * 100) + "%")}${row("累计击杀", P.kills)}</div>`;
  }
}
const icon = it => it.slot === "weapon" ? { pistol: "手", smg: "冲", shotgun: "霰", rifle: "步", sniper: "狙", flamer: "焰", launcher: "榴" }[it.base] : { armor: "甲", boots: "靴", charm: "饰" }[it.slot];
function detail(box, it, root) {
  const P = G.P, R = YJ.RAR[it.rar], equipped = P.eq[it.slot] === it, cur = YJ.calcStats(), alt = equipped ? cur : YJ.calcStats(it), dd = alt.dps - cur.dps, dh = alt.maxhp - cur.maxhp;
  let base = ""; if (it.slot === "weapon") { const B = YJ.WEAPONS[it.base]; base = `<div class="bs">单发 ${Math.round(B.dmg * YJ.wScale(it))}${B.pellets > 1 ? "×" + B.pellets : ""} · 射速 ${B.rate} · 弹匣 ${B.mag}${B.pierce ? " · 穿透 " + B.pierce : ""}${B.ex ? " · 爆炸" : ""}${B.flame ? " · 喷射" : ""}</div>`; } else { const im = YJ.impOf(it); base = `<div class="bs">${Object.keys(im).map(k => YJ.AFFIX.find(a => a.k === k).t.replace("{}", im[k])).join(" · ") || "无基础属性"}</div>`; }
  const up = YJ.upCost(it), rr = YJ.rerollCost(it);
  box.innerHTML = `<div class="dcard" style="--rc:${R.c}"><h4>${esc(YJ.itemName(it))}</h4><div class="sub">${R.n} · ${YJ.SLOTS[it.slot]} · 物品等级 ${it.ilvl}</div>${base}${it.aff.map(a => `<div class="af">◆ ${YJ.affText(a)}</div>`).join("")}${it.leg ? `<div class="lg">★ ${YJ.LEG[it.leg].n}：${YJ.LEG[it.leg].d}</div>` : ""}
    ${equipped ? `<div class="cmp">已装备</div>` : `<div class="cmp">换上后：每秒伤害 <b class="${dd > 0 ? "up" : dd < 0 ? "dn" : ""}">${dd >= 0 ? "+" : ""}${dd}</b>　生命 <b class="${dh > 0 ? "up" : dh < 0 ? "dn" : ""}">${dh >= 0 ? "+" : ""}${dh}</b></div>`}
    <div class="ops">${equipped ? "" : `<button class="btn sm" id="dEq">装备</button>`}<button class="btn sm ghost" id="dUp" ${P.scrap < up ? "disabled" : ""}>强化 +1 级（${up}⚙）</button>${it.rar ? `<button class="btn sm ghost" id="dRr" ${P.scrap < rr ? "disabled" : ""}>重铸词条（${rr}⚙）</button>` : ""}${equipped ? "" : `<button class="btn sm bad" id="dSc">分解 +${YJ.scrapOf(it)}⚙</button>`}</div></div>`;
  const q = s => box.querySelector(s);
  if (q("#dEq")) q("#dEq").onclick = () => { const old = P.eq[it.slot]; P.inv.splice(P.inv.indexOf(it), 1); if (old) P.inv.push(old); P.eq[it.slot] = it; YJ.refreshWeapon(); if (it.slot === "weapon" && G.pl) { G.pl.mag = G.S.mag; } SFX("equip"); panel(root); };
  q("#dUp").onclick = () => { P.scrap -= up; it.ilvl++; YJ.refreshWeapon(); SFX("level", .4); panel(root); };
  if (q("#dRr")) q("#dRr").onclick = () => { P.scrap -= rr; const leg = it.leg; YJ.rollAffixes(it); if (leg) it.leg = leg; YJ.refreshWeapon(); SFX("rare", .5); panel(root); };
  if (q("#dSc")) q("#dSc").onclick = () => { P.scrap += YJ.scrapOf(it); P.inv.splice(P.inv.indexOf(it), 1); sel = null; SFX("pick"); panel(root); };
}

/* ================= 弹出面板 ================= */
UI.sheet = function (title, html, opt = {}) {
  document.querySelectorAll(".scrim").forEach(s => s.remove());
  const sc = el(`<div class="scrim"><div class="sheet"><div class="sh-head"><h3>${esc(title)}</h3>${opt.noClose ? "" : `<button class="x">关闭</button>`}</div><div class="sh-body">${html}</div></div></div>`);
  const close = () => { sc.remove(); opt.onClose && opt.onClose(); }; if (!opt.noClose) sc.querySelector(".x").onclick = close; document.body.append(sc); return { root: sc, close, body: sc.querySelector(".sh-body") };
};
UI.pause = function (toBag) {
  if (G.state !== "play") return; G.state = "pause"; if (toBag) tab = "bag";
  const sh = UI.sheet("暂停", `<div id="pp"></div><div class="row"><button class="btn sm ghost" id="pAuto">自动瞄准：${YJ.autoAim ? "开" : "关"}</button><button class="btn sm ghost" id="pSnd">声音：${YJ.Audio.on ? "开" : "关"}</button></div><div class="row"><button class="btn" id="pGo">继续战斗</button><button class="btn bad" id="pQuit">放弃本关</button></div>`, { onClose: () => { if (G.state === "pause") G.state = "play"; hudInit(); } });
  panel(sh.body.querySelector("#pp"));
  sh.body.querySelector("#pGo").onclick = sh.close;
  sh.body.querySelector("#pAuto").onclick = e => { YJ.autoAim = !YJ.autoAim; try { localStorage.setItem("yj.auto", YJ.autoAim ? "1" : "0"); } catch {} e.target.textContent = "自动瞄准：" + (YJ.autoAim ? "开" : "关"); };
  sh.body.querySelector("#pSnd").onclick = e => { YJ.Audio.set(!YJ.Audio.on); e.target.textContent = "声音：" + (YJ.Audio.on ? "开" : "关"); };
  sh.body.querySelector("#pQuit").onclick = () => { sh.root.remove(); G.L = null; YJ.save(); UI.safe(); };
};
UI.dead = function () {
  const L = G.L; YJ.save();
  const sh = UI.sheet("你倒下了", `<div class="big bad">阵　亡</div><p class="tip" style="text-align:center">${esc(L.def.name)}　击杀 ${L.kills}　用时 ${fmtT(L.time)}<br>已经拾取的装备、经验和零件都会保留。</p><div class="row"><button class="btn" id="dRe">整理装备再战</button><button class="btn ghost" id="dT">回主菜单</button></div>`, { noClose: 1 });
  sh.body.querySelector("#dRe").onclick = () => { sh.root.remove(); G.L = null; UI.safe(); }; sh.body.querySelector("#dT").onclick = () => { sh.root.remove(); G.L = null; UI.title(); };
};
UI.win = function () {
  const L = G.L, P = G.P; P.chapter++; P.med = Math.min(4, P.med + 1); let gift = null; if (P.inv.length < 30) { gift = YJ.makeItem(L.lvl + 2, { rar: Math.random() < .3 ? 2 : 1 }); P.inv.push(gift); } YJ.save();
  const sh = UI.sheet("章节完成", `<div class="big good">${esc(L.def.name)}</div><div class="stats">${`<div><span>击杀</span><b>${L.kills}</b></div><div><span>用时</span><b>${fmtT(L.time)}</b></div><div><span>拾取装备</span><b>${L.loot}</b></div><div><span>等级</span><b>${P.lv}</b></div>`}</div><p class="tip" style="text-align:center">补给：医疗包 +1${gift ? `　<b style="color:${YJ.RAR[gift.rar].c}">${esc(YJ.itemName(gift))}</b>` : ""}</p><button class="btn block" id="wGo">继续</button>`, { noClose: 1 });
  sh.body.querySelector("#wGo").onclick = () => { sh.root.remove(); G.L = null; if (P.chapter >= YJ.LEVELS.length) UI.cutscene("ending", () => UI.cleared()); else UI.cutscene("pre" + P.chapter, () => UI.safe()); };
};
UI.cleared = function () {
  show("sTitle"); G.state = "title"; const P = G.P;
  const sh = UI.sheet("通关", `<div class="big good">第一部 · 完</div><p class="tip" style="text-align:center">感谢游玩。累计击杀 ${P.kills}，等级 ${P.lv}。<br>可以带着全部装备进入<b>噩梦难度</b>：敌人更强，掉落的装备等级也更高。</p><div class="row"><button class="btn" id="cNg">进入噩梦 ${(P.ng || 0) + 1}</button><button class="btn ghost" id="cT">回主菜单</button></div>`, { noClose: 1 });
  sh.body.querySelector("#cNg").onclick = () => { sh.root.remove(); P.ng = (P.ng || 0) + 1; P.chapter = 0; YJ.save(); UI.safe(); }; sh.body.querySelector("#cT").onclick = () => { sh.root.remove(); UI.title(); };
};
const fmtT = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");

/* ================= HUD ================= */
let radioQ = [], radioT = 0;
G.toast = function (text, kind = "") { const b = $("#toasts"); const t = el(`<div class="toast ${kind}"></div>`); t.textContent = text; b.prepend(t); while (b.children.length > 4) b.lastChild.remove(); setTimeout(() => t.remove(), 2600); };
G.radio = function (key) { const L = G.L; if (!L || L.radio[key]) return; L.radio[key] = 1; const lines = L.def.radio[key]; if (lines) { radioQ.push(...lines); if (radioT <= 0) radioT = .01; } };
function hudInit() { const L = G.L; if (!L) return; $("#hObj").textContent = L.def.goal; radioQ = []; $("#radio").hidden = true; }
let mmT = 0;
function hud(dt) {
  const L = G.L, pl = G.pl, P = G.P, S = G.S; if (!L || !pl) return;
  $("#hpF").style.width = Math.max(0, pl.hp / S.maxhp * 100) + "%"; $("#hpT").textContent = Math.ceil(pl.hp) + " / " + S.maxhp; $("#xpF").style.width = P.xp / YJ.xpNeed(P.lv) * 100 + "%"; $("#hLv").textContent = "Lv." + P.lv;
  $("#hW").textContent = YJ.itemName(P.eq.weapon); $("#hA").textContent = pl.rel > 0 ? "换弹中…" : pl.mag + " / " + S.mag; $("#bMed").dataset.n = P.med; $("#bMed").classList.toggle("off", !P.med);
  const cd = (id, v, max) => { const e = $(id); e.style.setProperty("--cd", Math.max(0, v / max)); e.classList.toggle("off", v > 0); }; cd("#bDash", pl.dashCd, S.dashCd); cd("#bGren", pl.gCd, 6);
  const o = L.def.obj; $("#hObj").textContent = L.holdOn ? "守住「" + L.def.exitName + "」！开门中 " + Math.min(99, Math.floor(L.holdP / (10 + L.i * 2) * 100)) + "%（别走远）" : L.objDone ? "前往「" + L.def.exitName + "」（小地图上的绿点）" : L.def.goal + (o.n ? "　" + L.objN + "/" + o.n : ""); $("#hObj").classList.toggle("done", L.objDone);
  const bs = L.bossE && !L.bossE.dead && L.bossE.awake ? L.bossE : L.eliteE && !L.eliteE.dead && L.eliteE.awake ? L.eliteE : null; $("#boss").hidden = !bs; if (bs) { $("#bossF").style.width = bs.hp / bs.maxhp * 100 + "%"; $("#bossN").textContent = bs.E.name; }
  $("#bBag").classList.toggle("pts", P.pts > 0);
  mmT -= dt; if (mmT <= 0) { mmT = .3; YJ.Render.minimap($("#mm")); }
  if (radioT > 0) { radioT -= dt; if (radioT <= 0) { const l = radioQ.shift(); if (l) { $("#radio").hidden = false; $("#rdW").textContent = l[0]; $("#rdW").style.color = YJ.FACE[l[0]] || "#ccc"; $("#rdT").textContent = l[1]; radioT = 2 + l[1].length * .075; SFX("radio", .5); } else $("#radio").hidden = true; } }
}

/* ================= 操作 ================= */
const I = G.inp, keys = {};
addEventListener("keydown", e => { keys[e.code] = 1; if (G.state === "play") { if (e.code === "Space") { I.dash = true; e.preventDefault(); } if (e.code === "KeyG") I.gren = true; if (e.code === "KeyQ") I.med = true; if (e.code === "KeyR") I.reload = true; if (e.code === "Escape") UI.pause(); if (e.code === "Tab" || e.code === "KeyI") { e.preventDefault(); UI.pause(true); } } else if (G.state === "cut" && (e.code === "Space" || e.code === "Enter")) cutNext(); });
addEventListener("keyup", e => { keys[e.code] = 0; });
const cvs = $("#cv"); let mouse = null, sticks = {};
cvs.addEventListener("mousemove", e => { mouse = { x: e.clientX, y: e.clientY }; }); cvs.addEventListener("mousedown", e => { if (e.button === 2) I.gren = true; else mouse = { x: e.clientX, y: e.clientY, down: 1 }; e.preventDefault(); });
addEventListener("mouseup", () => { if (mouse) mouse.down = 0; }); cvs.addEventListener("contextmenu", e => e.preventDefault());
function stickEl(id) { return $(id); }
cvs.addEventListener("touchstart", e => { e.preventDefault(); mouse = null; for (const t of e.changedTouches) { const side = t.clientX < innerWidth / 2 ? "L" : "R"; if (sticks[side]) continue; sticks[side] = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY }; const s = stickEl("#stk" + side); s.hidden = false; s.style.left = t.clientX + "px"; s.style.top = t.clientY + "px"; } }, { passive: false });
cvs.addEventListener("touchmove", e => { e.preventDefault(); for (const t of e.changedTouches) for (const k in sticks) if (sticks[k] && sticks[k].id === t.identifier) { sticks[k].x = t.clientX; sticks[k].y = t.clientY; } }, { passive: false });
const tEnd = e => { for (const t of e.changedTouches) for (const k in sticks) if (sticks[k] && sticks[k].id === t.identifier) { sticks[k] = null; stickEl("#stk" + k).hidden = true; } };
cvs.addEventListener("touchend", tEnd); cvs.addEventListener("touchcancel", tEnd);
function readInput() {
  if (G.bot) return; let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0), ax = 0, ay = 0, fire = false;
  const st = (s, id) => { if (!s) return [0, 0]; let dx = s.x - s.x0, dy = s.y - s.y0; const d = Math.hypot(dx, dy), m = 46; if (d > m) { dx *= m / d; dy *= m / d; } stickEl(id).firstElementChild.style.transform = `translate(${dx}px,${dy}px)`; return [dx / m, dy / m]; };
  if (sticks.L) [mx, my] = st(sticks.L, "#stkL"); if (sticks.R) { [ax, ay] = st(sticks.R, "#stkR"); fire = Math.hypot(ax, ay) > .3; }
  if (mouse && G.pl) { const R = YJ.Render, wx = (mouse.x - R.W / 2) / R.sc + G.cam.x, wy = (mouse.y - R.H / 2) / R.sc + G.cam.y; ax = wx - G.pl.x; ay = wy - G.pl.y; fire = !!mouse.down; }
  I.mx = mx; I.my = my; I.ax = ax; I.ay = ay; I.fire = fire;
}
const tapBtn = (id, fn) => { const b = $(id); b.addEventListener("touchstart", e => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false }); b.addEventListener("mousedown", e => { e.stopPropagation(); fn(); }); };
tapBtn("#bDash", () => I.dash = true); tapBtn("#bGren", () => I.gren = true); tapBtn("#bMed", () => I.med = true); tapBtn("#bRel", () => I.reload = true); tapBtn("#bBag", () => UI.pause(true)); tapBtn("#bPause", () => UI.pause());

/* ================= 主循环 ================= */
let last = performance.now(), titleCv = $("#titleCv");
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (G.state === "play" || G.state === "dead") { readInput(); YJ.update(dt); YJ.Render.draw(now / 1000); hud(dt); try { YJ.Audio.tension(G.L ? G.L.en.filter(e => e.awake).length : 0); } catch {} }
  else if (G.state === "pause" || G.state === "won") YJ.Render.draw(now / 1000);
  else if (G.state === "cut" && cut) cutFrame(now);
  else if (G.state === "title" || G.state === "safe") { const cv = G.state === "title" ? titleCv : $("#safeCv"), r = cv.getBoundingClientRect(); if (r.width > 10) { if (cv.width !== Math.round(r.width)) { cv.width = Math.round(r.width); cv.height = Math.round(r.height); } (G.state === "title" ? PAINT.city : PAINT.room)(cv.getContext("2d"), cv.width, cv.height, now / 1000); } }
  requestAnimationFrame(frame);
}
addEventListener("resize", () => YJ.Render.resize()); addEventListener("orientationchange", () => setTimeout(() => YJ.Render.resize(), 300));
document.addEventListener("visibilitychange", () => { if (document.hidden && G.state === "play") UI.pause(); });
YJ.Render.init(cvs); $("#ver").textContent = YJ.VERSION; UI.title(); requestAnimationFrame(frame);
if (G.bot) { YJ.newSave(); const m = /[?&]lv=(\d)/.exec(location.search); if (m) { G.P.chapter = +m[1]; G.P.lv = 1 + G.P.chapter * 3; G.P.pts = 0; G.P.eq.weapon = YJ.makeItem(1 + G.P.chapter * 2, { slot: "weapon", base: "rifle", rar: 2 }); } }
if ("serviceWorker" in navigator && location.protocol === "https:") { const had = !!navigator.serviceWorker.controller; navigator.serviceWorker.register("./sw.js").then(reg => document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); })).catch(() => {}); navigator.serviceWorker.addEventListener("controllerchange", () => { if (had && G.state === "title") location.reload(); }); }
})();
