/* 苍澜·乱战 — 确定性游戏引擎（第二版：居民、民心、名望、卡牌等级）
 * 所有客户端拿到同一份「房间设置 + 事件列表」，各自推演出完全相同的世界。
 * 只用 + - * / sqrt 和整数随机数，保证不同手机算出一样的结果。 */
(function (root) {
"use strict";

/* ---------- 随机数 ---------- */
function mulberry(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hstr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function h2(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s) { return vnoise(x, y, s) * .5 + vnoise(x * 2, y * 2, s + 7) * .25 + vnoise(x * 4, y * 4, s + 13) * .125 + vnoise(x * 8, y * 8, s + 29) * .0625; }

/* ---------- 常量 ---------- */
const WORLD = 1000, RW = 200, CELL = WORLD / RW;
const COLORS = ["#E0533F", "#2FA38F", "#E3A72F", "#8B67D6", "#4C8FE0", "#D46FA8"];
const TERR = {
  plain:  { name: "平原", food: 1.2, gold: 1, def: 1, speed: 1, col: [184, 176, 112] },
  forest: { name: "森林", food: 1, gold: 1.1, def: 1.15, speed: .85, col: [96, 132, 82] },
  hill:   { name: "山地", food: .75, gold: 1.35, def: 1.3, speed: .7, col: [150, 128, 104] },
  marsh:  { name: "沼泽", food: .9, gold: .9, def: 1.1, speed: .6, col: [104, 124, 110] }
};
// 民风：决定一个地方的人口、产出和守备
const TRAITS = {
  normal:  { name: "寻常", tag: "", gold: 1, food: 1, pop: [3000, 6000], cap: 9000, desc: "寻常的城镇" },
  rich:    { name: "富庶", tag: "富", gold: 1.8, food: .9, pop: [4000, 8000], cap: 12000, desc: "商贾云集，金钱产出高" },
  fertile: { name: "丰饶", tag: "沃", gold: .9, food: 1.8, pop: [5000, 9000], cap: 14000, desc: "沃野千里，粮食多、人口多" },
  strong:  { name: "尚武", tag: "武", gold: .9, food: 1, pop: [3000, 6000], cap: 9000, recruit: .5, growth: 2, def: 1.15, desc: "民风彪悍：征兵代价减半，守军增长快，守城更顽强" },
  barren:  { name: "贫瘠", tag: "瘠", gold: .5, food: .5, pop: [600, 1800], cap: 3000, desc: "土地贫瘠，人烟稀少" },
  fort:    { name: "要塞", tag: "塞", gold: .2, food: .2, pop: [150, 500], cap: 800, def: 1.7, desc: "兵家必争之地：几乎不产出，但扼守要道，易守难攻" },
  ruin:    { name: "废墟", tag: "墟", gold: 0, food: 0, pop: [0, 0], cap: 0, desc: "被毁的城池，寸草不生" }
};
const N1 = "青赤玄白苍金落寒云风雷霜幽烈碧紫长孤断鹰龙虎鹿狼月星石火".split("");
const N2 = "岭川原谷泽峰林湾关野丘渊滩坡镇岗堡洲".split("");
const CATS = { econ: "收益", support: "辅助", scout: "侦查", defense: "防御", attack: "攻击", disaster: "天灾" };
const TIERS = { 1: { name: "凡品", col: "#B9B2A3" }, 2: { name: "良品", col: "#5FB86A" }, 3: { name: "珍品", col: "#A274EA" }, 4: { name: "传说", col: "#EBA83A" } };

/* ---------- 卡牌 ----------
 tier 等级；price 只有凡品能在市集直接买；高级卡靠抽签或献祭
 tgt: own 己方地区 / any 任意地区 / vis 看得见的地区 / enemy 看得见的他人地区 / pioneer 相邻无主地区 / beast 相邻有凶兽地区
      player 其他玩家 / myArmy 己方行进中军队 / army 看得见的他人军队 / none 无需目标 / launch 选出发地+目标+兵力 */
const CARDS = {
  // 凡品
  harvest:  { tier: 1, name: "丰收", cat: "econ", tgt: "own", price: { gold: 70 }, desc: "一个己方地区 2.5 分钟内粮食产量翻倍" },
  granary:  { tier: 1, name: "屯粮", cat: "econ", tgt: "none", price: { gold: 60 }, desc: "开仓运粮：立刻 +120 粮" },
  march:    { tier: 1, name: "急行军", cat: "support", tgt: "myArmy", price: { gold: 45, food: 30 }, desc: "一支己方行进中的军队速度 ×1.5" },
  conscript:{ tier: 1, name: "强征", cat: "support", tgt: "own", price: { gold: 30 }, desc: "一个己方地区立刻 +40 兵，但居民 −600、民心 −10" },
  patrol:   { tier: 1, name: "巡哨", cat: "scout", tgt: "own", price: { gold: 40 }, desc: "派出游骑：3 分钟内，经过该地区及其相邻地区的一切军队都看得见" },
  tax:      { tier: 1, name: "征税", cat: "econ", tgt: "none", price: { food: 80 }, desc: "立刻收取 全国居民每千人 8 金，但各地民心 −5" },
  trade:    { tier: 1, name: "互市", cat: "econ", tgt: "none", price: { gold: 55 }, desc: "用 60 粮换 100 金" },
  recruit:  { tier: 1, name: "募兵", cat: "support", tgt: "own", price: { gold: 60, food: 40 }, desc: "一个己方地区立刻 +25 兵" },
  pioneer:  { tier: 1, name: "开拓", cat: "support", tgt: "pioneer", price: { gold: 50, food: 50 }, desc: "和平接管一块相邻的无主地区，连同那里的居民（有凶兽或民兵会失败）" },
  scout:    { tier: 1, name: "斥候", cat: "scout", tgt: "any", price: { gold: 55 }, desc: "侦查一个地区及其周边：居民、民风、守军、凶兽一清二楚，此后经过那里的军队都看得见" },
  wall:     { tier: 1, name: "城墙", cat: "defense", tgt: "own", price: { gold: 70 }, desc: "一个己方地区 3 分钟内守备 ×1.6" },
  // 良品
  mine:     { tier: 2, name: "开矿", cat: "econ", tgt: "own", desc: "一个己方地区永久每分钟 +8 金（最多 3 座矿）" },
  settle:   { tier: 2, name: "屯田", cat: "econ", tgt: "own", desc: "迁来 1500 居民（不超过该地人口上限）" },
  swift:    { tier: 2, name: "神行", cat: "support", tgt: "myArmy", desc: "一支己方行进中的军队速度翻倍" },
  rally:    { tier: 2, name: "号令", cat: "support", tgt: "own", desc: "相邻己方地区各抽一半兵力，立刻集结到这里" },
  ambush:   { tier: 2, name: "伏兵", cat: "defense", tgt: "vis", desc: "在看得见的地区埋伏 3 分钟，劫杀经过的敌军（威力 40）" },
  beacon:   { tier: 2, name: "烽火", cat: "defense", tgt: "own", desc: "在己方地区点烽火，永久看清两圈内的动静" },
  intercept:{ tier: 2, name: "截杀", cat: "attack", tgt: "army", desc: "截击一支看得见的他人军队，歼灭 40%" },
  rampart:  { tier: 2, name: "筑垒", cat: "defense", tgt: "own", desc: "一个己方地区永久守备 ×1.2（每地一次）" },
  decoy:    { tier: 2, name: "疑兵", cat: "defense", tgt: "own", desc: "虚张声势：3 分钟内，别人侦查到的该地守军数是真实的 3 倍" },
  raid:     { tier: 2, name: "劫掠", cat: "attack", tgt: "enemy", desc: "洗劫看得见的敌方地区：抢走 每千人 20 金 15 粮，该地民心 −10" },
  rumor:    { tier: 2, name: "流言", cat: "attack", tgt: "enemy", desc: "散布流言：看得见的敌方地区民心 −20，居民 −5%" },
  feast:    { tier: 2, name: "犒军", cat: "econ", tgt: "none", desc: "大赏三军：你所有地区民心 +12，各地守军 +3" },
  // 珍品
  tame:     { tier: 3, name: "驯兽", cat: "support", tgt: "beast", desc: "收服相邻地区的凶兽，连地带兽一起归你" },
  hawk:     { tier: 3, name: "鹰眼", cat: "scout", tgt: "any", desc: "侦查两圈范围内的所有地区" },
  spy:      { tier: 3, name: "密探", cat: "scout", tgt: "player", desc: "摸清一名玩家的全部领地、民心和钱粮" },
  cavalry:  { tier: 3, name: "铁骑", cat: "attack", tgt: "launch", desc: "派一支速度 ×2、战力 ×1.3 的突击部队" },
  fire:     { tier: 3, name: "火攻", cat: "attack", tgt: "enemy", desc: "烧掉看得见的敌方地区 35% 守军和 10% 居民" },
  subvert:  { tier: 3, name: "策反", cat: "attack", tgt: "enemy", desc: "煽动看得见的敌方地区：民心低于 50 且守军不足 20 时直接倒戈归你；否则民心 −30" },
  flood:    { tier: 3, name: "洪水", cat: "disaster", tgt: "any", desc: "2.5 分钟内该地区不产出、军队行进减半，守军 −15%，居民 −10%" },
  ironwall: { tier: 3, name: "铁壁", cat: "defense", tgt: "own", desc: "一个己方地区 3 分钟内守备 ×2.2，且免疫火攻" },
  stealth:  { tier: 3, name: "奇袭", cat: "attack", tgt: "launch", desc: "派一支隐形部队：3 分钟内任何人都看不见它（决战期除外）" },
  blockade: { tier: 3, name: "断粮", cat: "attack", tgt: "player", desc: "切断一名玩家的粮道：2 分钟内他的粮食产出减半" },
  storm:    { tier: 3, name: "暴雨", cat: "disaster", tgt: "any", desc: "目标及相邻地区 2 分钟内不产出、军队行进减半" },
  // 传说
  quake:    { tier: 4, name: "地震", cat: "disaster", tgt: "any", desc: "任意地区守军 −40%，居民 −30%" },
  plague:   { tier: 4, name: "瘟疫", cat: "disaster", tgt: "any", desc: "目标及相邻地区守军 −25%，居民 −20%" },
  beasts:   { tier: 4, name: "兽潮", cat: "disaster", tgt: "any", desc: "在任意地区召出 40 头凶兽，与当地守军厮杀" },
  meteor:   { tier: 4, name: "陨星", cat: "disaster", tgt: "any", desc: "天降陨星：守军 −80%，居民 −60%，城墙尽毁" },
  golden:   { tier: 4, name: "盛世", cat: "econ", tgt: "none", desc: "你所有地区民心拉满到 100，居民 +20%" },
  heaven:   { tier: 4, name: "天兵", cat: "support", tgt: "own", desc: "一个己方地区立刻 +80 兵" },
  dragon:   { tier: 4, name: "真龙", cat: "support", tgt: "none", desc: "真龙附体：2 分钟内你所有军队进攻 ×1.5、所有地区守备 ×1.3" },
  locust:   { tier: 4, name: "蝗灾", cat: "disaster", tgt: "player", desc: "蝗虫遮天：一名玩家存粮减半，2 分钟内颗粒无收" },
  mandate:  { tier: 4, name: "天命", cat: "attack", tgt: "enemy", desc: "天命所归：看得见的一座敌方城池（非国都）连人带城直接归你" }
};
const DEV_CATS = ["econ", "support"];
const HAND_MAX = 8;
// 卡牌自动发放：开局 2 张，之后每 40 秒发 1 张（手牌满了先欠着，最多欠 2 张）
const DRAW = { dealEvery: 40, startCards: 2, owedMax: 2, pity: 8, w: { 1: 55, 2: 30, 3: 12, 4: 3 } };
const SAC = {
  army: { tier: 2, troops: 25, name: "献祭一支军队", desc: "从一个己方地区献出 25 兵（地区要有 26 兵以上）。" },
  pop:  { tier: 3, minPop: 2000, name: "献祭一城居民", desc: "一个己方地区六成居民献祭（至少要 2000 人）。当地民心 −40，你其他地区民心 −8，名望 −3。" },
  city: { tier: 4, name: "自毁一座城池", desc: "一座己方城池化为废墟，永远不再产出。你其他地区民心 −10，名望 −2。" }
};
const POLICY = {
  benevolent: { name: "待民如子", target: 80, desc: "开仓赈济（花 30 粮），免税 1.5 分钟。民心 70 起步，人口增长加倍 3 分钟。名望 +3：名望高时，邻近敌城的不满百姓会主动来投。" },
  military:   { name: "军管", target: 55, desc: "维持秩序，不赏不罚。民心 40 起步。（30 秒内不选就默认军管）" },
  tax:        { name: "横征暴敛", target: 30, desc: "立刻搜刮 每千人 30 金，此后该城金钱产出 ×1.6。但民心只有 30，居民会慢慢逃散，守备不足时可能叛乱。名望 −1。" },
  massacre:   { name: "屠城", target: 20, desc: "屠尽九成五居民，劫掠 每千人 50 金、40 粮。此城 5 分钟内寸草不生。你所有地区民心 −10，名望 −10，天下皆知：名望很低时，敌人会拼死抵抗你（守备 ×1.2），新占城池民心更低。" }
};
const LEVY = { gold: 5, food: 25, n: 10, pop: 250 };
/* 特殊兵种：开局前每人选一种，只能在「本国国都」训练；攻下别国国都，就能训练那一国的特殊兵种
 * 每种兵除了攻/守/速，还各有一条独门本事（trait） */
const UNITS = {
  hubao:    { name: "虎豹骑", g: "豹", atk: 1.6, def: 1.0, speed: 1.8, cav: 1, tip: "来去如风", desc: "天下精骑。行军速度 ×1.8，进攻 ×1.6；守城时和普通兵一样", trait: "铁蹄追击：半路截杀时追击范围加倍，野战战力再 ×1.25" },
  xianzhen: { name: "陷阵营", g: "陷", atk: 1.9, def: 1.3, speed: .9, tip: "攻无不克", desc: "攻坚死士。进攻 ×1.9，攻城时无视城墙、要塞和山川地形的守备加成", trait: "先登夺城：攻下城池后的伤亡只有七成" },
  wudang:   { name: "无当飞军", g: "飞", atk: 1.4, def: 1.3, speed: 1.15, tip: "翻山越岭", desc: "山地奇兵。穿山越林、过沼泽都不减速；遭伏兵、截杀时伤亡减半", trait: "神出鬼没：别人半路截杀它时追击范围减半；在山地、森林守城 ×1.3" },
  daji:     { name: "大戟士", g: "戟", atk: 1.3, def: 2.4, speed: .85, tip: "坚如磐石", desc: "重甲长戟。驻守时每人顶 2.4 个普通兵，是最好的守城兵", trait: "铁甲结阵：不怕连弩齐射，火攻伤亡减半" },
  lianu:    { name: "连弩营", g: "弩", atk: 1.5, def: 1.7, speed: 1, tip: "万弩齐发", desc: "连发劲弩。进攻前先齐射，射杀守军两成；守城 ×1.7", trait: "城头箭雨：有连弩营驻守的城池，来攻的敌军先折损 15%" },
  tengjia:  { name: "藤甲兵", g: "藤", atk: 1.5, def: 1.6, speed: 1, tip: "刀枪不入", desc: "油浸藤甲。被伏击、截杀、天灾伤亡减半——唯独怕火攻，伤亡加倍", trait: "涉水如履平地：过沼泽、洪区都不减速，野战时伤亡减三成" }
};
const UNIT_KEYS = Object.keys(UNITS);
const TRAIN = { n: 5, gold: 40, food: 30, pop: 200 };
// 国都只产特殊兵种：每 16 秒自动 +1，直到上限（6 + 每千居民 2 人）
const ELITE_GROW = 16;
const eliteCap = R => Math.floor(6 + R.pop / 1000 * 2);
const RULES = { totalSec: 1500, devSec: 300, finalSec: 180, hegeShare: .6, hegeHold: 60 };
const SPEED = 8;
const CATCH = 14; // 半路截杀：两军在同一条官道上相距不到这么远（世界单位）就算追上

/* ---------- 地图生成 ---------- */
// 地形函数：陆地、山脉（脊线噪声）。渲染层也用同一套函数，保证画出来的山就是挡路的山
const MT = .6; // 山脉阈值
function terrainFns(seed) {
  const land = (x, y) => { const dx = (x - 500) / 500, dy = (y - 500) / 500, r = dx * dx + dy * dy; return fbm(x / 230, y / 230, seed) * 1.2 - r * .9 + .22; };
  const mtn = (x, y) => { const n = fbm(x / 210, y / 210, seed + 303), rg = 1 - Math.abs(n * 2 - 1), r2 = rg * rg; return r2 * r2 * (.45 + fbm(x / 260, y / 260, seed + 404) * .9); };
  return { land, mtn, landAt: (x, y) => land(x, y) > .5 };
}
function genMap(seed, nPlayers) {
  const rnd = mulberry(seed ^ 0x5bd1e995), T = terrainFns(seed);
  const N = Math.min(44, 9 + nPlayers * 5);
  let D = Math.sqrt(WORLD * WORLD * .5 / N) * .8;
  const sites = [];
  for (let tries = 0; sites.length < N && tries < 6000; tries++) {
    const x = 40 + rnd() * 920, y = 40 + rnd() * 920;
    if (!T.landAt(x, y) || T.mtn(x, y) > MT - .05) continue;
    let ok = true;
    for (const s of sites) { const dx = s.x - x, dy = s.y - y; if (dx * dx + dy * dy < D * D) { ok = false; break; } }
    if (ok) sites.push({ x, y });
    if (tries % 1500 === 1499) D *= .9;
  }
  const ras = new Uint8Array(RW * RW).fill(255), mt = new Float32Array(RW * RW), maxD = (D * 1.25) * (D * 1.25);
  for (let j = 0; j < RW; j++) for (let i = 0; i < RW; i++) {
    const x = (i + .5) * CELL, y = (j + .5) * CELL;
    if (!T.landAt(x, y)) continue;
    mt[j * RW + i] = T.mtn(x, y);
    let best = -1, bd = 1e12;
    for (let k = 0; k < sites.length; k++) { const dx = sites[k].x - x, dy = sites[k].y - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = k; } }
    if (bd < maxD) ras[j * RW + i] = best;
  }
  // 每个地区只保留最大的一块连片土地（去掉隔海的飞地）
  { const lab = new Int32Array(RW * RW).fill(-1), sizes = [], owner = []; let id = 0;
    for (let k = 0; k < ras.length; k++) { if (ras[k] === 255 || lab[k] >= 0) continue; const a = ras[k], q = [k]; lab[k] = id; let sz = 0;
      while (q.length) { const c = q.pop(); sz++; const i = c % RW; for (const nb of [i > 0 ? c - 1 : -1, i < RW - 1 ? c + 1 : -1, c - RW, c + RW]) if (nb >= 0 && nb < ras.length && lab[nb] < 0 && ras[nb] === a) { lab[nb] = id; q.push(nb); } }
      sizes.push(sz); owner.push(a); id++; }
    const bestC = {}; sizes.forEach((sz, c) => { const a = owner[c]; if (bestC[a] == null || sz > sizes[bestC[a]]) bestC[a] = c; });
    for (let k = 0; k < ras.length; k++) if (ras[k] !== 255 && bestC[ras[k]] !== lab[k]) ras[k] = 255; }
  const n = sites.length, area = new Array(n).fill(0), cx = new Array(n).fill(0), cy = new Array(n).fill(0), hills = new Array(n).fill(0), border = {};
  for (let j = 0; j < RW; j++) for (let i = 0; i < RW; i++) {
    const a = ras[j * RW + i]; if (a === 255) continue;
    area[a]++; cx[a] += i; cy[a] += j; if (mt[j * RW + i] > MT) hills[a]++;
    if (i + 1 < RW) { const b = ras[j * RW + i + 1]; if (b !== 255 && b !== a) { const k = a < b ? a + "," + b : b + "," + a; border[k] = (border[k] || 0) + 1; } }
    if (j + 1 < RW) { const b = ras[(j + 1) * RW + i]; if (b !== 255 && b !== a) { const k = a < b ? a + "," + b : b + "," + a; border[k] = (border[k] || 0) + 1; } }
  }
  const adj = sites.map(() => []);
  for (const k in border) if (border[k] >= 3) { const [a, b] = k.split(",").map(Number); adj[a].push(b); adj[b].push(a); }
  const ok = sites.map((_, i) => area[i] >= 40);
  const comp = new Array(n).fill(-1); let best = -1, bestSize = 0;
  for (let i = 0; i < n; i++) {
    if (!ok[i] || comp[i] >= 0) continue;
    const q = [i]; comp[i] = i; let size = 0;
    while (q.length) { const a = q.pop(); size++; for (const b of adj[a]) if (ok[b] && comp[b] < 0) { comp[b] = i; q.push(b); } }
    if (size > bestSize) { bestSize = size; best = i; }
  }
  const keep = sites.map((_, i) => ok[i] && comp[i] === best);
  const remap = new Array(n).fill(255); let m = 0;
  for (let i = 0; i < n; i++) if (keep[i]) remap[i] = m++;
  for (let k = 0; k < ras.length; k++) ras[k] = ras[k] === 255 ? 255 : remap[ras[k]];
  const used = new Set(), regions = [];
  for (let i = 0; i < n; i++) {
    if (!keep[i]) continue;
    const id = remap[i];
    // 城池落在离重心最近、不在山上的格子
    const gx = cx[i] / area[i], gy = cy[i] / area[i];
    let ci = -1, cd = 1e12;
    for (let k = 0; k < ras.length; k++) { if (ras[k] !== id || mt[k] > MT - .06) continue; const dx = k % RW - gx, dy = (k - k % RW) / RW - gy, d = dx * dx + dy * dy; if (d < cd) { cd = d; ci = k; } }
    if (ci < 0) ci = Math.round(gy) * RW + Math.round(gx);
    const x = (ci % RW + .5) * CELL, y = ((ci - ci % RW) / RW + .5) * CELL;
    const t = fbm(x / 140, y / 140, seed + 101), wet = fbm(x / 160, y / 160, seed + 202);
    const terr = hills[i] / area[i] > .16 ? "hill" : wet > .6 ? "marsh" : t < .42 ? "forest" : "plain";
    let name; for (let g = 0; g < 50; g++) { name = N1[Math.floor(rnd() * N1.length)] + N2[Math.floor(rnd() * N2.length)]; if (!used.has(name)) break; }
    used.add(name);
    regions.push({ id, x, y, cell: ci, terr, name, area: area[i], adj: adj[i].filter(b => keep[b]).map(b => remap[b]).sort((a, b) => a - b), trait: "normal", pop: 0, beast: 0 });
  }
  const R = regions.length;
  const bfs = src => { const d = new Array(R).fill(99); d[src] = 0; const q = [src]; while (q.length) { const a = q.shift(); for (const b of regions[a].adj) if (d[b] === 99) { d[b] = d[a] + 1; q.push(b); } } return d; };
  const cands = regions.filter(r => r.adj.length >= 3).map(r => r.id);
  if (!cands.length) cands.push(...regions.map(r => r.id));
  const starts = [cands[Math.floor(rnd() * cands.length)]];
  let distTo = bfs(starts[0]);
  while (starts.length < nPlayers) {
    let bi = -1, bd = -1;
    for (const c of cands.length > starts.length ? cands : regions.map(r => r.id)) { if (starts.includes(c)) continue; const d = distTo[c] + rnd() * .5; if (d > bd) { bd = d; bi = c; } }
    starts.push(bi); const nd = bfs(bi); distTo = distTo.map((v, i) => Math.min(v, nd[i]));
  }
  const dists = starts.map(s => bfs(s));
  const nearStart = regions.map(r => Math.min(...dists.map(d => d[r.id])));
  const byDeg = regions.filter(r => !starts.includes(r.id) && nearStart[r.id] >= 2).sort((a, b) => b.adj.length - a.adj.length || a.id - b.id);
  const nFort = Math.max(1, Math.round(R * .08));
  byDeg.slice(0, nFort).forEach(r => r.trait = "fort");
  regions.forEach(r => {
    if (r.trait === "fort") return;
    if (starts.includes(r.id)) { r.trait = rnd() < .5 ? "fertile" : "normal"; return; }
    const x = rnd();
    r.trait = x < .36 ? "normal" : x < .52 ? "rich" : x < .68 ? "fertile" : x < .82 ? "strong" : "barren";
  });
  regions.forEach(r => { const T2 = TRAITS[r.trait]; r.pop = Math.round((T2.pop[0] + rnd() * (T2.pop[1] - T2.pop[0])) / 50) * 50; });
  starts.forEach(s => { regions[s].pop = Math.max(regions[s].pop, 6000); });
  regions.forEach(r => { const d = nearStart[r.id]; if (d >= 2 && rnd() < .5) r.beast = Math.round(6 + d * 6 + rnd() * 14); if (r.trait === "fort") r.beast = Math.max(r.beast, 18); });
  return { regions, ras, mt, starts, seed };
}
/* 河流与官道：只给选定的地图算一次 */
function finishMap(map) {
  const seed = map.seed, T = terrainFns(seed), ras = map.ras, mt = map.mt, NN = RW * RW;
  const isLand = k => ras[k] !== 255;
  // 地势 = 离海远近（保证一路向海）+ 少许起伏，河道才会蜿蜒而不积成大湖
  const dsea = new Int32Array(NN).fill(-1), q0 = [];
  for (let k = 0; k < NN; k++) if (!isLand(k)) { dsea[k] = 0; q0.push(k); }
  for (let h = 0; h < q0.length; h++) { const k = q0[h], i = k % RW; for (const nb of [i > 0 ? k - 1 : -1, i < RW - 1 ? k + 1 : -1, k - RW, k + RW]) if (nb >= 0 && nb < NN && dsea[nb] < 0) { dsea[nb] = dsea[k] + 1; q0.push(nb); } }
  const H = new Float32Array(NN);
  for (let k = 0; k < NN; k++) { const x = (k % RW + .5) * CELL, y = ((k - k % RW) / RW + .5) * CELL; H[k] = dsea[k] + fbm(x / 32, y / 32, seed + 505) * 10 + mt[k] * 4; }
  const nb8 = k => { const i = k % RW, j = (k - i) / RW, out = []; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < RW && b < RW) out.push(b * RW + a); } return out; };
  // 河：从山脊往低处流，直到入海
  const riv = new Uint8Array(NN), rivers = [];
  const srcs = []; for (let k = 0; k < NN; k++) if (isLand(k) && mt[k] > MT && dsea[k] > 10) srcs.push(k);
  srcs.sort((a, b) => H[b] - H[a] || a - b);
  const picked = [];
  for (const s of srcs) {
    if (picked.length >= 5) break;
    const si = s % RW, sj = (s - si) / RW;
    if (picked.some(p => { const pi = p % RW, pj = (p - pi) / RW; return (pi - si) ** 2 + (pj - sj) ** 2 < 45 * 45; })) continue;
    const path = [s], seen = new Set([s]); let k = s, joined = false, reached = false;
    for (let step = 0; step < 500; step++) {
      let nx = -1, nh = 1e9; for (const b of nb8(k)) { if (seen.has(b)) continue; if (H[b] < nh) { nh = H[b]; nx = b; } }
      if (nx < 0) break;
      if (!isLand(nx)) { reached = true; break; }
      if (riv[nx]) { path.push(nx); joined = true; break; }
      path.push(nx); seen.add(nx); k = nx;
    }
    if ((reached || joined) && path.length >= 18 && path.length < dsea[s] * 3) { picked.push(s); path.forEach((c, i) => { if (!riv[c]) riv[c] = 1 + Math.min(200, i); }); rivers.push(path.map(c => [(c % RW + .5) * CELL, ((c - c % RW) / RW + .5) * CELL])); }
  }
  // 城池不建在河心：挪到同一地区里最近的干地
  for (const g of map.regions) {
    if (!riv[g.cell]) continue;
    let best = -1, bd = 1e12; const gi = g.cell % RW, gj = (g.cell - gi) / RW;
    for (let k = 0; k < NN; k++) { if (ras[k] !== g.id || riv[k] || mt[k] > MT - .06) continue; const d = (k % RW - gi) ** 2 + ((k - k % RW) / RW - gj) ** 2; if (d < bd) { bd = d; best = k; } }
    if (best >= 0) { g.cell = best; g.x = (best % RW + .5) * CELL; g.y = ((best - best % RW) / RW + .5) * CELL; }
  }
  // 官道：相邻两城之间沿地形寻路（避开高山，过河要绕到窄处）
  const routes = {}, rlen = {}, bridges = [];
  const cost = k => 1 + (mt[k] > MT ? 9 : mt[k] > MT - .08 ? 2.5 : 0) + (riv[k] ? 6 : 0);
  const dist = new Float64Array(NN), prev = new Int32Array(NN);
  for (const A of map.regions) for (const b of A.adj) {
    if (b < A.id) continue;
    const B = map.regions[b], s0 = A.cell, g0 = B.cell;
    dist.fill(1e18); prev.fill(-1); dist[s0] = 0;
    const heap = [[0, s0]];
    const push = (d, k) => { heap.push([d, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m2 = i; if (l < heap.length && heap[l][0] < heap[m2][0]) m2 = l; if (r < heap.length && heap[r][0] < heap[m2][0]) m2 = r; if (m2 === i) break; [heap[m2], heap[i]] = [heap[i], heap[m2]]; i = m2; } } return top; };
    while (heap.length) {
      const [d, k] = pop(); if (d > dist[k]) continue; if (k === g0) break;
      const ki = k % RW;
      for (const nb of nb8(k)) {
        if (ras[nb] !== A.id && ras[nb] !== b) continue;
        const diag = (nb % RW !== ki) && (nb - nb % RW !== k - ki);
        const nd = d + cost(nb) * (diag ? 1.4142 : 1);
        if (nd < dist[nb]) { dist[nb] = nd; prev[nb] = k; push(nd, nb); }
      }
    }
    let cells = [];
    if (prev[g0] >= 0 || s0 === g0) { for (let k = g0; k >= 0 && k !== s0; k = prev[k]) cells.push(k); cells.push(s0); cells.reverse(); }
    else cells = [s0, g0];
    let pts = cells.filter((c, i) => i % 3 === 0 || i === cells.length - 1).map(c => [(c % RW + .5) * CELL, ((c - c % RW) / RW + .5) * CELL]);
    pts[0] = [A.x, A.y]; pts[pts.length - 1] = [B.x, B.y];
    for (let it = 0; it < 2 && pts.length > 2; it++) { const q = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; q.push([x0 * .75 + x1 * .25, y0 * .75 + y1 * .25], [x0 * .25 + x1 * .75, y0 * .25 + y1 * .75]); } q.push(pts[pts.length - 1]); pts = q; }
    let L = 0; for (let i = 1; i < pts.length; i++) L += Math.sqrt((pts[i][0] - pts[i - 1][0]) ** 2 + (pts[i][1] - pts[i - 1][1]) ** 2);
    const key = A.id + "," + b; routes[key] = pts; rlen[key] = L;
    let lastB = -9;
    for (let i = 1; i < cells.length; i++) {
      const c = cells[i], p0 = cells[i - 1], ci = c % RW, cj = (c - ci) / RW, pi = p0 % RW, pj = (p0 - pi) / RW;
      const cross = (riv[c] && !riv[p0]) || (ci !== pi && cj !== pj && !riv[c] && !riv[p0] && (riv[pj * RW + ci] || riv[cj * RW + pi]));
      if (cross && i - lastB > 3) { lastB = i; bridges.push({ x: ((ci + pi) / 2 + .5) * CELL, y: ((cj + pj) / 2 + .5) * CELL, a: Math.atan2(cj - pj, ci - pi) }); }
    }
  }
  map.riv = riv; map.rivers = rivers; map.routes = routes; map.rlen = rlen; map.bridges = bridges;
  return map;
}

