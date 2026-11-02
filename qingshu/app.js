/* 情书·宫廷传书 — 界面与流程（登录、首页、房间、牌局） */
"use strict";
const { Sim, CARDS, TOKENS, botDecide } = window.QS;
const $ = s => document.querySelector(s);
const el = h => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let ONLINE = null, LOCAL = new QSNet.LocalNet(), NET = null, G = null;
const VERSION = "情书 v12 · 已知手牌修正"; // 每次更新改一下，方便在手机上确认是不是新版
for (const id of ["verA", "verH"]) { const e = document.getElementById(id); if (e) e.textContent = VERSION; }
const show = id => document.querySelectorAll(".screen").forEach(s => s.hidden = s.id !== id);
function toast(text, kind = "") { const box = $("#toasts"); const t = el(`<div class="toast ${kind}"></div>`); t.textContent = text; box.prepend(t); while (box.children.length > 3) box.lastChild.remove(); setTimeout(() => t.remove(), 3800); }

/* ================= 启动 / 登录（和苍澜共用同一个账号） ================= */
(async function boot() {
  await LOCAL.init();
  if (window.FIREBASE_CONFIG) { try { ONLINE = new QSNet.FireNet(window.FIREBASE_CONFIG); await ONLINE.init(); } catch (e) { console.error(e); ONLINE = null; } }
  if (ONLINE) ONLINE.onAuth(u => { if (G) return; if (u) openHome(); else openAuth(); }); else openAuth();
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    // 有新版本时：不在对局里就立刻刷新；在对局里就等回到首页再刷新。回到前台时也去检查一下有没有新版
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("./sw.js").then(reg => { document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); }); }).catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (!had) return; if (typeof G !== "undefined" && G) window.__needReload = true; else location.reload(); });
  }
})();
let authMode = "in";
function openAuth() {
  if (window.__needReload) return location.reload(); show("sAuth"); $("#authOnline").hidden = !ONLINE; $("#authOffline").hidden = !!ONLINE; }
