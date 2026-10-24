const AU = (fn, ...a) => { try { window.LZAudio && LZAudio[fn](...a); } catch {} };
/* 苍澜·乱战 — 界面与流程 */
"use strict";
const { Sim, CARDS, CATS, TIERS, TRAITS, POLICY, SAC, DRAW, TERR, HAND_MAX, LEVY, UNITS, UNIT_KEYS, TRAIN } = window.LZ;
const $ = s => document.querySelector(s);
const el = h => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => Math.floor(n).toLocaleString("en-US");
const mmss = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
// 画面比服务器时间略晚一点，让各方指令先到齐；迟到的指令靠“存档点回滚”修正，所以可以压得很短
const lagOf = net => net.mode === "local" ? 0 : .35;
const CP_EVERY = 5, CP_KEEP = 80; // 每 5 秒留一个存档点，最多回滚约 6 分钟
const CATCOL = { econ: "var(--c-econ)", support: "var(--c-support)", scout: "var(--c-scout)", defense: "var(--c-defense)", attack: "var(--c-attack)", disaster: "var(--c-disaster)" };
const GLYPH = { harvest: "禾", tax: "税", trade: "市", recruit: "兵", pioneer: "拓", scout: "探", wall: "墙", mine: "矿", settle: "田", swift: "疾", rally: "令", ambush: "伏", beacon: "烽", intercept: "截", tame: "驯", hawk: "鹰", spy: "谍", cavalry: "骑", fire: "焚", subvert: "反", flood: "洪", quake: "震", plague: "疫", beasts: "兽", meteor: "陨", golden: "盛", heaven: "天" };
const level = xp => Math.floor(Math.sqrt((xp || 0) / 40)) + 1;

let ONLINE = null, LOCAL = new LZNet.LocalNet(), NET = null, G = null;
const show = id => { document.querySelectorAll(".screen").forEach(s => s.hidden = s.id !== id); if (id !== "sGame") AU("setPhase", "menu"); };
function toast(text, kind = "", r = null) {
  const box = $("#toasts"); if (!box || $("#sGame").hidden) { console.log(text); return; }
  const t = el(`<div class="toast ${kind}"></div>`); t.textContent = text;
  if (r != null) t.onclick = () => { G && G.rd.focus(r); t.remove(); };
  box.prepend(t); while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => t.remove(), kind === "alert" ? 7000 : 4500);
}
let flashT; function flash(text) { const e = $("#aErr") ; console.log(text); const t = document.createElement("div"); t.className = "toast"; t.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 20px);z-index:90;width:auto;max-width:90%"; t.textContent = text; document.body.append(t); setTimeout(() => t.remove(), 2600); }

/* ================= 启动 ================= */
(async function boot() {
  await LOCAL.init();
  if (window.FIREBASE_CONFIG) {
    try { ONLINE = new LZNet.FireNet(window.FIREBASE_CONFIG); await ONLINE.init(); }
    catch (e) { console.error(e); ONLINE = null; }
  }
  if (ONLINE) {
    let first = true;
    ONLINE.onAuth(u => { if (G) return; if (u) openHome(); else openAuth(); first = false; });
  } else openAuth();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("./sw.js").catch(() => {});
})();