/* ---------- 模拟 ---------- */
function Sim(cfg) {
  this.cfg = cfg;
  const need = 6 + cfg.players.length * 4;
  for (let k = 0; k < 12; k++) { const m = genMap(cfg.seed + k * 7919, cfg.players.length); if (!this.map || m.regions.length > this.map.regions.length) this.map = m; if (m.regions.length >= need) break; }
  finishMap(this.map);
  this.reset();
}
Sim.prototype.reset = function () {
  const cfg = this.cfg, map = this.map;
  this.t = 0; this.applied = new Set(); this.over = null;
  this.R = map.regions.map(r => ({ owner: null, troops: 0, pop: r.pop, cap: TRAITS[r.trait].cap, trait: r.trait, loyalty: 50, policy: "home", pend: null,
    beast: r.beast, el: {}, home: null, mine: 0, wallUntil: 0, harvestUntil: 0, floodUntil: 0, taxFreeUntil: 0, boomUntil: 0, noGrowUntil: 0, ambush: [], beacon: 0,
    rampart: 0, decoyUntil: 0, ironUntil: 0, patrols: [] }));
  this.P = {}; this.order = cfg.players.map(p => p.id);
  cfg.players.forEach((p, i) => {
    const unit = UNITS[p.unit] ? p.unit : UNIT_KEYS[(hstr(p.id) + i) % UNIT_KEYS.length];
    const st = { id: p.id, unit, name: p.name, color: p.color || COLORS[i], bot: !!p.bot, gold: 60, food: 90, hand: [], hseq: 0, draws: 0, pity: 0,
      owed: DRAW.startCards, bought: 0, known: new Uint8Array(map.regions.length), snap: {}, alive: true, capital: map.starts[i], renown: 0, got: [], famineUntil: 0, locustUntil: 0, dragonUntil: 0, diedAt: -1, maxRows: 1, kills: 0, taken: 0 };
    this.P[p.id] = st;
    const cap = map.starts[i];
    this.own(cap, p.id, 0); this.R[cap].loyalty = 80; this.R[cap].home = unit; this.R[cap].el[unit] = 14;
    let extra = 0;
    for (const b of map.regions[cap].adj) {
      if (extra >= 1) break;
      const B = this.R[b];
      if (B.owner == null && !map.starts.includes(b) && B.trait !== "fort") { this.own(b, p.id, 10); B.beast = 0; B.loyalty = 65; extra++; }
    }
  });
  this.rel = {}; this.offers = {};
  this.armies = []; this.aseq = 0; this.fx = []; this.log = [];
  this.W = { next: OMEN.first, n: 0, harvest: 0, drought: 0, trade: 0, fog: 0 }; // 天时（随机事件）
  for (const id of this.order) for (let r = 0; r < this.R.length; r++) if (this.R[r].owner === id) this.reveal(id, r, 1, true);
};
Sim.prototype.own = function (r, pid, troops) { const R = this.R[r], prev = R.owner; R.owner = pid; R.troops = troops; R.el = {}; R.beast = 0; R.pend = null; R.ambush = R.ambush.filter(a => a.by !== pid); if (pid) this.P[pid].known[r] = 1; if (prev && prev !== pid && this.P[prev]) this.snapshot(prev, r); };
/* 守军：普通兵 + 特殊兵 */
Sim.prototype.gar = function (R) { let s = R.troops; for (const k in R.el) s += R.el[k]; return s; };
Sim.prototype.garDef = function (R) { let s = R.troops; for (const k in R.el) s += R.el[k] * UNITS[k].def; return s; };
// 按比例折损守军；藤甲兵平时伤亡减半、火攻伤亡加倍；大戟士火攻伤亡减半
Sim.prototype.cut = function (R, keep, how) {
  R.troops = R.troops * keep;
  for (const k in R.el) { let kk = keep; if (k === "tengjia") kk = how === "fire" ? Math.max(0, 1 - (1 - keep) * 2) : 1 - (1 - keep) / 2; if (k === "daji" && how === "fire") kk = 1 - (1 - keep) / 2; R.el[k] = Math.round(R.el[k] * kk); if (R.el[k] <= 0) delete R.el[k]; }
};
// 连弩齐射：大戟士结阵不受影响
Sim.prototype.cutVolley = function (R, keep) { const d = R.el.daji; delete R.el.daji; this.cut(R, keep, "hit"); if (d) R.el.daji = d; };
Sim.prototype.addTroops = function (R, kind, n) { if (UNITS[kind]) R.el[kind] = (R.el[kind] || 0) + n; else R.troops += n; };
Sim.prototype.relOf = function (a, b) { if (a === b) return "self"; const k = a < b ? a + "|" + b : b + "|" + a; return this.rel[k] || "peace"; };
Sim.prototype.setRel = function (a, b, v) { const k = a < b ? a + "|" + b : b + "|" + a; this.rel[k] = v; };
Sim.prototype.visible = function (pid, r) { return this.R[r].owner === pid || this.P[pid].known[r] === 1; };
Sim.prototype.reveal = function (pid, r, radius) {
  const seen = new Set([r]); let front = [r];
  for (let k = 0; k < radius; k++) { const nx = []; for (const a of front) for (const b of this.map.regions[a].adj) if (!seen.has(b)) { seen.add(b); nx.push(b); } front = nx; }
  for (const x of seen) { this.P[pid].known[x] = 1; this.snapshot(pid, x); }
  return seen;
};
// 别人看到的情报：疑兵期间守军数虚报成 3 倍
Sim.prototype.snapshot = function (pid, r) { const R = this.R[r], fake = R.decoyUntil > this.t && R.owner !== pid; this.P[pid].snap[r] = { t: this.t, owner: R.owner, troops: Math.round(this.gar(R) * (fake ? 3 : 1)), el: fake ? Object.fromEntries(Object.entries(R.el).map(([k, v]) => [k, v * 3])) : { ...R.el }, pop: Math.round(R.pop), beast: Math.round(R.beast), mine: R.mine, trait: R.trait, loyalty: Math.round(R.loyalty) }; };
Sim.prototype.L = function (text, kind, vis, r) { this.log.push({ t: this.t, text, kind, vis: vis === "all" ? "all" : [...new Set(vis)], r }); };
Sim.prototype.FX = function (kind, o) { this.fx.push({ t0: this.t, kind, ...o }); if (this.fx.length > 400) this.fx.splice(0, 100); };
Sim.prototype.watchers = function (rs) { return this.order.filter(p => rs.some(r => r != null && this.visible(p, r))); };
Sim.prototype.rname = function (r) { return this.map.regions[r].name; };
Sim.prototype.pname = function (p) { return p ? (this.P[p] ? this.P[p].name : "?") : "无主之地"; };
Sim.prototype.dev = function () { return this.t < this.cfg.devSec; };
Sim.prototype.final = function () { return this.t >= this.cfg.totalSec - RULES.finalSec; };
Sim.prototype.hegemon = function () { for (const p of this.order) { const st = this.P[p]; if (st.alive && st.hegeSince != null) return { p, since: st.hegeSince, n: this.rows(p).length, total: this.R.filter(R => R.trait !== "ruin").length }; } return null; };
Sim.prototype.hegeShare = function () { return this.order.length <= 2 ? .7 : RULES.hegeShare; }; // 两人局要占七成
Sim.prototype.checkHegemony = function () {
  const total = this.R.filter(R => R.trait !== "ruin").length;
  for (const p of this.order) {
    const st = this.P[p]; if (!st.alive) { st.hegeSince = null; continue; }
    const n = this.rows(p).length, on = !this.dev() && n > total * this.hegeShare();
    if (on && st.hegeSince == null) { st.hegeSince = this.t; this.L(`👑 ${st.name}已占据 ${n}/${total} 块领地！若守住 ${RULES.hegeHold} 秒便将称霸天下`, "hege", "all"); }
    else if (!on && st.hegeSince != null) { st.hegeSince = null; this.L(`${st.name}的霸业受挫，领地跌破六成`, "phase", "all"); }
  }
};
Sim.prototype.rows = function (pid) { const out = []; for (let i = 0; i < this.R.length; i++) if (this.R[i].owner === pid) out.push(i); return out; };
Sim.prototype.output = function (r) { // 每分钟产出
  const R = this.R[r], T = TERR[this.map.regions[r].terr], Tr = TRAITS[R.trait];
  if (R.floodUntil > this.t) return { gold: 0, food: 0 };
  const k = R.pop / 1000, lm = .4 + .6 * R.loyalty / 100, st = R.owner ? this.P[R.owner] : null;
  const W = this.W, wf = (W.harvest > this.t ? 1.5 : 1) * (W.drought > this.t ? .6 : 1) * (st && st.famineUntil > this.t ? .5 : 1) * (st && st.locustUntil > this.t ? 0 : 1), wg = W.trade > this.t ? 1.5 : 1;
  const food = k * 6 * T.food * Tr.food * lm * (R.harvestUntil > this.t ? 2 : 1) * wf;
  let gold = k * 4.5 * T.gold * Tr.gold * lm * (R.policy === "tax" ? 1.6 : 1) * wg + R.mine * 8;
  if (R.taxFreeUntil > this.t) gold = R.mine * 8;
  return { gold, food };
};
Sim.prototype.income = function (pid) {
  let gold = 0, food = 0, troops = 0, pop = 0;
  this.R.forEach((R, i) => { if (R.owner !== pid) return; const o = this.output(i); gold += o.gold; food += o.food; troops += this.gar(R); pop += R.pop; });
  const army = this.armies.filter(a => a.owner === pid).reduce((s, a) => s + a.troops, 0);
  return { gold, food, upkeep: (troops + army) * .1, pop };
};
Sim.prototype.defMult = function (r, attacker, breach) {
  const R = this.R[r];
  let m = breach ? 1 : TERR[this.map.regions[r].terr].def * (TRAITS[R.trait].def || 1) * (R.wallUntil > this.t ? 1.6 : 1) * (R.rampart ? 1.2 : 1) * (R.ironUntil > this.t ? 2.2 : 1);
  if (attacker && R.owner && this.P[attacker] && this.P[attacker].renown <= -10) m *= 1.2; // 哀兵：百姓不愿落入屠夫之手
  if (R.owner && this.P[R.owner] && this.P[R.owner].dragonUntil > this.t) m *= 1.3; // 真龙护佑
  return m;
};
// 守军折算：无当飞军在山林守城更强
Sim.prototype.garDefAt = function (r) { const R = this.R[r], terr = this.map.regions[r].terr; let s = R.troops; for (const k in R.el) s += R.el[k] * UNITS[k].def * (k === "wudang" && (terr === "hill" || terr === "forest") ? 1.3 : 1); return s; };
// 军队的进攻倍率：兵种 × 真龙
Sim.prototype.armyAtk = function (a) { return a.atk * (this.P[a.owner] && this.P[a.owner].dragonUntil > this.t ? 1.5 : 1); };
Sim.prototype.loyAll = function (pid, d) { this.R.forEach(R => { if (R.owner === pid) R.loyalty = Math.max(0, Math.min(100, R.loyalty + d)); }); };