document.querySelectorAll("#authSeg button").forEach(b => b.onclick = () => { authMode = b.dataset.m; document.querySelectorAll("#authSeg button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); $("#aName").hidden = authMode !== "up"; $("#aGo").textContent = authMode === "up" ? "注册并登录" : "登录"; $("#aErr").textContent = ""; });
$("#aGo").onclick = async () => {
  const email = $("#aEmail").value.trim(), pw = $("#aPw").value, name = $("#aName").value.trim(); $("#aErr").textContent = "";
  if (authMode === "up" && !name) return $("#aErr").textContent = "起个游戏昵称吧";
  $("#aGo").disabled = true;
  try { if (authMode === "up") { await ONLINE.signUp(email, pw, name); openHome(); } else await ONLINE.signIn(email, pw); } catch (e) { $("#aErr").textContent = e.message; } finally { $("#aGo").disabled = false; }
};
$("#aSolo").onclick = () => startSolo();

/* ================= 首页 ================= */
async function openHome() {
  if (window.__needReload) return location.reload();
  show("sHome"); $("#hErr").textContent = "";
  const net = ONLINE || LOCAL;
  $("#hOut").hidden = !ONLINE; $("#hCreate").disabled = !ONLINE; $("#hJoin").disabled = !ONLINE;
  try {
    const p = await net.profile();
    $("#hName").textContent = p.name || net.user.name; $("#hGames").textContent = p.games || 0; $("#hWins").textContent = p.wins || 0;
    const last = ONLINE ? await ONLINE.lastRoom() : null;
    $("#hResume").hidden = !last; $("#hResume").onclick = () => enterRoom(ONLINE, last);
  } catch (e) { $("#hErr").textContent = "读取资料失败：" + e.message; }
}
$("#hCreate").onclick = async () => { $("#hErr").textContent = ""; try { const code = await ONLINE.createRoom({}); enterRoom(ONLINE, code); } catch (e) { $("#hErr").textContent = e.message; } };
$("#hJoin").onclick = async () => { const code = $("#hCode").value.toUpperCase().trim(); $("#hErr").textContent = ""; if (code.length !== 4) return $("#hErr").textContent = "房间号是 4 位"; try { await ONLINE.joinRoom(code); enterRoom(ONLINE, code); } catch (e) { $("#hErr").textContent = e.message; } };
$("#hSolo").onclick = () => startSolo();
$("#hHelp").onclick = () => openHelp(); $("#aHelp").onclick = () => openHelp();
$("#hOut").onclick = async () => { await ONLINE.signOut(); };
async function startSolo() { const c = await LOCAL.createRoom({}); enterRoom(LOCAL, c); }

/* ================= 房间 ================= */
let roomUnsub = null;
function enterRoom(net, code) {
  NET = net; show("sRoom");
  $("#rCode").textContent = net.mode === "local" ? "单机" : code; $("#rCopy").hidden = net.mode === "local";
  $("#rCopy").onclick = async () => { try { await navigator.clipboard.writeText(code); toast("已复制房间号"); } catch { toast("房间号：" + code); } };
  if (roomUnsub) roomUnsub();
  roomUnsub = net.watchRoom(code, room => {
    if (!room) { toast("房间不存在了"); return openHome(); }
    if (room.status === "playing" || room.status === "ended") { roomUnsub && roomUnsub(); roomUnsub = null; return startGame(net, room); }
    renderRoom(net, room);
  });
}
function renderRoom(net, room) {
  const host = room.host === net.user.uid;
  $("#rCount").textContent = `${room.players.length} / 6`;
  $("#rDeck").textContent = room.players.length >= 5 ? "21 张扩展牌（多了细作、国公）" : "16 张经典牌";
  const pl = $("#rPlayers"); pl.innerHTML = "";
  room.players.forEach(p => {
    const row = el(`<div class="pl"><i style="background:${p.color}"></i><span></span><small>${p.bot ? "电脑" : p.id === room.host ? "房主" : ""}</small>${host && p.bot ? '<button>移除</button>' : ""}</div>`);
    row.querySelector("span").textContent = p.name + (p.id === net.user.uid ? "（你）" : "");
    const rm = row.querySelector("button"); if (rm) rm.onclick = () => net.updateRoom(room.code, r => { r.players = r.players.filter(x => x.id !== p.id); });
    pl.append(row);
  });
  $("#rNeed").textContent = TOKENS[Math.max(2, room.players.length)] || 3;
  $("#rHost").hidden = !host; $("#rWait").hidden = host;
  $("#rBot").disabled = room.players.length >= 6;
  $("#rBot").onclick = () => net.updateRoom(room.code, r => { if (r.players.length >= 6) return; const used = r.players.map(p => p.color), names = r.players.map(p => p.name); r.players.push({ id: "bot" + Date.now().toString(36), name: QSNet.BOT_NAMES.find(n => !names.includes(n)) || "电脑", color: QS.COLORS.find(c => !used.includes(c)), bot: true }); });
  $("#rStart").onclick = async () => { if (room.players.length < 2) return $("#rErr").textContent = "至少要 2 名玩家（可以加电脑）"; $("#rStart").disabled = true; try { await net.startRoom(room.code); } catch (e) { $("#rErr").textContent = e.message; } finally { $("#rStart").disabled = false; } };
  $("#rLeave").onclick = async () => { if (!host) await net.updateRoom(room.code, r => { r.players = r.players.filter(x => x.id !== net.user.uid); }).catch(() => {}); roomUnsub && roomUnsub(); roomUnsub = null; ONLINE ? openHome() : openAuth(); };
}

/* ================= 牌局 ================= */
function startGame(net, room) {
  if (G) leaveGame(true);
  const me = net.user.uid;
  if (!room.players.some(p => p.id === me)) { toast("你不在这局游戏里"); return openHome(); }
  show("sGame");
  const cfg = { seed: room.seed, players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, bot: p.bot })) };
  G = { net, room, code: room.code, me, cfg, sim: new Sim(cfg), events: [], host: room.host === me, seenLog: 0, pick: null, ended: false, botAt: 0 };
  G.unEv = net.watchEvents(room.code, list => onEvents(list));
  G.unRoom = net.watchRoom(room.code, r => { if (r) G.room = { ...G.room, ...r }; });
  G.timer = setInterval(tickBots, 900);
  render();
  let first = false; try { first = !localStorage.getItem("qs.tutDone"); } catch {}
  if (net.mode === "local" && (TUT.pending || first)) { TUT.pending = false; const game = G; setTimeout(() => { if (G === game) tutStart(); }, 900); }
}
function leaveGame(silent) {
  if (!G) return; tutEnd();
  G.unEv && G.unEv(); G.unRoom && G.unRoom(); clearInterval(G.timer);
  document.querySelectorAll(".scrim").forEach(s => s.remove()); $("#toasts").innerHTML = ""; $("#fx").innerHTML = ""; FXQ.length = 0; fxBusy = false;
  G = null; if (!silent) ONLINE ? openHome() : openAuth();
}
/* 事件按服务器时间排好序，每次都从头重算整局（牌局很短，几百条事件瞬间算完） */
function onEvents(list) {
  if (!G) return;
  const evs = list.slice().sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1));
  const sim = new Sim(G.cfg); sim.run(evs);
  G.events = evs; G.sim = sim; G.pick = null;
  render(); pumpLog(); pumpFx();
  if (sim.over && !G.ended) endGame();
}
function send(type, a) { if (!G || G.sim.over) return; G.net.sendEvent(G.code, { by: G.me, type, a: a || {} }).catch(e => toast("发送失败：" + e.message, "bad")); }
// 房主代电脑出牌；轮次结束后 4 秒自动开下一轮
function tickBots() {
  if (!G || !G.host || G.sim.over) return;
  const s = G.sim, now = Date.now();
  if (s.phase === "roundEnd") { if (!G.roundEndAt) G.roundEndAt = now; if (now - G.roundEndAt > 8500) { G.roundEndAt = 0; send("next"); } return; }
  G.roundEndAt = 0;
  const p = s.cur(); if (!s.P[p].bot) return;
  if (!G.botAt) { G.botAt = now + 1400 + Math.random() * 1200; return; }
  if (now < G.botAt) return; G.botAt = 0;
  const ev = botDecide(s, p, s.n); if (ev) G.net.sendEvent(G.code, { by: p, type: ev.type, a: ev.a }).catch(() => {});
}
function pumpLog() {
  const s = G.sim;
  for (; G.seenLog < s.log.length; G.seenLog++) {
    const l = s.log[G.seenLog]; if (l.vis !== "all" && !l.vis.includes(G.me)) continue;
    if (l.kind === "turn") continue;
    if (l.kind === "secret") { toast(l.text, "secret"); AU("play", "secret"); } else if (l.kind === "phase") { toast(l.text, "good"); AU("play", l.text.includes("❤") || l.text.includes("🕵") ? "heart" : "play"); } else if (l.kind === "out") AU("play", "out"); else if (l.kind === "play") AU("play", "play");
  }
}

