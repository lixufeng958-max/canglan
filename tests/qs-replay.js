/* 情书引擎测试：node tests/qs-replay.js — 电脑互打多局，重放必须一致，且每局都能正常结束 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const G = {}; G.globalThis = G; vm.createContext(G);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "qingshu", "sim.js"), "utf8"), G, { filename: "sim.js" });
const { QS } = G;
let fails = 0, rounds = 0, turns = 0, chanc = 0, spies = 0;
for (let seed = 1; seed <= 60; seed++) {
  const nP = 2 + (seed % 5);
  const players = []; for (let i = 0; i < nP; i++) players.push({ id: "p" + i, name: "玩家" + i, bot: true });
  const cfg = { seed: seed * 7919, players }, sim = new QS.Sim(cfg), events = []; let n = 0;
  for (let step = 0; step < 2000 && !sim.over; step++) {
    if (sim.phase === "roundEnd") { events.push({ id: "e" + n++, by: "p0", type: "next" }); sim.apply(events[events.length - 1]); continue; }
    const p = sim.cur(), d = QS.botDecide(sim, p, step);
    if (!d) { console.log("seed", seed, "电脑没出牌", p, sim.phase, sim.S[p].hand); fails++; break; }
    const ev = { id: "e" + n++, by: p, type: d.type, a: d.a }; events.push(ev); const before = sim.n; sim.apply(ev);
    if (sim.n === before) { console.log("seed", seed, "出牌被判无效", JSON.stringify(d), sim.S[p].hand); fails++; break; }
    if (nP >= 5) { chanc += d.type === "keep" ? 1 : 0; }
    turns++;
  }
  if (!sim.over) { console.log("seed", seed, "没打完"); fails++; continue; }
  rounds += sim.round; spies += sim.log.filter(l => l.text.includes("细作立功")).length;
  const B = new QS.Sim(cfg); B.run(events);
  const st = s => JSON.stringify([s.round, s.S, s.P, s.deck, s.aside, s.turn, s.phase, s.over, s.log.length]);
  if (st(B) !== st(sim)) { console.log("seed", seed, "重放不一致"); fails++; }
}
console.log(`60 局（2–6 人），共 ${rounds} 轮 ${turns} 手，国公挑牌 ${chanc} 次，细作立功 ${spies} 次，${fails ? "失败 " + fails : "全部一致、全部正常结束"}`);
process.exit(fails ? 1 : 0);