/* ---------- 行军 ---------- */
Sim.prototype.path = function (from, to) {
  const n = this.R.length, dist = new Array(n).fill(1e12), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  dist[from] = 0;
  for (let it = 0; it < n; it++) {
    let a = -1, bd = 1e12; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; a = i; }
    if (a < 0 || a === to) break; done[a] = true;
    for (const b of this.map.regions[a].adj) { const d = bd + this.segLen(a, b) / this.segSpeed(a, b); if (d < dist[b]) { dist[b] = d; prev[b] = a; } }
  }
  if (dist[to] >= 1e12) return null;
  const p = [to]; while (p[0] !== from) p.unshift(prev[p[0]]);
  return p;
};
Sim.prototype.segLen = function (a, b) { return this.map.rlen[a < b ? a + "," + b : b + "," + a]; };
// 沿官道取点：from→to 段上走了 d 的位置
Sim.prototype.routePt = function (a, b, d) {
  const key = a < b ? a + "," + b : b + "," + a, pts = this.map.routes[key], L = this.map.rlen[key];
  let x = Math.max(0, Math.min(L, a < b ? d : L - d));
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], l = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
    if (x <= l || i === pts.length - 1) { const f = l ? Math.min(1, x / l) : 0; const ang = Math.atan2(y1 - y0, x1 - x0); return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, ang: a < b ? ang : ang + Math.PI }; }
    x -= l;
  }
  return { x: pts[0][0], y: pts[0][1], ang: 0 };
};
Sim.prototype.segSpeed = function (a, b) { return (TERR[this.map.regions[a].terr].speed + TERR[this.map.regions[b].terr].speed) / 2; };
/* 半路截杀的行军计划：从 from 出发，先到敌军要去的下一站 T，再迎着敌军走上它正在走的那条官道 */
Sim.prototype.huntPlan = function (pid, from, armyId) {
  const e = this.armies.find(x => x.id === armyId && x.troops > 0);
  if (!e || e.owner === pid) return "要选一支他人的军队";
  if (!this.armyVisibleTo(e, pid)) return "看不见这支军队";
  if (this.relOf(pid, e.owner) === "ally") return "不能截杀盟友";
  if (this.dev()) return "发育期内不能攻击其他玩家";
  const X = e.path[e.idx], T = e.path[e.idx + 1];
  if (T == null) return "这支军队已经到了";
  let path;
  if (from === X) path = [X, T]; // 就在敌军身后：追着走
  else { path = this.path(from, T); if (!path) return "到不了那里"; if (path[path.length - 1] !== X) path.push(X); }
  return { path, T, X, e };
};
Sim.prototype.launch = function (pid, from, to, n, opt = {}) {
  let path, hunt = null;
  if (opt.hunt != null) { const plan = this.huntPlan(pid, from, opt.hunt); if (typeof plan === "string") return plan; path = plan.path; hunt = plan; }
  else { path = this.path(from, to); if (!path) return "到不了那里"; }
  const U = UNITS[opt.kind];
  if (U) { this.R[from].el[opt.kind] -= n; if (this.R[from].el[opt.kind] <= 0) delete this.R[from].el[opt.kind]; } else this.R[from].troops -= n;
  const a = { id: ++this.aseq, owner: pid, path, idx: 0, d: 0, troops: n, atk: U ? U.atk : opt.atk || 1, speed: U ? U.speed : opt.speed || 1, born: this.t, seen: [], kind: opt.kind || "army", hiddenUntil: opt.hidden ? this.t + 180 : 0,
    hunt: hunt ? hunt.e.id : 0, huntTo: hunt ? hunt.T : -1, home: from, ld: null };
  this.armies.push(a);
  this.FX("march", { r: from, r2: hunt ? hunt.T : to, by: pid, vis: this.watchers([from]).concat(pid) });
  if (hunt) this.L(`${this.pname(pid)}从${this.rname(from)}派出 ${n} 兵，半路截杀${this.pname(hunt.e.owner)}的军队`, "info", [pid], from);
  this.enterSeg(a);
  return null;
};
// 看得见一支军队 = 它此刻正身处你看得见的地区（前半程算出发地，后半程算目的地）；巡哨过的地区也看得见；奇袭部队谁都看不见
Sim.prototype.armyVisibleTo = function (a, pid) {
  if (a.owner === pid) return true;
  if (this.relOf(pid, a.owner) === "ally") return true; // 盟友互通军情
  if (a.hiddenUntil > this.t && !this.final()) return false;
  const A = a.path[a.idx], B = a.path[a.idx + 1], at = B == null || a.d < this.segLen(A, B) / 2 ? A : B;
  if (this.R[at].patrols.some(q => q.until > this.t && (q.by === pid || this.relOf(pid, q.by) === "ally"))) return true;
  if (this.W.fog > this.t) return this.R[at].owner === pid; // 大雾：只看得见自家地界里的军队
  return this.visible(pid, at);
};
Sim.prototype.enterSeg = function (a) {
  const from = a.path[a.idx], to = a.path[a.idx + 1];
  if (a.hiddenUntil > this.t && !this.final()) return;
  for (const p of this.order) {
    if (p === a.owner || !this.P[p].alive) continue;
    const patrol = r => this.R[r].patrols.some(q => q.until > this.t && (q.by === p || this.relOf(p, q.by) === "ally"));
    if (this.W.fog > this.t ? !(this.R[from].owner === p || this.R[to].owner === p || patrol(from) || patrol(to)) : !(this.visible(p, from) || this.visible(p, to) || patrol(from) || patrol(to))) continue;
    const nextMine = this.R[to].owner === p, key = p + (nextMine ? "!" : "");
    if (a.seen.includes(key)) continue;
    a.seen.push(key);
    const ally = this.relOf(p, a.owner) === "ally";
    if (nextMine && !ally) this.L(`⚠ ${this.pname(a.owner)}的军队（约 ${Math.round(a.troops)}）正逼近你的${this.rname(to)}！`, "alert", [p], to);
    else if (this.visible(p, from)) this.L(`发现${this.pname(a.owner)}的军队（约 ${Math.round(a.troops)}）经过${this.rname(from)}，${this.visible(p, to) ? "往" + this.rname(to) + "方向" : "去向不明"}`, ally ? "info" : "watch", [p], from);
    else this.L(`发现${this.pname(a.owner)}的军队（约 ${Math.round(a.troops)}）正开进${this.rname(to)}`, ally ? "info" : "watch", [p], to);
  }
};
Sim.prototype.stepArmies = function () {
  for (const a of this.armies.slice()) {
    if (a.troops <= 0) continue;
    a.d += this.armyStep(a);
    while (a.troops > 0) {
      const L = this.segLen(a.path[a.idx], a.path[a.idx + 1]);
      if (a.d < L) break;
      a.d -= L; a.idx++;
      const node = a.path[a.idx];
      this.checkAmbush(a, node);
      if (a.troops <= 0) break;
      if (a.idx === a.path.length - 1) { if (a.hunt) { if (this.huntEnd(a, node)) continue; } this.arrive(a, node); a.troops = -1; break; }
      this.enterSeg(a);
    }
  }
  this.checkHunts();
  this.armies = this.armies.filter(a => a.troops > 0);
};
Sim.prototype.armyStep = function (a) { // 每秒走多远
  const A = a.path[a.idx], B = a.path[a.idx + 1];
  let move = SPEED * a.speed * (a.kind === "wudang" ? 1 : a.kind === "tengjia" ? Math.max(this.segSpeed(A, B), 1) : this.segSpeed(A, B));
  if ((this.R[A].floodUntil > this.t || this.R[B].floodUntil > this.t) && a.kind !== "tengjia") move *= .5;
  return move;
};
/* ---------- 半路截杀 ---------- */
// 追击失败后该去哪：目标城还是自己人的就去帮忙守，否则回老家
Sim.prototype.huntDest = function (a) { const T = this.R[a.huntTo]; return T && (T.owner === a.owner || (T.owner && this.relOf(a.owner, T.owner) === "ally")) ? a.huntTo : a.home; };
// 追到了路的尽头也没追上（走到了敌军的出发地）：别去攻城，改道
Sim.prototype.huntEnd = function (a, node) {
  const dest = this.huntDest(a); a.hunt = 0; a.ld = null;
  if (node === dest) return false; // 正好就是要去的地方：照常进城
  const p = this.path(node, dest); if (!p) return false;
  a.path = p; a.idx = 0; a.d = 0; this.enterSeg(a);
  this.L(`截杀未果，${this.rname(node)}一带的部队转往${this.rname(dest)}`, "info", [a.owner], node);
  return true;
};
// 原地掉头：当前在 A→B 段走了 d，改成 B→A 再接着去 dest
Sim.prototype.turnBack = function (a, dest) {
  const A = a.path[a.idx], B = a.path[a.idx + 1], L = this.segLen(A, B);
  if (B === dest) { a.path = a.path.slice(0, a.idx + 2); return; }
  const rest = A === dest ? [A] : (this.path(A, dest) || [A]);
  a.path = [B, ...rest]; a.idx = 0; a.d = Math.max(0, L - a.d); a.seen = []; this.enterSeg(a);
};
Sim.prototype.checkHunts = function () {
  for (const a of this.armies) {
    if (!a.hunt || a.troops <= 0 || a.idx >= a.path.length - 1) continue;
    const e = this.armies.find(x => x.id === a.hunt && x.troops > 0);
    if (!e || e.idx >= e.path.length - 1) { // 目标没了（已到达或被歼灭）
      a.hunt = 0; a.ld = null; const dest = this.huntDest(a);
      this.turnBack(a, dest);
      this.L(`没能追上敌军，部队转往${this.rname(dest)}${dest === a.huntTo ? "助守" : ""}`, "info", [a.owner], dest);
      continue;
    }
    const A = a.path[a.idx], B = a.path[a.idx + 1], C = e.path[e.idx], D = e.path[e.idx + 1];
    const same = (A === C && B === D) || (A === D && B === C);
    if (!same) { a.ld = null; continue; }
    const L = this.segLen(A, B), ep = C === A ? e.d : L - e.d, diff = ep - a.d; // 都从 A 这头量
    let radius = CATCH * (a.kind === "hubao" ? 2 : 1) * (e.kind === "wudang" ? .5 : 1);
    const crossed = a.ld != null && ((a.ld > 0 && diff < 0) || (a.ld < 0 && diff > 0));
    if (Math.abs(diff) <= radius || crossed) this.clash(a, e, A, B, Math.max(0, Math.min(L, a.d + diff / 2)));
    else a.ld = diff;
  }
};
// 野战：两军在官道上相遇
Sim.prototype.clash = function (h, e, A, B, d) {
  const pt = this.routePt(A, B, d), vis = this.watchers([A, B]).concat(h.owner, e.owner);
  const mul = x => this.armyAtk(x) * (x.kind === "hubao" ? 1.25 : 1);
  const Sh = h.troops * mul(h), Se = e.troops * mul(e), lossK = x => x.kind === "tengjia" ? .6 : .85;
  if (this.relOf(h.owner, e.owner) === "peace") this.declare(h.owner, e.owner);
  this.FX("clash", { x: pt.x, y: pt.y, r: A, by: h.owner, def: e.owner, u: h.kind, u2: e.kind, vis });
  if (Sh > Se) {
    const before = h.troops, left = Math.max(1, Math.round(before - Se / mul(h) * lossK(h))), dead = Math.round(e.troops);
    h.troops = left; e.troops = 0;
    this.L(`⚔ ${this.pname(h.owner)}在${this.rname(A)}—${this.rname(B)}的官道上截住了${this.pname(e.owner)}的军队，歼敌 ${dead}，自损 ${Math.round(before - left)}`, "battle", vis, A);
    h.hunt = 0; h.ld = null; const dest = this.huntDest(h); this.turnBack(h, dest);
  } else {
    const before = e.troops, left = Math.max(1, Math.round(before - Sh / mul(e) * lossK(e))), dead = Math.round(h.troops);
    e.troops = left; h.troops = 0;
    this.L(`⚔ ${this.pname(h.owner)}的截杀部队在${this.rname(A)}—${this.rname(B)}的官道上被${this.pname(e.owner)}击溃，${dead} 兵尽没，敌军折损 ${Math.round(before - left)}`, "battle", vis, A);
  }
};
Sim.prototype.checkAmbush = function (a, r) {
  const R = this.R[r];
  for (const am of R.ambush) {
    if (am.until <= this.t || am.by === a.owner || this.relOf(am.by, a.owner) === "ally" || !this.P[am.by].alive) continue;
    const kill = Math.min(a.troops, a.kind === "wudang" || a.kind === "tengjia" ? am.str / 2 : am.str);
    a.troops -= kill; am.until = 0;
    const vis = this.watchers([r]).concat(a.owner, am.by);
    this.FX("ambushHit", { r, vis });
    this.L(`${this.pname(am.by)}在${this.rname(r)}伏击了${this.pname(a.owner)}的军队，歼敌 ${Math.round(kill)}${a.troops <= 0 ? "，全军覆没" : ""}`, "battle", vis, r);
    if (this.relOf(am.by, a.owner) === "peace") this.declare(am.by, a.owner);
    if (a.troops <= 0) return;
  }
  R.ambush = R.ambush.filter(x => x.until > this.t);
};
Sim.prototype.declare = function (a, b) {
  if (this.relOf(a, b) === "war") return;
  this.setRel(a, b, "war"); delete this.offers[a + ">" + b]; delete this.offers[b + ">" + a];
  this.L(`${this.pname(a)}与${this.pname(b)}正式开战`, "diplo", "all");
};
Sim.prototype.arrive = function (a, r) {
  const R = this.R[r], p = a.owner, vis = this.watchers([r]).concat(p, R.owner).filter(Boolean);
  if (R.owner === p) { this.addTroops(R, a.kind, a.troops); return; }
  if (R.owner && this.relOf(p, R.owner) === "ally") { this.addTroops(R, a.kind, a.troops); this.L(`${this.pname(p)}派来 ${Math.round(a.troops)} 援军进驻${this.rname(r)}`, "diplo", vis, r); this.FX("reinforce", { r, vis }); return; }
  if (R.owner && this.relOf(p, R.owner) === "peace") {
    if (this.dev()) { const home = a.path[0]; if (this.R[home].owner === p) this.addTroops(this.R[home], a.kind, a.troops); this.L("发育期内不能进攻其他玩家，军队已撤回", "info", [p], r); return; }
    this.declare(p, R.owner);
  }
  this.FX("battle", { r, by: p, def: R.owner || (R.beast > R.troops ? "beast" : null), u: a.kind, vis });
  if (a.kind === "lianu" && (this.gar(R) + R.beast) > 0) { this.cutVolley(R, .8); R.beast *= .8; this.FX("volley", { r, by: p, vis }); } // 连弩先射一轮（大戟士不怕）
  if ((R.el.lianu || 0) > 0 && R.owner) { a.troops = Math.max(1, Math.round(a.troops * .85)); this.FX("volley", { r, by: R.owner, vis }); } // 城头箭雨
  const aa = this.armyAtk(a);
  const dm = this.defMult(r, p, a.kind === "xianzhen"), def = (this.garDefAt(r) + R.beast) * dm, atk = a.troops * aa, was = R.owner;
  if (atk > def) {
    const left = Math.max(1, Math.round(a.troops - def / aa * (a.kind === "xianzhen" ? .6 : .85)));
    this.own(r, p, 0); this.addTroops(R, a.kind, left);
    this.capture(r, p, was, vis);
    if (was) this.checkDead(was);
  } else {
    const dmg = atk / dm * .85, raw = Math.max(1, this.garDefAt(r) + R.beast), keep = Math.max(0, 1 - dmg / raw);
    R.beast = Math.max(0, R.beast * keep); this.cut(R, keep, "battle"); R.troops = Math.max(0, R.troops);
    this.L(was ? `${this.pname(p)}进攻${this.rname(r)}失败，${Math.round(a.troops)} 兵全军覆没` : `${this.pname(p)}的军队在${this.rname(r)}被${R.beast > 0 ? "凶兽" : "当地民兵"}击溃`, "battle", vis, r);
  }
};
Sim.prototype.capture = function (r, p, was, vis) { // 占领后：等待新主人决定如何处置百姓
  const R = this.R[r], st = this.P[p];
  R.policy = "military"; R.loyalty = Math.max(0, 35 + (st.renown <= -10 ? -10 : st.renown >= 10 ? 10 : 0));
  st.known[r] = 1; st.taken++;
  this.FX("capture", { r, by: p, vis });
  this.L(was ? `${this.pname(p)}攻占了${this.pname(was)}的${this.rname(r)}` : `${this.pname(p)}占领了${this.rname(r)}`, was ? "battle" : "info", vis, r);
  if (R.pop >= 300 && R.trait !== "ruin") { R.pend = { by: p, until: this.t + 30 }; this.L(`攻下${this.rname(r)}，城中 ${Math.round(R.pop)} 居民听候发落`, "decide", [p], r); }
};
Sim.prototype.checkDead = function (pid) {
  if (this.R.some(R => R.owner === pid)) return;
  const st = this.P[pid]; if (!st.alive) return;
  st.alive = false; st.diedAt = this.t;
  this.armies.forEach(a => { if (a.owner === pid) a.troops = 0; });
  this.L(`${st.name}失去了所有领地，退出了争霸`, "diplo", "all");
  this.L(`☠ 国破：你失去了所有领地`, "defeat", [pid]);
};
Sim.prototype.fixCapital = function (pid) {
  const st = this.P[pid]; if (this.R[st.capital] && this.R[st.capital].owner === pid) return;
  const mine = this.rows(pid); if (!mine.length) return;
  st.capital = mine.reduce((a, b) => this.R[b].pop > this.R[a].pop ? b : a);
  this.L(`迁都${this.rname(st.capital)}`, "info", [pid], st.capital);
};