/* ================= 登录 ================= */
let authMode = "in";
function openAuth() {
  show("sAuth");
  $("#authOnline").hidden = !ONLINE; $("#authOffline").hidden = !!ONLINE;
}
document.querySelectorAll("#authSeg button").forEach(b => b.onclick = () => {
  authMode = b.dataset.m;
  document.querySelectorAll("#authSeg button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  $("#aName").hidden = authMode !== "up"; $("#aGo").textContent = authMode === "up" ? "注册并登录" : "登录"; $("#aErr").textContent = "";
});
$("#aGo").onclick = async () => {
  const email = $("#aEmail").value.trim(), pw = $("#aPw").value, name = $("#aName").value.trim();
  $("#aErr").textContent = "";
  if (authMode === "up" && !name) return $("#aErr").textContent = "起个游戏昵称吧";
  $("#aGo").disabled = true;
  try { if (authMode === "up") { await ONLINE.signUp(email, pw, name); openHome(); } else await ONLINE.signIn(email, pw); }
  catch (e) { $("#aErr").textContent = e.message; }
  finally { $("#aGo").disabled = false; }
};
$("#aSolo").onclick = () => startSolo();

/* ================= 首页 ================= */
async function openHome() {
  show("sHome"); $("#hErr").textContent = "";
  const net = ONLINE || LOCAL;
  $("#hOut").hidden = !ONLINE; $("#hCreate").disabled = !ONLINE; $("#hJoin").disabled = !ONLINE;
  try {
    const p = await net.profile();
    $("#hName").textContent = p.name || net.user.name; $("#hLv").textContent = level(p.xp); $("#hGames").textContent = p.games || 0; $("#hWins").textContent = p.wins || 0;
    const last = ONLINE ? await ONLINE.lastRoom() : null;
    $("#hResume").hidden = !last; $("#hResume").onclick = () => enterRoom(ONLINE, last);
  } catch (e) { $("#hErr").textContent = "读取资料失败：" + e.message; }
}
$("#hCreate").onclick = async () => {
  $("#hErr").textContent = "";
  try { const code = await ONLINE.createRoom({ len: 25, dev: 5 }); enterRoom(ONLINE, code); } catch (e) { $("#hErr").textContent = e.message; }
};
$("#hJoin").onclick = async () => {
  const code = $("#hCode").value.toUpperCase().trim(); $("#hErr").textContent = "";
  if (code.length !== 4) return $("#hErr").textContent = "房间号是 4 位";
  try { await ONLINE.joinRoom(code); enterRoom(ONLINE, code); } catch (e) { $("#hErr").textContent = e.message; }
};
$("#hSolo").onclick = () => startSolo();
$("#hHelp").onclick = () => openHelp();
$("#hOut").onclick = async () => { await ONLINE.signOut(); };
$("#hRename").onclick = () => {
  const body = box(`<input id="rnI" maxlength="8" placeholder="新的昵称"><button class="btn block" id="rnGo">保存</button>`);
  const sh = sheet("改名", body);
  body.querySelector("#rnI").value = (ONLINE || LOCAL).user.name;
  body.querySelector("#rnGo").onclick = async () => { const n = body.querySelector("#rnI").value.trim(); if (!n) return; await (ONLINE || LOCAL).saveProfile({ name: n }); sh.close(); openHome(); };
};
async function startSolo() {
  const last = await LOCAL.lastRoom();
  if (last) {
    const body = box(`<p style="margin:0">有一局单机练习还没打完。</p><button class="btn block" id="sRes">继续上一局</button><button class="btn ghost block" id="sNew">开新的一局</button>`);
    const sh = sheet("单机练习", body);
    body.querySelector("#sRes").onclick = () => { sh.close(); enterRoom(LOCAL, last); };
    body.querySelector("#sNew").onclick = async () => { sh.close(); const c = await LOCAL.createRoom({ len: 25, dev: 5 }); enterRoom(LOCAL, c); };
    return;
  }
  const c = await LOCAL.createRoom({ len: 25, dev: 5 }); enterRoom(LOCAL, c);
}

/* ================= 房间 ================= */
let roomUnsub = null;
function enterRoom(net, code) {
  NET = net; show("sRoom");
  $("#rCode").textContent = net.mode === "local" ? "单机" : code;
  $("#rCopy").hidden = net.mode === "local";
  $("#rCopy").onclick = async () => { try { await navigator.clipboard.writeText(code); flash("已复制房间号"); } catch { flash("房间号：" + code); } };
  if (roomUnsub) roomUnsub();
  roomUnsub = net.watchRoom(code, room => {
    if (!room) { flash("房间不存在了"); return openHome(); }
    if (room.status === "playing" || room.status === "ended") { roomUnsub && roomUnsub(); roomUnsub = null; return startGame(net, room); }
    renderRoom(net, room);
  });
}
function renderRoom(net, room) {
  const host = room.host === net.user.uid;
  $("#rCount").textContent = `${room.players.length} / 6`;
  const pl = $("#rPlayers"); pl.innerHTML = "";
  room.players.forEach(p => {
    const U = UNITS[p.unit];
    const row = el(`<div class="pl"><i style="background:${p.color}"></i><span></span>${U ? `<em class="ugl" title="${U.name}">${U.g}</em>` : ""}<small>${p.bot ? "电脑" : p.id === room.host ? "房主" : ""}</small>${host && p.bot ? '<button>移除</button>' : ""}</div>`);
    row.querySelector("span").textContent = p.name + (p.id === net.user.uid ? "（你）" : "");
    const rm = row.querySelector("button"); if (rm) rm.onclick = () => net.updateRoom(room.code, r => { r.players = r.players.filter(x => x.id !== p.id); });
    pl.append(row);
  });
  // 选特殊兵种
  const mine = room.players.find(p => p.id === net.user.uid), cur = mine && mine.unit;
  const up = $("#rUnits"); up.innerHTML = "";
  UNIT_KEYS.forEach(k => {
    const U = UNITS[k], b = el(`<button class="unitpick${cur === k ? " on" : ""}" aria-pressed="${cur === k}"><span class="ug">${U.g}</span><b>${U.name}</b><small>${U.tip}</small></button>`);
    b.onclick = () => net.updateRoom(room.code, r => { const me2 = r.players.find(x => x.id === net.user.uid); if (me2) me2.unit = k; });
    up.append(b);
  });
  $("#rUnitDesc").innerHTML = cur ? `<b>${UNITS[cur].name}</b>：${UNITS[cur].desc}。只在你的国都训练；别人攻下你的国都，也能训练它。` : "选一个你的特殊兵种（不选就随机）。特殊兵种只能在本国国都训练；攻下别国国都，就能训练那一国的特殊兵种。";
  $("#rHost").hidden = !host; $("#rWait").hidden = host;
  $("#rBot").disabled = room.players.length >= 6;
  $("#rBot").onclick = () => net.updateRoom(room.code, r => {
    if (r.players.length >= 6) return;
    const used = r.players.map(p => p.color), names = r.players.map(p => p.name);
    const name = LZNet.BOT_NAMES.find(n => !names.includes(n)) || "电脑" + r.players.length;
    r.players.push({ id: "bot" + Date.now().toString(36), name, color: LZ.COLORS.find(c => !used.includes(c)), bot: true, unit: UNIT_KEYS[Math.floor(Math.random() * UNIT_KEYS.length)] });
  });
  $("#rStart").onclick = async () => {
    if (room.players.length < 2) return $("#rErr").textContent = "至少要 2 名玩家（可以加电脑）";
    $("#rStart").disabled = true; try { await net.startRoom(room.code); } catch (e) { $("#rErr").textContent = e.message; } finally { $("#rStart").disabled = false; }
  };
  $("#rLeave").onclick = async () => {
    if (!host) await net.updateRoom(room.code, r => { r.players = r.players.filter(x => x.id !== net.user.uid); }).catch(() => {});
    roomUnsub && roomUnsub(); roomUnsub = null; ONLINE ? openHome() : openAuth();
  };
}

/* ================= 对局 ================= */
function startGame(net, room) {
  if (G) { // 保险：上一局没走「离开」就直接开了新局，也要把旧局的监听和定时器清掉
    try { G.unEv && G.unEv(); G.unRoom && G.unRoom(); clearInterval(G.botTimer); G.rd && G.rd.destroy(); } catch {}
    removeEventListener("resize", onResize); G = null;
  }
  const me = net.user.uid;
  if (!room.players.some(p => p.id === me)) { flash("你不在这局游戏里"); return openHome(); }
  show("sGame");
  const cfg = { seed: room.seed, players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, bot: p.bot, unit: p.unit || null })), devSec: LZ.RULES.devSec, totalSec: LZ.RULES.totalSec };
  const sim = new Sim(cfg);
  G = { net, room, code: room.code, me, sim, events: [], tickOf: new Map(), seenLog: new Set(), unread: 0, mode: null, sel: null, botNext: {}, host: room.host === me, ended: false, lastHud: 0, lag: lagOf(net), cps: [], pend: [] };
  const cv = $("#map");
  G.rd = new LZRender(cv, sim, me);
  G.rd.onTap = onMapTap;
  addEventListener("resize", onResize);
  G.unEv = net.watchEvents(room.code, list => onEvents(list));
  G.unRoom = net.watchRoom(room.code, r => { if (r) G.room = { ...G.room, ...r, startAt: r.startAt || G.room.startAt }; });
  G.botTimer = setInterval(runBots, 1200);
  renderHand();
  const game = G; requestAnimationFrame(() => loop(game)); // 每一局只有自己的这一条画面循环
}
function onResize() { if (!G) return; G.rd.resize(); clearTimeout(G.rsT); G.rsT = setTimeout(() => G && G.rd.resize(), 350); } // 转屏后布局要过一会才稳定，再量一次
addEventListener("orientationchange", onResize);
if (window.visualViewport) visualViewport.addEventListener("resize", onResize);
function leaveGame() {
  if (!G) return;
  G.unEv && G.unEv(); G.unRoom && G.unRoom(); clearInterval(G.botTimer); removeEventListener("resize", onResize);
  if (G.rd) G.rd.destroy(); // 卸掉这一局地图上的点击监听，避免下一局叠加
  document.querySelectorAll(".scrim").forEach(s => s.remove()); document.body.classList.remove("picking"); $("#banner").hidden = true;
  G = null; $("#toasts").innerHTML = "";
  ONLINE ? openHome() : openAuth();
}
const startAt = () => G.room.startAt;
const simNow = () => (G.net.serverNow() - startAt()) / 1000 - G.lag;
function evTick(e) { return Math.max(1, Math.ceil((e.ts - startAt()) / 1000)); }
function onEvents(list) {
  if (!G || !startAt()) { if (G) G.pendingList = list; return; }
  const evs = list.map(e => ({ ...e, tick: evTick(e) })).sort((a, b) => a.tick - b.tick || a.ts - b.ts || (a.id < b.id ? -1 : 1));
  G.events = evs;
  // 已经推演过的时间里有新/改动的事件 → 回到它之前的存档点重算
  let from = Infinity;
  for (const e of evs) {
    const was = G.tickOf.get(e.id);
    if (was != null && was !== e.tick) from = Math.min(from, was, e.tick);
    else if (was == null && e.tick <= G.sim.t) from = Math.min(from, e.tick);
  }
  if (from !== Infinity) resim(from);
}
/* 存档点：只存会变的状态；日志只记长度（之前的内容回滚后不会变） */
function checkpoint() {
  const s = G.sim; if (s.t % CP_EVERY || (G.cps.length && G.cps[G.cps.length - 1].t >= s.t)) return;
  G.cps.push({ t: s.t, n: s.applied.size, logN: s.log.length, st: structuredClone({ over: s.over, R: s.R, P: s.P, rel: s.rel, offers: s.offers, armies: s.armies, aseq: s.aseq, fx: s.fx, W: s.W }) });
  if (G.cps.length > CP_KEEP) G.cps.shift();
}
function restore(cp) {
  const s = G.sim, st = structuredClone(cp.st);
  s.t = cp.t; s.over = st.over; s.R = st.R; s.P = st.P; s.rel = st.rel; s.offers = st.offers; s.armies = st.armies; s.aseq = st.aseq; s.fx = st.fx; s.W = st.W;
  s.applied = new Set([...s.applied].slice(0, cp.n)); s.log.length = cp.logN;
}
function resim(from = 0) {
  const s = G.sim, upto = s.t;
  while (G.cps.length && G.cps[G.cps.length - 1].t >= from) G.cps.pop();
  const cp = G.cps[G.cps.length - 1];
  if (cp) restore(cp); else s.reset();
  if (!stepTo(upto)) { G.cps = []; s.reset(); stepTo(upto); }
  G.tickOf.clear();
  G.events.forEach(e => { if (e.tick <= s.t) G.tickOf.set(e.id, e.tick); });
  G.rd.key = "";
}
/* 推进到某一秒，沿途留存档点 */
function stepTo(target) {
  const s = G.sim;
  while (s.t < target && !s.over) {
    const nx = Math.min(target, (Math.floor(s.t / CP_EVERY) + 1) * CP_EVERY);
    if (!s.run(G.events, nx)) return false;
    checkpoint();
  }
  return true;
}
function advance() {
  if (!startAt()) return;
  if (G.pendingList) { const l = G.pendingList; G.pendingList = null; onEvents(l); }
  const target = Math.floor(simNow());
  if (target <= G.sim.t || G.sim.over) return;
  if (!stepTo(Math.min(target, G.sim.t + 600))) { resim(0); return; }
  G.events.forEach(e => { if (e.tick <= G.sim.t) G.tickOf.set(e.id, e.tick); });
  // 已经生效的指令，去掉“待发”标记
  if (G.pend.length) { const done = new Set(G.events.filter(e => e.cid && e.tick <= G.sim.t).map(e => e.cid)); const now = performance.now(); G.pend = G.pend.filter(p => !done.has(p.cid) && now - p.at < 8000); }
}
function loop(game) {
  if (!G || G !== game) return;
  advance();
  const now = startAt() ? simNow() : -99;
  $("#countdown").hidden = now >= 0;
  if (now < 0) $("#cdN").textContent = startAt() ? Math.ceil(-now) : "…";
  G.rd.hl = highlight(); G.rd.pend = G.pend;
  G.rd.draw(Math.max(0, now));
  fxSounds(now);
  const t = performance.now();
  if (t - G.lastHud > 250) { G.lastHud = t; updateHud(now); pumpLog(); if (G.sim.over && !G.ended) endGame(); }
  requestAnimationFrame(() => loop(game));
}

