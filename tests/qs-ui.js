/* 情书界面测试：node tests/qs-ui.js — 先 python3 -m http.server 8765
 * 手机视口；单机 + 2 电脑，自动打完一整局（轮到自己就按规则随便出），检查无报错、能结束、再来一局能开 */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const URL = process.env.URL || "http://127.0.0.1:8765/qingshu/";
const shots = path.join(__dirname, "shots"); fs.mkdirSync(shots, { recursive: true });
(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/favicon|firebase|gstatic|googleapis|net::ERR/.test(m.text())) errors.push(m.text()); });
  await page.goto(URL); await page.evaluate(() => { try { localStorage.clear(); } catch {} }); await page.goto(URL);
  await page.waitForFunction(() => { const s = document.querySelector("#sAuth"), h = document.querySelector("#sHome"); return (s && !s.hidden) || (h && !h.hidden); }, null, { timeout: 30000 });
  await page.locator("#aSolo").tap(); await page.waitForSelector("#sRoom:not([hidden])");
  await page.locator("#rBot").tap(); await page.waitForTimeout(150); await page.locator("#rBot").tap(); await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(shots, "qs-room.png") });
  await page.locator("#rStart").tap(); await page.waitForSelector("#sGame:not([hidden])");
  await page.waitForTimeout(800); await page.screenshot({ path: path.join(shots, "qs-game.png") });
  let fails = 0, myPlays = 0, shot = false;
  // 打到结束：轮到我就点第一张能打的牌，选第一个目标/猜测，打出
  for (let i = 0; i < 1200; i++) {
    const st = await page.evaluate(() => G ? { over: !!G.sim.over, my: G.sim.phase === "play" && G.sim.cur() === G.me && !G.sim.S[G.me].out, round: G.sim.round } : null);
    if (!st) { fails++; console.log("牌局对象没了"); break; }
    if (st.over) break;
    if (st.my) {
      const cards = page.locator("#hand .card.playable:not(.locked)");
      if (!(await cards.count())) { await page.waitForTimeout(300); continue; }
      await cards.first().tap(); await page.waitForTimeout(250);
      if (!(await page.locator("#go").count())) { console.log("点牌后没弹出面板"); fails++; break; }
      const tg = page.locator("#tg .opt"); if (await tg.count()) await tg.first().tap();
      const gs = page.locator("#gs .opt"); if (await gs.count()) await gs.nth(2).tap();
      if (!shot) { await page.screenshot({ path: path.join(shots, "qs-play.png") }); shot = true; }
      if (await page.locator("#go").isDisabled()) { console.log("打出按钮没有启用"); fails++; await page.screenshot({ path: path.join(shots, "qs-fail.png") }); break; }
      await page.locator("#go").tap(); myPlays++; await page.waitForTimeout(400);
    } else await page.waitForTimeout(400);
  }
  const over = await page.evaluate(() => !!G.sim.over);
  if (!over) { console.log("1200 步内没打完"); fails++; }
  await page.waitForTimeout(800); await page.screenshot({ path: path.join(shots, "qs-end.png") });
  const again = page.locator("#eAgain");
  if (!(await again.count())) { console.log("结束后没有再来一局按钮"); fails++; }
  else { await again.tap(); await page.waitForSelector("#sRoom:not([hidden])", { timeout: 8000 }).catch(() => { console.log("再来一局没回到房间"); fails++; }); }
  console.log(`我出了 ${myPlays} 手牌，${over ? "一局打完" : "没打完"}`);
  await br.close();
  if (errors.length) { console.log("页面报错：\n" + [...new Set(errors)].slice(0, 8).join("\n")); fails++; }
  console.log(fails ? `失败 ${fails} 项` : "情书界面测试通过"); process.exit(fails ? 1 : 0);
})();