/* ---------- 卡牌获取 ---------- */
Sim.prototype.pool = function (tier) { const dev = this.dev(); return Object.keys(CARDS).filter(k => CARDS[k].tier === tier && (!dev || DEV_CATS.includes(CARDS[k].cat))); };
Sim.prototype.give = function (st, k, how) { st.hand.push({ h: ++st.hseq, k }); st.got.push({ t: this.t, k, how }); };
Sim.prototype.drawCard = function (st) {
  st.draws++;
  const r1 = h2(hstr(st.id), st.draws, this.cfg.seed), r2 = h2(hstr(st.id) ^ 0x9e37, st.draws, this.cfg.seed);
  let tier, x = r1 * 100;
  for (const t of [1, 2, 3, 4]) { x -= DRAW.w[t]; if (x < 0) { tier = t; break; } }
  if (!tier) tier = 1;
  if (st.pity + 1 >= DRAW.pity && tier < 3) tier = 3;
  if (tier >= 3) st.pity = 0; else st.pity++;
  let pool = this.pool(tier); while (!pool.length && tier > 1) pool = this.pool(--tier);
  return pool[Math.floor(r2 * pool.length)];
};

// 市集买牌越买越贵
Sim.prototype.deal = function (st) { // 自动发牌
  while (st.owed > 0 && st.hand.length < HAND_MAX) { st.owed--; this.give(st, this.drawCard(st), "deal"); }
};
Sim.prototype.buyPrice = function (st, k) { const p = CARDS[k].price, m = 1 + .1 * Math.min(st.bought, 10); return { gold: Math.round((p.gold || 0) * m), food: Math.round((p.food || 0) * m) }; };