/* 新出现的、我看得见的特效 → 配音 */
function fxSounds(now) {
  const s = G.sim; if (!s.fx.length) return;
  const seen = G.fxSeen || (G.fxSeen = new Set());
  if (seen.size > 400) seen.clear();
  for (let i = s.fx.length - 1; i >= 0; i--) {
    const f = s.fx[i]; if (now - f.t0 > 1.5) break;
    const key = f.t0 + "|" + f.kind + "|" + f.r + "|" + (f.by || "");
    if (seen.has(key) || now < f.t0) continue; seen.add(key);
    if (f.vis && !f.vis.includes(G.me)) continue;
    const snd = { battle: "battle", capture: "capture", volley: "volley", train: "train", sacrifice: "capture", massacre: "lose", meteor: "battle", quake: "battle", fire: "battle" }[f.kind];
    if (snd) AU("play", snd);
  }
}
document.addEventListener("click", e => { if (e.target.closest && e.target.closest("button")) AU("play", "tap"); }, true);
/* ---------- HUD ---------- */
let lastTouch = 0;
addEventListener("pointerdown", () => { lastTouch = performance.now(); }, true);
addEventListener("pointerup", () => { lastTouch = performance.now(); }, true);
function updateHud(now) {
  const s = G.sim, st = s.P[G.me], inc = s.income(G.me);
  const dev = s.dev();
  $("#cPhase").className = "chip phase " + (dev ? "dev" : "war");
  const final = s.final();
  AU("setPhase", s.over ? "menu" : dev ? "dev" : final ? "final" : "war");
  $("#cPhaseL").textContent = s.over ? "已结束" : dev ? "发育期" : final ? "决战" : "混战";
  if (final && !s.over) $("#cPhase").className = "chip phase final";
  const hg = s.hegemon();
  $("#hege").hidden = !hg || !!s.over;
  if (hg && !s.over) { const left = Math.max(0, LZ.RULES.hegeHold - (s.t - hg.since)); $("#hege").className = "hege " + (hg.p === G.me ? "mine" : ""); $("#hege").textContent = hg.p === G.me ? `👑 你已占据 ${hg.n}/${hg.total} 块领地，再守住 ${left} 秒即可称霸！` : `👑 ${s.P[hg.p].name}占据 ${hg.n}/${hg.total} 块领地，${left} 秒后称霸！快打下他的城池`; }
  $("#cTime").textContent = mmss(dev ? s.cfg.devSec - now : s.cfg.totalSec - now);
  $("#cGold").textContent = fmt(st.gold); $("#cFood").textContent = fmt(st.food);
  $("#cGoldR").textContent = "+" + Math.round(inc.gold);
  const nf = inc.food - inc.upkeep; $("#cFoodR").textContent = (nf >= 0 ? "+" : "") + Math.round(nf); $("#cFoodR").style.color = nf < 0 ? "var(--bad)" : "";
  const tr = s.R.reduce((a, R) => a + (R.owner === G.me ? s.gar(R) : 0), 0) + s.armies.filter(a => a.owner === G.me).reduce((a, x) => a + x.troops, 0);
  $("#cTroops").textContent = fmt(tr);
  $("#cPop").textContent = inc.pop >= 10000 ? (inc.pop / 10000).toFixed(1) + "万" : fmt(inc.pop);
  $("#cRen").textContent = (st.renown > 0 ? "+" : "") + st.renown; $("#cRen").style.color = st.renown <= -10 ? "var(--bad)" : st.renown >= 10 ? "var(--good)" : "";
  // 新到手的卡：翻牌动画
  const newest = st.hand.filter(c => c.h > (G.maxH || 0));
  if (G.maxH != null && newest.length) { const g = st.got[st.got.length - 1]; if (g && s.t - g.t < 10) newest.forEach(c => cardArrive(c, g.how)); }
  G.maxH = Math.max(G.maxH || 0, st.hseq);
  const offers = Object.keys(s.offers).filter(k => k.endsWith(">" + G.me)).length;
  $("#dDip").hidden = !offers; $("#dDip").textContent = offers;
  $("#dLog").hidden = !G.unread; $("#dLog").textContent = G.unread;
  // 手牌/商店在资源变化时刷新可用状态
  const sig = st.hand.map(c => c.h).join(",") + "|" + dev;
  updateDealRing(); updateOmens();
  const busy = performance.now() - lastTouch < 900; // 手指正在点按时不重建界面，避免点不中
  if (sig !== G.handSig && !busy) { G.handSig = sig; renderHand(); }
  if (G.openSheet && G.openSheet.refresh && !busy) G.openSheet.refresh();
  if (!st.alive && !G.deadShown) { G.deadShown = true; toast("你的领地已全部失守。可以继续观战。", "alert"); }
}
function pumpLog() {
  const s = G.sim;
  for (const l of s.log) {
    if (l.vis !== "all" && !l.vis.includes(G.me)) continue;
    const key = l.t + "|" + l.text; if (G.seenLog.has(key)) continue;
    G.seenLog.add(key);
    if (s.t - l.t > 8) continue; // 重算或断线回来，不重复弹旧消息
    if (l.kind === "watch" && s.dev()) { G.unread++; continue; } // 发育期的行军动静只记进战报
    if (l.kind === "omen") { showOmen(l); G.unread++; continue; }
    if (l.kind === "decide") { toast(l.text + "（点这里处置）", "watch", l.r); if (!document.querySelector(".scrim:not(.light)") && !G.mode) openPolicy(l.r); G.unread++; continue; }
    if (["alert", "watch", "offer", "ping", "battle", "phase", "diplo", "disaster", "error", "info", "policy", "massacre", "sac", "hege"].includes(l.kind)) {
      const kind = l.kind === "alert" || l.kind === "error" || l.kind === "massacre" || l.kind === "hege" ? "alert" : l.kind === "watch" ? "watch" : l.kind === "ping" ? "ping" : l.kind === "phase" ? "good" : "";
      toast(l.text, kind, l.r);
      if (["alert", "watch", "offer", "ping", "battle"].includes(l.kind)) G.unread++;
      if (l.kind === "alert" && navigator.vibrate) navigator.vibrate(200);
      if (l.kind === "alert" || l.kind === "massacre") AU("play", "alert"); else if (l.kind === "phase") AU("play", "phase");
    }
  }
}
function showOmen(l) {
  const O = LZ.OMENS.find(o => l.text.startsWith("天时·" + o.name)) || { glyph: "天", good: 0, name: "天时" };
  const body = l.text.replace(/^天时·[^：]*：/, "");
  document.querySelectorAll(".omen").forEach(x => x.remove());
  const e = el(`<div class="omen${O.good ? " good" : ""}"><div class="og">${O.glyph}</div><div><small>天 时</small><b>${esc(O.name)}</b><p></p></div></div>`);
  e.querySelector("p").textContent = body; document.body.append(e); setTimeout(() => e.remove(), 4700); AU("play", "omen");
  toast(l.text, O.good ? "good" : "watch", l.r);
}
function updateOmens() {
  const s = G.sim, W = s.W, box = $("#omens"); if (!box) return;
  const on = [["harvest", "丰", "丰年", 1], ["drought", "旱", "大旱", 0], ["trade", "商", "通商", 1], ["fog", "雾", "大雾", 0]].filter(([k]) => W[k] > s.t);
  const html = on.map(([k, g, n, good]) => `<span class="${good ? "good" : ""}"><i>${g}</i>${n} <b class="num">${W[k] - s.t}</b></span>`).join("");
  if (box.innerHTML !== html) box.innerHTML = html;
}
function send(type, a) {
  if (!G || G.sim.over) return;
  const cid = Math.random().toString(36).slice(2, 10);
  G.pend.push({ cid, type, a, at: performance.now() }); // 先在画面上显示“已下令”，不用等网络
  if (type === "move" || (type === "card" && a.from != null)) AU("play", "order");
  G.net.sendEvent(G.code, { by: G.me, type, a, cid }).catch(e => { G.pend = G.pend.filter(p => p.cid !== cid); toast("发送失败：" + e.message, "alert"); });
}

/* ---------- 选择目标 ---------- */
function mineRegions() { return G.sim.R.map((x, i) => i).filter(i => G.sim.R[i].owner === G.me); }
function validFor(tgt) {
  const s = G.sim, me = G.me, all = s.R.map((x, i) => i);
  const adjMine = i => s.map.regions[i].adj.some(b => s.R[b].owner === me);
  switch (tgt) {
    case "own": return { regions: mineRegions() };
    case "src": return { regions: mineRegions().filter(i => s.R[i].troops >= 2 || Object.values(s.R[i].el).some(n => n > 0)) };
    case "any": return { regions: all };
    case "vis": return { regions: all.filter(i => s.visible(me, i)) };
    case "enemy": return { regions: all.filter(i => s.visible(me, i) && s.R[i].owner && s.R[i].owner !== me && s.relOf(me, s.R[i].owner) !== "ally") };
    case "pioneer": return { regions: all.filter(i => !s.R[i].owner && adjMine(i)) };
    case "beast": return { regions: all.filter(i => !s.R[i].owner && adjMine(i) && s.visible(me, i) && (s.P[me].snap[i] || {}).beast > 0) };
    case "myArmy": return { armies: s.armies.filter(a => a.owner === me).map(a => a.id) };
    case "army": return { armies: s.armies.filter(a => a.owner !== me && s.armyVisibleTo(a, me) && s.relOf(me, a.owner) !== "ally").map(a => a.id) };
  }
  return {};
}
function highlight() {
  const h = { regions: null, armies: null, sel: G.sel };
  if (G.mode) { const v = G.mode.valid || {}; h.regions = v.regions || null; h.armies = v.armies || null; }
  return h;
}
function setMode(m, text) {
  G.mode = m; closeSheets(true); G.lastPick = null;
  document.body.classList.toggle("picking", !!m); // 选目标时，手牌区让开，免得点到卡牌
  $("#banner").hidden = !m; if (m) $("#bannerT").textContent = text;
}
$("#bannerX").onclick = () => setMode(null);
function onMapTap({ region, poly, army }) {
  if (!G) return;
  const m = G.mode;
  if (m) {
    const v = m.valid || {};
    if (v.armies && army != null && v.armies.includes(army)) return m.pick({ army });
    if (v.regions && region != null && v.regions.includes(region)) return m.pick({ r: region });
    if (v.regions && poly != null && v.regions.includes(poly)) return m.pick({ r: poly }); // 点在城池图标旁边但落在另一块领地里
    toast("这里不能选，请点发亮的目标", "alert"); return;
  }
  if (army != null) return openArmy(army);
  // 保险：刚选完调兵目标、面板却被意外关掉（手机的幽灵点击）→ 再点同一座城直接重开调兵面板
  const lp = G.lastPick;
  if (lp && performance.now() - lp.at < 2500 && (region === lp.from || region === lp.to) && !document.querySelector(".scrim")) { openTroops(lp.from, lp.to, lp.card, lp.unit); return; }
  G.sel = region;
  if (region == null) { closeSheets(); return; }
  openRegion(region);
}