/* ---------- 出牌动画：按顺序一条条播，每条约 1.8 秒 ---------- */
const FXQ = []; let fxBusy = false;
function pumpFx() {
  const s = G.sim; if (G.seenFx == null) G.seenFx = s.fx.length; // 中途进来的不补播旧的
  for (; G.seenFx < s.fx.length; G.seenFx++) FXQ.push(s.fx[G.seenFx]);
  if (!fxBusy) fxNext();
}
function fxNext() { const f = FXQ.shift(); if (!f || !G) { fxBusy = false; maybeShowRound(); return; } fxBusy = true; (f.kind === "showdown" ? playShowdown(f) : playFx(f)).then(fxNext, fxNext); }
function maybeShowRound() { if (!G) return; const s = G.sim; if (s.phase === "roundEnd" && !s.over && G.shownRound !== s.round && !fxBusy) { G.shownRound = s.round; showRound(); } }
// 牌库摸空：每个人翻开手牌，飞到中央排成一排比大小
async function playShowdown(f) {
  const s = G.sim, layer = $("#fx"); if (!layer) return; layer.innerHTML = "";
  const ps = Object.keys(f.hands), cx = innerWidth / 2, cy = Math.min(innerHeight * .42, innerHeight - 330), w = 72, h = 105, gap = Math.min(84, (innerWidth - 40) / ps.length);
  const cap = el(`<div class="cap">牌库摸空 · <i>亮牌比大小</i></div>`); cap.style.top = cy - h / 2 - 48 + "px"; layer.append(cap);
  const cards = [];
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i], v = f.hands[p], from = posOf(p), tx = cx + (i - (ps.length - 1) / 2) * gap - w / 2, ty = cy - h / 2;
    const c = el(`<div class="big sd">${cardHTML(v)}<div class="who"><i style="background:${s.P[p].color}"></i>${esc(s.P[p].name)}</div></div>`); layer.append(c); cards.push(c);
    c.animate([{ transform: `translate(${from.x - w / 2}px,${from.y - h / 2}px) scale(.5) rotateY(180deg)`, opacity: .3 }, { transform: `translate(${tx}px,${ty}px) scale(1) rotateY(0deg)`, opacity: 1 }], { duration: 520, delay: i * 160, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" });
    AU("play", "play"); await sleep(170);
  }
  await sleep(700);
  const max = Math.max(...ps.map(p => f.hands[p]));
  ps.forEach((p, i) => { const c = cards[i]; if (f.hands[p] === max) { c.classList.add("win"); const tag = el(`<div class="tag">${f.winners.length > 1 ? "平局" : "最大"}</div>`); c.append(tag); } else c.classList.add("lose"); });
  const res = el(`<div class="cap">${f.winners.length > 1 ? "一样大，" + f.winners.map(p => esc(s.P[p].name)).join("、") + " 一起得 ❤" : esc(s.P[f.winners[0]].name) + " 的牌最大，得 ❤"}</div>`); res.style.top = cy + h / 2 + 34 + "px"; layer.append(res);
  AU("play", "heart"); await sleep(2200);
  for (const c of [cap, res, ...cards]) c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: "forwards" });
  await sleep(380); layer.innerHTML = "";
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 某个玩家在屏幕上的位置（对手是座位头像，自己是底部名牌）
function posOf(p) {
  const e = p === G.me ? $("#me-name") : document.querySelector(`.seat[data-p="${p}"] .av`);
  if (!e) return { x: innerWidth / 2, y: innerHeight / 2 };
  const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
function seatEl(p) { return p === G.me ? document.querySelector(".me") : document.querySelector(`.seat[data-p="${p}"]`); }
async function playFx(f) {
  const s = G.sim, me = G.me, layer = $("#fx"); if (!layer || !s.P[f.by]) return;
  const C = CARDS[f.card], from = posOf(f.by), cx = innerWidth / 2, cy = Math.min(innerHeight * .42, innerHeight - 330);
  layer.innerHTML = "";
  // 1. 牌从出牌人飞到中央放大
  const big = el(`<div class="big">${cardHTML(f.card)}</div>`); layer.append(big);
  const bw = 118, bh = 172;
  big.animate([{ transform: `translate(${from.x - bw / 2}px,${from.y - bh / 2}px) scale(.3)`, opacity: .2 }, { transform: `translate(${cx - bw / 2}px,${cy - bh / 2}px) scale(1)`, opacity: 1 }], { duration: 420, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" });
  const cap = el(`<div class="cap"><i>${esc(s.P[f.by].name)}</i> 打出「${C.name}」${f.t != null ? ` → <i>${esc(s.P[f.t].name)}</i>` : ""}</div>`);
  cap.style.top = cy + bh / 2 + 10 + "px"; layer.append(cap); cap.animate([{ opacity: 0, transform: "translate(-50%,8px)" }, { opacity: 1, transform: "translate(-50%,0)" }], { duration: 300, delay: 250, fill: "both" });
  await sleep(480);
  // 2. 有目标：画箭头，目标震一下
  if (f.t != null) {
    const to = posOf(f.t), sx = from.x, sy = from.y;
    // 从出牌人画到目标，弧线往远离中央大牌的方向弯，免得被牌挡住
    const mx0 = (sx + to.x) / 2, my0 = (sy + to.y) / 2, dx = to.x - sx, dy = to.y - sy, len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len; if ((mx0 + nx - cx) ** 2 + (my0 + ny - cy) ** 2 < (mx0 - nx - cx) ** 2 + (my0 - ny - cy) ** 2) { nx = -nx; ny = -ny; }
    const bend = Math.min(140, 40 + len * .25), mx = mx0 + nx * bend, my = my0 + ny * bend;
    const ang = Math.atan2(to.y - my, to.x - mx), hx = to.x - Math.cos(ang) * 22, hy = to.y - Math.sin(ang) * 22, a0 = Math.atan2(my - sy, mx - sx), x0 = sx + Math.cos(a0) * 20, y0 = sy + Math.sin(a0) * 20;
    const svg = el(`<svg class="arrow"><circle class="head" cx="${sx}" cy="${sy}" r="5"/><path d="M${x0} ${y0} Q${mx} ${my} ${hx} ${hy}"/><polygon class="head" points="0,-9 18,0 0,9" transform="translate(${hx},${hy}) rotate(${ang * 180 / Math.PI})"/></svg>`);
    layer.append(svg);
    const path = svg.querySelector("path"), L = path.getTotalLength(); path.style.strokeDasharray = L; path.style.strokeDashoffset = L;
    path.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 380, easing: "ease-out", fill: "forwards" });
    svg.querySelector(".head").animate([{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }], { duration: 400, fill: "forwards" });
    await sleep(400);
    const se = seatEl(f.t); if (se) { se.classList.add("hit"); setTimeout(() => se.classList.remove("hit"), 600); }
  }
  // 3. 结果
  const at = f.t != null ? posOf(f.t) : from, res = [];
  const put = (html, cls, dy = 0, where = at) => { const r = el(`<div class="res ${cls}">${html}</div>`); r.style.left = Math.max(96, Math.min(innerWidth - 96, where.x)) + "px"; r.style.top = Math.max(70, where.y - 34 + dy) + "px"; layer.append(r); r.animate([{ opacity: 0, transform: "translate(-50%,-30%) scale(.6)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)" }], { duration: 260, easing: "cubic-bezier(.2,.8,.3,1.3)", fill: "forwards" }); res.push(r); return r; };
  if (f.guess != null) put(`猜「${CARDS[f.guess].name}」${f.hit ? "" : " · 没猜中"}`, f.hit ? "good" : "");
  if (f.secret && f.secret[me] != null && (f.by === me || f.t === me)) { const v = f.secret[me]; put(`${f.card === 7 ? "换到" : f.card === 3 ? "对方是" : "看到"} ${cardHTML(v, "mini")}`, "good", f.guess != null ? -40 : 0, f.card === 7 && f.t === me ? posOf(me) : f.card === 3 ? posOf(f.by === me ? f.t : f.by) : at); }
  else if (f.note && f.card !== 4 && f.guess == null) put(esc(f.note), "", 0, f.t != null ? at : from);
  if (f.show != null && f.card === 5) put(cardHTML(f.show, "mini"), "", 36);
  if (f.card === 4) { const ring = el(`<div class="ring"></div>`); ring.style.left = from.x + "px"; ring.style.top = from.y + "px"; layer.append(ring); ring.animate([{ width: "20px", height: "20px", opacity: 1 }, { width: "120px", height: "120px", opacity: 0 }], { duration: 900, easing: "ease-out", fill: "forwards" }); put("侍女保护", "pink", 0, from); }
  if (f.card === 6 && f.draw) { const dk = document.querySelector(".deck .card"); const d0 = dk ? dk.getBoundingClientRect() : null; for (let i = 0; i < f.draw; i++) { const b = el(`<div class="big">${backHTML("mini")}</div>`); layer.append(b); const x0 = d0 ? d0.left : cx, y0 = d0 ? d0.top : cy; b.animate([{ transform: `translate(${x0}px,${y0}px)`, opacity: 1 }, { transform: `translate(${from.x - 28 + i * 30}px,${from.y - 41}px)`, opacity: .9 }], { duration: 500, delay: i * 140, easing: "ease-out", fill: "forwards" }); } }
  for (const q of f.knocked || []) { await sleep(260); const kp = posOf(q); put("✖ 出局", "bad", -4, kp); const hb = el(`<div class="heartbreak">💔</div>`); hb.style.left = kp.x + "px"; hb.style.top = kp.y + "px"; layer.append(hb); hb.animate([{ transform: "translate(-50%,-50%) scale(.4)", opacity: 0 }, { transform: "translate(-50%,-130%) scale(1.3)", opacity: 1 }, { transform: "translate(-50%,-200%) scale(1)", opacity: 0 }], { duration: 1100, fill: "forwards" }); const se = seatEl(q); if (se) { se.classList.add("hit"); setTimeout(() => se.classList.remove("hit"), 600); } }
  await sleep(1150);
  // 4. 收尾：牌缩回出牌人的弃牌堆，结果标签淡出
  const dp = f.by === me ? $("#me-disc") : document.querySelector(`.seat[data-p="${f.by}"] .dpile`); const dr = dp ? dp.getBoundingClientRect() : null;
  const tx = dr ? dr.left + dr.width / 2 : from.x, ty = dr ? dr.top + dr.height / 2 : from.y;
  big.animate([{ transform: `translate(${cx - bw / 2}px,${cy - bh / 2}px) scale(1)`, opacity: 1 }, { transform: `translate(${tx - bw / 2}px,${ty - bh / 2}px) scale(.3)`, opacity: 0 }], { duration: 380, easing: "ease-in", fill: "forwards" });
  for (const r of [cap, ...res, ...layer.querySelectorAll(".arrow,.ring")]) r.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 120, fill: "forwards" });
  await sleep(420); layer.innerHTML = "";
}

