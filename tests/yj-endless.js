// 余烬·尸潮 无尽模式自动试玩：node tests/yj-endless.js [真实秒数=60] [加速=4]
const { chromium } = require("playwright");
(async () => { const SEC = +(process.argv[2] || 60), FAST = +(process.argv[3] || 4); const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 }); const p = await ctx.newPage(); let errs = 0;
  p.on("pageerror", e => { errs++; console.log("ERR", e.message, (e.stack || "").split("\n")[1]); });
  await p.goto("http://localhost:8765/yujin/?bot=1&lv=6&fast=" + FAST); await p.waitForTimeout(400); await p.evaluate(() => YJ.UI.safe()); await p.screenshot({ path: "tests/shots/yj-safe.png" }); await p.click("#sfEnd");
  let shots = 0; for (let t = 0; t < SEC; t += 3) { await p.waitForTimeout(3000); const s = await p.evaluate(() => { const L = YJ.G.L; return L ? { st: YJ.G.state, t: Math.round(L.time), mis: L.mis && L.mis.type, n: L.misN, lv: L.lvl, en: L.en.length, k: L.kills, sc: L.score, hp: Math.round(YJ.G.pl.hp) } : { st: YJ.G.state }; });
    if (t % 15 === 0) console.log(JSON.stringify(s)); if (s.mis && shots < 2 && t > 10 * (shots + 1)) await p.screenshot({ path: `tests/shots/yj-endless${++shots}.png` }); if (s.st !== "play") break; }
  await p.evaluate(() => { YJ.G.pl.hp = 0.1; YJ.G.bot = false; }); await p.waitForTimeout(100); await p.evaluate(() => { const G = YJ.G; if (G.state === "play") { G.pl.inv = 0; G.L.pools.push({ x: G.pl.x, y: G.pl.y, r: 60, life: 5, max: 5, dmg: 999, t: 0 }); } }); await p.waitForTimeout(3500);
  await p.screenshot({ path: "tests/shots/yj-endless-dead.png" }); console.log("best", await p.evaluate(() => JSON.stringify(YJ.G.P.best)), "errs", errs); await b.close(); process.exit(errs ? 1 : 0); })();
