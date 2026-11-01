/* 情书·宫廷传书 — 界面与流程（登录、首页、房间、牌局） */
"use strict";
const { Sim, CARDS, TOKENS, botDecide } = window.QS;
const $ = s => document.querySelector(s);
const el = h => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let ONLINE = null, LOCAL = new QSNet.LocalNet(), NET = null, G = null;
const show = id => document.querySelectorAll(".screen").forEach(s => s.hidden = s.id !== id);
function toast(text, kind = "") { const box = $("#toasts"); const t = el(`<div class="toast ${kind}"></div>`); t.textContent = text; box.prepend(t); while (box.children.length > 3) box.lastChild.remove(); setTimeout(() => t.remove(), 3800); }

/* ================= 启动 / 登录（和苍澜共用同一个账号） ================= */
(async function boot() {
  await LOCAL.init();
  if (window.FIREBASE_CONFIG) { try { ONLINE = new QSNet.FireNet(window.FIREBASE_CONFIG); await ONLINE.init(); } catch (e) { console.error(e); ONLINE = null; } }
  if (ONLINE) ONLINE.onAuth(u => { if (G) return; if (u) openHome(); else openAuth(); }); else openAuth();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("./sw.js").catch(() => {});
})();
let authMode = "in";
function openAuth() { show("sAuth"); $("#authOnline").hidden = !ONLINE; $("#authOffline").hidden = !!ONLINE; }
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
  $("#rDeck").textContent = room.players.length >= 5 ? "21 张扩展牌（多了间谍、大臣）" : "16 张经典牌";
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
  document.querySelectorAll(".scrim").forEach(s => s.remove()); $("#toasts").innerHTML = "";
  G = null; if (!silent) ONLINE ? openHome() : openAuth();
}
/* 事件按服务器时间排好序，每次都从头重算整局（牌局很短，几百条事件瞬间算完） */
function onEvents(list) {
  if (!G) return;
  const evs = list.slice().sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1));
  const sim = new Sim(G.cfg); sim.run(evs);
  G.events = evs; G.sim = sim; G.pick = null;
  render(); pumpLog();
  if (sim.over && !G.ended) endGame();
}
function send(type, a) { if (!G || G.sim.over) return; G.net.sendEvent(G.code, { by: G.me, type, a: a || {} }).catch(e => toast("发送失败：" + e.message, "bad")); }
// 房主代电脑出牌；轮次结束后 4 秒自动开下一轮
function tickBots() {
  if (!G || !G.host || G.sim.over) return;
  const s = G.sim, now = Date.now();
  if (s.phase === "roundEnd") { if (!G.roundEndAt) G.roundEndAt = now; if (now - G.roundEndAt > 4500) { G.roundEndAt = 0; send("next"); } return; }
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
    if (l.kind === "secret") toast(l.text, "secret"); else if (l.kind === "out" || l.kind === "phase") toast(l.text, l.kind === "out" ? "bad" : "good"); else if (l.kind !== "play") toast(l.text);
  }
}

