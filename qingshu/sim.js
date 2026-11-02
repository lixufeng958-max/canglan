/* 情书·宫廷传书 — 确定性规则引擎
 * 所有客户端拿同一份「房间设置 + 事件列表」，按顺序重算出完全相同的牌局。
 * 只用整数随机数（mulberry / h2），禁止 Math.random、Date.now。
 * 牌组：4 人及以下用 16 张经典牌（8 种角色）；5–6 人用 21 张扩展牌（多了细作、国公）。 */
(function (root) {
"use strict";
function mulberry(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hstr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function h2(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

const COLORS = ["#E0533F", "#2FA38F", "#E3A72F", "#8B67D6", "#4C8FE0", "#D46FA8"];
/* 十种角色：数字越大越尊贵。n 为经典牌组里几张，nx 为扩展牌组里几张（0 表示该牌组没有这张） */
const CARDS = {
  0: { name: "细作", n: 0, nx: 2, tgt: "none", desc: "没有效果。但轮次结束时，如果你是还没出局的人里唯一打出或弃过细作的，额外得一颗 ❤。" },
  1: { name: "侍卫", n: 5, nx: 6, tgt: "other", guess: true, desc: "指一名玩家并猜他手里的牌（不能猜侍卫）。猜中他就出局。" },
  2: { name: "道士", n: 2, nx: 2, tgt: "other", desc: "偷看一名玩家的手牌。" },
  3: { name: "侯爷", n: 2, nx: 2, tgt: "other", desc: "和一名玩家暗中比牌，数字小的出局。" },
  4: { name: "侍女", n: 2, nx: 2, tgt: "none", desc: "直到你下一回合前，别人不能对你用牌。" },
  5: { name: "太子", n: 2, nx: 2, tgt: "any", desc: "让一名玩家（可以是自己）弃掉手牌、重新摸一张。弃掉公主就出局。" },
  6: { name: "国公", n: 0, nx: 2, tgt: "none", chancellor: true, desc: "从牌库摸 2 张，三张里留 1 张，另外两张放回牌库底。" },
  7: { name: "帝君", n: 1, nx: 1, tgt: "other", desc: "和一名玩家交换手牌。" },
  8: { name: "皇后", n: 1, nx: 1, tgt: "none", desc: "手里同时有太子或帝君时，必须打出皇后。" },
  9: { name: "公主", n: 1, nx: 1, tgt: "none", desc: "情书的收信人。谁弃掉公主，谁就出局。" }
};
const TOKENS = { 2: 7, 3: 5, 4: 4, 5: 3, 6: 3 }; // 赢几轮才算赢
const deckFor = n => { const ext = n >= 5, d = []; for (const v in CARDS) { const k = ext ? CARDS[v].nx : CARDS[v].n; for (let i = 0; i < k; i++) d.push(+v); } return d; };
const countOf = (v, n) => n >= 5 ? CARDS[v].nx : CARDS[v].n;

function Sim(cfg) {
  this.cfg = cfg; this.order = cfg.players.map(p => p.id);
  this.P = {}; cfg.players.forEach((p, i) => { this.P[p.id] = { id: p.id, name: p.name, color: p.color || COLORS[i], bot: !!p.bot, tokens: 0 }; });
  this.nP = this.order.length; this.ext = this.nP >= 5; this.need = TOKENS[this.nP] || 3;
  this.values = Object.keys(CARDS).map(Number).filter(v => countOf(v, this.nP) > 0);
  this.round = 0; this.over = null; this.log = []; this.fx = []; this.applied = new Set(); this.n = 0;
  this.startRound();
}
Sim.prototype.L = function (text, vis, kind) { this.log.push({ n: this.n++, round: this.round, text, vis: vis || "all", kind: kind || "" }); };
Sim.prototype.name = function (p) { return this.P[p] ? this.P[p].name : "?"; };
Sim.prototype.countOf = function (v) { return countOf(v, this.nP); };
/* 发牌：洗牌，扣 1 张（两人局再明放 3 张），每人 1 张；上一轮赢家先手 */
Sim.prototype.startRound = function () {
  this.round++;
  const rnd = mulberry((this.cfg.seed ^ (this.round * 7919)) | 0);
  const deck = deckFor(this.nP);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  this.aside = deck.pop();
  this.faceUp = this.nP === 2 ? [deck.pop(), deck.pop(), deck.pop()] : [];
  this.deck = deck;
  this.S = {}; for (const p of this.order) this.S[p] = { hand: [deck.pop()], out: false, safe: false, disc: [], know: {} };
  this.turn = this.lastWinner && this.order.includes(this.lastWinner) ? this.order.indexOf(this.lastWinner) : (this.round - 1) % this.nP;
  this.phase = "play"; this.roundResult = null; this.winner = null;
  this.L(`第 ${this.round} 轮开始（${deck.length + 1 + this.faceUp.length + this.nP} 张牌），${this.name(this.order[this.turn])}先手`, "all", "phase");
  this.beginTurn();
};
Sim.prototype.cur = function () { return this.order[this.turn]; };
Sim.prototype.alive = function () { return this.order.filter(p => !this.S[p].out); };
Sim.prototype.beginTurn = function () {
  for (let k = 0; k < this.nP; k++) { if (!this.S[this.cur()].out) break; this.turn = (this.turn + 1) % this.nP; }
  const p = this.cur(), s = this.S[p];
  s.safe = false; // 侍女的保护到自己回合开始时结束
  if (this.deck.length) s.hand.push(this.deck.pop());
  this.L(`轮到${this.name(p)}`, "all", "turn");
};
Sim.prototype.endTurn = function () {
  const alive = this.alive();
  if (alive.length <= 1) return this.endRound(alive[0], "最后的幸存者");
  if (!this.deck.length) { // 牌库摸空：所有人亮牌比大小，一样大就一起赢
    const max = Math.max(...alive.map(p => this.S[p].hand[0])), ws = alive.filter(p => this.S[p].hand[0] === max);
    for (const p of alive) this.L(`${this.name(p)}亮出手牌：${CARDS[this.S[p].hand[0]].name}`, "all");
    this.fx.push({ n: this.n, kind: "showdown", round: this.round, hands: Object.fromEntries(alive.map(p => [p, this.S[p].hand[0]])), winners: ws, aside: this.aside });
    return this.endRound(ws, ws.length > 1 ? "牌库摸空，手牌一样大，平局" : "牌库摸空，手牌最大");
  }
  this.turn = (this.turn + 1) % this.nP;
  this.beginTurn();
};
Sim.prototype.endRound = function (w, why) {
  const ws = Array.isArray(w) ? w : w ? [w] : [];
  this.phase = "roundEnd"; this.winner = ws[0] || null; this.winners = ws; this.lastWinner = ws[0] || this.lastWinner;
  for (const q of ws) this.P[q].tokens++;
  if (ws.length) this.L(`❤ ${ws.map(q => this.name(q)).join("、")}赢得这一轮（${why}），情书送达 ${ws.map(q => this.P[q].tokens + "/" + this.need).join("、")}`, "all", "phase");
  // 细作：还在局中的人里唯一用过细作的，额外得一颗
  if (this.ext) { const spies = this.alive().filter(p => this.S[p].disc.includes(0)); if (spies.length === 1) { this.P[spies[0]].tokens++; this.L(`🕵 ${this.name(spies[0])}的细作立功，额外得一颗 ❤（${this.P[spies[0]].tokens}/${this.need}）`, "all", "phase"); } }
  this.roundResult = { w: ws[0] || null, ws, why, aside: this.aside, hands: Object.fromEntries(this.order.map(p => [p, this.S[p].hand.slice()])) };
  this.L(this.aside >= 0 ? `这一轮的暗牌是「${CARDS[this.aside].name}」` : "这一轮的暗牌已被太子摸走", "all", "phase");
  const champ = this.order.filter(p => this.P[p].tokens >= this.need).sort((a, b) => this.P[b].tokens - this.P[a].tokens || (ws.includes(a) ? -1 : 1))[0];
  if (champ) { this.over = { w: champ }; this.phase = "over"; this.L(`👑 ${this.name(champ)}赢得公主的芳心！`, "all", "phase"); }
};
Sim.prototype.knock = function (p, why) { const s = this.S[p]; s.out = true; s.disc.push(...s.hand); s.hand = []; this.L(`✖ ${this.name(p)}出局（${why}）`, "all", "out"); };
/* 可选目标：活着、没被侍女保护、（除太子外）不是自己 */
Sim.prototype.targets = function (p, card) {
  const C = CARDS[card]; if (C.tgt === "none") return [];
  return this.order.filter(q => !this.S[q].out && !this.S[q].safe && (C.tgt === "any" || q !== p));
};
Sim.prototype.mustPlay = function (hand) { return hand.includes(8) && (hand.includes(5) || hand.includes(7)) ? 8 : 0; };
Sim.prototype.guessable = function () { return this.values.filter(v => v !== 1); };

/* ---------- 事件 ---------- */
Sim.prototype.apply = function (ev) {
  if (this.applied.has(ev.id)) return; this.applied.add(ev.id);
  const a = ev.a || {};
  if (ev.type === "next") { if (this.phase === "roundEnd" && !this.over) this.startRound(); return; }
  if (ev.type === "keep") return this.keep(ev.by, +a.card);
  if (ev.type !== "play" || this.phase !== "play" || ev.by !== this.cur()) return;
  const p = ev.by, s = this.S[p], card = +a.card;
  if (!s.hand.includes(card)) return;
  const must = this.mustPlay(s.hand); if (must && card !== must) return;
  const C = CARDS[card], ts = this.targets(p, card);
  let t = a.target != null && ts.includes(a.target) ? a.target : null;
  if (C.tgt !== "none" && ts.length && t == null) return; // 有目标可选就必须选
  s.hand.splice(s.hand.indexOf(card), 1); s.disc.push(card);
  this.L(`${this.name(p)}打出「${C.name}」${t != null ? "→ " + this.name(t) : ""}`, "all", "play");
  const wasOut = Object.fromEntries(this.order.map(q => [q, this.S[q].out])), F = { n: this.n, by: p, card, t, round: this.round };
  if (t == null && C.tgt !== "none") { this.L("没有可以选的目标，这张牌没有效果", "all"); }
  else switch (card) {
    case 0: this.L(`${this.name(p)}埋下了一名细作`, "all"); break;
    case 1: { const g = +a.guess; if (!(this.guessable().includes(g))) { this.L("猜测无效", "all"); break; } F.guess = g; this.L(`${this.name(p)}猜${this.name(t)}拿的是「${CARDS[g].name}」`, "all"); if (this.S[t].hand[0] === g) { F.hit = true; this.knock(t, "被猜中了"); } else { F.note = "没猜中"; this.L("没猜中", "all"); } break; }
    case 2: { const v = this.S[t].hand[0]; s.know[t] = v; F.secret = { [p]: v }; F.note = "偷看了手牌"; this.L(`你看到${this.name(t)}的手牌是「${CARDS[v].name}」`, [p], "secret"); this.L(`${this.name(p)}偷看了${this.name(t)}的手牌`, this.order.filter(q => q !== p)); break; }
    case 3: { const mine = s.hand[0], theirs = this.S[t].hand[0]; s.know[t] = theirs; this.S[t].know[p] = mine; F.secret = { [p]: theirs, [t]: mine }; F.note = mine === theirs ? "比牌平手" : "暗中比牌";
      this.L(`比牌：你「${CARDS[mine].name}」对${this.name(t)}「${CARDS[theirs].name}」`, [p], "secret"); this.L(`比牌：你「${CARDS[theirs].name}」对${this.name(p)}「${CARDS[mine].name}」`, [t], "secret");
      if (mine > theirs) this.knock(t, "比牌输了"); else if (theirs > mine) this.knock(p, "比牌输了"); else this.L("比牌平手，无事发生", "all"); break; }
    case 4: { s.safe = true; F.note = "受到保护，直到下回合"; this.L(`${this.name(p)}受到侍女保护`, "all"); break; }
    case 5: { const v = this.S[t].hand[0]; this.S[t].hand = []; this.S[t].disc.push(v); F.show = v; F.note = `弃掉了「${CARDS[v].name}」`; this.L(`${this.name(t)}弃掉了「${CARDS[v].name}」`, "all");
      if (v === 9) this.knock(t, "弃掉了公主"); else { this.S[t].hand.push(this.deck.length ? this.deck.pop() : this.aside); if (!this.deck.length) this.aside = -1; for (const q of this.order) delete this.S[q].know[t]; } break; }
    case 6: { // 国公：摸 2 张，留 1 张，其余放回牌库底（等玩家决定）
      const got = []; while (got.length < 2 && this.deck.length) got.push(this.deck.pop());
      if (!got.length) { F.note = "牌库空了，无牌可摸"; this.L("牌库空了，国公无牌可摸", "all"); break; }
      F.note = `摸了 ${got.length} 张，挑一张留下`; F.draw = got.length; this.fx.push(F);
      s.hand.push(...got); this.phase = "chancellor"; this.L(`${this.name(p)}摸了 ${got.length} 张，正在挑选留下哪张`, "all");
      for (const q of this.order) delete this.S[q].know[p];
      return; // 这一回合还没结束，等 keep 事件
    }
    case 7: { const mine = s.hand[0], theirs = this.S[t].hand[0]; s.hand = [theirs]; this.S[t].hand = [mine]; s.know[t] = mine; this.S[t].know[p] = theirs; F.secret = { [p]: theirs, [t]: mine }; F.note = "交换了手牌"; this.L(`${this.name(p)}和${this.name(t)}交换了手牌`, "all"); this.L(`你换到了「${CARDS[theirs].name}」`, [p], "secret"); this.L(`你换到了「${CARDS[mine].name}」`, [t], "secret"); break; }
    case 0: F.note = "埋下细作"; break;
    case 8: break;
    case 9: this.knock(p, "弃掉了公主"); break;
  }
  if (card === 0 && t == null) F.note = "埋下细作";
  F.knocked = this.order.filter(q => this.S[q].out && !wasOut[q]);
  if (card !== 6 || F.draw == null) this.fx.push(F);
  if (!s.out) delete s.know[p];
  this.endTurn();
};
// 国公挑牌：留下 card，其余按手牌顺序放回牌库底
Sim.prototype.keep = function (p, card) {
  if (this.phase !== "chancellor" || p !== this.cur()) return;
  const s = this.S[p]; if (!s.hand.includes(card)) return;
  s.hand.splice(s.hand.indexOf(card), 1);
  const back = s.hand.slice(); s.hand = [card];
  for (const v of back) this.deck.unshift(v); // 放到牌库底
  this.L(`${this.name(p)}留下一张，把 ${back.length} 张放回了牌库底`, "all");
  this.phase = "play"; this.endTurn();
};
Sim.prototype.run = function (events) { for (const e of events) this.apply(e); };

/* ---------- 电脑 ---------- */
function botDecide(sim, pid, salt) {
  if (sim.cur() !== pid) return null;
  const s = sim.S[pid], hand = s.hand.slice(), rnd = k => h2(sim.n, salt * 31 + k, sim.cfg.seed ^ hstr(pid));
  if (sim.phase === "chancellor") { const keep = hand.includes(9) ? 9 : Math.max(...hand); return { type: "keep", a: { card: keep } }; }
  if (sim.phase !== "play") return null;
  const must = sim.mustPlay(hand); if (must) return { type: "play", a: { card: 8 } };
  // 已经公开的牌：所有弃牌 + 两人局明牌 + 自己手里的
  const seen = {}; for (const q of sim.order) for (const v of sim.S[q].disc) seen[v] = (seen[v] || 0) + 1; for (const v of sim.faceUp) seen[v] = (seen[v] || 0) + 1; for (const v of hand) seen[v] = (seen[v] || 0) + 1;
  const left = v => sim.countOf(v) - (seen[v] || 0);
  const pick = (arr, k) => arr[Math.floor(rnd(k) * arr.length)];
  const other = v => hand.find(x => x !== v);
  // 决定打哪张：绝不打公主；皇后能留就留；小牌优先打
  let card = hand.includes(9) ? hand.find(v => v !== 9) : hand.slice().sort((a, b) => a - b)[0];
  if (hand.includes(8) && hand.some(v => v !== 8 && v <= 4)) card = hand.find(v => v !== 8 && v <= 4);
  // 侯爷：只有自己另一张够大才比
  if (card === 3 && other(3) != null && other(3) < 5 && other(3) !== 9) card = other(3);
  // 国公：手里另一张很小时值得换换
  if (hand.includes(6) && other(6) != null && other(6) <= 3 && sim.deck.length >= 2) card = 6;
  const ts = sim.targets(pid, card);
  const a = { card };
  if (CARDS[card].tgt !== "none" && ts.length) {
    const known = ts.filter(q => q !== pid && s.know[q] != null);
    if (card === 1) { const kq = known.find(q => s.know[q] !== 1); if (kq) { a.target = kq; a.guess = s.know[kq]; } else { a.target = pick(ts, 1); const gs = sim.guessable(); let best = gs[0], bl = -1; for (const v of gs) if (left(v) > bl) { bl = left(v); best = v; } a.guess = rnd(2) < .35 ? pick(gs.filter(v => left(v) > 0), 3) || best : best; } }
    else if (card === 3) { const kq = known.find(q => s.know[q] < other(3)); a.target = kq || pick(ts, 4); }
    else if (card === 5) { const kq = known.find(q => s.know[q] === 9); a.target = kq || (other(5) <= 3 && ts.includes(pid) && rnd(5) < .3 ? pid : pick(ts.filter(q => q !== pid).length ? ts.filter(q => q !== pid) : ts, 6)); }
    else if (card === 7) { const kq = known.find(q => s.know[q] > other(7)); a.target = kq || pick(ts, 7); }
    else a.target = pick(ts, 8);
  }
  return { type: "play", a };
}

root.QS = { Sim, CARDS, TOKENS, COLORS, deckFor, countOf, botDecide, hstr, h2, mulberry };
})(typeof window !== "undefined" ? window : globalThis);
