// Simulates Tableau Desktop's web view: WebGL disabled. The page must open the analytics, not hang.
import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--disable-webgl", "--disable-3d-apis", "--window-size=1300,800"] });
const p = await b.newPage(); await p.setViewport({ width: 1300, height: 800 });
await p.goto(process.argv[2] || "http://localhost:4173/");
await p.waitForFunction(() => !document.querySelector(".loading"), { timeout: 30000 }).then(() => console.log("loader cleared")).catch(() => console.log("STUCK on loader"));
await new Promise(r => setTimeout(r, 1500));
console.log(await p.evaluate(() => ({ kpis: document.querySelectorAll(".kpi").length, nav: document.querySelectorAll(".nav button").length, note: !!document.querySelector(".nogl") })));
await p.evaluate(() => [...document.querySelectorAll(".nav button")].find(b => b.textContent === "Profitability").click()); await new Promise(r => setTimeout(r, 1500));
await p.screenshot({ path: "e2e-shots/nogl.png" }); await b.close();