/* ---------- 画面 ---------- */
const cardHTML = (v, cls = "") => { const C = CARDS[v]; return `<div class="card c${v} ${cls}"><i class="fr"></i><span class="num">${v}</span><div class="art">${QSArt[v]}</div><div class="rib"><b>${C.name}</b></div><small>${G && G.sim ? G.sim.countOf(v) : (C.n || C.nx)} 张</small></div>`; };
const backHTML = (cls = "") => `<div class="card back ${cls}"><i class="fr"></i><div class="seal">情<br>书</div></div>`;
const AU = (fn, ...a) => { try { window.QSAudio && QSAudio[fn](...a); } catch {} };
document.addEventListener("click", e => { if (e.target.closest && e.target.closest("button")) AU("play", "tap"); }, true);
function render() {
  if (!G) return;
  const s = G.sim, me = G.me, S = s.S, mine = S[me], myTurn = s.phase === "play" && s.cur() === me, keeping = s.phase === "chancellor" && s.cur() === me;
  // 对手一排
  // 围桌：对手固定围成一圈，不用滑动
  const ops = $("#opps"); ops.innerHTML = "";
  const others = s.order.filter(p => p !== me), n = others.length;
  // 从左下 160° 经过顶部到右下 380°，均匀排在一个椭圆上
  const spread = { 1: 0, 2: 110, 3: 160, 4: 200, 5: 220 }[n] || 220;
  const SEATS = others.map((_, i) => { const a = (n === 1 ? 270 : 270 - spread / 2 + spread * i / (n - 1)) * Math.PI / 180; return [50 + 41 * Math.cos(a), 50 + 40 * Math.sin(a)]; });
  others.forEach((p, i) => {
    const t = S[p], P = s.P[p], cur = (s.phase === "play" || s.phase === "chancellor") && s.cur() === p;
    const last = t.disc.length ? t.disc[t.disc.length - 1] : null;
    const known = mine.know[p] != null && !t.out ? mine.know[p] : null;
    const [x, y] = SEATS[i] || [50, 20];
    const d = el(`<div class="seat ${t.out ? "out" : ""} ${cur ? "cur" : ""} ${t.safe ? "safe" : ""}" style="left:${x}%;top:${y}%" data-p="${p}">
      <div class="av" style="background:${P.color}">${esc([...P.name][0])}</div>
      <div class="nm"></div>
      <span class="hearts">${"❤".repeat(P.tokens)}<span class="dim">${"♡".repeat(Math.max(0, s.need - P.tokens))}</span></span>
      <div class="cards">${t.out ? `<div class="card mini gone">出局</div>` : known != null ? cardHTML(known, "mini known") : backHTML("mini")}<div class="dpile">${last != null ? cardHTML(last, "mini") : `<div class="card mini empty">弃</div>`}${t.disc.length > 1 ? `<span class="cnt">${t.disc.length}</span>` : ""}</div></div>
      ${t.out ? `<span class="badge outb">出局</span>` : t.safe ? `<span class="badge">侍女保护</span>` : cur ? `<span class="badge turn">思考中…</span>` : ""}</div>`);
    d.querySelector(".nm").textContent = P.name;
    d.onclick = () => openPlayer(p);
    ops.append(d);
  });
  requestAnimationFrame(fitCenter);
  // 场上弃牌汇总：每种牌打出几张 / 还剩几张
  const played = {}; for (const q of s.order) for (const v of S[q].disc) played[v] = (played[v] || 0) + 1; for (const v of s.faceUp) played[v] = (played[v] || 0) + 1;
  $("#pile").innerHTML = s.values.map(v => { const k = played[v] || 0; return `<span class="chip c${v} ${k ? "" : "left"}"><i>${v}</i>${CARDS[v].name}<em>${k}/${s.countOf(v)}</em></span>`; }).join("");
  // 桌面
  $("#deckN").textContent = s.deck.length; $("#round").textContent = `第 ${s.round} 轮`;
  $("#aside").innerHTML = s.aside >= 0 ? backHTML("mini") : `<div class="card mini gone">已摸走</div>`;
  $("#faceUp").innerHTML = s.faceUp.map(v => cardHTML(v, "mini")).join("");
  $("#faceUpBox").hidden = !s.faceUp.length;
  $("#faceUpBox").hidden = !s.faceUp.length;
  $("#recent").innerHTML = s.log.filter(l => (l.vis === "all" || l.vis.includes(me)) && l.kind !== "turn").slice(-3).map(l => `<li class="${l.kind}">${esc(l.text)}</li>`).join("");
  $("#me-hearts").innerHTML = "❤".repeat(s.P[me].tokens) + `<span class="dim">${"♡".repeat(Math.max(0, s.need - s.P[me].tokens))}</span>`;
  $("#me-name").textContent = s.P[me].name; $("#me-flag").style.background = s.P[me].color;
  $("#me-disc").innerHTML = mine.disc.length ? "弃牌：" + mine.disc.map(v => `<span class="c${v}">${CARDS[v].name}</span>`).join("、") : ""; $("#me-disc").onclick = () => openPlayer(me);
  // 我的手牌
  const h = $("#hand"); h.innerHTML = "";
  const must = s.mustPlay(mine.hand);
  if (mine.out) h.append(el(`<div class="note">你这一轮已经出局，看别人打完吧。</div>`));
  else if (keeping) mine.hand.forEach(v => { const c = el(cardHTML(v, "playable")); c.onclick = () => { send("keep", { card: v }); toast(`留下「${CARDS[v].name}」，其余放回牌库底`, "good"); }; h.append(c); });
  else mine.hand.forEach((v, i) => {
    const c = el(cardHTML(v, (myTurn ? "playable" : "") + (must && v !== must ? " locked" : "") + (G.pick && G.pick.card === v && G.pick.i === i ? " picked" : "")));
    c.onclick = () => { if (!myTurn) return toast("还没轮到你"); if (must && v !== must) return toast("手里有太子或帝君时，必须打出皇后", "bad"); openPlay(v, i); };
    h.append(c);
  });
  const st = $("#status");
  if (s.phase === "roundEnd" || s.over) st.textContent = s.winner ? `${s.P[s.winner].name}赢得这一轮` + (s.over ? "" : "，下一轮马上开始…") : "";
  else if (mine.out) st.textContent = `等待这一轮结束…`;
  else if (keeping) st.textContent = "国公：点一张要留下的牌，其余两张放回牌库底";
  else if (s.phase === "chancellor") st.textContent = `${s.P[s.cur()].name}正在挑牌…`;
  else if (myTurn) st.textContent = must ? "你必须打出皇后" : "轮到你了：点一张牌打出";
  else st.textContent = `等待${s.P[s.cur()].name}出牌…`;
  $("#hand").classList.toggle("myturn", (myTurn || keeping) && !mine.out);
  $("#deckMode").textContent = s.ext ? "扩展 21 张" : "经典 16 张";
  // 轮到我：震一下
  const turnKey = (myTurn || keeping) && !mine.out ? s.round + ":" + s.n : null;
  if (turnKey && G.vibKey !== turnKey) { G.vibKey = turnKey; if (navigator.vibrate) navigator.vibrate(120); }
  // 轮次结算（等动画播完）
  maybeShowRound();
}
/* 把桌子中央的牌库/暗牌/弃牌计数，缩放后放进座位之间最大的空位里，任何手机都不挡人 */
function fitCenter() {
  const tb = $("#table"), c = document.querySelector(".center"); if (!tb || !c) return;
  const T = tb.getBoundingClientRect(); if (!T.width) return;
  let r = { l: 6, t: 6, r: T.width - 6, b: T.height - 6 };
  const area = q => Math.max(0, q.r - q.l) * Math.max(0, q.b - q.t);
  const seats = [...document.querySelectorAll("#opps .seat")].map(e => { const b = e.getBoundingClientRect(); return { l: b.left - T.left - 4, t: b.top - T.top - 4, r: b.right - T.left + 4, b: b.bottom - T.top + 4 }; });
  for (let pass = 0; pass < 3; pass++) for (const s of seats) {
    if (s.r <= r.l || s.l >= r.r || s.b <= r.t || s.t >= r.b) continue; // 不重叠
    const opts = [{ ...r, t: s.b }, { ...r, b: s.t }, { ...r, l: s.r }, { ...r, r: s.l }];
    r = opts.reduce((a, b) => area(b) > area(a) ? b : a);
  }
  c.style.transform = "none";
  const w = c.offsetWidth, h = c.offsetHeight, rw = r.r - r.l, rh = r.b - r.t;
  const k = Math.max(.55, Math.min(1.15, rw / w, rh / h));
  c.style.left = r.l + Math.max(0, (rw - w * k) / 2) + "px"; c.style.top = r.t + Math.max(0, (rh - h * k) / 2) + "px";
  c.style.transform = `scale(${k})`; c.classList.add("fit");
}
addEventListener("resize", () => { if (G) fitCenter(); });
/* 点某个玩家：看他这一轮弃过的全部牌 */
function openPlayer(p) {
  const s = G.sim, t = s.S[p], P = s.P[p];
  const body = el(`<div><div class="tip" style="margin-bottom:8px"><span class="owner"><i style="background:${P.color};display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px"></i>${esc(P.name)}</span> · ❤ ${P.tokens}/${s.need}${t.out ? " · 本轮已出局" : t.safe ? " · 侍女保护中" : ""}${s.S[G.me].know[p] != null && !t.out && p !== G.me ? ` · 你知道他手里是「${CARDS[s.S[G.me].know[p]].name}」` : ""}</div>
    <div class="lbl">本轮弃过的牌（按先后）</div>
    <div class="dlist">${t.disc.length ? t.disc.map(v => cardHTML(v, "mini")).join("") : '<p class="note">还没出过牌</p>'}</div></div>`);
  sheet(p === G.me ? "我的弃牌" : P.name, body);
}
/* 点了一张牌：需要目标就选人，侍卫再猜牌 */
function openPlay(card, i) {
  const s = G.sim, C = CARDS[card], ts = s.targets(G.me, card);
  G.pick = { card, i }; render();
  const body = el(`<div class="play"><div class="big">${cardHTML(card)}</div><div><p class="desc">${esc(C.desc)}</p><div id="tg"></div><div id="gs"></div><button class="btn block" id="go" disabled>打出</button></div></div>`);
  const sh = sheet(`打出「${C.name}」`, body, () => { if (G) { G.pick = null; render(); } });
  tutHit("open");
  let target = null, guess = null;
  const go = body.querySelector("#go"), upd = () => { go.disabled = (C.tgt !== "none" && ts.length && target == null) || (C.guess && ts.length && guess == null); go.textContent = target != null ? `对${s.P[target].name}打出` : "打出"; };
  if (C.tgt !== "none") {
    const tg = body.querySelector("#tg");
    if (!ts.length) tg.innerHTML = `<p class="note">现在没有可以选的目标（都被侍女保护或已出局），这张牌打出后没有效果。</p>`;
    else {
      tg.innerHTML = `<div class="lbl">选一名玩家</div><div class="opts">${ts.map(p => `<button class="opt" data-p="${p}"><i style="background:${s.P[p].color}"></i>${esc(s.P[p].name)}${p === G.me ? "（自己）" : ""}${s.S[G.me].know[p] != null ? `<em>手牌 ${CARDS[s.S[G.me].know[p]].name}</em>` : ""}</button>`).join("")}</div>`;
      tg.querySelectorAll(".opt").forEach(b => b.onclick = () => { target = b.dataset.p; tg.querySelectorAll(".opt").forEach(x => x.classList.toggle("on", x === b)); upd(); });
    }
  }
  if (C.guess && ts.length) {
    const gs = body.querySelector("#gs");
    gs.innerHTML = `<div class="lbl">猜他的手牌是</div><div class="opts guess">${s.guessable().map(v => `<button class="opt c${v}" data-g="${v}"><span class="num">${v}</span>${CARDS[v].name}</button>`).join("")}</div>`;
    gs.querySelectorAll(".opt").forEach(b => b.onclick = () => { guess = +b.dataset.g; gs.querySelectorAll(".opt").forEach(x => x.classList.toggle("on", x === b)); upd(); });
  }
  if (card === 9) body.querySelector("#tg").innerHTML = `<p class="note warn">打出公主你就立刻出局！真的要打吗？</p>`;
  if (card === 6) body.querySelector("#tg").innerHTML = `<p class="note">打出后会从牌库摸 2 张，你再从 3 张里挑 1 张留下。</p>`;
  upd();
  go.onclick = () => { send("play", { card, target, guess }); sh.close(); tutHit("send"); };
}
function showRound() {
  const s = G.sim, r = s.roundResult;
  const body = el(`<div><div class="rwin">❤ ${(r.ws || [r.w]).filter(Boolean).map(p => esc(s.P[p].name)).join("、")} 赢了这一轮</div><p class="note" style="text-align:center">${esc(r.why)}</p>
    <div class="rv" style="margin:6px auto 0"><b>暗牌</b>${r.aside >= 0 ? cardHTML(r.aside, "mini") : '<div class="card mini gone">被太子摸走</div>'}</div>
    <div class="reveal">${s.order.map(p => `<div class="rv ${s.S[p].out ? "out" : ""} ${(r.ws || []).includes(p) ? "winner" : ""}"><i style="background:${s.P[p].color}"></i><b>${esc(s.P[p].name)}</b>${r.hands[p].length ? cardHTML(r.hands[p][0], "mini") : `<div class="card mini gone">出局</div>`}<span class="hearts">${"❤".repeat(s.P[p].tokens)}</span></div>`).join("")}</div>
    <p class="note" style="text-align:center">先集满 ${s.need} 颗心的人获胜。下一轮几秒后自动开始。</p></div>`);
  const sh = sheet("本轮结束", body); setTimeout(() => sh.close(), 4600);
}
async function endGame() {
  G.ended = true; const s = G.sim, win = s.over.w === G.me; AU("play", win ? "win" : "lose");
  const flag = "qs.done." + G.code + "." + (G.room.seed || 0); let done = false; try { done = !!localStorage.getItem(flag); localStorage.setItem(flag, 1); } catch {}
  if (!done) { try { const p = await G.net.profile(); await G.net.saveProfile({ games: (p.games || 0) + 1, wins: (p.wins || 0) + (win ? 1 : 0), room: null }); } catch {} if (G.host) G.net.endRoom(G.code, { w: s.over.w }).catch(() => {}); }
  const body = el(`<div><div class="rwin ${win ? "me" : ""}">${win ? "💌 公主收到了你的情书" : "💔 情书被" + esc(s.P[s.over.w].name) + "抢先送到了"}</div>
    <div class="reveal">${s.order.map(p => `<div class="rv"><i style="background:${s.P[p].color}"></i><b>${esc(s.P[p].name)}</b><span class="hearts">${"❤".repeat(s.P[p].tokens)}</span></div>`).join("")}</div>
    ${G.host ? `<button class="btn block" id="eAgain">再来一局（同一批人）</button>` : `<button class="btn block" id="eJoin" hidden>房主开了新一局，加入</button><p class="note" id="eWait">房主点「再来一局」后，这里会出现加入按钮</p>`}
    <button class="btn ghost block" id="eBack">返回首页</button></div>`);
  const sh = sheet(win ? "你赢了" : "对局结束", body);
  body.querySelector("#eBack").onclick = () => { sh.close(); leaveGame(); };
  const ag = body.querySelector("#eAgain"); if (ag) ag.onclick = async () => { ag.disabled = true; try { await rematch(); } catch (e) { ag.disabled = false; toast("开新局失败：" + e.message, "bad"); } };
  const poll = setInterval(() => { if (!G) return clearInterval(poll); const j = body.querySelector("#eJoin"); if (j && G.room.next && j.hidden) { j.hidden = false; body.querySelector("#eWait").hidden = true; j.onclick = async () => { const code = G.room.next, net = G.net; sh.close(); leaveGame(true); try { await net.joinRoom(code); enterRoom(net, code); } catch (e) { toast("加入失败：" + e.message, "bad"); openHome(); } }; } }, 1000);
}
async function rematch() {
  const net = G.net, old = G.room, oldCode = G.code, bots = old.players.filter(p => p.bot);
  leaveGame(true);
  const code = await net.createRoom({});
  await net.updateRoom(code, r => { for (const b of bots) { const used = r.players.map(p => p.color); r.players.push({ id: "bot" + Math.random().toString(36).slice(2, 8), name: b.name, color: used.includes(b.color) ? QS.COLORS.find(c => !used.includes(c)) : b.color, bot: true }); } });
  if (net.mode !== "local") await net.updateRoom(oldCode, r => { r.next = code; }).catch(() => {});
  enterRoom(net, code);
}

