// 余烬·尸潮 自动试玩：node tests/yj-ui.js [关卡数=5] [land]   需要先在仓库根目录起 http 服务 8765
const { chromium } = require("playwright");
(async () => {
  const N = +(process.argv[2] || 5), land = process.argv[3] === "land";
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: land ? { width: 844, height: 390 } : { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", e => { errs.push(e.message); console.log("ERR", e.message, (e.stack || "").split("\n")[1]); });
  p.on("console", m => { if (m.type() === "error") console.log("console:", m.text()); });
  await p.goto("http://localhost:8765/yujin/?bot=1"); await p.waitForTimeout(600);
  await p.screenshot({ path: "tests/shots/yj-title.png" });
  await p.click("#tNew"); await p.waitForTimeout(1500); await p.screenshot({ path: "tests/shots/yj-cut.png" });
  await p.click("#cutSkip"); await p.waitForTimeout(500); await p.screenshot({ path: "tests/shots/yj-safe.png" });
  for (let lv = 0; lv < N; lv++) {
    await p.click("#sfGo"); const t0 = Date.now(); let shot = 0, res = "timeout";
    while (Date.now() - t0 < 240000) {
      await p.waitForTimeout(2000);
      const s = await p.evaluate(() => ({ st: YJ.G.state, k: YJ.G.L && YJ.G.L.kills, hp: YJ.G.pl && Math.round(YJ.G.pl.hp), t: YJ.G.L && Math.round(YJ.G.L.time), en: YJ.G.L && YJ.G.L.en.length, obj: YJ.G.L && YJ.G.L.objN, done: YJ.G.L && YJ.G.L.objDone }));
      if (shot < 3 && s.t > 8 + shot * 25) await p.screenshot({ path: `tests/shots/yj-l${lv + 1}-${++shot}${land ? "w" : ""}.png` });
      if (s.st === "won") { res = "won"; console.log("关卡", lv + 1, "通过", JSON.stringify(s), "实际秒", Math.round((Date.now() - t0) / 1000)); break; }
      if (s.st === "dead") { res = "dead"; console.log("关卡", lv + 1, "阵亡", JSON.stringify(s)); break; }
    }
    if (res === "timeout") { console.log("关卡", lv + 1, "超时", await p.evaluate(() => JSON.stringify({ st: YJ.G.state, k: YJ.G.L.kills, t: YJ.G.L.time, obj: YJ.G.L.objN, done: YJ.G.L.objDone, x: YJ.G.pl.x, y: YJ.G.pl.y }))); await p.screenshot({ path: `tests/shots/yj-stuck${lv + 1}.png` }); break; }
    await p.waitForTimeout(1800); await p.screenshot({ path: `tests/shots/yj-end${lv + 1}.png` });
    if (res === "dead") { await p.click("#dRe"); await p.waitForTimeout(300); lv--; if (++errs.deaths > 6) break; continue; }
    await p.click("#wGo"); await p.waitForTimeout(900);
    if (lv < 4) { await p.screenshot({ path: `tests/shots/yj-cut${lv + 1}.png` }); await p.click("#cutSkip"); await p.waitForTimeout(400);
      await p.evaluate(() => { const P = YJ.G.P; const best = {}; for (const it of P.inv) { const c = best[it.slot]; if (!c || it.ilvl * (1 + it.rar * .3) > c.ilvl * (1 + c.rar * .3)) best[it.slot] = it; } for (const s in best) { const it = best[s], old = P.eq[s]; if (!old || it.ilvl * (1 + it.rar * .3) > old.ilvl * (1 + old.rar * .3)) { P.inv.splice(P.inv.indexOf(it), 1); if (old) P.inv.push(old); P.eq[s] = it; } } while (P.pts > 0) { const t = YJ.TALENTS.filter(t => (P.tal[t.k] || 0) < 5); const k = t[Math.floor(Math.random() * t.length)].k; P.tal[k] = (P.tal[k] || 0) + 1; P.pts--; } YJ.refreshWeapon(); });
      const any = await p.$(".cell[data-id]:not([data-id=''])"); if (any) { await any.click(); await p.waitForTimeout(200); } await p.screenshot({ path: `tests/shots/yj-bag${lv + 1}.png` }); }
    else { await p.waitForTimeout(1200); await p.screenshot({ path: "tests/shots/yj-ending.png" }); await p.click("#cutSkip"); await p.waitForTimeout(500); await p.screenshot({ path: "tests/shots/yj-cleared.png" }); }
  }
  console.log(errs.length ? "有错误: " + errs.length : "无报错"); await b.close(); process.exit(errs.length ? 1 : 0);
})();