/* ---------- 事件 ---------- */
Sim.prototype.apply = function (ev) {
  const st = this.P[ev.by];
  if (!st || !st.alive || this.over) return "无效";
  const fn = this["ev_" + ev.type]; if (!fn) return "未知操作";
  return fn.call(this, st, ev.a || {}, ev);
};
const afford = (st, c) => (c.gold || 0) <= st.gold + 1e-9 && (c.food || 0) <= st.food + 1e-9;
const pay = (st, c) => { if (!afford(st, c)) return false; st.gold -= c.gold || 0; st.food -= c.food || 0; return true; };
Sim.prototype.ev_draw = function () { return "卡牌已改为自动发放"; };
Sim.prototype.ev_buy = function (st, a) {
  const C = CARDS[a.k]; if (!C || C.tier !== 1) return "市集只卖凡品";
  if (this.dev() && !DEV_CATS.includes(C.cat)) return "发育期市集只卖收益、辅助类";
  if (st.hand.length >= HAND_MAX) return "手牌已满";
  if (!pay(st, this.buyPrice(st, a.k))) return "资源不够";
  st.bought++; this.give(st, a.k, "buy"); return null;
};
Sim.prototype.ev_sac = function (st, a) {
  const S = SAC[a.kind], C = CARDS[a.k], R = this.R[a.r];
  if (!S || !C || C.tier !== S.tier) return "献祭和卡牌等级不符";
  if (!R || R.owner !== st.id) return "只能献祭自己的地区";
  if (st.hand.length >= HAND_MAX) return "手牌已满";
  const vis = this.watchers([a.r]).concat(st.id);
  if (a.kind === "army") {
    if (R.troops < S.troops + 1) return "这里的兵不够 " + (S.troops + 1);
    R.troops -= S.troops;
    this.L(`${st.name}在${this.rname(a.r)}以 ${S.troops} 名士兵献祭`, "sac", vis, a.r);
  } else if (a.kind === "pop") {
    if (R.pop < S.minPop) return "居民不足 " + S.minPop;
    const dead = Math.round(R.pop * .6); R.pop -= dead;
    this.loyAll(st.id, -8); R.loyalty = Math.max(0, R.loyalty - 32); st.renown -= 3;
    this.L(`${st.name}在${this.rname(a.r)}举行血祭，${dead} 名百姓殒命`, "sac", vis, a.r);
  } else if (a.kind === "city") {
    if (this.rows(st.id).length <= 1) return "这是你最后一座城";
    R.owner = null; R.troops = 0; R.el = {}; R.home = null; R.pop = 0; R.cap = 0; R.trait = "ruin"; R.loyalty = 0; R.mine = 0; R.policy = "home"; R.pend = null; R.beacon = 0; R.rampart = 0; R.decoyUntil = 0; R.ironUntil = 0;
    this.loyAll(st.id, -10); st.renown -= 2; this.snapshot(st.id, a.r);
    this.L(`${st.name}亲手焚毁了${this.rname(a.r)}，那里化为一片焦土`, "sac", "all", a.r);
    this.fixCapital(st.id);
  } else return "未知献祭";
  this.FX("sacrifice", { r: a.r, kind: a.kind, vis });
  this.give(st, a.k, "sac");
  return null;
};
Sim.prototype.ev_policy = function (st, a) {
  const R = this.R[a.r], P = POLICY[a.c];
  if (!R || R.owner !== st.id || !R.pend || R.pend.by !== st.id) return "这里没有待处置的百姓";
  if (!P) return "无效";
  const k = R.pop / 1000, vis = this.watchers([a.r]).concat(st.id);
  if (a.c === "benevolent") { if (!pay(st, { food: 30 })) return "开仓赈济需要 30 粮"; R.loyalty = 70; R.taxFreeUntil = this.t + 90; R.boomUntil = this.t + 180; st.renown += 3; this.L(`${st.name}在${this.rname(a.r)}开仓赈济，百姓箪食壶浆`, "policy", vis, a.r); }
  if (a.c === "military") R.loyalty = 40;
  if (a.c === "tax") { const g = Math.round(k * 30); st.gold += g; R.loyalty = 30; st.renown -= 1; this.L(`${st.name}在${this.rname(a.r)}横征暴敛，搜刮 ${g} 金`, "policy", vis, a.r); }
  if (a.c === "massacre") {
    const dead = Math.round(R.pop * .95), g = Math.round(k * 50), f = Math.round(k * 40);
    R.pop -= dead; st.gold += g; st.food += f; R.loyalty = 0; R.noGrowUntil = this.t + 300;
    this.loyAll(st.id, -10); st.renown -= 10;
    this.L(`☠ ${st.name}在${this.rname(a.r)}屠城，${dead} 人罹难。天下震动`, "massacre", "all", a.r);
    this.FX("massacre", { r: a.r, vis: this.order.slice() });
  }
  R.policy = a.c; R.pend = null;
  return null;
};
Sim.prototype.ev_discard = function (st, a) { const i = st.hand.findIndex(c => c.h === a.h); if (i < 0) return "没有这张牌"; const t = CARDS[st.hand[i].k].tier; st.hand.splice(i, 1); st.gold += [0, 10, 30, 80, 200][t]; return null; };
Sim.prototype.ev_levy = function (st, a) {
  const R = this.R[a.r]; if (!R || R.owner !== st.id) return "不是你的地区";
  if (R.home) return "国都只训练特殊兵种";
  const need = Math.round(LEVY.pop * (TRAITS[R.trait].recruit || 1));
  if (R.pop < need + 300) return "这里的居民太少，征不到兵";
  if (!pay(st, LEVY)) return "资源不够";
  R.troops += LEVY.n; R.pop -= need; this.FX("levy", { r: a.r, vis: this.watchers([a.r]) }); return null;
};
Sim.prototype.ev_train = function (st, a) {
  const R = this.R[a.r]; if (!R || R.owner !== st.id) return "不是你的地区";
  if (!R.home) return "只有国都才能训练特殊兵种";
  if (R.pop < TRAIN.pop + 300) return "居民太少";
  if (!pay(st, TRAIN)) return "资源不够";
  R.el[R.home] = (R.el[R.home] || 0) + TRAIN.n; R.pop -= TRAIN.pop;
  this.FX("train", { r: a.r, u: R.home, vis: this.watchers([a.r]).concat(st.id) }); return null;
};
Sim.prototype.ev_move = function (st, a) {
  const R = this.R[a.from], hunt = a.hunt != null ? a.hunt : null, T = hunt != null ? null : this.R[a.to];
  if (!R || (!T && hunt == null) || R.owner !== st.id) return "只能从自己的地区出兵";
  const n = Math.floor(a.n), opt = hunt != null ? { hunt } : {};
  if (a.u) {
    if (!UNITS[a.u]) return "无效兵种";
    if (!(n >= 1) || n > (R.el[a.u] || 0)) return "这里没有那么多" + UNITS[a.u].name;
    opt.kind = a.u;
  } else if (!(n >= 1) || n > R.troops - 1) return "兵力不够（至少留 1 兵守家）";
  if (hunt != null) return this.launch(st.id, a.from, null, n, opt);
  if (a.from === a.to) return "目标和出发地相同";
  if (this.dev() && T.owner && T.owner !== st.id && this.relOf(st.id, T.owner) !== "ally") return "发育期内不能进攻其他玩家";
  return this.launch(st.id, a.from, a.to, n, opt);
};
Sim.prototype.ev_ally = function (st, a) {
  const o = this.P[a.to]; if (!o || !o.alive || o.id === st.id) return "无效";
  if (this.relOf(st.id, o.id) === "ally") return "已经是盟友";
  if (this.offers[o.id + ">" + st.id] != null) { delete this.offers[o.id + ">" + st.id]; this.setRel(st.id, o.id, "ally"); this.L(`${st.name}与${o.name}结为同盟`, "diplo", "all"); return null; }
  this.offers[st.id + ">" + o.id] = this.t;
  this.L(`${st.name}向你提议结盟`, "offer", [o.id]); this.L(`已向${o.name}提议结盟，等待回应`, "info", [st.id]);
  return null;
};
Sim.prototype.ev_reject = function (st, a) { delete this.offers[a.to + ">" + st.id]; this.L(`${st.name}拒绝了结盟提议`, "info", [a.to]); return null; };
Sim.prototype.ev_unally = function (st, a) { if (this.relOf(st.id, a.to) !== "ally") return "不是盟友"; this.setRel(st.id, a.to, "peace"); this.L(`${st.name}解除了与${this.pname(a.to)}的同盟`, "diplo", "all"); return null; };
Sim.prototype.ev_war = function (st, a) { if (this.dev()) return "发育期内不能宣战"; if (!this.P[a.to] || this.relOf(st.id, a.to) === "war") return "无效"; this.declare(st.id, a.to); return null; };
Sim.prototype.ev_peace = function (st, a) {
  if (this.relOf(st.id, a.to) !== "war") return "没有交战";
  if (this.offers["p" + a.to + ">" + st.id] != null) { delete this.offers["p" + a.to + ">" + st.id]; this.setRel(st.id, a.to, "peace"); this.L(`${st.name}与${this.pname(a.to)}停战`, "diplo", "all"); return null; }
  this.offers["p" + st.id + ">" + a.to] = this.t; this.L(`${st.name}请求停战`, "offer", [a.to]); this.L(`已向${this.pname(a.to)}请求停战`, "info", [st.id]); return null;
};
Sim.prototype.ev_ping = function (st, a) {
  if (!this.P[a.to] || this.R[a.r] == null) return "无效";
  this.FX("ping", { r: a.r, by: st.id, vis: [st.id, a.to] });
  this.L(`📣 ${st.name}：${a.msg || "注意"}（${this.rname(a.r)}）`, "ping", [st.id, a.to], a.r); return null;
};
Sim.prototype.ev_card = function (st, a) {
  const hi = st.hand.findIndex(c => c.h === a.h); if (hi < 0) return "没有这张牌";
  const k = st.hand[hi].k, C = CARDS[k];
  if (this.dev() && !DEV_CATS.includes(C.cat)) return "发育期只能用收益、辅助类卡牌";
  const err = this.useCard(st, k, a); if (err) return err;
  st.hand.splice(hi, 1); return null;
};
Sim.prototype.useCard = function (st, k, a) {
  const me = st.id, r = a.r, R = r != null ? this.R[r] : null, M = r != null ? this.map.regions[r] : null;
  const vis = rs => this.watchers(rs).concat(me);
  const mineReq = () => (!R || R.owner !== me) ? "要选自己的地区" : null;
  switch (k) {
    case "harvest": { const e = mineReq(); if (e) return e; R.harvestUntil = this.t + 150; this.FX("harvest", { r, vis: vis([r]) }); return null; }
    case "tax": { let pop = 0; this.rows(me).forEach(i => pop += this.R[i].pop); const g = Math.round(pop / 1000 * 8); st.gold += g; this.loyAll(me, -5); this.FX("tax", { by: me, vis: [me] }); this.L(`征税入账 ${g} 金，各地民心 −5`, "info", [me]); return null; }
    case "trade": { if (st.food < 60) return "粮食不够 60"; st.food -= 60; st.gold += 100; this.FX("tax", { by: me, vis: [me] }); return null; }
    case "recruit": { const e = mineReq(); if (e) return e; R.troops += 25; this.FX("levy", { r, vis: vis([r]) }); return null; }
    case "heaven": { const e = mineReq(); if (e) return e; R.troops += 80; this.FX("heaven", { r, vis: vis([r]) }); this.L(`${M.name}天降神兵 80`, "info", vis([r]), r); return null; }
    case "mine": { const e = mineReq(); if (e) return e; if (R.mine >= 3) return "这里的矿已经开满了"; R.mine++; this.FX("mine", { r, vis: vis([r]) }); return null; }
    case "settle": { const e = mineReq(); if (e) return e; if (R.pop >= R.cap) return "人口已达上限"; R.pop = Math.min(R.cap, R.pop + 1500); this.FX("settle", { r, vis: vis([r]) }); return null; }
    case "golden": { this.rows(me).forEach(i => { const X = this.R[i]; X.loyalty = 100; X.pop = Math.min(Math.max(X.cap, X.pop), Math.round(X.pop * 1.2)); this.FX("golden", { r: i, vis: vis([i]) }); }); this.L("盛世降临：万民归心", "info", [me]); return null; }
    case "pioneer": {
      if (!R || R.owner) return "要选无主的地区";
      if (R.trait === "ruin") return "废墟无法开拓";
      if (!M.adj.some(b => this.R[b].owner === me)) return "只能开拓与你相邻的地区";
      if (R.beast > 0 || R.troops > 0) { st.known[r] = 1; this.snapshot(me, r); this.FX("beastRoar", { r, vis: vis([r]) }); this.L(`开拓队在${M.name}遭遇${R.beast > 0 ? "凶兽" : "民兵"}，无功而返`, "info", [me], r); return null; }
      this.own(r, me, 5); R.loyalty = 60; R.policy = "home"; this.FX("capture", { r, by: me, vis: vis([r]) }); this.L(`和平接管了${M.name}，${Math.round(R.pop)} 居民归附`, "info", vis([r]), r); return null;
    }
    case "tame": {
      if (!R || R.beast <= 0 || R.owner) return "要选有凶兽的无主地区";
      if (!M.adj.some(b => this.R[b].owner === me)) return "只能驯服相邻地区的凶兽";
      const n = Math.round(R.beast * .7) + Math.round(R.troops); this.own(r, me, n); R.loyalty = 55; R.policy = "home"; this.FX("tame", { r, by: me, vis: vis([r]) }); this.L(`驯服了${M.name}的凶兽，收编 ${n} 兵`, "info", vis([r]), r); return null;
    }
    case "swift": case "march": { const ar = this.armies.find(x => x.id === a.army && x.owner === me); if (!ar) return "要选你正在行进的军队"; ar.speed *= k === "swift" ? 2 : 1.5; this.FX("swift", { army: ar.id, vis: [me] }); return null; }
    case "granary": { st.food += 120; this.FX("tax", { by: me, vis: [me] }); return null; }
    case "conscript": { const e = mineReq(); if (e) return e; if (R.pop < 900) return "居民太少（要 900 人以上）"; R.troops += 40; R.pop -= 600; R.loyalty = Math.max(0, R.loyalty - 10); this.FX("levy", { r, vis: vis([r]) }); this.L(`${M.name}强征 40 兵，民怨渐起`, "info", [me], r); return null; }
    case "patrol": { const e = mineReq(); if (e) return e; for (const x of [r, ...M.adj]) { const X = this.R[x]; X.patrols = X.patrols.filter(q => q.by !== me); X.patrols.push({ by: me, until: this.t + 180 }); } this.FX("scout", { r, vis: [me] }); return null; }
    case "rampart": { const e = mineReq(); if (e) return e; if (R.rampart) return "这里已经筑过垒了"; R.rampart = 1; this.FX("wall", { r, vis: vis([r]) }); return null; }
    case "decoy": { const e = mineReq(); if (e) return e; R.decoyUntil = this.t + 180; this.FX("rally", { r, r2: r, vis: [me] }); return null; }
    case "ironwall": { const e = mineReq(); if (e) return e; R.ironUntil = this.t + 180; this.FX("wall", { r, vis: vis([r]) }); return null; }
    case "feast": { this.rows(me).forEach(i => { const X = this.R[i]; X.loyalty = Math.min(100, X.loyalty + 12); if (!X.home) X.troops += 3; }); this.FX("golden", { r: st.capital, vis: [me] }); this.L("犒赏三军，万众欢腾", "info", [me]); return null; }
    case "dragon": { st.dragonUntil = this.t + 120; this.FX("heaven", { r: st.capital, vis: this.order.slice() }); this.L(`${st.name}真龙附体，两分钟内攻守皆强`, "info", "all", st.capital); return null; }
    case "blockade": case "locust": {
      const o = this.P[a.p]; if (!o || o.id === me || !o.alive) return "要选另一名玩家";
      if (this.relOf(me, o.id) === "ally") return "不能对盟友下手";
      if (k === "blockade") { o.famineUntil = this.t + 120; this.L(`${o.name}的粮道被切断，两分钟内粮产减半`, "disaster", [o.id, me]); }
      else { o.locustUntil = this.t + 120; o.food = Math.round(o.food / 2); this.L(`${o.name}境内蝗虫遮天蔽日：存粮减半，两分钟颗粒无收`, "disaster", "all", o.capital); }
      this.FX("spy", { p: o.id, vis: [me, o.id] });
      if (k === "blockade" && this.relOf(me, o.id) === "peace") this.declare(me, o.id);
      return null;
    }
    case "raid": case "rumor": case "mandate": {
      if (!R || !R.owner || R.owner === me || !this.visible(me, r)) return "要选看得见的他人地区";
      if (this.relOf(me, R.owner) === "ally") return "不能对盟友下手";
      const victim = R.owner, vv = vis([r]).concat(victim), kk = R.pop / 1000;
      if (k === "raid") { const g = Math.round(kk * 20), f = Math.round(kk * 15); st.gold += g; st.food += f; this.P[victim].gold = Math.max(0, this.P[victim].gold - g); this.P[victim].food = Math.max(0, this.P[victim].food - f); R.loyalty = Math.max(0, R.loyalty - 10); this.FX("fire", { r, r2: this.nearestOwn(me, r), vis: vv }); this.L(`${st.name}洗劫了${M.name}，掠走 ${g} 金 ${f} 粮`, "battle", vv, r); }
      else if (k === "rumor") { R.loyalty = Math.max(0, R.loyalty - 20); R.pop = Math.round(R.pop * .95); this.FX("subvert", { r, vis: vv }); this.L(`${M.name}流言四起，人心惶惶`, "disaster", vv, r); }
      else { if (this.P[victim].capital === r) return "天命不临国都"; if (this.rows(victim).length <= 1) return "这是他最后一座城"; this.own(r, me, Math.round(this.gar(R))); R.loyalty = 45; R.policy = "military"; this.FX("capture", { r, by: me, vis: vv }); this.L(`天命所归！${M.name}举城归顺${st.name}`, "battle", "all", r); this.checkDead(victim); this.fixCapital(victim); }
      if (this.relOf(me, victim) === "peace") this.declare(me, victim);
      return null;
    }
    case "stealth": {
      const F = this.R[a.from], T = this.R[a.to];
      if (!F || F.owner !== me) return "要从自己的地区出发";
      if (!T || a.to === a.from) return "要选目标地区";
      const n = Math.floor(a.n); if (!(n >= 1) || n > F.troops - 1) return "兵力不够";
      if (T.owner && T.owner !== me && this.relOf(me, T.owner) !== "ally" && this.dev()) return "发育期不能进攻其他玩家";
      return this.launch(me, a.from, a.to, n, { kind: "stealth", hidden: 1 });
    }
    case "storm": {
      if (!R) return "要选一个地区";
      const hit = [r, ...M.adj], vv = vis(hit).concat(...hit.map(x => this.R[x].owner).filter(Boolean));
      hit.forEach(x => { this.R[x].floodUntil = Math.max(this.R[x].floodUntil, this.t + 120); });
      this.FX("flood", { r, by: me, vis: vv }); this.L(`${M.name}一带暴雨倾盆，道路泥泞`, "disaster", vv, r);
      return null;
    }
    case "rally": {
      const e = mineReq(); if (e) return e; let got = 0;
      for (const b of M.adj) { const B = this.R[b]; if (B.owner === me && B.troops > 2) { const n = Math.floor(B.troops / 2); B.troops -= n; got += n; this.FX("rally", { r: b, r2: r, vis: vis([b, r]) }); } }
      if (!got) return "相邻没有可以调动的己方兵力";
      R.troops += got; return null;
    }
    case "scout": case "hawk": {
      if (!R) return "要选一个地区";
      const seen = this.reveal(me, r, k === "hawk" ? 2 : 1);
      this.FX(k, { r, vis: [me] }); this.L(`${k === "hawk" ? "鹰眼" : "斥候"}探明了${M.name}一带 ${seen.size} 个地区`, "info", [me], r); return null;
    }
    case "spy": {
      const o = this.P[a.p]; if (!o || o.id === me || !o.alive) return "要选另一名玩家";
      this.rows(o.id).forEach(i => { st.known[i] = 1; this.snapshot(me, i); });
      this.FX("spy", { p: o.id, vis: [me] });
      this.L(`密报：${o.name}有 ${Math.round(o.gold)} 金、${Math.round(o.food)} 粮，手牌 ${o.hand.length} 张，名望 ${o.renown}`, "info", [me]); return null;
    }
    case "wall": { const e = mineReq(); if (e) return e; R.wallUntil = this.t + 180; this.FX("wall", { r, vis: vis([r]) }); return null; }
    case "ambush": { if (!R || !this.visible(me, r)) return "只能在看得见的地区设伏"; R.ambush.push({ by: me, str: 40, until: this.t + 180 }); this.FX("ambushSet", { r, vis: [me] }); return null; }
    case "beacon": { const e = mineReq(); if (e) return e; this.reveal(me, r, 2); R.beacon = 1; this.FX("beacon", { r, vis: vis([r]) }); return null; }
    case "cavalry": {
      const F = this.R[a.from], T = this.R[a.to];
      if (!F || F.owner !== me) return "要从自己的地区出发";
      if (!T || a.to === a.from) return "要选目标地区";
      const n = Math.floor(a.n); if (!(n >= 1) || n > F.troops - 1) return "兵力不够";
      if (T.owner && T.owner !== me && this.relOf(me, T.owner) !== "ally" && this.dev()) return "发育期不能进攻其他玩家";
      return this.launch(me, a.from, a.to, n, { speed: 2, atk: 1.3, kind: "cavalry" });
    }
    case "fire": case "subvert": {
      if (!R || !R.owner || R.owner === me || !this.visible(me, r)) return "要选看得见的他人地区";
      if (this.relOf(me, R.owner) === "ally") return "不能对盟友下手";
      const victim = R.owner, vv = vis([r]).concat(victim);
      if (k === "fire") {
        if (R.ironUntil > this.t) { this.FX("fire", { r, r2: this.nearestOwn(me, r), vis: vv }); this.L(`${M.name}铁壁森严，火攻无功`, "info", vv, r); return null; }
        const before = this.gar(R); this.cut(R, .65, "fire"); R.troops = Math.round(R.troops); const k2 = Math.round(before - this.gar(R)); R.pop = Math.round(R.pop * .9);
        this.FX("fire", { r, r2: this.nearestOwn(me, r), vis: vv });
        this.L(`${st.name}火烧${M.name}，烧死守军 ${k2}`, "battle", vv, r);
      } else {
        if (R.loyalty < 50 && this.gar(R) < 20 && this.rows(victim).length > 1 && this.P[victim].capital !== r) {
          this.own(r, me, Math.round(this.gar(R))); R.loyalty = 50; R.policy = "military";
          this.FX("subvert", { r, by: me, vis: vv });
          this.L(`${M.name}的百姓揭竿而起，倒向了${st.name}`, "battle", vv, r);
          this.checkDead(victim);
        } else {
          R.loyalty = Math.max(0, R.loyalty - 30);
          this.FX("subvert", { r, vis: vv });
          this.L(`${M.name}流言四起，民心动摇`, "disaster", vv, r);
        }
      }
      if (this.relOf(me, victim) === "peace") this.declare(me, victim);
      return null;
    }
    case "intercept": {
      const ar = this.armies.find(x => x.id === a.army);
      if (!ar || ar.owner === me || !this.armyVisibleTo(ar, me)) return "要选看得见的他人军队";
      if (this.relOf(me, ar.owner) === "ally") return "不能截杀盟友";
      const k2 = Math.ceil(ar.troops * (ar.kind === "wudang" || ar.kind === "tengjia" ? .2 : .4)); ar.troops -= k2;
      const pos = ar.path[ar.idx], vv = this.watchers([pos, ar.path[ar.idx + 1]]).concat(me, ar.owner);
      this.FX("intercept", { army: ar.id, r: pos, r2: this.nearestOwn(me, pos), vis: vv });
      this.L(`${st.name}截杀${this.pname(ar.owner)}的军队，歼敌 ${k2}`, "battle", vv, pos);
      if (this.relOf(me, ar.owner) === "peace") this.declare(me, ar.owner);
      if (ar.troops <= 0) this.armies = this.armies.filter(x => x !== ar);
      return null;
    }
    case "quake": case "plague": case "flood": case "beasts": case "meteor": {
      if (!R) return "要选一个地区";
      const hit = k === "plague" ? [r, ...M.adj] : [r];
      const vv = vis(hit).concat(...hit.map(x => this.R[x].owner).filter(Boolean));
      if (k === "quake") { const b0 = this.gar(R); this.cut(R, .6, "hit"); R.troops = Math.round(R.troops); const d = Math.round(b0 - this.gar(R)); R.pop = Math.round(R.pop * .7); this.L(`${M.name}发生地震，守军 −${d}，房倒屋塌`, "disaster", vv, r); }
      if (k === "plague") { hit.forEach(x => { const X = this.R[x]; this.cut(X, .75, "hit"); X.troops = Math.round(X.troops); X.pop = Math.round(X.pop * .8); }); this.L(`${M.name}一带爆发瘟疫`, "disaster", vv, r); }
      if (k === "flood") { R.floodUntil = this.t + 150; this.cut(R, .85, "hit"); R.troops = Math.round(R.troops); R.pop = Math.round(R.pop * .9); this.L(`${M.name}洪水滔天`, "disaster", vv, r); }
      if (k === "meteor") { this.cut(R, .2, "hit"); R.troops = Math.round(R.troops); R.pop = Math.round(R.pop * .4); R.wallUntil = 0; this.L(`陨星坠落在${M.name}！`, "disaster", "all", r); }
      if (k === "beasts") {
        let b = 40;
        if (R.owner) { const gd = this.garDef(R), def = gd * this.defMult(r); if (def >= b) { this.cut(R, 1 - b / this.defMult(r) / Math.max(1, gd), "hit"); b = 0; } else { b -= def; const was = R.owner; R.owner = null; R.troops = 0; R.el = {}; R.pend = null; this.snapshot(was, r); this.checkDead(was); this.fixCapital(was); } }
        R.beast += b; R.troops = Math.max(0, Math.round(R.troops));
        this.L(`${M.name}兽潮来袭${R.owner ? "，守军死战击退" : "，此地沦为兽巢"}`, "disaster", vv, r);
      }
      this.FX(k, { r, by: me, vis: k === "meteor" ? this.order.slice() : vv });
      return null; // 天灾匿名：受害方不知道是谁放的
    }
  }
  return "未知卡牌";
};
Sim.prototype.nearestOwn = function (pid, r) {
  let best = null, bd = 1e12; const T = this.map.regions[r];
  this.rows(pid).forEach(i => { const M = this.map.regions[i], d = (M.x - T.x) ** 2 + (M.y - T.y) ** 2; if (d < bd) { bd = d; best = i; } });
  return best;
};