/* ---------- 画面 ---------- */
const cardHTML = (v, cls = "") => { const C = CARDS[v]; return `<div class="card c${v} ${cls}"><span class="num">${v}</span><div class="art">${QSArt[v]}</div><b>${C.name}</b><small>${G && G.sim ? G.sim.countOf(v) : (C.n || C.nx)} 张</small></div>`; };
const backHTML = (cls = "") => `<div class="card back ${cls}"><div class="seal">情<br>书</div></div>`;
function render() {
  if (!G) return;
  const s = G.sim, me = G.me, S = s.S, mine = S[me], myTurn = s.phase === "play" && s.cur() === me, keeping = s.phase === "chancellor" && s.cur() === me;
  // 对手一排
  const ops = $("#opps"); ops.innerHTML = "";
  for (const p of s.order) {
    if (p === me) continue;
    const t = S[p], P = s.P[p], cur = (s.phase === "play" || s.phase === "chancellor") && s.cur() === p;
    const last = t.disc.length ? t.disc[t.disc.length - 1] : null;
    const known = mine.know[p] != null && !t.out ? mine.know[p] : null;
    const d = el(`<div class="opp ${t.out ? "out" : ""} ${cur ? "cur" : ""} ${t.safe ? "safe" : ""}" data-p="${p}">
      <div class="who"><i style="background:${P.color}"></i><b></b><span class="hearts">${"❤".repeat(P.tokens)}<span class="dim">${"♡".repeat(Math.max(0, s.need - P.tokens))}</span></span></div>
      <div class="hand">${t.out ? `<div class="card mini gone">出局</div>` : known != null ? cardHTML(known, "mini known") : backHTML("mini")}</div>
      <div class="disc">${last != null ? cardHTML(last, "mini") : `<div class="card mini empty">弃牌</div>`}<small>${t.disc.length ? "弃 " + t.disc.map(v => CARDS[v].name).join("、") : "还没出牌"}</small></div>
      ${t.safe ? `<span class="badge">侍女保护</span>` : ""}${cur ? `<span class="badge turn">思考中…</span>` : ""}</div>`);
    d.querySelector("b").textContent = P.name;
    ops.append(d);
  }
  // 桌面
  $("#deckN").textContent = s.deck.length; $("#round").textContent = `第 ${s.round} 轮`;
  $("#faceUp").innerHTML = s.faceUp.map(v => cardHTML(v, "mini")).join("");
  $("#faceUpBox").hidden = !s.faceUp.length;
  $("#recent").innerHTML = s.log.filter(l => (l.vis === "all" || l.vis.includes(me)) && l.kind !== "turn").slice(-5).map(l => `<li class="${l.kind}">${esc(l.text)}</li>`).join("");
  $("#me-hearts").innerHTML = "❤".repeat(s.P[me].tokens) + `<span class="dim">${"♡".repeat(Math.max(0, s.need - s.P[me].tokens))}</span>`;
  $("#me-name").textContent = s.P[me].name; $("#me-flag").style.background = s.P[me].color;
  $("#me-disc").innerHTML = mine.disc.length ? "弃牌：" + mine.disc.map(v => `<span class="c${v}">${CARDS[v].name}</span>`).join("、") : "";
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
  else if (keeping) st.textContent = "大臣：点一张要留下的牌，其余两张放回牌库底";
  else if (s.phase === "chancellor") st.textContent = `${s.P[s.cur()].name}正在挑牌…`;
  else if (myTurn) st.textContent = must ? "你必须打出皇后" : "轮到你了：点一张牌打出";
  else st.textContent = `等待${s.P[s.cur()].name}出牌…`;
  $("#hand").classList.toggle("myturn", (myTurn || keeping) && !mine.out);
  $("#deckMode").textContent = s.ext ? "扩展 21 张" : "经典 16 张";
  // 轮次结算
  if (s.phase === "roundEnd" && !s.over && G.shownRound !== s.round) { G.shownRound = s.round; showRound(); }
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
  const body = el(`<div><div class="rwin">❤ ${esc(s.P[r.w].name)} 赢了这一轮</div><p class="note" style="text-align:center">${esc(r.why)}</p>
    <div class="reveal">${s.order.map(p => `<div class="rv ${s.S[p].out ? "out" : ""}"><i style="background:${s.P[p].color}"></i><b>${esc(s.P[p].name)}</b>${r.hands[p].length ? cardHTML(r.hands[p][0], "mini") : `<div class="card mini gone">出局</div>`}<span class="hearts">${"❤".repeat(s.P[p].tokens)}</span></div>`).join("")}</div>
    <p class="note" style="text-align:center">先集满 ${s.need} 颗心的人获胜。下一轮几秒后自动开始。</p></div>`);
  const sh = sheet("本轮结束", body); setTimeout(() => sh.close(), 4200);
}
async function endGame() {
  G.ended = true; const s = G.sim, win = s.over.w === G.me;
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
  const body = el(`<div><button class="btn ghost block" id="mCards">八种角色</button><button class="btn ghost block" id="mTut">新手教程（在这局里边玩边学）</button><button class="btn ghost block" id="mHelp">玩法说明</button><button class="btn ghost block" id="mOut">离开（对局会继续，可以随时回来）</button></div>`);
  const sh = sheet("菜单", body);
  body.querySelector("#mCards").onclick = () => { sh.close(); openCards(); }; body.querySelector("#mTut").onclick = () => { sh.close(); tutStart(); };
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
  const body = el(`<div class="gallery"><p class="note">${s ? (s.ext ? "这局是 5–6 人的扩展牌组：21 张、10 种角色" : "这局是 4 人以下的经典牌组：16 张、8 种角色") : "4 人及以下用 16 张经典牌（8 种角色）；5–6 人用 21 张扩展牌，多了间谍和大臣。"}</p>
    ${vals.map(v => `<div class="gitem${s ? "" : (CARDS[v].n ? "" : " ext")}">${cardHTML(v)}<div><b class="c${v}">${v} · ${CARDS[v].name}</b>${!s && !CARDS[v].n ? '<span class="xtag">扩展牌组</span>' : ""}<p>${esc(CARDS[v].desc)}</p><small>${s ? `一共 ${s.countOf(v)} 张，已经打出 ${seen[v] || 0} 张` : `经典 ${CARDS[v].n} 张 · 扩展 ${CARDS[v].nx} 张`}</small></div></div>`).join("")}
    <p class="note">数字越大越尊贵：牌库摸空时，手里数字大的赢。${s ? "「已经打出」把别人弃掉的牌都算上了，用来推测剩下什么。" : ""}</p></div>`);
  sheet("八种角色", body);
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
  { text: "打出的牌进弃牌堆，效果马上生效。几条规矩：<b>侍女</b>保护你到下回合；手里有太子或帝君时<b>必须打皇后</b>；<b>公主</b>打出去你就出局。5–6 人局还有<b>间谍</b>（轮末可能多得一颗 ❤）和<b>大臣</b>（摸两张挑一张）。", target: null },
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
    <p>你是王宫里的追求者，要把情书送到公主手里。<b>每人手里只有 1 张牌</b>。4 人及以下用 16 张经典牌（8 种角色）；5–6 人自动换成 21 张扩展牌（多了间谍和大臣，侍卫 6 张）。</p>
    <h4>怎么玩</h4><p>轮到你时先摸 1 张（手里 2 张），再打出 1 张，照着牌上的效果做。被淘汰就本轮出局。牌库摸完时，还没出局的人比手牌，<b>数字大的赢</b>；或者只剩一个人时他赢。赢一轮得一颗 ❤，两人局先集 7 颗、三人局 5 颗、四人局 4 颗、五六人局 3 颗的人获胜。</p>
    <h4>十种牌</h4>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => `<div class="hrow"><span class="hn c${v}">${v}</span><b>${CARDS[v].name}</b><span>×${CARDS[v].n}${CARDS[v].nx !== CARDS[v].n ? "/" + CARDS[v].nx : ""}</span><p>${esc(CARDS[v].desc)}</p></div>`).join("")}
    <h4>小窍门</h4><p>记住别人弃过什么牌，剩下的牌就好猜了。侍女保护期间别人碰不了你。手里有太子或帝君时必须先打皇后，这常常会暴露你。公主永远别打出去。</p>
    <h4>联机</h4><p>登录后创建房间，把 4 位房间号发给朋友，他们在首页输入就能加入。和苍澜·乱战用同一个账号。</p>
  </div>`));
}