/* ---------- 弹出层 ---------- */
function sheet(title, body, onClose) {
  document.querySelectorAll(".scrim").forEach(s => s.remove());
  const sc = el(`<div class="scrim"><div class="sheet" role="dialog"><div class="sh-head"><h3></h3><button class="x">关闭</button></div><div class="sh-body"></div></div></div>`);
  sc.querySelector("h3").textContent = title; sc.querySelector(".sh-body").append(body);
  const close = () => { sc.remove(); onClose && onClose(); };
  sc.querySelector(".x").onclick = close;
  let armed = false; const born = performance.now();
  sc.addEventListener("pointerdown", e => { armed = true; }, true);
  sc.addEventListener("click", e => { if (!armed && performance.now() - born < 700) { e.stopPropagation(); e.preventDefault(); return; } if (e.target === sc) close(); }, true);
  document.body.append(sc);
  return { close, root: sc };
}
$("#bMenu").onclick = () => {
  const body = el(`<div><div class="seg" id="mSnd"><button data-k="music" aria-pressed="${QSAudio.music}">🎵 背景音乐 ${QSAudio.music ? "开" : "关"}</button><button data-k="sfx" aria-pressed="${QSAudio.sfx}">🔊 音效 ${QSAudio.sfx ? "开" : "关"}</button></div><p class="note">手机开着静音键时可能听不到声音。</p><button class="btn ghost block" id="mCards">角色一览</button><button class="btn ghost block" id="mTut">新手教程（在这局里边玩边学）</button><button class="btn ghost block" id="mHelp">玩法说明</button><button class="btn ghost block" id="mOut">离开（对局会继续，可以随时回来）</button></div>`);
  const sh = sheet("菜单", body);
  body.querySelector("#mCards").onclick = () => { sh.close(); openCards(); }; body.querySelector("#mTut").onclick = () => { sh.close(); tutStart(); };
  body.querySelectorAll("#mSnd button").forEach(b => b.onclick = () => { const k = b.dataset.k, on = !QSAudio[k]; k === "music" ? QSAudio.setMusic(on) : QSAudio.setSfx(on); b.setAttribute("aria-pressed", on); b.textContent = (k === "music" ? "🎵 背景音乐 " : "🔊 音效 ") + (on ? "开" : "关"); });
  body.querySelector("#mHelp").onclick = () => { sh.close(); openHelp(); };
  body.querySelector("#mOut").onclick = () => { sh.close(); leaveGame(); };
};
$("#bLog").onclick = () => {
  const s = G.sim, lines = s.log.filter(l => l.vis === "all" || l.vis.includes(G.me)).filter(l => l.kind !== "turn").slice(-80).reverse();
  sheet("战报", el(`<ul class="log">${lines.map(l => `<li class="${l.kind}">${esc(l.text)}</li>`).join("") || "<li>还没有消息</li>"}</ul>`));
};
/* 八种角色一览：大牌面 + 效果 + 张数，随时能看 */
function openCards() {
  const s = G && G.sim, seen = {};
  if (s) { for (const q of s.order) for (const v of s.S[q].disc) seen[v] = (seen[v] || 0) + 1; for (const v of s.faceUp) seen[v] = (seen[v] || 0) + 1; }
  const vals = s ? s.values : Object.keys(CARDS).map(Number), nP = s ? s.nP : 4;
  const body = el(`<div class="gallery"><p class="note">${s ? (s.ext ? "这局是 5–6 人的扩展牌组：21 张、10 种角色" : "这局是 4 人以下的经典牌组：16 张、8 种角色") : "4 人及以下用 16 张经典牌（8 种角色）；5–6 人用 21 张扩展牌，多了细作和国公。"}</p>
    ${vals.map(v => `<div class="gitem${s ? "" : (CARDS[v].n ? "" : " ext")}">${cardHTML(v)}<div><b class="c${v}">${v} · ${CARDS[v].name}</b>${!s && !CARDS[v].n ? '<span class="xtag">扩展牌组</span>' : ""}<p>${esc(CARDS[v].desc)}</p><small>${s ? `一共 ${s.countOf(v)} 张，已经打出 ${seen[v] || 0} 张` : `经典 ${CARDS[v].n} 张 · 扩展 ${CARDS[v].nx} 张`}</small></div></div>`).join("")}
    <p class="note">数字越大越尊贵：牌库摸空时，手里数字大的赢。${s ? "「已经打出」把别人弃掉的牌都算上了，用来推测剩下什么。" : ""}</p></div>`);
  sheet("角色一览", body);
}
$("#bCards").onclick = () => openCards(); $("#hCards").onclick = () => openCards(); $("#aCards").onclick = () => openCards();
$("#hTut").onclick = () => startTutorial(); $("#aTut").onclick = () => startTutorial();
async function startTutorial() { TUT.pending = true; const c = await LOCAL.createRoom({}); await LOCAL.updateRoom(c, r => { r.players.push({ id: "bot-tut", name: QSNet.BOT_NAMES[0], color: QS.COLORS[1], bot: true }); }); await LOCAL.startRoom(c); enterRoom(LOCAL, c); }

