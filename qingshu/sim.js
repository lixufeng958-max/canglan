/* 情书·宫廷传书 — 确定性规则引擎
 * 所有客户端拿同一份「房间设置 + 事件列表」，按顺序重算出完全相同的牌局。
 * 只用整数随机数（mulberry / h2），禁止 Math.random、Date.now。 */
(function (root) {
"use strict";
function mulberry(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hstr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function h2(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

const COLORS = ["#E0533F", "#2FA38F", "#E3A72F", "#8B67D6", "#4C8FE0", "#D46FA8"];
/* 八种角色：数字越大越尊贵。n 为每种几张 */
const CARDS = {
  1: { name: "侍卫", n: 5, tgt: "other", guess: true, desc: "指一名玩家并猜他手里的牌（不能猜侍卫）。猜中他就出局。" },
  2: { name: "道士", n: 2, tgt: "other", desc: "偷看一名玩家的手牌。" },
  3: { name: "侯爷", n: 2, tgt: "other", desc: "和一名玩家暗中比牌，数字小的出局。" },
  4: { name: "侍女", n: 2, tgt: "none", desc: "直到你下一回合前，别人不能对你用牌。" },
  5: { name: "太子", n: 2, tgt: "any", desc: "让一名玩家（可以是自己）弃掉手牌、重新摸一张。弃掉公主就出局。" },
  6: { name: "帝君", n: 1, tgt: "other", desc: "和一名玩家交换手牌。" },
  7: { name: "皇后", n: 1, tgt: "none", desc: "手里同时有太子或帝君时，必须打出皇后。" },
  8: { name: "公主", n: 1, tgt: "none", desc: "情书的收信人。谁弃掉公主，谁就出局。" }
};
const TOKENS = { 2: 7, 3: 5, 4: 4 }; // 赢几轮才算赢
const DECK = []; for (const v in CARDS) for (let i = 0; i < CARDS[v].n; i++) DECK.push(+v);

function Sim(cfg) {
  this.cfg = cfg; this.order = cfg.players.map(p => p.id);
  this.P = {}; cfg.players.forEach((p, i) => { this.P[p.id] = { id: p.id, name: p.name, color: p.color || COLORS[i], bot: !!p.bot, tokens: 0 }; });
  this.need = TOKENS[this.order.length] || 4;
  this.round = 0; this.over = null; this.log = []; this.applied = new Set(); this.n = 0;
  this.startRound();
}
Sim.prototype.rnd = function (k) { return h2(this.round, k, this.cfg.seed); };
Sim.prototype.L = function (text, vis, kind) { this.log.push({ n: this.n++, round: this.round, text, vis: vis || "all", kind: kind || "" }); };
Sim.prototype.name = function (p) { return this.P[p] ? this.P[p].name : "?"; };
/* 发牌：洗 16 张，扣 1 张（两人局再明放 3 张），每人 1 张；上一轮赢家先手 */
Sim.prototype.startRound = function () {
  this.round++;
  const rnd = mulberry((this.cfg.seed ^ (this.round * 7919)) | 0);
  const deck = DECK.slice();
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  this.aside = deck.pop();
  this.faceUp = this.order.length === 2 ? [deck.pop(), deck.pop(), deck.pop()] : [];
  this.deck = deck;
  this.S = {}; for (const p of this.order) this.S[p] = { hand: [deck.pop()], out: false, safe: false, disc: [], know: {} };
  this.turn = this.lastWinner && this.order.includes(this.lastWinner) ? this.order.indexOf(this.lastWinner) : (this.round - 1) % this.order.length;
  this.phase = "play"; this.roundResult = null; this.winner = null;
  this.L(`第 ${this.round} 轮开始，${this.name(this.order[this.turn])}先手`, "all", "phase");
  this.beginTurn();
};
Sim.prototype.cur = function () { return this.order[this.turn]; };
Sim.prototype.alive = function () { return this.order.filter(p => !this.S[p].out); };
Sim.prototype.beginTurn = function () {
  // 跳过出局的人
  for (let k = 0; k < this.order.length; k++) { if (!this.S[this.cur()].out) break; this.turn = (this.turn + 1) % this.order.length; }
  const p = this.cur(), s = this.S[p];
  s.safe = false; // 侍女的保护到自己回合开始时结束
  if (this.deck.length) s.hand.push(this.deck.pop());
  this.L(`轮到${this.name(p)}`, "all", "turn");
};
Sim.prototype.endTurn = function () {
  const alive = this.alive();
  if (alive.length <= 1) return this.endRound(alive[0], "最后的幸存者");
  if (!this.deck.length) { // 牌库摸空：比手牌，大的赢；平手比弃牌总和
    let best = null;
    for (const p of alive) { const v = this.S[p].hand[0], sum = this.S[p].disc.reduce((a, b) => a + b, 0); if (!best || v > best.v || (v === best.v && sum > best.sum)) best = { p, v, sum }; }
    for (const p of alive) this.L(`${this.name(p)}亮出手牌：${CARDS[this.S[p].hand[0]].name}`, "all");
    return this.endRound(best.p, "牌库摸空，手牌最大");
  }
  this.turn = (this.turn + 1) % this.order.length;
  this.beginTurn();
};
Sim.prototype.endRound = function (w, why) {
  this.phase = "roundEnd"; this.winner = w; this.lastWinner = w;
  if (w) { this.P[w].tokens++; this.L(`❤ ${this.name(w)}赢得这一轮（${why}），情书送达 ${this.P[w].tokens}/${this.need}`, "all", "phase"); }
  this.roundResult = { w, why, hands: Object.fromEntries(this.order.map(p => [p, this.S[p].hand.slice()])) };
  if (w && this.P[w].tokens >= this.need) { this.over = { w }; this.phase = "over"; this.L(`👑 ${this.name(w)}赢得公主的芳心！`, "all", "phase"); }
};
Sim.prototype.knock = function (p, why) { const s = this.S[p]; s.out = true; s.disc.push(...s.hand); s.hand = []; this.L(`✖ ${this.name(p)}出局（${why}）`, "all", "out"); };
/* 可选目标：活着、没被侍女保护、（除太子外）不是自己 */
Sim.prototype.targets = function (p, card) {
  const C = CARDS[card]; if (C.tgt === "none") return [];
  return this.order.filter(q => !this.S[q].out && !this.S[q].safe && (C.tgt === "any" || q !== p));
};
Sim.prototype.mustPlay = function (hand) { return hand.includes(7) && (hand.includes(5) || hand.includes(6)) ? 7 : 0; };

/* ---------- 事件 ---------- */
Sim.prototype.apply = function (ev) {
  if (this.applied.has(ev.id)) return; this.applied.add(ev.id);
  const a = ev.a || {};
  if (ev.type === "next") { if (this.phase === "roundEnd" && !this.over) this.startRound(); return; }
  if (ev.type !== "play" || this.phase !== "play" || ev.by !== this.cur()) return;
  const p = ev.by, s = this.S[p], card = +a.card;
  if (!s.hand.includes(card)) return;
  const must = this.mustPlay(s.hand); if (must && card !== must) return;
  const C = CARDS[card], ts = this.targets(p, card);
  let t = a.target != null && ts.includes(a.target) ? a.target : null;
  if (C.tgt !== "none" && ts.length && t == null) return; // 有目标可选就必须选
  s.hand.splice(s.hand.indexOf(card), 1); s.disc.push(card);
  this.L(`${this.name(p)}打出「${C.name}」${t != null ? "→ " + this.name(t) : ""}`, "all", "play");
  if (t == null && C.tgt !== "none") { this.L("没有可以选的目标，这张牌没有效果", "all"); }
  else switch (card) {
    case 1: { const g = +a.guess; if (!(g >= 2 && g <= 8)) { this.L("猜测无效", "all"); break; } this.L(`${this.name(p)}猜${this.name(t)}拿的是「${CARDS[g].name}」`, "all"); if (this.S[t].hand[0] === g) this.knock(t, "被猜中了"); else this.L("没猜中", "all"); break; }
    case 2: { const v = this.S[t].hand[0]; s.know[t] = v; this.L(`你看到${this.name(t)}的手牌是「${CARDS[v].name}」`, [p], "secret"); this.L(`${this.name(p)}偷看了${this.name(t)}的手牌`, this.order.filter(q => q !== p)); break; }
    case 3: { const mine = s.hand[0], theirs = this.S[t].hand[0]; s.know[t] = theirs; this.S[t].know[p] = mine;
      this.L(`比牌：你「${CARDS[mine].name}」对${this.name(t)}「${CARDS[theirs].name}」`, [p], "secret"); this.L(`比牌：你「${CARDS[theirs].name}」对${this.name(p)}「${CARDS[mine].name}」`, [t], "secret");
      if (mine > theirs) this.knock(t, "比牌输了"); else if (theirs > mine) this.knock(p, "比牌输了"); else this.L("比牌平手，无事发生", "all"); break; }
    case 4: { s.safe = true; this.L(`${this.name(p)}受到侍女保护`, "all"); break; }
    case 5: { const v = this.S[t].hand[0]; this.S[t].hand = []; this.S[t].disc.push(v); this.L(`${this.name(t)}弃掉了「${CARDS[v].name}」`, "all");
      if (v === 8) this.knock(t, "弃掉了公主"); else { this.S[t].hand.push(this.deck.length ? this.deck.pop() : this.aside); if (!this.deck.length) this.aside = -1; for (const q of this.order) delete this.S[q].know[t]; } break; }
    case 6: { const mine = s.hand[0], theirs = this.S[t].hand[0]; s.hand = [theirs]; this.S[t].hand = [mine]; s.know[t] = mine; this.S[t].know[p] = theirs; this.L(`${this.name(p)}和${this.name(t)}交换了手牌`, "all"); this.L(`你换到了「${CARDS[theirs].name}」`, [p], "secret"); this.L(`你换到了「${CARDS[mine].name}」`, [t], "secret"); break; }
    case 7: break;
    case 8: this.knock(p, "弃掉了公主"); break;
  }
  if (!s.out) delete s.know[p];
  this.endTurn();
};
Sim.prototype.run = function (events) { for (const e of events) this.apply(e); };

/* ---------- 电脑 ---------- */
function botDecide(sim, pid, salt) {
  if (sim.phase !== "play" || sim.cur() !== pid) return null;
  const s = sim.S[pid], hand = s.hand.slice(), rnd = k => h2(sim.n, salt * 31 + k, sim.cfg.seed ^ hstr(pid));
  const must = sim.mustPlay(hand); if (must) return { card: 7 };
  // 已经公开的牌：所有弃牌 + 两人局明牌
  const seen = {}; for (const q of sim.order) for (const v of sim.S[q].disc) seen[v] = (seen[v] || 0) + 1; for (const v of sim.faceUp) seen[v] = (seen[v] || 0) + 1; for (const v of hand) seen[v] = (seen[v] || 0) + 1;
  const left = v => CARDS[v].n - (seen[v] || 0);
  const others = sim.order.filter(q => q !== pid && !sim.S[q].out);
  const pick = (arr, k) => arr[Math.floor(rnd(k) * arr.length)];
  // 决定打哪张：绝不打公主；皇后能留就留；小牌优先打
  let card = hand.includes(8) ? hand.find(v => v !== 8) : hand.slice().sort((a, b) => a - b)[0];
  if (hand.includes(7) && hand.some(v => v !== 7 && v <= 4)) card = hand.find(v => v !== 7 && v <= 4);
  // 侯爷：只有自己另一张够大才比
  if (card === 3 && hand.some(v => v !== 3) && hand.find(v => v !== 3) < 5 && hand.some(v => v !== 3 && v !== 8)) card = hand.find(v => v !== 3 && v !== 8) || card;
  const ts = sim.targets(pid, card);
  const out = { card };
  if (CARDS[card].tgt !== "none" && ts.length) {
    // 知道对方手牌就专门打他
    const known = ts.filter(q => q !== pid && s.know[q] != null);
    if (card === 1) { const kq = known.find(q => s.know[q] !== 1); if (kq) { out.target = kq; out.guess = s.know[kq]; } else { out.target = pick(ts, 1); let best = 2, bl = -1; for (let v = 2; v <= 8; v++) if (left(v) > bl) { bl = left(v); best = v; } out.guess = rnd(2) < .35 ? pick([2, 3, 4, 5, 6, 7, 8].filter(v => left(v) > 0), 3) || best : best; } }
    else if (card === 3) { const kq = known.find(q => s.know[q] < hand.find(v => v !== 3)); out.target = kq || pick(ts, 4); }
    else if (card === 5) { const kq = known.find(q => s.know[q] === 8); out.target = kq || (hand.find(v => v !== 5) <= 3 && ts.includes(pid) && rnd(5) < .3 ? pid : pick(ts.filter(q => q !== pid).length ? ts.filter(q => q !== pid) : ts, 6)); }
    else if (card === 6) { const kq = known.find(q => s.know[q] > hand.find(v => v !== 6)); out.target = kq || pick(ts, 7); }
    else out.target = pick(ts, 8);
  }
  return out;
}

root.QS = { Sim, CARDS, DECK, TOKENS, COLORS, botDecide, hstr, h2, mulberry };
})(typeof window !== "undefined" ? window : globalThis);
