/* 界面测试：node tests/ui.js [局数]
 * 先 python3 -m http.server 8765 起本地服务。手机视口 390×844 带触屏。
 * 同一页面连开 N 局（单机练习 + 电脑），每局：等地图画出来 → 点自己的国都 → 出兵 → 点目标 → 兵力面板 → 出征；
 * 再测卡牌选目标；若看得见敌军则测「半路截杀」。每局截图到 tests/shots/。 */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const N = +(process.argv[2] || 4), URL = process.env.URL || "http://127.0.0.1:8765/";
const shots = path.join(__dirname, "shots"); fs.mkdirSync(shots, { recursive: true });
(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/favicon|firebase|gstatic|googleapis|net::ERR/.test(m.text())) errors.push(m.text()); });
  await page.goto(URL);
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(URL);
  // 没有网络时 Firebase 会失败 → 直接进单机
  await page.waitForFunction(() => { const s = document.querySelector("#sAuth"), h = document.querySelector("#sHome"); return (s && !s.hidden) || (h && !h.hidden); }, null, { timeout: 30000 });
  const tap = async sel => { await page.locator(sel).first().tap(); };
  const tapCanvas = async (x, y) => { await page.touchscreen.tap(x, y); };
  let fails = 0;
  const fail = msg => { console.log(msg); fails++; throw "skip"; };
  for (let g = 1; g <= N; g++) {
    const home = await page.locator("#sHome").isVisible();
    await tap(home ? "#hSolo" : "#aSolo");
    await page.waitForTimeout(400);
    if (await page.locator("#sNew").isVisible().catch(() => false)) await tap("#sNew");
    await page.waitForSelector("#sRoom:not([hidden])");
    await tap("#rBot"); await page.waitForTimeout(150); await tap("#rBot"); await page.waitForTimeout(150);
    await page.locator("#rUnits button").nth(g % 6).tap();
    await tap("#rStart");
    await page.waitForSelector("#sGame:not([hidden])");
    try { await page.waitForFunction(() => typeof G !== "undefined" && G && G.rd && G.rd.base && !document.querySelector("#countdown:not([hidden])"), null, { timeout: 30000 }); } catch (e) { console.log("地图没画出来", errors.slice(0, 5)); process.exit(1); }
    await page.waitForFunction(() => G.sim.t >= 5, null, { timeout: 20000 });
    await page.evaluate(() => { G.lag = 3; }); // 推演落后 3 秒：测试里直接改状态时不会被回滚抹掉（开局 5 秒后再设，免得倒计时遮罩又出来）
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(shots, `g${g}-map.png`) });
    try {
    // 缩放到国都附近再截一张看细节
    await page.evaluate(() => { const c = G.sim.P[G.me].capital; G.rd.focus(c); G.rd.cam.z = G.rd.fitZ() * 3.2; G.rd.clamp(); });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(shots, `g${g}-zoom.png`) });
    // 调兵：点国都 → 出兵 → 点相邻地区 → 面板
    const cap = await page.evaluate(() => { const c = G.sim.P[G.me].capital, g2 = G.sim.map.regions[c], p = G.rd.toScreen(g2.x, g2.y); return { c, x: p.x, y: p.y, adj: g2.adj[0] }; });
    await tapCanvas(cap.x, cap.y);
    await page.waitForTimeout(500);
    const title = await page.locator(".sheet h3").first().textContent().catch(() => "");
    const btn = page.locator(".sheet button", { hasText: "出兵" });
    if (!(await btn.count())) { await page.screenshot({ path: path.join(shots, `g${g}-fail-region.png`) }); fail(`第${g}局：点国都没弹出城池面板（标题「${title}」）`); }
    await btn.first().tap(); await page.waitForTimeout(300);
    const adj = await page.evaluate(a => { const g2 = G.sim.map.regions[a], p = G.rd.toScreen(g2.x, g2.y); return { x: p.x, y: p.y, vis: p.x > 10 && p.x < 380 && p.y > 120 && p.y < 700 }; }, cap.adj);
    if (!adj.vis) { await page.evaluate(a => { G.rd.focus(a); G.rd.cam.z = G.rd.fitZ() * 2.2; G.rd.clamp(); }, cap.adj); await page.waitForTimeout(300); }
    const adj2 = await page.evaluate(a => { const g2 = G.sim.map.regions[a], p = G.rd.toScreen(g2.x, g2.y); return { x: p.x, y: p.y }; }, cap.adj);
    await tapCanvas(adj2.x, adj2.y); await page.waitForTimeout(500);
    const go = page.locator("#tGo");
    if (!(await go.count())) { await page.screenshot({ path: path.join(shots, `g${g}-fail-troops.png`) }); fail(`第${g}局：选目标后没弹出兵力面板`); }
    await page.screenshot({ path: path.join(shots, `g${g}-troops.png`) });
    await go.tap(); await page.waitForTimeout(800);
    const armies = await page.evaluate(() => G.sim.armies.filter(a => a.owner === G.me).length + (G.pend.length ? 1 : 0));
    if (!armies) { console.log(`第${g}局：出征后没有军队`); fails++; }
    // 卡牌选目标：手牌里第一张需要选己方地区的卡
    const card = await page.evaluate(() => { const st = G.sim.P[G.me]; const c = st.hand.find(c => LZ.CARDS[c.k].tgt === "own" && LZ.DEV_CATS.includes(LZ.CARDS[c.k].cat)); return c ? c.h : null; });
    if (card != null) {
      const idx = await page.evaluate(h => G.sim.P[G.me].hand.findIndex(c => c.h === h), card);
      await page.locator("#hand .cardmini").nth(idx).tap(); await page.waitForTimeout(300);
      await tap("#cUse"); await page.waitForTimeout(300);
      const picking = await page.evaluate(() => document.body.classList.contains("picking"));
      if (!picking) { console.log(`第${g}局：用卡后没进入选目标状态`); fails++; }
      else {
        const p = await page.evaluate(() => { const c = G.sim.P[G.me].capital, g2 = G.sim.map.regions[c]; G.rd.focus(c); const q = G.rd.toScreen(g2.x, g2.y); return q; });
        await page.waitForTimeout(200); await tapCanvas(p.x, p.y); await page.waitForTimeout(400);
        const still = await page.evaluate(() => document.body.classList.contains("picking"));
        if (still) { console.log(`第${g}局：点了目标但还在选目标状态`); fails++; }
      }
    }
    // 半路截杀：造一支敌军走向我的国都，再走流程（先停掉电脑玩家，免得它们的指令让推演回滚、抹掉这里的改动）
    const hunt = await page.evaluate(() => {
      clearInterval(G.botTimer);
      const s = G.sim, me = G.me, cap = s.P[me].capital, g2 = s.map.regions[cap];
      s.R[cap].troops += 30;
      const from = g2.adj.find(b => s.R[b].owner !== me); if (from == null) return null;
      const other = s.order.find(p => p !== me); s.R[from].owner = other; s.R[from].troops = 30;
      s.launch(other, from, cap, 12); const a = s.armies[s.armies.length - 1]; for (let i = 0; i < 4; i++) s.tick(); if (a.troops <= 0) return null;
      s.cfg.devSec = 0; // 让截杀按钮可用
      const w = G.rd.armyWorld(a, 0); G.rd.cam.x = w.x; G.rd.cam.y = w.y; G.rd.clamp(); const p = G.rd.toScreen(w.x, w.y); return { id: a.id, x: p.x, y: p.y + 6 };
    });
    if (hunt) {
      await page.waitForTimeout(300);
      await tapCanvas(hunt.x, hunt.y); await page.waitForTimeout(500);
      const hb = page.locator("#aHunt");
      if (!(await hb.count())) { console.log(`第${g}局：点敌军没出现截杀按钮`); fails++; await page.screenshot({ path: path.join(shots, `g${g}-fail-hunt.png`) }); }
      else {
        await page.screenshot({ path: path.join(shots, `g${g}-army.png`) });
        await hb.tap(); await page.waitForTimeout(300);
        const p = await page.evaluate(() => { const v = G.mode && G.mode.valid.regions; if (!v || !v.length) return null; const r = v.includes(G.sim.P[G.me].capital) ? G.sim.P[G.me].capital : v[0]; G.rd.focus(r); const g2 = G.sim.map.regions[r]; return G.rd.toScreen(g2.x, g2.y); });
        if (!p) { console.log(`第${g}局：截杀时没有可出兵的城`); fails++; }
        else { await page.waitForTimeout(200); await tapCanvas(p.x, p.y); await page.waitForTimeout(500); }
        if (!(await page.locator("#tGo").count())) { console.log(`第${g}局：截杀选出发地后没弹出兵力面板`); fails++; }
        else { await page.screenshot({ path: path.join(shots, `g${g}-hunt.png`) }); await page.locator("#tGo").tap(); await page.waitForTimeout(800);
          const ok = await page.evaluate(() => G.sim.armies.some(a => a.owner === G.me && a.hunt) || G.pend.some(q => q.a && q.a.hunt != null));
          if (!ok) { console.log(`第${g}局：截杀命令没生效`); fails++; } }
      }
    }
    await page.evaluate(() => { for (let i = 0; i < 40 && !G.sim.over; i++) G.sim.tick(); });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(shots, `g${g}-later.png`) });
    // 新手教程（第一次玩会自动出现）：前面的调兵操作应已推进到第 5 步，剩下的点「下一步」走完
    if (g === 1) {
      const on = await page.evaluate(() => TUT.on);
      if (!on) { console.log("第1局：教程没有自动出现"); fails++; }
      else {
        const i0 = await page.evaluate(() => TUT.i);
        if (i0 < 4) { console.log(`第1局：教程没跟着操作推进（停在第 ${i0 + 1} 步）`); fails++; }
        await page.screenshot({ path: path.join(shots, `g1-tut.png`) });
        for (let k = 0; k < 8 && await page.evaluate(() => TUT.on); k++) { await tap("#tutNext"); await page.waitForTimeout(250); }
        if (await page.evaluate(() => TUT.on)) { console.log("第1局：教程点不完"); fails++; }
        if (!(await page.evaluate(() => localStorage.getItem("lz.tutDone")))) { console.log("第1局：教程完成没记录"); fails++; }
      }
    }
    // 战败界面与观战
    if (g === 2) {
      await page.evaluate(() => { const s = G.sim, me = G.me, other = s.order.find(p => p !== me); s.R.forEach((R, i) => { if (R.owner === me) s.own(i, other, 5); }); s.checkDead(me); });
      await page.waitForTimeout(800);
      const ds = page.locator("#dStay");
      if (!(await ds.count())) { console.log("第2局：出局后没弹出战败界面"); fails++; }
      else {
        await page.screenshot({ path: path.join(shots, `g2-defeat.png`) });
        await ds.tap(); await page.waitForTimeout(300);
        await page.evaluate(() => { for (let i = 0; i < 4; i++) G.sim.tick(); });
        await page.waitForTimeout(600);
        const r = await page.evaluate(() => ({ hand: document.querySelector("#hand").textContent, phase: document.querySelector("#cPhaseL").textContent, seen: G.sim.R.every((x, i) => G.sim.visible(G.me, i)) }));
        if (!/出局/.test(r.hand) || r.phase !== "观战中" || !r.seen) { console.log("第2局：观战状态不对", JSON.stringify(r)); fails++; }
        await page.screenshot({ path: path.join(shots, `g2-spectate.png`) });
      }
    }
    } catch (e) { if (e !== "skip") throw e; }
    // 离开这一局（先退出选目标状态、关掉教程和面板）
    await page.evaluate(() => { if (TUT.on) tutEnd(true); });
    if (await page.evaluate(() => document.body.classList.contains("picking"))) await tap("#bannerX");
    await page.evaluate(() => { document.querySelectorAll(".scrim").forEach(x => x.remove()); });
    await tap("#bMenu"); await page.waitForTimeout(200); await tap("#mOut"); await page.waitForTimeout(400);
    console.log(`第${g}局：完成`);
  }
  await br.close();
  if (errors.length) { console.log("页面报错：\n" + [...new Set(errors)].slice(0, 10).join("\n")); fails++; }
  console.log(fails ? `失败 ${fails} 项` : "界面测试全部通过");
  process.exit(fails ? 1 : 0);
})();
