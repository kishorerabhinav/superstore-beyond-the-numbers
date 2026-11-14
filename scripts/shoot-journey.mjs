// Screenshots each chapter of the live Analytical Journey (one headless Chrome, no GPU needed).
import puppeteer from "puppeteer-core";
const U = process.argv[2] || "https://kishorerabhinav.github.io/superstore-beyond-the-numbers/";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--window-size=1440,900"] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
const t0 = Date.now(); await p.goto(U + "?v=" + Date.now(), { waitUntil: "networkidle0" });
await p.waitForFunction(() => !document.querySelector(".loading") && document.querySelector(".chap"), { timeout: 60000 });
console.log("journey ready in", ((Date.now() - t0) / 1000).toFixed(1), "s; chapters", await p.$$eval(".chap", c => c.length));
const n = await p.$$eval(".chap", c => c.length);
for (let i = 0; i < n; i++) {
  await p.evaluate(i => document.querySelectorAll(".chap")[i].scrollIntoView({ block: "start" }), i); await new Promise(r => setTimeout(r, 1700));
  await p.screenshot({ path: `e2e-shots/j-${String(i).padStart(2, "0")}.png` });
}
await p.select("#f-region", "Central"); await new Promise(r => setTimeout(r, 1200));
await p.evaluate(() => document.querySelectorAll(".chap")[6].scrollIntoView({ block: "start" })); await new Promise(r => setTimeout(r, 1500));
await p.screenshot({ path: "e2e-shots/j-central-discounts.png" });
console.log("errors:", errs.length, errs.slice(0, 5).join(" | ")); await b.close();