/* ================= 弹出层 ================= */
function sheet(title, body, opt = {}) {
  closeSheets(true);
  const sc = el(`<div class="scrim${opt.light ? " light" : ""}"><div class="sheet" role="dialog"><div class="sh-head"><h3></h3><button class="x">关闭</button></div><div class="sh-body"></div></div></div>`);
  sc.querySelector("h3").textContent = title; sc.querySelector(".sh-body").append(body);
  const close = () => { sc.remove(); if (G && G.openSheet === api) G.openSheet = null; if (opt.onClose) opt.onClose(); };
  sc.querySelector(".x").onclick = close;
  // 面板里的任何点击，都必须先在面板里“按下”过才算数。
  // 点地图弹出面板后，浏览器会在同一位置补发一次点击：如果正好落在「关闭」或某个按钮上，面板就会被莫名关掉或误触——这里把这种幽灵点击全部拦掉。
  let armed = false, downOnScrim = false; const born = performance.now();
  sc.addEventListener("pointerdown", e => { armed = true; downOnScrim = e.target === sc; }, true);
  sc.addEventListener("click", e => { if (!armed && performance.now() - born < 700) { e.stopPropagation(); e.preventDefault(); return; } if (e.target === sc && downOnScrim) close(); downOnScrim = false; }, true);
  document.body.append(sc);
  const api = { close, root: sc, refresh: opt.refresh };
  if (G) G.openSheet = api;
  return api;
}
function closeSheets(keepSel) { document.querySelectorAll(".scrim").forEach(s => s.remove()); if (G) { G.openSheet = null; if (!keepSel) { G.sel = null; G.lastPick = null; } } }
const box = html => { const d = document.createElement("div"); d.style.cssText = "display:contents"; d.innerHTML = html; return d; };
const ownerTag = pid => { if (!pid) return `<span class="owner"><i style="background:#8C877C"></i>无主</span>`; const p = G.sim.P[pid]; return `<span class="owner"><i style="background:${p.color}"></i>${esc(p.name)}${pid === G.me ? "（你）" : ""}</span>`; };
const relName = { peace: "中立", ally: "同盟", war: "交战", self: "" };

function elLine(el, home) {
  const parts = el ? Object.keys(el).filter(k => el[k] > 0).map(k => `<span class="elchip"><i>${UNITS[k].g}</i>${UNITS[k].name} <b class="num">${el[k]}</b></span>`) : [];
  const h = home ? `<span class="tip">国都只产<b>${UNITS[home].name}</b>（${UNITS[home].tip}）：每 ${LZ.ELITE_GROW} 秒自动 +1，最多 ${LZ.eliteCap(G.sim.R[G.sel] && G.sim.R[G.sel].home === home ? G.sim.R[G.sel] : { pop: 6000 })} 人；也可以花钱立刻训练</span>` : "";
  return parts.length || h ? `<div class="ellist">${parts.join("")}${h}</div>` : "";
}
function loyTxt(v) { return v >= 70 ? "归心" : v >= 50 ? "安定" : v >= 30 ? "不满" : v >= 15 ? "怨声载道" : "濒临暴动"; }
function openRegion(r) {
  const s = G.sim, me = G.me, g = s.map.regions[r];
  const draw = () => {
    const R = s.R[r], own = R.owner === me, vis = s.visible(me, r), snap = s.P[me].snap[r];
    const b = document.createElement("div"); b.style.display = "contents";
    let info;
    const Tr = t => TRAITS[t];
    if (own) {
      const st = [R.wallUntil > s.t ? "城墙中" : "", R.harvestUntil > s.t ? "丰收中" : "", R.floodUntil > s.t ? "洪灾中" : "", R.taxFreeUntil > s.t ? "免税中" : "", R.beacon ? "有烽火" : ""].filter(Boolean).join(" · ");
      const o = s.output(r), pol = R.policy === "home" ? "故土" : POLICY[R.policy].name;
      info = `<div class="tip">${ownerTag(me)} · ${TERR[g.terr].name} · <b>${Tr(R.trait).name}</b>${s.P[me].capital === r ? " · 都城" : ""}${st ? " · " + st : ""}</div>
        <div class="kv"><div><small>居民</small><b class="num">${fmt(R.pop)}</b></div><div><small>民心 · ${loyTxt(R.loyalty)}</small><b class="num" style="color:${R.loyalty < 25 ? "var(--bad)" : R.loyalty < 45 ? "var(--warn)" : "inherit"}">${Math.round(R.loyalty)}</b></div><div><small>守军</small><b class="num">${fmt(s.gar(R))}</b></div><div><small>守备</small><b class="num">×${s.defMult(r).toFixed(2)}</b></div></div>
        <div class="tip">每分钟产出 <b class="num">${Math.round(o.gold)}</b> 金、<b class="num">${Math.round(o.food)}</b> 粮 · 人口上限 ${fmt(R.cap)} · 治理：${pol}${R.mine ? " · 矿 " + R.mine + "/3" : ""}</div>
        <div class="tip">${Tr(R.trait).desc}${R.loyalty < 25 ? "。<b style='color:var(--bad)'>民心太低：守军不足时会叛乱</b>" : ""}</div>
        ${elLine(R.el, R.home)}`;
    } else if (vis && snap) {
      const age = s.t - snap.t;
      info = `<div class="tip">${ownerTag(snap.owner)}${snap.owner && snap.owner !== me ? " · " + relName[s.relOf(me, snap.owner)] : ""} · ${TERR[g.terr].name} · <b>${Tr(snap.trait).name}</b></div>
        <div class="kv"><div><small>居民</small><b class="num">${fmt(snap.pop)}</b></div><div><small>${snap.owner ? "民心" : "凶兽"}</small><b class="num">${snap.owner ? Math.round(snap.loyalty) : snap.beast ? fmt(snap.beast) : "无"}</b></div><div><small>${snap.owner ? "守军" : "民兵"}</small><b class="num">${fmt(snap.troops)}</b></div><div><small>地形守备</small><b class="num">×${(TERR[g.terr].def * (TRAITS[snap.trait].def || 1)).toFixed(2)}</b></div></div>
        ${elLine(snap.el, R.home)}
        <div class="tip">${Tr(snap.trait).desc}。情报来自 ${age < 5 ? "刚刚" : mmss(age) + " 前"}的侦查，你能看到经过这里的军队。</div>`;
    } else {
      const o = R.owner;
      info = `<div class="tip">${o ? "大致属于 " + ownerTag(o) : "可能是无主之地"} · ${TERR[g.terr].name}</div><div class="card tip">迷雾中的地区：不知道居民多少、民风如何、有多少守军和凶兽。用<b>斥候</b>、<b>鹰眼</b>侦查后才能看清，也才能看到经过这里的军队。</div>`;
    }
    b.innerHTML = info + `<div class="acts" id="ra"></div>`;
    const acts = b.querySelector("#ra");
    const add = (label, cls, fn, dis) => { const x = el(`<button class="btn ${cls}">${label}</button>`); x.disabled = !!dis; x.onclick = fn; acts.append(x); };
    if (own && R.pend && R.pend.by === me) add("处置城中百姓", "", () => openPolicy(r));
    if (own) {
      const need = Math.round(LEVY.pop * (TRAITS[R.trait].recruit || 1));
      add("出兵", R.pend ? "ghost" : "", () => startMoveFrom(r), R.troops < 2 && !Object.values(R.el).some(n => n > 0));
      if (R.home) { const U = UNITS[R.home]; const why = s.P[me].gold < TRAIN.gold ? `金不够（要 ${TRAIN.gold}）` : s.P[me].food < TRAIN.food ? `粮不够（要 ${TRAIN.food}）` : R.pop < TRAIN.pop + 300 ? "居民太少" : ""; add(`训练${U.name} +${TRAIN.n}<br><small style="font-weight:500">${why || `${TRAIN.gold}金 ${TRAIN.food}粮 ${TRAIN.pop}民`}</small>`, "elite", () => { send("train", { r }); }, !!why); }
      add("调兵到这里", "ghost", () => startMoveTo(r), mineRegions().filter(i => i !== r && s.R[i].troops >= 2).length === 0);
      if (!R.home) {
        const why = s.P[me].gold < LEVY.gold ? `金不够（要 ${LEVY.gold}）` : s.P[me].food < LEVY.food ? `粮不够（要 ${LEVY.food}）` : R.pop < need + 300 ? `居民太少（要 ${need + 300} 人以上）` : "";
        add(`征兵 +${LEVY.n}<br><small style="font-weight:500">${why || `${LEVY.gold}金 ${LEVY.food}粮 ${need}民`}</small>`, "ghost", () => send("levy", { r }), !!why);
      }
    } else {
      add(R.owner && s.relOf(me, R.owner) === "ally" ? "派援军到这里" : "派兵到这里", "", () => startMoveTo(r));
    }
    const allies = s.order.filter(p => p !== me && s.P[p].alive && s.relOf(me, p) === "ally");
    if (allies.length) add("📣 预警盟友", "ghost", () => openPing(r, allies));
    return b;
  };
  const wrap = document.createElement("div"); wrap.style.display = "contents"; wrap.append(draw());
  let last = "";
  sheet(g.name, wrap, { light: true, onClose: () => { if (G) G.sel = null; }, refresh: () => { const R = s.R[r], k = [R.owner, Math.round(R.troops), JSON.stringify(R.el), Math.round(R.pop / 50), Math.round(R.loyalty), R.mine, R.trait, !!R.pend, s.visible(me, r), Math.floor(s.P[me].gold / 5), Math.floor(s.P[me].food / 5)].join(); if (k !== last) { last = k; wrap.innerHTML = ""; wrap.append(draw()); } } });
  G.sel = r;
}
function openPolicy(r) {
  const s = G.sim, R = s.R[r], g = s.map.regions[r];
  if (!R.pend || R.pend.by !== G.me) return;
  const k = R.pop / 1000;
  const gain = { benevolent: "花费 30 粮", military: "", tax: `+${Math.round(k * 30)} 金`, massacre: `+${Math.round(k * 50)} 金 +${Math.round(k * 40)} 粮` };
  const body = box(`<div class="tip">${esc(g.name)}（${TRAITS[R.trait].name}）城中还有 <b class="num">${fmt(R.pop)}</b> 名居民。剩余 <b class="num" id="pdT"></b> 秒，不选就默认军管。</div>
    <div class="policies">${Object.entries(POLICY).map(([key, P]) => `<button class="pol ${key}" data-c="${key}"><b>${P.name}</b>${gain[key] ? `<span class="gain">${gain[key]}</span>` : ""}<small>${P.desc}</small></button>`).join("")}</div>`);
  const sh = sheet("如何处置百姓？", body, { refresh: () => { const x = s.R[r]; if (!x.pend) { sh.close(); return; } body.querySelector("#pdT").textContent = Math.max(0, x.pend.until - s.t); } });
  body.querySelector("#pdT").textContent = Math.max(0, R.pend.until - s.t);
  body.querySelectorAll("[data-c]").forEach(b => {
    if (b.dataset.c === "benevolent" && s.P[G.me].food < 30) b.disabled = true;
    b.onclick = () => {
      if (b.dataset.c === "massacre" && !b.dataset.armed) { b.dataset.armed = 1; b.querySelector("b").textContent = "确定屠城？再点一次"; return; }
      send("policy", { r, c: b.dataset.c }); sh.close();
    };
  });
}
function openArmy(id) {
  const s = G.sim, a = s.armies.find(x => x.id === id); if (!a) return;
  const own = a.owner === G.me, P = s.P[a.owner], next = s.map.regions[a.path[a.idx + 1]];
  const dest = own ? s.map.regions[a.path[a.path.length - 1]].name : "未知";
  const body = box(`<div class="tip">${ownerTag(a.owner)} · ${own ? "" : relName[s.relOf(G.me, a.owner)]}</div>
    <div class="kv"><div><small>兵力</small><b class="num">${fmt(a.troops)}</b></div><div><small>下一站</small><b>${esc(next.name)}</b></div><div><small>目的地</small><b>${esc(dest)}</b></div><div><small>类型</small><b>${UNITS[a.kind] ? UNITS[a.kind].name : a.kind === "cavalry" ? "铁骑" : "步军"}</b></div></div>
    ${own ? "" : `<div class="tip">看得见它，是因为它正经过你掌控或侦查过的地区。可以用「截杀」卡打击它，或者在它的去路上设「伏兵」。</div>`}`);
  sheet(own ? "我的军队" : P.name + "的军队", body, { light: true });
}

