/* 推演一致性测试：node tests/sim-replay.js
 * 跑多局电脑对战（含截杀），记录事件；用同一事件列表重放，世界状态必须逐位一致。
 * 顺便做一次“存档点回滚”：从中途存档恢复后再推到终点，也必须一致。 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..", "luanzhan");
const G = { window: undefined };
G.globalThis = G;
vm.createContext(G);
for (const f of ["sim.js", "bots.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), G, { filename: f });
const { LZ, LZBots } = G;

function play(seed, nP, secs) {
  const players = [];
  for (let i = 0; i < nP; i++) players.push({ id: "p" + i, name: "玩家" + i, bot: true, unit: LZ.UNIT_KEYS[(seed + i) % LZ.UNIT_KEYS.length] });
  const cfg = { seed, players, devSec: 60, totalSec: secs };
  const sim = new LZ.Sim(cfg), events = [];
  let salt = 1, n = 0;
  while (sim.t < secs && !sim.over) {
    sim.run(events, sim.t + 1);
    if (sim.t % 3 === 0) for (const p of sim.order) {
      for (const e of LZBots.decide(sim, p, salt++)) { const ev = { id: "e" + (n++), by: p, type: e.type, a: e.a, tick: sim.t + 1 }; events.push(ev); }
    }
  }
  sim.run(events, secs);
  return { cfg, events, sim };
}
function state(s) { return JSON.stringify([s.t, s.R, s.P, s.W, s.armies, s.rel, s.over]); }

let fails = 0, hunts = 0, clashes = 0, cardsUsed = {};
for (const [seed, nP] of [[11, 2], [23, 3], [37, 4], [51, 6], [77, 5]]) {
  const secs = 900;
  const A = play(seed, nP, secs);
  const B = new LZ.Sim(A.cfg); B.run(A.events, secs);
  const sa = state(A.sim), sb = state(B);
  const ok = sa === sb;
  // 回滚：先推到一半，克隆状态，再推到底
  const C = new LZ.Sim(A.cfg); C.run(A.events, 400); const t0 = C.t;
  const snap = structuredClone({ R: C.R, P: C.P, rel: C.rel, offers: C.offers, armies: C.armies, aseq: C.aseq, fx: C.fx, W: C.W, over: C.over });
  C.run(A.events, 700);
  Object.assign(C, structuredClone(snap)); C.t = t0; C.applied = new Set([...C.applied].filter(id => A.events.find(e => e.id === id).tick <= t0)); C.log.length = 0;
  C.run(A.events, secs);
  const ok2 = state(C) === sa;
  hunts += A.events.filter(e => e.type === "move" && e.a.hunt).length;
  clashes += A.sim.log.filter(l => l.kind === "battle" && l.text.includes("截住")).length;
  A.events.filter(e => e.type === "card").forEach(e => { const k = (A.sim.P[e.by].got.find(g => true) || {}).k; });
  for (const l of A.sim.log) if (l.kind === "error") { cardsUsed[l.text] = (cardsUsed[l.text] || 0) + 1; }
  console.log(`seed ${seed} ${nP}人 事件 ${A.events.length} 地区 ${A.sim.R.length}` + ` 重放${ok ? "一致" : "不一致！"} 回滚${ok2 ? "一致" : "不一致！"} 结果:${A.sim.over ? A.sim.over.why : "未结束"} 存活:${A.sim.order.filter(p => A.sim.P[p].alive).length}`);
  if (!ok || !ok2) fails++;
}
console.log("截杀命令", hunts, "野战", clashes);
const errs = Object.entries(cardsUsed).sort((a, b) => b[1] - a[1]).slice(0, 12);
if (errs.length) console.log("最常见的无效操作：", errs.map(([k, v]) => v + "×" + k).join(" | "));
if (fails) { console.log("失败"); process.exit(1); } else console.log("全部一致");