/* ---------- 时间推进 ---------- */
Sim.prototype.tick = function () {
  this.t++;
  const t = this.t;
  if (t === this.cfg.devSec) this.L("⚔ 发育期结束！从现在起可以进攻、宣战，抽签和市集出现所有类型的卡牌", "phase", "all");
  if (t === this.cfg.totalSec - RULES.finalSec) this.L("🔥 最后决战！迷雾散尽，天下城池与军队一览无余", "phase", "all");
  // 决战期全图公开；出局的玩家转为观战，也看全图
  for (const id of this.order) { const st = this.P[id]; if (!(this.final() || !st.alive)) continue; if (t % 3 === 0 || t === this.cfg.totalSec - RULES.finalSec) for (let r = 0; r < this.R.length; r++) { st.known[r] = 1; this.snapshot(id, r); } }
  this.stepArmies();
  for (const id of this.order) {
    const st = this.P[id]; if (!st.alive) continue;
    const inc = this.income(id);
    st.gold += inc.gold / 60; st.food += (inc.food - inc.upkeep) / 60;
    if (st.food < 0) {
      st.food = 0;
      if (t % 10 === 0) this.rows(id).forEach(i => { const R = this.R[i]; if (R.troops > 1) R.troops *= .97; R.loyalty = Math.max(0, R.loyalty - 2); });
      if (t % 60 === 0) this.L("粮食耗尽，士兵逃散，民怨沸腾！", "alert", [id]);
    }
    if (t % DRAW.dealEvery === 0) st.owed = Math.min(DRAW.owedMax + 1, st.owed + 1);
    if (st.owed > 0) this.deal(st);
  }
  // 待处置的城池：超时默认军管
  this.R.forEach((R, i) => { if (R.pend && R.pend.until <= t) { R.policy = "military"; R.loyalty = Math.max(R.loyalty, 40); R.pend = null; this.L(`${this.rname(i)}未下令处置，默认军管`, "info", [R.owner], i); } });
  if (t % 10 === 0) { this.people(); this.R.forEach(R => { if (R.patrols.length) R.patrols = R.patrols.filter(q => q.until > t); }); }
  if (t % ELITE_GROW === 0) this.R.forEach(R => {
    if (!R.owner || !R.home || R.pop < 500) return;
    let n = 0; for (const k in R.el) n += R.el[k];
    if (n < eliteCap(R)) { R.el[R.home] = (R.el[R.home] || 0) + 1; R.pop -= 40; }
  });
  if (t % 8 === 0) this.R.forEach(R => {
    const Tr = TRAITS[R.trait];
    if (R.owner && !R.home && R.troops < R.pop / 1000 * 8 && R.pop > 500) { const g = Tr.growth || 1; R.troops += g; R.pop -= 15 * g; }
    else if (!R.owner && R.beast > 0 && t % 40 === 0) R.beast += 1;
  });
  if (t % 30 === 0) this.unrest();
  if (t % 5 === 0) for (const id of this.order) { const st = this.P[id]; if (st.alive) st.maxRows = Math.max(st.maxRows, this.rows(id).length); }
  if (t >= this.W.next) this.omen();
  this.checkHegemony();
  this.checkEnd();
};
Sim.prototype.people = function () { // 人口增减与民心
  const t = this.t;
  this.R.forEach((R, i) => {
    if (R.trait === "ruin") return;
    const st = R.owner ? this.P[R.owner] : null, starving = st && st.food <= 0;
    // 人口
    if (starving) R.pop *= .995;
    else if (R.policy === "tax") R.pop *= .998;
    else if (R.noGrowUntil <= t && R.pop < R.cap) R.pop = Math.min(R.cap, R.pop * (1 + .004 * (R.boomUntil > t ? 2 : 1)) + 8);
    R.pop = Math.max(0, Math.round(R.pop));
    // 民心向目标值靠拢
    if (!R.owner) return;
    let target = R.policy === "home" ? 65 : POLICY[R.policy].target;
    if (st.capital === i) target = Math.max(target, 75);
    target += Math.max(-15, Math.min(15, st.renown / 2));
    if (R.loyalty < target) R.loyalty = Math.min(target, R.loyalty + 1.5); else if (R.loyalty > target) R.loyalty = Math.max(target, R.loyalty - .75);
  });
};
Sim.prototype.unrest = function () {
  // 叛乱：民心太低、守军太少
  this.R.forEach((R, i) => {
    if (!R.owner || R.pend || this.P[R.owner].capital === i) return;
    const k = R.pop / 1000;
    if (R.loyalty < 20 && this.gar(R) < k * 2 + 3 && h2(this.t, i, this.cfg.seed + 31) < .25) {
      const was = R.owner, vis = this.watchers([i]).concat(was);
      R.owner = null; R.troops = Math.max(5, Math.round(k * 3)); R.el = {}; R.policy = "home"; R.loyalty = 50; this.snapshot(was, i);
      this.FX("revolt", { r: i, vis });
      this.L(`${this.rname(i)}百姓不堪压迫，揭竿而起，脱离了${this.pname(was)}`, "alert", vis, i);
      this.checkDead(was);
    }
  });
  // 民心所向：名望高的玩家，邻近敌城的不满百姓会来投奔
  if (this.t % 60 !== 0) return;
  for (const p of this.order) {
    const st = this.P[p]; if (!st.alive || st.renown < 10) continue;
    this.R.forEach((R, i) => {
      if (!R.owner || R.owner === p || this.relOf(p, R.owner) === "ally" || R.pend) return;
      if (R.loyalty >= 35 || this.gar(R) >= 15 || this.P[R.owner].capital === i) return;
      if (!this.map.regions[i].adj.some(b => this.R[b].owner === p)) return;
      if (h2(this.t, i * 7 + hstr(p) % 97, this.cfg.seed + 47) >= .12) return;
      const was = R.owner, vis = this.watchers([i]).concat(was, p);
      this.own(i, p, Math.round(this.gar(R))); R.loyalty = 60; R.policy = "home";
      this.FX("subvert", { r: i, by: p, vis });
      this.L(`${this.rname(i)}的百姓仰慕${st.name}的仁名，举城来投`, "battle", vis, i);
      this.checkDead(was);
    });
  }
};
/* ---------- 天时：随机事件 ----------
 每 100–160 秒一次。一半是天下皆受的大势，一半落在某一位玩家头上：
 福事多半落给国力最弱的，祸事多半落给最强的（天道均衡），也有三成是随机的。 */