/* ---------- 新手教程：在真实牌局里一步步教 ---------- */
const TUT = { on: false, i: 0, pending: false };
const TUT_STEPS = [
  { text: "欢迎！4 人以下用 16 张牌、8 种角色（5–6 人是 21 张），<b>每人手里只有 1 张</b>。轮到你时先摸 1 张（变成 2 张），再打出 1 张。<br>下面这两张就是你的手牌。", target: "#hand" },
  { text: "上面是对手：左边扣着的是他的手牌，右边是他<b>最近弃掉的牌</b>。记住别人弃过什么，剩下的就好猜。", target: "#opps" },
  { text: "牌库开局会扣掉 1 张谁也不知道。两人局还会明放 3 张。牌库摸空时，还没出局的人比手牌，<b>数字大的赢</b>。", target: ".center" },
  { text: "每张牌左上角的数字就是它的大小，名字下面写着张数。想看所有角色的效果，随时点右上角的<b>「角色」</b>。<br>现在<b>点一张手牌</b>。", target: "#hand", wait: "open" },
  { text: "这里是这张牌的效果。需要目标的牌先选一名玩家；侍卫还要猜他拿的是什么。选好后点<b>「打出」</b>。", target: ".sheet", wait: "send" },
  { text: "打出的牌进弃牌堆，效果马上生效。几条规矩：<b>侍女</b>保护你到下回合；手里有太子或帝君时<b>必须打皇后</b>；<b>公主</b>打出去你就出局。5–6 人局还有<b>细作</b>（轮末可能多得一颗 ❤）和<b>国公</b>（摸两张挑一张）。", target: null },
  { text: "被淘汰就等这一轮结束。赢一轮得一颗 ❤，先集满的人获胜（两人 7 颗、三人 5 颗、四人 4 颗、五六人 3 颗）。轮次结束会翻开所有人的牌。<br>去吧，把情书送到公主手里！", target: null }
];
function tutStart() {
  if (!G) return; tutEnd();
  TUT.on = true; TUT.i = 0;
  TUT.spot = el(`<div class="tut-spot" hidden></div>`); TUT.card = el(`<div class="tut"><div class="tut-n"></div><div class="tut-t"></div><div class="tut-b"><button class="btn sm ghost" id="tutSkip">跳过</button><span class="tut-wait">👆 等你操作…</span><button class="btn sm" id="tutNext">下一步</button></div></div>`);
  document.body.append(TUT.spot, TUT.card);
  TUT.card.querySelector("#tutSkip").onclick = () => tutEnd(true); TUT.card.querySelector("#tutNext").onclick = () => tutNext();
  TUT.timer = setInterval(tutTick, 120); tutShow();
}
function tutShow() {
  const S = TUT_STEPS[TUT.i]; if (!S) return tutEnd(true);
  TUT.card.querySelector(".tut-n").textContent = `新手教程 ${TUT.i + 1} / ${TUT_STEPS.length}`; TUT.card.querySelector(".tut-t").innerHTML = S.text;
  TUT.card.querySelector(".tut-wait").hidden = !S.wait; TUT.card.querySelector("#tutNext").hidden = !!S.wait;
  TUT.card.querySelector("#tutNext").textContent = TUT.i === TUT_STEPS.length - 1 ? "开始" : "下一步";
}
function tutNext() { TUT.i++; if (TUT.i >= TUT_STEPS.length) return tutEnd(true); tutShow(); }
function tutHit(what) { if (!TUT.on) return; const S = TUT_STEPS[TUT.i]; if (S && S.wait === what) setTimeout(tutNext, 300); }
function tutTick() {
  if (!TUT.on || !G) return; const S = TUT_STEPS[TUT.i], sp = TUT.spot; if (!S) return;
  // 第 4 步要等轮到自己才有牌可点：没轮到就先提示等待
  const w = TUT.card.querySelector(".tut-wait"); if (S.wait === "open") w.textContent = G.sim.phase === "play" && G.sim.cur() === G.me ? "👆 点一张手牌" : "⏳ 等电脑出完牌…";
  const e = S.target ? document.querySelector(S.target) : null, r = e && e.offsetParent !== null ? e.getBoundingClientRect() : null;
  sp.hidden = !r; if (r) { sp.style.left = r.left - 6 + "px"; sp.style.top = r.top - 6 + "px"; sp.style.width = r.width + 12 + "px"; sp.style.height = r.height + 12 + "px"; }
  TUT.card.classList.toggle("top", r ? r.top + r.height / 2 > innerHeight * .5 : false);
}
function tutEnd(done) { clearInterval(TUT.timer); if (TUT.spot) TUT.spot.remove(); if (TUT.card) TUT.card.remove(); TUT.spot = TUT.card = null; if (TUT.on && done) { try { localStorage.setItem("qs.tutDone", "1"); } catch {} } TUT.on = false; }

