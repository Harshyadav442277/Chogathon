// Captures the real deployed site in Chrome: loader, title screen, and the world after "Enter Monadia".
// Output: mograph/assets/web_loader.jpg, web_title.jpg, web_world1.jpg, web_world2.jpg
import { chromium } from "playwright-core";
const URL = process.argv[2] || "https://chogsekai.vercel.app/";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--autoplay-policy=no-user-gesture-required"] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })).newPage();
const shot = (n) => p.screenshot({ path: `mograph/assets/web_${n}.jpg`, type: "jpeg", quality: 92 });
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(3500);
await shot("loader");
// the wasm compile blocks the page for a while; the title screen is up once screenshots return quickly again
await p.waitForTimeout(25000);
await shot("title");
await p.waitForTimeout(1500);
await p.mouse.move(800, 854, { steps: 12 });
await p.mouse.click(800, 854);
await p.waitForTimeout(9000);
await shot("world1");
await p.waitForTimeout(7000);
await shot("world2");
await b.close();
console.log("captured");