const OMEN = { first: 90, gap: 100, spread: 60 };
const OMENS = [
  { k: "harvest", g: 1, w: 3, name: "风调雨顺", glyph: "丰", good: 1, desc: "天下丰年：两分钟内各地粮食产出 ×1.5" },
  { k: "drought", g: 1, w: 3, name: "赤地千里", glyph: "旱", good: 0, desc: "大旱：两分钟内各地粮食产出 ×0.6" },
  { k: "trade", g: 1, w: 3, name: "商路大开", glyph: "商", good: 1, desc: "四方通商：两分钟内各地金钱产出 ×1.5" },
  { k: "fog", g: 1, w: 3, name: "大雾弥天", glyph: "雾", good: 0, desc: "九十秒内伸手不见五指：只看得见自家地界里的军队，正是偷袭的好时机" },
  { k: "boon", g: 1, w: 2, name: "紫气东来", glyph: "瑞", good: 1, desc: "天降祥瑞：每位玩家额外获得一张卡牌" },
  { k: "plagueAll", g: 1, w: 2, name: "天下大疫", glyph: "疫", good: 0, desc: "各地居民 −8%，守军 −5%" },
  { k: "beastsAll", g: 1, w: 2, name: "兽群迁徙", glyph: "兽", good: 0, desc: "山林中的凶兽成群出没，几块无主之地凶兽大增" },
  { k: "refugee", g: 0, w: 3, name: "流民来投", glyph: "民", good: 1 },
  { k: "hero", g: 0, w: 3, name: "豪杰来投", glyph: "杰", good: 1 },
  { k: "gold", g: 0, w: 2, name: "发现金矿", glyph: "金", good: 1 },
  { k: "merchant", g: 0, w: 2, name: "云游商人", glyph: "商", good: 1 },
  { k: "rain", g: 0, w: 2, name: "天降甘霖", glyph: "霖", good: 1 },
  { k: "granary", g: 0, w: 3, name: "粮仓失火", glyph: "火", good: 0 },
  { k: "sedition", g: 0, w: 3, name: "地方生乱", glyph: "乱", good: 0 },
  { k: "pest", g: 0, w: 2, name: "时疫", glyph: "疫", good: 0 },
  { k: "bandit", g: 0, w: 2, name: "盗匪横行", glyph: "匪", good: 0 },
  { k: "desert", g: 0, w: 2, name: "将领叛逃", glyph: "叛", good: 0 }
];
Sim.prototype.omen = function () {
  const W = this.W, t = this.t, seed = this.cfg.seed, n = ++W.n;
  W.next = t + OMEN.gap + Math.floor(h2(n, 3, seed + 101) * OMEN.spread);
  const alive = this.order.filter(p => this.P[p].alive); if (!alive.length) return;
  let tw = 0; for (const o of OMENS) tw += o.w;
  let x = h2(n, 5, seed + 103) * tw, O = OMENS[0];
  for (const o of OMENS) { x -= o.w; if (x < 0) { O = o; break; } }
  if (this.dev() && (O.k === "fog" || O.k === "desert")) O = OMENS[0]; // 发育期不出大雾、叛逃
  const rnd = i => h2(n, i, seed + 107);
  const all = this.order.slice();
  if (O.g) {
    const vis = all;
    if (O.k === "harvest") W.harvest = t + 120;
    if (O.k === "drought") W.drought = t + 120;
    if (O.k === "trade") W.trade = t + 120;
    if (O.k === "fog") W.fog = t + 90;
    if (O.k === "boon") alive.forEach(p => { const st = this.P[p]; st.owed = Math.min(DRAW.owedMax + 1, st.owed + 1); this.deal(st); });
    if (O.k === "plagueAll") this.R.forEach(R => { R.pop = Math.round(R.pop * .92); this.cut(R, .95, "hit"); R.troops = Math.round(R.troops); });
    if (O.k === "beastsAll") {
      const free = this.R.map((R, i) => i).filter(i => !this.R[i].owner && this.R[i].trait !== "ruin");
      for (let j = 0; j < 4 && free.length; j++) { const i = free.splice(Math.floor(rnd(10 + j) * free.length), 1)[0]; this.R[i].beast += 25; this.FX("beastRoar", { r: i, vis: this.watchers([i]) }); }
    }
    this.FX("omen", { g: 1, k: O.k, glyph: O.glyph, good: O.good, vis });
    this.L(`天时·${O.name}：${O.desc}`, "omen", vis);
    return;
  }
  // 落在一位玩家头上
  const rank = alive.slice().sort((a, b) => this.score(a) - this.score(b) || (a < b ? -1 : 1)); // 弱 → 强
  const p = rnd(20) < .7 ? (O.good ? rank[0] : rank[rank.length - 1]) : rank[Math.floor(rnd(21) * rank.length)];
  const st = this.P[p], mine = this.rows(p).filter(i => this.R[i].trait !== "ruin"); if (!mine.length) return;
  const pick = (arr, i) => arr[Math.floor(rnd(i) * arr.length)];
  let r = null, text = "";
  switch (O.k) {
    case "refugee": { r = pick(mine, 30); const R = this.R[r], add = Math.min(1500, Math.max(0, R.cap + 1500 - R.pop)); R.pop += add; text = `${Math.round(add)} 名流民涌入${st.name}的${this.rname(r)}`; break; }
    case "hero": { r = this.R[st.capital].owner === p ? st.capital : mine[0]; const X = this.R[r]; if (X.home) { X.el[X.home] = (X.el[X.home] || 0) + 8; text = `四方豪杰投奔${st.name}，${this.rname(r)}新增 8 名${UNITS[X.home].name}`; } else { X.troops += 20; text = `四方豪杰投奔${st.name}，${this.rname(r)}守军 +20`; } break; }
    case "gold": { r = pick(mine, 31); const R = this.R[r]; if (R.mine < 3) { R.mine++; text = `${st.name}在${this.rname(r)}发现金矿，每分钟 +8 金`; } else { st.gold += 80; text = `${st.name}在${this.rname(r)}挖出一窖金子，+80 金`; } break; }
    case "merchant": { const tier = rnd(32) < .3 ? 3 : 2; let pool = this.pool(tier); if (!pool.length) pool = this.pool(1); r = st.capital; st.hand.length < HAND_MAX ? this.give(st, pick(pool, 33), "omen") : (st.gold += 60); text = `云游商人造访${st.name}，留下一张${tier === 3 ? "珍品" : "良品"}卡牌`; break; }
    case "rain": { st.food += 80; r = pick(mine, 34); text = `${st.name}境内天降甘霖，+80 粮`; break; }
    case "granary": { const lost = Math.round(st.food * .35); st.food -= lost; r = st.capital; text = `${st.name}的粮仓失火，烧掉 ${lost} 粮`; break; }
    case "sedition": { const c = mine.filter(i => i !== st.capital); r = c.length ? c.reduce((a, b) => this.R[b].loyalty < this.R[a].loyalty ? b : a) : mine[0]; this.R[r].loyalty = Math.max(0, this.R[r].loyalty - 25); text = `${st.name}的${this.rname(r)}有人煽动作乱，民心 −25`; break; }
    case "pest": { r = pick(mine, 35); [r, ...this.map.regions[r].adj].forEach(i => { const X = this.R[i]; if (X.owner === p) X.pop = Math.round(X.pop * .85); }); text = `${st.name}的${this.rname(r)}一带闹时疫，居民 −15%`; break; }
    case "bandit": { const lost = Math.round(st.gold * .3); st.gold -= lost; r = pick(mine, 36); text = `盗匪劫掠${st.name}的商队，损失 ${lost} 金`; break; }
    case "desert": { const c = mine.filter(i => i !== st.capital); r = (c.length ? c : mine).reduce((a, b) => this.R[b].troops > this.R[a].troops ? b : a); const d = Math.round(this.R[r].troops * .3); this.R[r].troops -= d; text = `${st.name}在${this.rname(r)}的将领叛逃，带走 ${d} 兵`; break; }
  }
  const vis = all;
  this.FX("omen", { g: 0, k: O.k, glyph: O.glyph, good: O.good, r, p, vis });
  this.L(`天时·${O.name}：${text}`, "omen", vis, r);
};
Sim.prototype.score = function (pid) {
  let s = 0; this.R.forEach(R => { if (R.owner === pid) s += 10 + R.pop / 500 + R.troops / 5; for (const k in R.el) s += R.el[k] * .3; });
  return Math.round(s);
};
Sim.prototype.checkEnd = function () {
  if (this.over) return;
  const alive = this.order.filter(p => this.P[p].alive);
  const allAllied = alive.length > 1 && alive.every(a => alive.every(b => a === b || this.relOf(a, b) === "ally"));
  const heg = this.order.find(p => this.P[p].alive && this.P[p].hegeSince != null && this.t - this.P[p].hegeSince >= RULES.hegeHold);
  if (heg || alive.length <= 1 || allAllied || this.t >= this.cfg.totalSec) {
    const ranks = this.order.map(p => ({ p, s: this.P[p].alive ? this.score(p) : 0, alive: this.P[p].alive })).sort((a, b) => b.s - a.s);
    const winners = heg ? [heg] : allAllied ? alive : [ranks[0].p];
    this.over = { winners, ranks, t: this.t, why: heg ? "霸主：占据六成江山并坚守 " + RULES.hegeHold + " 秒" : alive.length <= 1 ? "唯一幸存" : allAllied ? "同盟统一" : "时间到，按国力排名" };
    this.L(`🏁 争霸结束：${winners.map(w => this.pname(w)).join("、")}获胜（${this.over.why}）`, "phase", "all");
  }
};
Sim.prototype.run = function (events, upto) {
  let i = 0;
  while (i < events.length && events[i].tick <= this.t) { if (!this.applied.has(events[i].id)) return false; i++; }
  while (this.t < upto && !this.over) {
    this.tick();
    while (i < events.length && events[i].tick <= this.t) {
      const ev = events[i++];
      if (this.applied.has(ev.id)) continue;
      this.applied.add(ev.id);
      const err = this.apply(ev);
      if (err) this.L("操作无效：" + err, "error", [ev.by]);
    }
  }
  return true;
};

root.LZ = { ELITE_GROW, eliteCap, UNITS, UNIT_KEYS, TRAIN, MT, terrainFns, OMENS, RULES, SPEED, CATCH, Sim, genMap, CARDS, CATS, TIERS, TRAITS, POLICY, SAC, DRAW, DEV_CATS, TERR, COLORS, HAND_MAX, LEVY, WORLD, RW, CELL, h2, hstr, mulberry, fbm };
})(typeof window !== "undefined" ? window : globalThis);
