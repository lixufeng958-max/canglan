/* 情书·宫廷传书 — 确定性规则引擎
 * 所有客户端拿同一份「房间设置 + 事件列表」，按顺序重算出完全相同的牌局。
 * 只用整数随机数（mulberry / h2），禁止 Math.random、Date.now。
 * 牌组：4 人及以下用 17 张经典牌（9 种角色）；5–6 人用 22 张扩展牌（多了细作、国公）。 */
(function (root) {
"use strict";
function mulberry(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hstr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function h2(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

const COLORS = ["#E0533F", "#2FA38F", "#E3A72F", "#8B67D6", "#4C8FE0", "#D46FA8"];
/* 十一种角色：数字越大越尊贵。n 为经典牌组里几张，nx 为扩展牌组里几张（0 表示该牌组没有这张） */
const CARDS = {
  0: { name: "细作", n: 0, nx: 2, tgt: "none", desc: "没有效果。但轮次结束时，如果你是还没出局的人里唯一打出或弃过细作的，额外得一颗 ❤。" },
  1: { name: "侍卫", n: 5, nx: 6, tgt: "other", guess: true, desc: "指一名玩家并猜他手里的牌（不能猜侍卫）。猜中他就出局。" },
  2: { name: "侍女", n: 2, nx: 2, tgt: "none", desc: "直到你下一回合前，别人不能对你用牌。" },
  3: { name: "天师", n: 2, nx: 2, tgt: "other", desc: "偷看一名玩家的手牌。" },
  4: { name: "侯爷", n: 2, nx: 2, tgt: "other", desc: "和一名玩家暗中比牌，数字小的出局。" },
  5: { name: "国公", n: 0, nx: 2, tgt: "none", chancellor: true, desc: "从牌库摸 2 张，三张里留 1 张，另外两张放回牌库底。" },
  6: { name: "亲王", n: 2, nx: 2, tgt: "other", desc: "和一名玩家暗中比牌，数字大的出局（和侯爷正好相反）。" },
  7: { name: "太子", n: 1, nx: 1, tgt: "any", desc: "让一名玩家（可以是自己）弃掉手牌、重新摸一张。弃掉公主就出局。" },
  8: { name: "皇后", n: 1, nx: 1, tgt: "none", desc: "手里同时有太子或帝君时，必须打出皇后。" },
  9: { name: "帝君", n: 1, nx: 1, tgt: "other", desc: "和一名玩家交换手牌。" },
  10: { name: "公主", n: 1, nx: 1, tgt: "none", desc: "情书的收信人。谁弃掉公主，谁就出局。" }
};
/* 牌值的名字：规则里一律用名字，别直接写数字 */
const K = { SPY: 0, GUARD: 1, MAID: 2, PRIEST: 3, BARON: 4, DUKE: 5, WANG: 6, PRINCE: 7, QUEEN: 8, KING: 9, PRINCESS: 10 };
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
  if (this.ext) { const spies = this.alive().filter(p => this.S[p].disc.includes(K.SPY)); if (spies.length === 1) { this.P[spies[0]].tokens++; this.L(`🕵 ${this.name(spies[0])}的细作立功，额外得一颗 ❤（${this.P[spies[0]].tokens}/${this.need}）`, "all", "phase"); } }
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
Sim.prototype.mustPlay = function (hand) { return hand.includes(K.QUEEN) && (hand.includes(K.PRINCE) || hand.includes(K.KING)) ? K.QUEEN : 0; };
Sim.prototype.guessable = function () { return this.values.filter(v => v !== K.GUARD); };

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
  // 别人记得 p 手里是这张牌，而 p 正好把它打掉了：剩下的是新摸的牌，变回未知
  for (const q of this.order) if (q !== p && this.S[q].know[p] === card) delete this.S[q].know[p];
  this.L(`${this.name(p)}打出「${C.name}」${t != null ? "→ " + this.name(t) : ""}`, "all", "play");
  const wasOut = Object.fromEntries(this.order.map(q => [q, this.S[q].out])), F = { n: this.n, by: p, card, t, round: this.round };
  if (t == null && C.tgt !== "none") { this.L("没有可以选的目标，这张牌没有效果", "all"); }
  else switch (card) {
    case K.SPY: this.L(`${this.name(p)}埋下了一名细作`, "all"); break;
    case K.GUARD: { const g = +a.guess; if (!(this.guessable().includes(g))) { this.L("猜测无效", "all"); break; } F.guess = g; this.L(`${this.name(p)}猜${this.name(t)}拿的是「${CARDS[g].name}」`, "all"); if (this.S[t].hand[0] === g) { F.hit = true; this.knock(t, "被猜中了"); } else { F.note = "没猜中"; this.L("没猜中", "all"); } break; }
    case K.PRIEST: { const v = this.S[t].hand[0]; s.know[t] = v; F.secret = { [p]: v }; F.note = "偷看了手牌"; this.L(`你看到${this.name(t)}的手牌是「${CARDS[v].name}」`, [p], "secret"); this.L(`${this.name(p)}偷看了${this.name(t)}的手牌`, this.order.filter(q => q !== p)); break; }
    case K.BARON: case K.WANG: { // 侯爷：小的出局；亲王：大的出局
      const mine = s.hand[0], theirs = this.S[t].hand[0], big = card === K.WANG, why = big ? "比牌时牌更大" : "比牌输了";
      s.know[t] = theirs; this.S[t].know[p] = mine; F.secret = { [p]: theirs, [t]: mine }; F.note = mine === theirs ? "比牌平手" : "暗中比牌";
      this.L(`比牌：你「${CARDS[mine].name}」对${this.name(t)}「${CARDS[theirs].name}」`, [p], "secret"); this.L(`比牌：你「${CARDS[theirs].name}」对${this.name(p)}「${CARDS[mine].name}」`, [t], "secret");
      if (mine === theirs) this.L("比牌平手，无事发生", "all"); else if ((mine > theirs) === big) this.knock(p, why); else this.knock(t, why); break; }
    case K.MAID: { s.safe = true; F.note = "受到保护，直到下回合"; this.L(`${this.name(p)}受到侍女保护`, "all"); break; }
    case K.PRINCE: { const v = this.S[t].hand[0]; this.S[t].hand = []; this.S[t].disc.push(v); F.show = v; F.note = `弃掉了「${CARDS[v].name}」`; this.L(`${this.name(t)}弃掉了「${CARDS[v].name}」`, "all");
      if (v === K.PRINCESS) this.knock(t, "弃掉了公主"); else { this.S[t].hand.push(this.deck.length ? this.deck.pop() : this.aside); if (!this.deck.length) this.aside = -1; for (const q of this.order) delete this.S[q].know[t]; } break; }
    case K.DUKE: { // 国公：摸 2 张，留 1 张，其余放回牌库底（等玩家决定）
      const got = []; while (got.length < 2 && this.deck.length) got.push(this.deck.pop());
      if (!got.length) { F.note = "牌库空了，无牌可摸"; this.L("牌库空了，国公无牌可摸", "all"); break; }
      F.note = `摸了 ${got.length} 张，挑一张留下`; F.draw = got.length; this.fx.push(F);
      s.hand.push(...got); this.phase = "chancellor"; this.L(`${this.name(p)}摸了 ${got.length} 张，正在挑选留下哪张`, "all");
      for (const q of this.order) delete this.S[q].know[p];
      return; // 这一回合还没结束，等 keep 事件
    }
    case K.KING: { const mine = s.hand[0], theirs = this.S[t].hand[0]; s.hand = [theirs]; this.S[t].hand = [mine];
      // 旁观者记得的牌跟着换手：原来知道 p 的现在知道 t，反之亦然
      for (const q of this.order) { if (q === p || q === t) continue; const K = this.S[q].know, kp = K[p], kt = K[t]; delete K[p]; delete K[t]; if (kp != null) K[t] = kp; if (kt != null) K[p] = kt;
        const mv = []; if (kp != null) mv.push([t, kp]); if (kt != null) mv.push([p, kt]);
        if (mv.length) { (F.moved = F.moved || {})[q] = mv; for (const [w, v] of mv) this.L(`你知道的那张「${CARDS[v].name}」现在到了${this.name(w)}手里`, [q], "secret"); } } s.know[t] = mine; this.S[t].know[p] = theirs; F.secret = { [p]: theirs, [t]: mine }; F.note = "交换了手牌"; this.L(`${this.name(p)}和${this.name(t)}交换了手牌`, "all"); this.L(`你换到了「${CARDS[theirs].name}」`, [p], "secret"); this.L(`你换到了「${CARDS[mine].name}」`, [t], "secret"); break; }
    case K.QUEEN: break;
    case K.PRINCESS: this.knock(p, "弃掉了公主"); break;
  }
  if (card === K.SPY && t == null) F.note = "埋下细作";
  F.knocked = this.order.filter(q => this.S[q].out && !wasOut[q]);
  if (card !== K.DUKE || F.draw == null) this.fx.push(F);
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

/* ---------- 电脑 ----------
 * 只用它自己看得到的信息：自己的手牌、所有弃牌、两人局明牌、偷看/比牌/换牌得知的牌（s.know），
 * 以及场上公开的出牌记录（sim.fx）能推出来的东西。先估每个对手手里各种牌的可能性，再给手里两张牌各打一个分。 */
/* 推断每个对手的手牌：返回 { 玩家: { 牌值: 概率 } } */
function botRead(sim, pid) {
  const me = sim.S[pid], vals = sim.values;
  // 公开记录推出的限制：某人的牌「不是 X」「比 X 大」「比 X 小」；他自己再出一次牌后就作废（留下的可能是新摸的）
  const cons = {}; const fresh = () => ({ not: {}, gt: -1, lt: 99, royal: false }); for (const q of sim.order) cons[q] = fresh();
  for (const f of sim.fx) {
    if (f.round !== sim.round || f.kind === "showdown" || f.by == null) continue;
    cons[f.by] = fresh();
    if (f.card === K.QUEEN) cons[f.by].royal = true; // 打皇后的人，手里多半是太子、帝君或公主
    if (f.t == null) continue;
    if (f.card === K.GUARD && f.guess != null && !f.hit) cons[f.t].not[f.guess] = 1;
    else if (f.card === K.PRINCE) cons[f.t] = fresh();
    else if (f.card === K.KING) { const x = cons[f.by]; cons[f.by] = cons[f.t]; cons[f.t] = x; }
    else if ((f.card === K.BARON || f.card === K.WANG) && f.knocked && f.knocked.length === 1) {
      const lose = f.knocked[0], win = lose === f.by ? f.t : f.by, d = sim.S[lose].disc, lv = d[d.length - 1];
      if (f.card === K.BARON) cons[win].gt = Math.max(cons[win].gt, lv); else cons[win].lt = Math.min(cons[win].lt, lv);
    }
  }
  // 还没露面的牌：总数 − 弃牌 − 明牌 − 我的手牌 − 我确知在别人手里的牌
  const seen = {}, add = v => { seen[v] = (seen[v] || 0) + 1; };
  for (const q of sim.order) sim.S[q].disc.forEach(add); sim.faceUp.forEach(add); me.hand.forEach(add);
  const others = sim.order.filter(q => q !== pid && !sim.S[q].out);
  for (const q of others) if (me.know[q] != null) add(me.know[q]);
  const R = {};
  for (const q of others) {
    const d = {}; let sum = 0;
    if (me.know[q] != null) { d[me.know[q]] = 1; R[q] = d; continue; }
    const c = cons[q];
    for (const v of vals) { let w = Math.max(0, sim.countOf(v) - (seen[v] || 0)); if (c.not[v] || v <= c.gt || v >= c.lt) w = 0; if (c.royal && (v === K.PRINCE || v === K.KING || v === K.PRINCESS)) w *= 4; d[v] = w; sum += w; }
    if (!sum) { for (const v of vals) { d[v] = Math.max(0, sim.countOf(v) - (seen[v] || 0)) || .01; sum += d[v]; } }
    for (const v of vals) d[v] /= sum; R[q] = d;
  }
  return R;
}
function botDecide(sim, pid, salt) {
  if (sim.cur() !== pid) return null;
  const s = sim.S[pid], hand = s.hand.slice(), rnd = k => h2(sim.n, salt * 31 + k, sim.cfg.seed ^ hstr(pid));
  const TOP = K.PRINCESS;
  if (sim.phase === "chancellor") { return { type: "keep", a: { card: hand.includes(TOP) ? TOP : Math.max(...hand) } }; }
  if (sim.phase !== "play") return null;
  const must = sim.mustPlay(hand); if (must) return { type: "play", a: { card: must } };
  const R = botRead(sim, pid), nAlive = sim.alive().length;
  const late = 1 - Math.min(1, sim.deck.length / (nAlive * 2.5)); // 0 = 还早，1 = 马上亮牌比大小
  const lead = q => 1 + .25 * sim.P[q].tokens + (sim.P[q].tokens >= sim.need - 1 ? .5 : 0); // 快赢的人优先打
  const P = (q, f) => { let x = 0; for (const v in R[q]) if (f(+v)) x += R[q][v]; return x; };
  const sure = q => Math.max(...Object.values(R[q])); // 这个人暴露了多少：最可能那张牌的把握
  let best = null;
  const consider = (card, i) => {
    if (card === TOP) return;
    const keep = hand[1 - i], ts = sim.targets(pid, card), foes = ts.filter(q => q !== pid), a = { card };
    // 留在手里的那张值多少：越到后面越要留大牌；公主、大牌怕被侍卫点名，早期略扣分
    let val = keep * (.25 + .9 * late) - (keep >= K.PRINCE ? (1 - late) * .8 : 0), act = 0;
    const top = (score) => { let bq = null, bs = -1e9; foes.forEach((q, j) => { const x = score(q) + rnd(50 + j) * .05; if (x > bs) { bs = x; bq = q; } }); return [bq, bs]; };
    if (CARDS[card].tgt !== "none" && !foes.length) { act = .4; if (ts.includes(pid)) { a.target = pid; act = keep === TOP ? -100 : -keep * .5; } } // 都被保护：白打一张，没坏处
    else if (card === K.GUARD) { // 猜最有把握的那个人、最可能的那张牌
      let bs = -1; foes.forEach((q, j) => { for (const v of sim.guessable()) { const x = (R[q][v] || 0) * lead(q) + rnd(60 + j * 11 + v) * .02; if (x > bs) { bs = x; a.target = q; a.guess = v; } } });
      act = 6 * (R[a.target][a.guess] || 0) + .6;
    }
    else if (card === K.PRIEST) { const [q] = top(q => (s.know[q] != null ? -5 : 0) + lead(q) - sure(q)); a.target = q; act = s.know[q] != null ? .2 : 1.6; }
    else if (card === K.BARON || card === K.WANG) { const low = card === K.BARON; // 侯爷要对方比我小，亲王要对方比我大
      const [q, x] = top(q => (P(q, v => low ? v < keep : v > keep) - 1.3 * P(q, v => low ? v > keep : v < keep)) * lead(q)); a.target = q; act = 6 * x / lead(q) + (x < 0 ? -1 : 0); }
    else if (card === K.MAID) act = 1.8 + (keep >= K.PRINCE ? 1.5 : 0) + (keep === TOP ? 1.5 : 0);
    else if (card === K.PRINCE) { // 逼最可能拿公主的人弃牌；否则逼牌大的、快赢的人
      const [q, x] = top(q => (P(q, v => v === TOP) * 8 + P(q, v => v >= K.PRINCE) * 1.5 * (.4 + late)) * lead(q)); a.target = q; act = x / lead(q) + .8;
      if (ts.includes(pid) && keep <= K.MAID && late < .6 && act < 1.6) { a.target = pid; act = 1.2; } }
    else if (card === K.DUKE) act = sim.deck.length >= 2 ? 2.2 + (keep <= K.BARON ? 1.6 : 0) : .3;
    else if (card === K.KING) { const ev = q => { let e = 0; for (const v in R[q]) e += v * R[q][v]; return e; };
      const [q, x] = top(q => ev(q) - keep); a.target = q; act = x * (.3 + .7 * late) - .8; val = 0; } // 换完后对方知道我的牌
    else if (card === K.SPY) act = 1.5;
    else if (card === K.QUEEN) act = .2;
    const sc = val + act + rnd(70 + i) * .1;
    if (!best || sc > best.sc) best = { sc, a };
  };
  consider(hand[0], 0); if (hand[1] !== hand[0] || !best) consider(hand[1], 1);
  if (!best) best = { a: { card: hand[0] } };
  const a = best.a, ts = sim.targets(pid, a.card);
  if (CARDS[a.card].tgt !== "none" && ts.length && a.target == null) a.target = ts[0];
  return { type: "play", a };
}

root.QS = { Sim, CARDS, K, botRead, TOKENS, COLORS, deckFor, countOf, botDecide, hstr, h2, mulberry };
})(typeof window !== "undefined" ? window : globalThis);
