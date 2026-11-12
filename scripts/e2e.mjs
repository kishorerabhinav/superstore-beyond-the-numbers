// End-to-end check in real Chrome: loads the built app, captures intro beats, skips, visits departments and experiences,
// changes filters, and records console errors. Screenshots go to ./e2e-shots.
// Usage: node scripts/e2e.mjs [url] [--fast]
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const URL = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "http://localhost:4173/";
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find(p => fs.existsSync(p));
const OUT = "e2e-shots"; fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl", "--window-size=1600,900", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage(); await page.setViewport({ width: 1600, height: 900 });
const errors = [];
page.on("console", m => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", e => errors.push("pageerror: " + e.message));
const shot = async name => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const t0 = Date.now();
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !document.querySelector(".loading"), { timeout: 120000 });
console.log("loaded in", ((Date.now() - t0) / 1000).toFixed(1), "s");
const fps = await page.evaluate(() => new Promise(res => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
console.log("fps (intro)", fps);
if (!process.argv.includes("--fast")) {
  for (const [t, name] of [[2500, "intro-1-arrival"], [5000, "intro-2-approach"], [4000, "intro-3-doors"], [4000, "intro-4-inside"], [4500, "intro-5-technology"], [4000, "intro-6-appliances"], [4000, "intro-7-office"], [4000, "intro-8-furniture"], [5000, "intro-9-kpis"]]) { await sleep(t); await shot(name); }
}
const skip = await page.$(".skip button"); if (skip) await skip.click();
await sleep(3500); await shot("explore-overview");
const click = async sel => { const el = await page.$(sel); if (!el) throw new Error("missing " + sel); await el.click(); };
const chips = await page.$$(".chip"); for (const c of chips) { if ((await c.evaluate(e => e.textContent)) === "Technology") { await c.click(); break; } }
await sleep(3800); await shot("dept-technology");
await page.evaluate(() => [...document.querySelectorAll(".chip")].find(b => b.textContent?.startsWith("Next"))?.click()); await sleep(3800); await shot("dept-appliances");
await page.evaluate(() => [...document.querySelectorAll(".chip")].find(b => b.textContent?.startsWith("Next"))?.click()); await sleep(3800); await shot("dept-office");
await page.evaluate(() => [...document.querySelectorAll(".chip")].find(b => b.textContent?.startsWith("Next"))?.click()); await sleep(3800); await shot("dept-furniture");
await page.select("#f-region", "West"); await sleep(2500); await shot("dept-furniture-west");
await page.select("#f-region", "");
for (const [label, name] of [["Profitability", "exp-profit"], ["Customers", "exp-customers"], ["Geography", "exp-geo"], ["Products", "exp-products"]]) {
  await page.evaluate(l => [...document.querySelectorAll(".nav button")].find(b => b.textContent === l)?.click(), label); await sleep(4200); await shot(name);
}
await page.evaluate(() => [...document.querySelectorAll(".nav button")].find(b => b.textContent === "Sales journey")?.click()); await sleep(3500); await shot("exp-sales-0");
await page.evaluate(() => { const s = document.querySelector(".story"); s.scrollTop = s.scrollHeight * 0.45; }); await sleep(3000); await shot("exp-sales-mid");
const fps2 = await page.evaluate(() => new Promise(res => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
console.log("fps (explore)", fps2);
fs.writeFileSync(`${OUT}/console.txt`, errors.join("\n"));
console.log("console errors/warnings:", errors.length); console.log(errors.slice(0, 15).join("\n"));
await browser.close();