/* ---------- 出兵 ---------- */
function startMoveFrom(from) {
  setMode({ valid: { regions: G.sim.R.map((x, i) => i).filter(i => i !== from) }, pick: ({ r }) => { setMode(null); openTroops(from, r); } }, `从${G.sim.map.regions[from].name}出兵：点目标地区`);
}
function startMoveTo(to) {
  const v = validFor("src"); v.regions = v.regions.filter(i => i !== to);
  if (!v.regions.length) return toast("你没有能出兵的地区（至少要 2 兵）", "alert");
  setMode({ valid: v, pick: ({ r }) => { setMode(null); openTroops(r, to); } }, `派兵到${G.sim.map.regions[to].name}：点出发地`);
}
function eta(from, to, speed = 1, u) {
  const s = G.sim, p = s.path(from, to); if (!p) return null;
  let t = 0; for (let k = 0; k < p.length - 1; k++) t += s.segLen(p[k], p[k + 1]) / (LZ.SPEED * speed * (u === "wudang" ? 1 : s.segSpeed(p[k], p[k + 1])));
  return { secs: t, hops: p.length - 1, path: p };
}
function openTroops(from, to, card, unit) {
  const s = G.sim, me = G.me, R = s.R[from], T = s.R[to];
  G.lastPick = { from, to, card, unit, at: performance.now() };
  // 可选兵种：普通兵 + 本地驻扎的特殊兵（铁骑卡只能用普通兵）
  const opts = [];
  if (Math.floor(R.troops) - 1 >= 1) opts.push({ u: null, name: card ? "铁骑（普通兵）" : "普通兵", max: Math.floor(R.troops) - 1 });
  if (!card) for (const k of UNIT_KEYS) if ((R.el[k] || 0) >= 1) opts.push({ u: k, name: UNITS[k].name, max: R.el[k] });
  if (!opts.length) return toast("兵力不够", "alert");
  let opt = opts.find(o => o.u === (unit || null)) || opts[0];
  const snap = s.P[me].snap[to], vis = s.visible(me, to);
  const kind = T.owner === me ? "调兵" : T.owner && s.relOf(me, T.owner) === "ally" ? "援军" : "进攻";
  const devBlock = s.dev() && T.owner && T.owner !== me && s.relOf(me, T.owner) !== "ally";
  const wrap = document.createElement("div"); wrap.style.display = "contents";
  const draw = () => {
    const U = UNITS[opt.u], speed = card ? 2 : U ? U.speed : 1, atk = card ? 1.3 : U ? U.atk : 1, max = opt.max;
    const e = eta(from, to, speed, opt.u);
    const body = box(`${opts.length > 1 ? `<div class="seg unitseg">${opts.map((o, i) => `<button data-i="${i}" aria-pressed="${o === opt}">${o.u ? `<i>${UNITS[o.u].g}</i>` : ""}${o.name} <small class="num">${fmt(o.max)}</small></button>`).join("")}</div>` : ""}
      <div class="tip">${esc(s.map.regions[from].name)} → <b>${esc(s.map.regions[to].name)}</b>（${kind}${card ? " · 铁骑" : U ? " · " + U.name : ""}）· 途经 ${e ? e.hops : "?"} 个地区，约 <b>${e ? mmss(e.secs) : "?"}</b> 到达</div>
      ${U ? `<div class="tip elitetip"><b>${U.name}</b>：${U.desc}</div>` : ""}
      <div class="mv-n num" id="tN"></div>
      <input type="range" class="range" id="tR" min="1" max="${max}" value="${U ? max : Math.max(1, Math.round(max * .75))}" aria-label="兵力">
      <div class="tip" style="display:flex;justify-content:space-between"><span>留守 <b class="num" id="tL"></b></span><span>可用 ${fmt(max)}</span></div>
      <div class="card tip" id="tOdds"></div>
      ${devBlock ? `<p class="err">发育期内不能进攻其他玩家</p>` : ""}
      <button class="btn block" id="tGo">${kind === "进攻" ? "出征！" : "出发"}</button>`);
    body.querySelectorAll(".unitseg button").forEach(b => b.onclick = () => { opt = opts[+b.dataset.i]; wrap.innerHTML = ""; wrap.append(draw()); });
    const rg = body.querySelector("#tR");
    const upd = () => {
      const n = +rg.value; body.querySelector("#tN").textContent = fmt(n) + (U ? " " + U.name : " 兵"); body.querySelector("#tL").textContent = U ? fmt((R.el[opt.u] || 0) - n) + " " + U.name : fmt(R.troops - n);
      const o = body.querySelector("#tOdds");
      if (kind !== "进攻") { o.textContent = kind === "援军" ? "援军会并入盟友的守军。" : "部队会并入目标地区的守军。"; return; }
      if (!vis || !snap) { o.innerHTML = "目标在迷雾中，<b>不知道有多少守军或凶兽</b>。先侦查更稳妥。"; return; }
      let gd = snap.owner ? snap.troops : 0;
      if (snap.owner && snap.el) for (const k in snap.el) gd += snap.el[k] * (UNITS[k].def - 1);
      const breach = opt.u === "xianzhen";
      const def = (gd + snap.beast) * (breach ? 1 : TERR[s.map.regions[to].terr].def * (TRAITS[snap.trait].def || 1)) * (opt.u === "lianu" ? .8 : 1), ratio = n * atk / Math.max(1, def);
      const [lab, col] = def === 0 ? ["空地，直接占领", "var(--good)"] : ratio > 1.4 ? ["胜算很大", "var(--good)"] : ratio > 1.1 ? ["胜算较大", "var(--good)"] : ratio > .9 ? ["五五开", "var(--warn)"] : ["胜算很小", "var(--bad)"];
      o.innerHTML = `情报：守军约 ${fmt(snap.owner ? snap.troops : 0)}${snap.beast ? "，凶兽 " + fmt(snap.beast) : ""}（${s.t - snap.t < 5 ? "最新" : mmss(s.t - snap.t) + " 前"}）→ <b style="color:${col}">${lab}</b><br>路上可能遭遇伏兵，对方也可能增援。`;
    };
    rg.oninput = upd; upd();
    body.querySelector("#tGo").disabled = devBlock;
    body.querySelector("#tGo").onclick = () => {
      if (card) send("card", { h: card, from, to, n: +rg.value }); else send("move", opt.u ? { from, to, n: +rg.value, u: opt.u } : { from, to, n: +rg.value });
      G.lastPick = null; sh.close(); toast("命令已下达", "good");
    };
    return body;
  };
  wrap.append(draw());
  const sh = sheet(kind, wrap, { onClose: () => { if (G) G.lastPick = null; } });
}

