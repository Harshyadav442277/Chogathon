// Renders a motion-design page (mograph/<page>.html) to an image sequence by seeking its paused GSAP timeline
// frame by frame in your installed Chrome. Usage:
//   node render.mjs <page> <outDir> <seconds> [fps=30] [png|jpg=jpg] [config.json] [startSec=0]
// png keeps transparency (overlays); jpg is for opaque scenes.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [, , page, outDir, secondsArg, fpsArg = "30", format = "jpg", cfgPath, startArg = "0"] = process.argv;
const seconds = Number(secondsArg), fps = Number(fpsArg), start = Number(startArg);
const dir = path.resolve(outDir);
fs.mkdirSync(dir, { recursive: true });
const url = pathToFileURL(path.resolve("mograph", page + ".html")).href;

const browser = await chromium.launch({
  channel: "chrome", headless: true,
  args: ["--force-device-scale-factor=1", "--hide-scrollbars", "--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"],
});
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror:", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("console error:", m.text()); });
if (cfgPath) {
  const cfg = fs.readFileSync(path.resolve(cfgPath), "utf8");
  await p.addInitScript(`window.CFG = ${cfg};`);
}
await p.goto(url, { waitUntil: "load" });
for (let k = 0; k < 300 && !(await p.evaluate("!!(window.ready && window.tl)")); k++) await new Promise((r) => setTimeout(r, 100));
await p.evaluate("window.ready()");
const frames = Math.round(seconds * fps);
const first = Math.round(start * fps);
const t0 = Date.now();
for (let i = first; i < frames; i++) {
  await p.evaluate((t) => window.seek(t), i / fps);
  const file = path.join(dir, String(i).padStart(5, "0") + "." + format);
  if (format === "png") await p.screenshot({ path: file, type: "png", omitBackground: true });
  else await p.screenshot({ path: file, type: "jpeg", quality: 94 });
  if (i % 120 === 0) console.log(`${page}: frame ${i}/${frames} (${Math.round((Date.now() - t0) / 1000)} s)`);
}
await browser.close();
console.log(`${page}: ${frames - first} frames -> ${dir}`);
