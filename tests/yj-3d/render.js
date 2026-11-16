// 用法（在仓库根目录）：
//   cd tests/yj-3d && npm i three@0.170.0 && ln -s "../../yujin/military soldier 3d model (3).glb" hero.glb && ln -s "../../yujin/zombie 3d model (2).glb" zombie.glb
//   python3 -m http.server 8766 &    然后  node render.js hero  /  node render.js zombie
// 输出 yujin/m3d/<name>.png（角色图集）和 yujin/m3d/<name>.js（每格的偏移、枪口位置）
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
(async () => { const name = process.argv[2], out = path.join(__dirname, "../../yujin/m3d"); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }); const p = await b.newPage({ viewport: { width: 800, height: 600 } }); p.on("pageerror", e => console.log("ERR", e.message));
  await p.goto("http://localhost:8766/render.html?m=" + name); await p.waitForFunction(() => window.result || window.err, null, { timeout: 0 });
  const r = await p.evaluate(() => window.err ? { err: window.err } : window.result); if (r.err) { console.log(r.err); process.exit(1); }
  fs.writeFileSync(path.join(out, name + ".png"), Buffer.from(r.png.split(",")[1], "base64")); fs.writeFileSync(path.join(out, name + ".js"), "/* 由 tests/yj-3d/render.js 生成 */\n(YJ.M3D = YJ.M3D || {})." + name + " = " + JSON.stringify(r.meta) + ";\n");
  console.log(name, "ok", r.meta.dirs + "x" + r.meta.rows, fs.statSync(path.join(out, name + ".png")).size >> 10, "KB"); await b.close(); })();