/* ---------- 预警 ---------- */
function openPing(r, allies) {
  const msgs = ["敌军来袭！", "这里有伏兵", "需要支援", "我来救你", "一起打这里"];
  let to = allies[0];
  const body = box(`<div class="tip">在${esc(G.sim.map.regions[r].name)}标记一个信号，只有你和这位盟友看得到。</div>
    ${allies.length > 1 ? `<div class="seg" id="pTo">${allies.map((a, i) => `<button aria-pressed="${i === 0}" data-p="${a}">${esc(G.sim.P[a].name)}</button>`).join("")}</div>` : `<div>发给 ${ownerTag(to)}</div>`}
    <div class="acts">${msgs.map(m => `<button class="btn ghost" data-m="${m}">${m}</button>`).join("")}</div>`);
  body.querySelectorAll("#pTo button").forEach(b => b.onclick = () => { to = b.dataset.p; body.querySelectorAll("#pTo button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
  const sh = sheet("预警盟友", body);
  body.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { send("ping", { to, r, msg: b.dataset.m }); sh.close(); toast("信号已发出", "good"); });
}

/* ---------- 卡牌 ---------- */
function cardFace(k, cls = "cardmini") {
  const C = CARDS[k], T = TIERS[C.tier];
  return `<div class="${cls} t${C.tier}" style="--cc:${CATCOL[C.cat]}"><span class="cat">${CATS[C.cat]}</span>${LZIcon(k)}<span class="gl seal">${GLYPH[k]}</span><b>${C.name}</b><span class="tier">${T.name}</span></div>`;
}
const costTxt = c => [c.gold ? `<span>${fmt(c.gold)} 金</span>` : "", c.food ? `<span>${fmt(c.food)} 粮</span>` : ""].join("");
const SELL = [0, 10, 30, 80, 200];
function updateDealRing() {
  const s = G.sim, st = s.P[G.me], left = DRAW.dealEvery - (s.t % DRAW.dealEvery), full = st.hand.length >= HAND_MAX;
  const n = $("#dealS"), fg = document.querySelector(".shopbtn .ring .fg"); if (!n || !fg) return;
  n.textContent = full ? "满" : left;
  fg.style.strokeDashoffset = String(106.8 * (left / DRAW.dealEvery));
}
/* 新卡到手：从天而降落进手牌，不挡操作 */
function cardArrive(c, how) {
  const C = CARDS[c.k], T = TIERS[C.tier];
  const fly = el(`<div class="flycard t${C.tier}" style="--cc:${CATCOL[C.cat]}">${LZIcon(c.k)}<span class="gl seal">${GLYPH[c.k]}</span><b>${C.name}</b><small>${T.name}</small></div>`);
  document.body.append(fly); setTimeout(() => fly.remove(), 1900);
  const src = { deal: "发牌", omen: "天时", sac: "祭坛", buy: "市集" }[how] || "获得";
  AU("play", C.tier >= 3 ? "rare" : "deal");
  toast(`${src}：${T.name}「${C.name}」`, C.tier >= 3 ? "good" : "");
  setTimeout(() => { const b = [...document.querySelectorAll("#hand .cardmini")].pop(); if (b) { b.classList.add("fresh"); setTimeout(() => b.classList.remove("fresh"), 1600); } }, 900);
}
function renderHand() {
  if (!G) return;
  const st = G.sim.P[G.me], dev = G.sim.dev(), h = $("#hand"); h.innerHTML = "";
  const sb = el(`<button class="shopbtn deal"><svg class="ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/><circle class="fg" cx="20" cy="20" r="17"/></svg><b class="num" id="dealS">--</b><small>秒后发牌</small><small class="num">${st.hand.length}/${HAND_MAX}</small></button>`);
  sb.onclick = () => openAcquire(); h.append(sb);
  if (!st.hand.length) h.append(el(`<div class="empty-hand">卡牌每 ${DRAW.dealEvery} 秒自动发一张，不用操作。想要更多可以去市集或祭坛。</div>`));
  updateDealRing();
  st.hand.forEach(c => {
    const C = CARDS[c.k], T = TIERS[C.tier], locked = dev && !LZ.DEV_CATS.includes(C.cat);
    const b = el(`<button class="cardmini t${C.tier}${locked ? " locked" : ""}" style="--cc:${CATCOL[C.cat]}"><span class="cat">${CATS[C.cat]}</span>${LZIcon(c.k)}<span class="gl seal">${GLYPH[c.k]}</span><b>${C.name}</b><small>${locked ? "发育后可用" : T.name}</small></button>`);
    b.onclick = () => openCard(c); h.append(b);
  });
}
function openCard(c) {
  const C = CARDS[c.k], s = G.sim, locked = s.dev() && !LZ.DEV_CATS.includes(C.cat);
  const body = box(`<div class="bigcard">${cardFace(c.k, "face")}<div><div style="font-size:15px">${esc(C.desc)}</div><div class="tip" style="margin-top:6px">${tgtText(C.tgt)}</div></div></div>
    ${locked ? `<p class="err">发育期只能使用收益、辅助类卡牌，还剩 ${mmss(s.cfg.devSec - s.t)}</p>` : ""}
    <div class="acts"><button class="btn" id="cUse">使用</button><button class="btn ghost" id="cSell">变卖 +${SELL[C.tier]} 金</button></div>`);
  const sh = sheet(`${TIERS[C.tier].name} · ${C.name}`, body);
  body.querySelector("#cUse").disabled = locked;
  body.querySelector("#cUse").onclick = () => { sh.close(); useCard(c); };
  const sell = body.querySelector("#cSell");
  sell.onclick = () => { if (!sell.dataset.armed) { sell.dataset.armed = 1; sell.textContent = "确认变卖？"; return; } send("discard", { h: c.h }); sh.close(); };
}
function tgtText(t) {
  return { own: "目标：你自己的一个地区", any: "目标：地图上任意地区（迷雾中也可以）", vis: "目标：你看得见的地区", enemy: "目标：你看得见的、非盟友的他人地区", pioneer: "目标：与你相邻的无主地区", beast: "目标：与你相邻、侦查到有凶兽的地区",
    player: "目标：另一名玩家", myArmy: "目标：你正在行进的军队", army: "目标：你看得见的他人军队（在你掌控或侦查过的地区里）", none: "无需目标，立即生效", launch: "先选出发地，再选目标，再定兵力" }[t] || "";
}
function useCard(c) {
  const C = CARDS[c.k], s = G.sim;
  if (C.tgt === "none") { send("card", { h: c.h }); toast(`使用了「${C.name}」`, "good"); return; }
  if (C.tgt === "player") {
    const ps = s.order.filter(p => p !== G.me && s.P[p].alive);
    const body = box(`<div class="acts">${ps.map(p => `<button class="btn ghost" data-p="${p}">${esc(s.P[p].name)}</button>`).join("")}</div>`);
    const sh = sheet(`「${C.name}」选择玩家`, body);
    body.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { send("card", { h: c.h, p: b.dataset.p }); sh.close(); toast(`使用了「${C.name}」`, "good"); });
    return;
  }
  if (C.tgt === "launch") {
    const v = validFor("src"); if (!v.regions.length) return toast("没有能出兵的地区", "alert");
    setMode({ valid: v, pick: ({ r: from }) => {
      setMode({ valid: { regions: s.R.map((x, i) => i).filter(i => i !== from) }, pick: ({ r: to }) => { setMode(null); openTroops(from, to, c.h); } }, "铁骑：点目标地区");
    } }, "铁骑：点出发地（你的地区）");
    return;
  }
  const v = validFor(C.tgt);
  if (!(v.regions && v.regions.length) && !(v.armies && v.armies.length)) return toast(C.tgt === "army" ? "现在看不到可以截杀的军队" : C.tgt === "myArmy" ? "你没有行进中的军队" : C.tgt === "beast" ? "相邻没有侦查到的凶兽" : "现在没有合适的目标", "alert");
  setMode({ valid: v, pick: tgt => { setMode(null); send("card", { h: c.h, ...tgt }); toast(`使用了「${C.name}」`, "good"); } }, `「${C.name}」：${tgtText(C.tgt).replace("目标：", "点")}`);
}

/* ---------- 获取卡牌：抽签 / 市集 / 祭坛 ---------- */
let acqTab = "market";
function openAcquire(tab) {
  if (tab) acqTab = tab;
  const wrap = document.createElement("div"); wrap.style.display = "contents";
  const draw = () => {
    const s = G.sim, st = s.P[G.me], dev = s.dev(), full = st.hand.length >= HAND_MAX;
    const b = document.createElement("div"); b.style.display = "contents";
    b.innerHTML = `<div class="seg" id="aqT"><button data-t="market" aria-pressed="${acqTab === "market"}">市集</button><button data-t="altar" aria-pressed="${acqTab === "altar"}">祭坛</button></div><div id="aqB" style="display:contents"></div>`;
    b.querySelectorAll("#aqT button").forEach(x => x.onclick = () => { acqTab = x.dataset.t; refresh(true); });
    const B = b.querySelector("#aqB");
    B.append(el(`<div class="card tip deal-info">卡牌<b>自动发放</b>：每 ${DRAW.dealEvery} 秒一张，凡品 ${DRAW.w[1]}% · 良品 ${DRAW.w[2]}% · 珍品 ${DRAW.w[3]}% · 传说 ${DRAW.w[4]}%，${DRAW.pity} 张内保底珍品。${dev ? "发育期只发收益、辅助类。" : ""}${full ? "<br><b style='color:var(--bad)'>手牌已满，新卡会先存着（最多 " + DRAW.owedMax + " 张），用掉一张就补上。</b>" : ""}</div>`));
    if (acqTab === "market") {
      const ks = Object.keys(CARDS).filter(k => CARDS[k].tier === 1);
      B.append(el(`<div class="tip">市集只卖<b>凡品</b>，而且价格是抽签的好几倍，每买一张都会再涨 20%。高级卡牌靠自动发牌或祭坛。</div>`));
      const grid = el(`<div class="shop"></div>`);
      ks.forEach(k => {
        const C = CARDS[k], price = s.buyPrice(st, k), lock = dev && !LZ.DEV_CATS.includes(C.cat), ok = !lock && !full && price.gold <= st.gold && price.food <= st.food;
        const it = el(`<div class="item" style="--cc:${CATCOL[C.cat]}"><div class="top">${CATS[C.cat]} · 凡品${LZIcon(k)}</div><div class="in"><b>${C.name}</b><p>${esc(C.desc)}</p><div class="cost">${costTxt(price)}</div><button class="btn sm" ${ok ? "" : "disabled"}>${lock ? "发育后开放" : "购买"}</button></div></div>`);
        it.querySelector("button").onclick = e => { e.target.disabled = true; e.target.textContent = "购买中…"; send("buy", { k }); };
        grid.append(it);
      });
      B.append(grid);
    }
    if (acqTab === "altar") {
      B.append(el(`<div class="tip">以血与火换取高级卡牌：<b>指定</b>想要的卡，然后在地图上选献祭的地方。代价不可挽回。</div>`));
      Object.entries(SAC).forEach(([kind, S]) => {
        const T = TIERS[S.tier];
        const c = el(`<div class="card altar t${S.tier}"><div class="row" style="align-items:center"><b style="flex:none">${S.name}</b><span class="tierpill" style="flex:none">换 ${T.name}</span></div><div class="tip">${S.desc}</div><div class="acts"></div></div>`);
        const acts = c.querySelector(".acts");
        Object.keys(CARDS).filter(k => CARDS[k].tier === S.tier).forEach(k => {
          const x = el(`<button class="btn sm ghost">${CARDS[k].name}</button>`); x.disabled = full;
          x.onclick = () => startSacrifice(kind, k); acts.append(x);
        });
        B.append(c);
      });
    }
    B.append(el(`<div class="tip">现有 ${fmt(st.gold)} 金、${fmt(st.food)} 粮 · 手牌 ${st.hand.length}/${HAND_MAX}</div>`));
    return b;
  };
  let last = "";
  const refresh = force => { const st = G.sim.P[G.me]; const k = acqTab + st.hand.length + "|" + Math.floor(st.gold / 5) + "|" + Math.floor(st.food / 5) + "|" + st.pity + G.sim.dev(); if (force || k !== last) { last = k; wrap.innerHTML = ""; wrap.append(draw()); } };
  refresh(true);
  sheet("获取卡牌", wrap, { refresh });
}
function startSacrifice(kind, k) {
  const s = G.sim, S = SAC[kind];
  const ok = mineRegions().filter(i => { const R = s.R[i]; return kind === "army" ? R.troops >= S.troops + 1 : kind === "pop" ? R.pop >= S.minPop : mineRegions().length > 1; });
  if (!ok.length) return toast(kind === "army" ? `没有兵力超过 ${S.troops} 的地区` : kind === "pop" ? `没有居民超过 ${S.minPop} 的地区` : "你只剩一座城了", "alert");
  setMode({ valid: { regions: ok }, pick: ({ r }) => {
    setMode(null);
    const R = s.R[r], g = s.map.regions[r];
    const what = kind === "army" ? `献出 ${S.troops} 名士兵` : kind === "pop" ? `献祭 ${fmt(Math.round(R.pop * .9))} 名百姓` : `把${g.name}（${fmt(R.pop)} 居民）化为废墟`;
    const body = box(`<div class="bigcard">${cardFace(k, "face")}<div><b>换取「${CARDS[k].name}」</b><div class="tip" style="margin-top:4px">${esc(CARDS[k].desc)}</div></div></div>
      <div class="card" style="border-color:#7A2A24"><b style="color:var(--bad)">代价：在${esc(g.name)}${what}</b><div class="tip" style="margin-top:4px">${S.desc}</div></div>
      <button class="btn block" id="sGo" style="background:#B0302A;color:#fff">献祭</button>`);
    const sh = sheet(S.name, body);
    body.querySelector("#sGo").onclick = () => { send("sac", { kind, r, k }); sh.close(); };
  } }, `${S.name}：点你要献祭的地区`);
}
function showReveal(c) {
  const C = CARDS[c.k], T = TIERS[C.tier];
  const ov = el(`<div class="reveal t${C.tier}" style="--cc:${CATCOL[C.cat]}"><div class="rv-card t${C.tier}"><span class="cat">${CATS[C.cat]}</span><span class="gl">${GLYPH[c.k]}</span><b>${C.name}</b><span class="tier">${T.name}</span><p>${esc(C.desc)}</p></div><div class="rv-tip">点任意处继续</div></div>`);
  ov.onclick = () => ov.remove();
  document.body.append(ov);
  setTimeout(() => ov.remove(), 4500);
}

/* ---------- 外交 ---------- */
$("#bDip").onclick = () => {
  const draw = () => {
    const s = G.sim, me = G.me, b = document.createElement("div"); b.style.display = "contents";
    b.innerHTML = `<div class="tip">${s.dev() ? "发育期内不能宣战和进攻其他玩家，但可以先结盟。" : "进攻中立玩家会自动开战。盟友之间可以互派援军，互相预警。"}</div>`;
    s.order.filter(p => p !== me).forEach(p => {
      const P = s.P[p], rel = s.relOf(me, p), cnt = s.R.filter(R => R.owner === p).length;
      const c = el(`<div class="card dip"><div class="dip-top"><i style="background:${P.color}"></i><b></b><span class="pill ${P.alive ? rel : "dead"}">${P.alive ? relName[rel] : "已出局"}</span></div><div class="tip">${P.bot ? "电脑 · " : ""}大约 ${cnt} 块领地</div><div class="acts"></div></div>`);
      c.querySelector("b").textContent = P.name;
      const acts = c.querySelector(".acts");
      const add = (label, cls, type) => { const x = el(`<button class="btn sm ${cls}">${label}</button>`); x.onclick = () => { send(type, { to: p }); x.disabled = true; x.textContent = "已发送"; }; acts.append(x); };
      if (P.alive) {
        const theyOffer = s.offers[p + ">" + me] != null, iOffer = s.offers[me + ">" + p] != null;
        const theyPeace = s.offers["p" + p + ">" + me] != null, iPeace = s.offers["p" + me + ">" + p] != null;
        if (rel === "ally") add("解除同盟", "bad", "unally");
        if (rel === "peace") {
          if (theyOffer) { add("接受结盟", "", "ally"); add("拒绝", "ghost", "reject"); }
          else if (iOffer) acts.append(el(`<span class="tip">已提议结盟，等对方回应</span>`));
          else add("提议结盟", "ghost", "ally");
          if (!s.dev()) add("宣战", "bad", "war");
        }
        if (rel === "war") { if (theyPeace) add("接受停战", "", "peace"); else if (iPeace) acts.append(el(`<span class="tip">已请求停战</span>`)); else add("请求停战", "ghost", "peace"); }
      }
      b.append(c);
    });
    return b;
  };
  const wrap = document.createElement("div"); wrap.style.display = "contents"; wrap.append(draw());
  let last = "";
  sheet("外交", wrap, { refresh: () => { const s = G.sim; const k = JSON.stringify(s.rel) + Object.keys(s.offers).join() + s.dev() + s.order.map(p => s.P[p].alive).join(); if (k !== last) { last = k; wrap.innerHTML = ""; wrap.append(draw()); } } });
};

/* ---------- 战报 ---------- */
$("#bLog").onclick = () => {
  G.unread = 0;
  const s = G.sim, mine = s.log.filter(l => l.vis === "all" || l.vis.includes(G.me)).slice(-120).reverse();
  const body = box(`<ul class="log">${mine.map((l, i) => `<li class="${l.kind}" data-i="${i}"><time class="num">${mmss(l.t)}</time><span>${esc(l.text)}</span></li>`).join("") || '<li><span class="tip">还没有消息</span></li>'}</ul>`);
  body.querySelectorAll("li[data-i]").forEach(li => { const l = mine[+li.dataset.i]; if (l.r != null) li.onclick = () => { closeSheets(); G.rd.focus(l.r); }; });
  sheet("战报", body);
};
$("#bMenu").onclick = () => {
  const body = box(`<div class="seg" id="mSnd"><button data-k="music" aria-pressed="${LZAudio.music}">🎵 背景音乐 ${LZAudio.music ? "开" : "关"}</button><button data-k="sfx" aria-pressed="${LZAudio.sfx}">🔊 音效 ${LZAudio.sfx ? "开" : "关"}</button></div><div class="tip">手机开着静音键时可能听不到声音。</div><button class="btn ghost block" id="mCap">回到我的都城</button><button class="btn ghost block" id="mHelp">玩法说明</button><button class="btn ghost block" id="mOut">离开（对局会继续，可以随时回来）</button>`);
  const sh = sheet("菜单", body);
  body.querySelectorAll("#mSnd button").forEach(b => b.onclick = () => { const k = b.dataset.k, on = !LZAudio[k]; k === "music" ? LZAudio.setMusic(on) : LZAudio.setSfx(on); b.setAttribute("aria-pressed", on); b.textContent = (k === "music" ? "🎵 背景音乐 " : "🔊 音效 ") + (on ? "开" : "关"); });
  body.querySelector("#mCap").onclick = () => { sh.close(); const c = G.sim.P[G.me].capital; const own = mineRegions(); G.rd.focus(own.includes(c) ? c : own[0] ?? c); };
  body.querySelector("#mHelp").onclick = () => { sh.close(); openHelp(); };
  body.querySelector("#mOut").onclick = () => { sh.close(); leaveGame(); };
};

/* ---------- 再来一局 ---------- */
async function rematch() {
  const net = G.net, old = G.room, oldCode = G.code, myUnit = (old.players.find(p => p.id === G.me) || {}).unit;
  const bots = old.players.filter(p => p.bot);
  leaveGame();
  const code = await net.createRoom({ len: 25, dev: 5 });
  await net.updateRoom(code, r => {
    const me2 = r.players.find(x => x.id === net.user.uid); if (me2 && myUnit) me2.unit = myUnit;
    for (const b of bots) { const used = r.players.map(p => p.color); r.players.push({ id: "bot" + Math.random().toString(36).slice(2, 8), name: b.name, color: used.includes(b.color) ? LZ.COLORS.find(c => !used.includes(c)) : b.color, bot: true, unit: b.unit }); }
  });
  if (net.mode !== "local") await net.updateRoom(oldCode, r => { r.next = code; }).catch(() => {});
  enterRoom(net, code);
}
async function joinNext() {
  const net = G.net, code = G.room.next, myUnit = (G.room.players.find(p => p.id === G.me) || {}).unit;
  leaveGame();
  await net.joinRoom(code);
  if (myUnit) await net.updateRoom(code, r => { const me2 = r.players.find(x => x.id === net.user.uid); if (me2) me2.unit = myUnit; }).catch(() => {});
  enterRoom(net, code);
}
/* ---------- 电脑玩家（房主代跑） ---------- */
let botSalt = 1;
function runBots() {
  if (!G || !G.host || G.sim.over || !startAt() || simNow() < 1) return;
  const now = performance.now();
  for (const p of G.sim.order) {
    const P = G.sim.P[p]; if (!P.bot || !P.alive) continue;
    if ((G.botNext[p] || 0) > now) continue;
    G.botNext[p] = now + 3500 + Math.random() * 3500;
    const evs = LZBots.decide(G.sim, p, botSalt++);
    evs.forEach(e => G.net.sendEvent(G.code, { by: p, type: e.type, a: e.a }).catch(() => {}));
  }
}

/* ---------- 结束 ---------- */
async function endGame() {
  G.ended = true;
  const s = G.sim, o = s.over, win = o.winners.includes(G.me), myScore = s.score(G.me);
  AU("play", win ? "win" : "lose");
  const flag = "lz.done." + G.code + "." + (G.room.seed || 0);
  let done = false; try { done = !!localStorage.getItem(flag); localStorage.setItem(flag, 1); } catch {}
  if (!done) {
    try { const p = await G.net.profile(); await G.net.saveProfile({ games: (p.games || 0) + 1, wins: (p.wins || 0) + (win ? 1 : 0), xp: (p.xp || 0) + 20 + Math.round(myScore / 5) + (win ? 60 : 0), room: null }); } catch (e) { console.warn(e); }
    if (G.host) G.net.endRoom(G.code, { winners: o.winners, why: o.why }).catch(() => {});
  }
  const body = box(`<div class="end-title" style="color:${win ? "var(--brass)" : "var(--bad)"}">${win ? "称霸苍澜" : "胜败乃兵家常事"}</div>
    <div class="tip" style="text-align:center">${esc(o.why)}</div>
    <table class="rank">${o.ranks.map((r, i) => `<tr><td>${i + 1}. <i style="background:${s.P[r.p].color}"></i>${esc(s.P[r.p].name)}${r.p === G.me ? "（你）" : ""}${o.winners.includes(r.p) ? " 🏆" : ""}</td><td class="num">${r.alive ? r.s : "出局"}</td></tr>`).join("")}</table>
    ${G.host ? `<button class="btn block" id="eAgain">再来一局（同一批人）</button>` : `<button class="btn block" id="eJoin" hidden>房主开了新一局，加入</button><div class="tip" id="eWaitTip">房主点「再来一局」后，这里会出现加入按钮</div>`}
    <button class="btn ghost block" id="eBack">返回首页</button><button class="btn ghost block" id="eStay">留下看地图</button>`);
  const sh = sheet("对局结束", body, { refresh: () => { const j = body.querySelector("#eJoin"); if (j && G.room.next) { j.hidden = false; body.querySelector("#eWaitTip").hidden = true; } } });
  body.querySelector("#eBack").onclick = () => { sh.close(); leaveGame(); };
  body.querySelector("#eStay").onclick = () => sh.close();
  const ag = body.querySelector("#eAgain"); if (ag) ag.onclick = async () => { ag.disabled = true; ag.textContent = "正在开新房间…"; try { await rematch(); } catch (e) { ag.disabled = false; ag.textContent = "再来一局（同一批人）"; toast("开新局失败：" + e.message, "alert"); } };
  const jn = body.querySelector("#eJoin"); if (jn) jn.onclick = async () => { jn.disabled = true; try { await joinNext(); } catch (e) { jn.disabled = false; toast("加入失败：" + e.message, "alert"); } };
}

/* ---------- 说明 ---------- */
function openHelp() {
  sheet("玩法说明", box(`<div class="help">
    <h4>怎样获胜</h4><p>每局 25 分钟，前 5 分钟是发育期。以下任一条件达成即获胜：</p>
    <p>· <b>霸主</b>：占据全图六成以上的领地（两人局要七成，废墟不算；发育期后才开始算），并连续守住 ${LZ.RULES.hegeHold} 秒。一旦有人开始称霸，全图都会收到警报和倒计时。</p>
    <p>· <b>独存</b>：其他玩家都失去了所有领地。</p>
    <p>· <b>同盟统一</b>：所有幸存玩家互为盟友，一起获胜。</p>
    <p>· <b>时间到</b>：按国力排名，第一名获胜。国力 = 每块领地 10 分 + 每 500 居民 1 分 + 每 5 守军 1 分。</p>
    <h4>最后决战</h4><p>最后 3 分钟进入决战：迷雾散尽，全图所有地区和军队对所有人可见，情报实时更新。</p>
    <h4>居民是根本</h4><p>金和粮主要来自居民：人越多产出越多，民心越高产出越足。各地民风不同：<b>富庶</b>多金，<b>丰饶</b>多粮多人，<b>尚武</b>征兵便宜、守城顽强，<b>贫瘠</b>人烟稀少，<b>要塞</b>几乎不产出却易守难攻、扼守要道。征兵会消耗居民。</p>
    <h4>民心</h4><p>民心低于 25 而守军不足时，城池会叛乱独立。粮食耗尽、横征暴敛、屠城、献祭都会伤民心。</p>
    <h4>攻下城池后</h4><p>要决定如何处置百姓：<b>待民如子</b>（花粮赈济，民心高、人口涨、名望升）、<b>军管</b>（不赏不罚）、<b>横征暴敛</b>（立刻搜刮一笔、此后多收金，但百姓逃散、易叛乱）、<b>屠城</b>（劫掠大量金粮，但城池荒芜、天下震动）。</p>
    <h4>名望</h4><p>名望高（≥10）时，邻近敌城里民心低、守军少的百姓会举城来投。名望低（≤−10）时，敌人会拼死守城（守备 ×1.2），你新占的城民心更低。</p>
    <h4>卡牌</h4><p>分四等：凡品、良品、珍品、传说。<b>自动发放</b>：开局 ${DRAW.startCards} 张，之后每 ${DRAW.dealEvery} 秒发一张，${DRAW.pity} 张内保底珍品，不用你操作。<b>市集</b>只卖凡品，而且很贵。想指定拿高级卡，只能上<b>祭坛</b>：献祭一支军队（${SAC.army.troops} 兵）换良品，献祭一城六成居民换珍品，自毁一座城池换传说。</p>
    <h4>特殊兵种</h4><p>开局前每人挑一种。<b>国都只产特殊兵种、不产普通兵</b>：每 ${LZ.ELITE_GROW} 秒自动 +1（上限随人口增长），也可以花钱立刻训练（每次 +${TRAIN.n}，${TRAIN.gold} 金 ${TRAIN.food} 粮 ${TRAIN.pop} 民）。普通兵由其他城池产出和征召。攻下别国国都，就能在那里训练那一国的特殊兵种。出兵时可以选派普通兵或特殊兵。${UNIT_KEYS.map(k => `<br>· <b>${UNITS[k].name}</b>：${UNITS[k].desc}`).join("")}</p>
    <h4>地形与官道</h4><p>城池之间有官道相连，军队沿官道行军，会绕开高山、在桥上过河。山地、森林、沼泽行军较慢，守城更有利。</p>
    <h4>天时</h4><p>每隔两分钟左右会有随机事件：有的天下皆受（丰年、大旱、商路大开、大雾、瘟疫、兽群迁徙、天降祥瑞），有的只落在一位玩家头上（流民、豪杰、金矿、商人、甘霖，或粮仓失火、地方生乱、时疫、盗匪、将领叛逃）。福事多半眷顾最弱的一方，祸事多半找上最强的一方。大雾期间只看得见自家地界里的军队，正好偷袭。</p>
    <h4>发育期</h4><p>开局几分钟不能进攻其他玩家，只能用收益、辅助类卡牌。抓紧打凶兽、扩张、发展人口。</p>
    <h4>迷雾与侦查</h4><p>你只能看清自己的领地。侦查过的地区能看到居民、民风、民心、守军，并且此后经过那里的军队都看得见：可以提前布防、设伏、截杀，或提醒盟友。</p>
    <h4>外交</h4><p>可以结盟（双方同意）、宣战、求和。盟友之间不能互相攻击，可以互派援军，在地图上发预警信号。</p>
    <h4>操作</h4><p>拖动地图移动，双指缩放。点地区看详情，点军队看兵力。地图上的小方块：富、沃、武、瘠、塞、墟 表示民风；黄色问号表示有城池待你处置；红点表示民怨。</p>
  </div>`));
}
