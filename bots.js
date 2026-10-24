/* 电脑玩家：由房主的客户端代为行动 */
(function (root) {
"use strict";
const { CARDS } = root.LZ;

function decide(sim, pid, salt) {
  const st = sim.P[pid]; if (!st || !st.alive || sim.over) return [];
  const out = [], R = sim.R, M = sim.map.regions, dev = sim.dev();
  const rnd = k => root.LZ.h2(sim.t, salt * 31 + k, sim.cfg.seed ^ root.LZ.hstr(pid));
  const mine = R.map((x, i) => i).filter(i => R[i].owner === pid);
  if (!mine.length) return out;
  const hostile = o => o && o !== pid && sim.relOf(pid, o) === "war";
  const frontier = mine.filter(i => M[i].adj.some(b => R[b].owner !== pid));
  const threat = i => M[i].adj.reduce((s, b) => s + (hostile(R[b].owner) ? R[b].troops : 0), 0);
  const best = (arr, f) => arr.reduce((a, b) => (a == null || f(b) > f(a) ? b : a), null);

  // 外交回应
  for (const key in sim.offers) {
    const [from, to] = key.replace(/^p/, "").split(">");
    if (to !== pid) continue;
    if (key.startsWith("p")) { if (rnd(1) < .5) out.push({ type: "peace", a: { to: from } }); }
    else out.push(rnd(2) < .45 ? { type: "ally", a: { to: from } } : { type: "reject", a: { to: from } });
    if (out.length) return out;
  }
  // 处置新占的城池
  for (const i of mine) {
    const X = R[i]; if (!X.pend || X.pend.by !== pid) continue;
    const r0 = rnd(11);
    const c = r0 < .06 && sim.relOf(pid, sim.order[0]) !== "ally" ? "massacre" : r0 < .55 ? "tax" : st.food >= 30 && r0 < .85 ? "benevolent" : "military";
    out.push({ type: "policy", a: { r: i, c } }); return out;
  }
  // 市集 / 献祭（卡牌本身自动发放）
  if (st.hand.length < 5) {
    const rich = mine.filter(i => R[i].troops > 90);
    if (!dev && rich.length && rnd(12) < .06) { const ks = Object.keys(CARDS).filter(k => CARDS[k].tier === 2); out.push({ type: "sac", a: { kind: "army", r: rich[0], k: ks[Math.floor(rnd(13) * ks.length)] } }); return out; }
    if (st.gold > 320 && rnd(14) < .2) { const ks = Object.keys(CARDS).filter(k => CARDS[k].tier === 1 && (!dev || ["econ", "support"].includes(CARDS[k].cat))); const k = ks[Math.floor(rnd(15) * ks.length)]; if (afford(st, sim.buyPrice(st, k))) { out.push({ type: "buy", a: { k } }); return out; } }
  }
  // 国都训练特殊兵种
  const home = mine.find(i => R[i].home);
  if (home != null && !dev && st.gold > 140 && st.food > 90 && R[home].pop > 1500 && rnd(16) < .35) { out.push({ type: "train", a: { r: home } }); return out; }
  // 用牌
  for (const c of st.hand) {
    const k = c.k, C = CARDS[k];
    if (dev && !["econ", "support"].includes(C.cat)) continue;
    let a = null;
    const cap = mine.includes(st.capital) ? st.capital : mine[0];
    if (["harvest", "mine", "settle"].includes(k)) a = { r: best(mine, i => R[i].pop / 1000 - R[i].mine * 3 + (R[i].harvestUntil > sim.t ? -9 : 0) + (k === "settle" && R[i].pop >= R[i].cap ? -99 : 0)) };
    else if (k === "tax" || k === "trade" || k === "golden" || k === "granary" || k === "feast" || k === "dragon") a = (k === "trade" ? st.food > 120 : k === "dragon" ? sim.armies.some(x => x.owner === pid) : true) ? {} : null;
    else if (k === "recruit" || k === "wall" || k === "heaven" || k === "rampart" || k === "ironwall" || k === "decoy" || k === "patrol") a = { r: best(frontier.length ? frontier : mine, i => threat(i) - R[i].troops / 2 + (k === "rampart" && R[i].rampart ? -99 : 0)) };
    else if (k === "conscript") { const t = best(mine, i => R[i].pop); a = t != null && R[t].pop > 2500 ? { r: t } : null; }
    else if (k === "march") { const ar = sim.armies.find(x => x.owner === pid); a = ar ? { army: ar.id } : null; }
    else if (k === "blockade" || k === "locust") { const ps = sim.order.filter(p => p !== pid && sim.P[p].alive && sim.relOf(pid, p) === "war"); a = ps.length ? { p: ps[Math.floor(rnd(6) * ps.length)] } : null; }
    else if (k === "raid" || k === "rumor" || k === "mandate") { const t = best(R.map((x, i) => i).filter(i => hostile(R[i].owner) && sim.visible(pid, i) && (k !== "mandate" || sim.P[R[i].owner].capital !== i)), i => R[i].pop); a = t != null ? { r: t } : null; }
    else if (k === "storm") { const t = best(R.map((x, i) => i).filter(i => hostile(R[i].owner) && sim.visible(pid, i)), i => R[i].troops); a = t != null ? { r: t } : null; }
    else if (k === "beacon") a = { r: cap };
    else if (k === "rally") { const t = best(frontier, threat); a = t != null && threat(t) > R[t].troops ? { r: t } : null; }
    else if (k === "pioneer") { const t = mine.flatMap(i => M[i].adj).find(b => !R[b].owner && !R[b].beast && !R[b].troops && R[b].trait !== "ruin"); a = t != null ? { r: t } : null; }
    else if (k === "tame") { const t = mine.flatMap(i => M[i].adj).find(b => !R[b].owner && R[b].beast > 0); a = t != null ? { r: t } : null; }
    else if (k === "swift") { const ar = sim.armies.find(x => x.owner === pid); a = ar ? { army: ar.id } : null; }
    else if (k === "scout" || k === "hawk") { const t = R.map((x, i) => i).filter(i => !sim.visible(pid, i)); a = t.length ? { r: t[Math.floor(rnd(5) * t.length)] } : null; }
    else if (k === "spy") { const ps = sim.order.filter(p => p !== pid && sim.P[p].alive); a = ps.length ? { p: ps[Math.floor(rnd(6) * ps.length)] } : null; }
    else if (k === "ambush") { const t = best(frontier, threat); a = t != null ? { r: t } : null; }
    else if (k === "intercept") { const ar = sim.armies.find(x => hostile(x.owner) && sim.armyVisibleTo(x, pid)); a = ar ? { army: ar.id } : null; }
    else if (["fire", "subvert", "quake", "plague", "flood", "beasts", "meteor"].includes(k)) {
      const t = best(R.map((x, i) => i).filter(i => hostile(R[i].owner) && sim.visible(pid, i)), i => R[i].troops);
      a = t != null ? { r: t } : null;
    } else if (k === "cavalry" || k === "stealth") a = null;
    if (a && rnd(7) < .8) { out.push({ type: "card", a: { h: c.h, ...a } }); return out; }
  }
  // 扩张：打无主地（普通兵 + 特殊兵一起算）
  const power = i => { let p = Math.max(0, R[i].troops - 3); for (const u in R[i].el) p += R[i].el[u] * root.LZ.UNITS[u].atk; return p; };
  const sendAll = (i, b) => { if (R[i].troops >= 4) out.push({ type: "move", a: { from: i, to: b, n: Math.floor(R[i].troops - 3) } }); for (const u in R[i].el) if (R[i].el[u] >= 2) out.push({ type: "move", a: { from: i, to: b, n: R[i].el[u] - (R[i].home ? 2 : 0), u } }); return out.filter(e => e.a.n >= 1); };
  for (const i of mine) {
    if (power(i) < 14) continue;
    for (const b of M[i].adj) {
      const B = R[b]; if (B.owner) continue;
      if (B.trait === "ruin") continue;
      const need = (B.beast + B.troops) * sim.defMult(b) * 1.25 + 2;
      if (power(i) > need && rnd(8 + b) < .6) { const o = sendAll(i, b); if (o.length) return o; }
    }
  }
  if (!dev) {
    // 半路截杀：有敌军正朝我的城来，而我别处有足够兵力
    for (const e of sim.armies) {
      if (!hostile(e.owner) || !sim.armyVisibleTo(e, pid) || e.hunt) continue;
      const T = e.path[e.idx + 1]; if (T == null || R[T].owner !== pid) continue;
      if (sim.armies.some(x => x.owner === pid && x.hunt === e.id)) continue;
      const need = e.troops * e.atk * 1.4 + 3;
      const src = best(mine.filter(i => i !== T && R[i].troops - 3 >= need), i => -(sim.segLen ? 0 : 0) - M[i].adj.includes(T) ? 1 : 0);
      if (src != null && rnd(17 + e.id) < .7) { out.push({ type: "move", a: { from: src, hunt: e.id, n: Math.floor(Math.min(R[src].troops - 3, need * 1.3)) } }); return out; }
    }
    // 宣战：偶尔对最弱的邻居
    if (rnd(9) < .04) {
      const ns = new Set(frontier.flatMap(i => M[i].adj.map(b => R[b].owner)).filter(o => o && o !== pid && sim.relOf(pid, o) === "peace"));
      const t = [...ns][0]; if (t) { out.push({ type: "war", a: { to: t } }); return out; }
    }
    // 进攻敌人
    for (const i of frontier) {
      for (const b of M[i].adj) {
        const B = R[b]; if (!hostile(B.owner)) continue;
        const need = sim.garDef(B) * sim.defMult(b) * 1.3 + 3;
        let power = (R[i].troops - 3);
        for (const u in R[i].el) power += R[i].el[u] * root.LZ.UNITS[u].atk;
        if (power > need && R[i].troops - 3 >= 0) {
          if (R[i].troops >= 4) out.push({ type: "move", a: { from: i, to: b, n: Math.floor(R[i].troops - 3) } });
          for (const u in R[i].el) if (R[i].el[u] >= 3) out.push({ type: "move", a: { from: i, to: b, n: R[i].el[u], u } });
          if (out.length) return out;
        }
      }
    }
    // 后方往前线输送
    const inner = mine.filter(i => !frontier.includes(i) && R[i].troops > 20);
    if (inner.length && frontier.length && rnd(10) < .5) {
      const i = inner[0], t = best(frontier, threat);
      out.push({ type: "move", a: { from: i, to: t, n: Math.floor(R[i].troops - 5) } }); return out;
    }
  }
  // 征兵
  if (st.food > 90 && st.gold > 25) { const c = (frontier.length ? frontier : mine).filter(i => R[i].pop > 900 && !R[i].home); const t = best(c, i => threat(i) - R[i].troops + R[i].pop / 1000); if (t != null) out.push({ type: "levy", a: { r: t } }); }
  return out;
}
const afford = (st, c) => (c.gold || 0) <= st.gold && (c.food || 0) <= st.food;
root.LZBots = { decide };
})(typeof window !== "undefined" ? window : globalThis);