function openHelp() {
  sheet("玩法说明", el(`<div class="help">
    <p>你是王宫里的追求者，要把情书送到公主手里。<b>每人手里只有 1 张牌</b>。4 人及以下用 16 张经典牌（8 种角色）；5–6 人自动换成 21 张扩展牌（多了细作和国公，侍卫 6 张）。</p>
    <h4>怎么玩</h4><p>轮到你时先摸 1 张（手里 2 张），再打出 1 张，照着牌上的效果做。被淘汰就本轮出局。牌库摸完时，还没出局的人比手牌，<b>数字大的赢</b>；或者只剩一个人时他赢。赢一轮得一颗 ❤，两人局先集 7 颗、三人局 5 颗、四人局 4 颗、五六人局 3 颗的人获胜。</p>
    <h4>十种牌</h4>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => `<div class="hrow"><span class="hn c${v}">${v}</span><b>${CARDS[v].name}</b><span>×${CARDS[v].n}${CARDS[v].nx !== CARDS[v].n ? "/" + CARDS[v].nx : ""}</span><p>${esc(CARDS[v].desc)}</p></div>`).join("")}
    <h4>小窍门</h4><p>记住别人弃过什么牌，剩下的牌就好猜了。侍女保护期间别人碰不了你。手里有太子或帝君时必须先打皇后，这常常会暴露你。公主永远别打出去。</p>
    <h4>联机</h4><p>登录后创建房间，把 4 位房间号发给朋友，他们在首页输入就能加入。和苍澜·乱战用同一个账号。</p>
  </div>`));
}
