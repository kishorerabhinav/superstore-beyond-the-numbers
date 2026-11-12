import puppeteer from "puppeteer-core"; import fs from "node:fs";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const url = process.argv[2] || "http://localhost:4173/";
const b = await puppeteer.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : CHROME.replace("Program Files", "Program Files (x86)"), headless: false, defaultViewport: null, args: ["--window-size=1600,900", "--enable-logging=stderr", "--v=0"], dumpio: true });
const p = (await b.pages())[0]; const t0 = Date.now(); const T = () => ((Date.now() - t0) / 1000).toFixed(1);
p.on("console", m => { if (!/X3595|gradient/.test(m.text())) console.log(T(), "console", m.type(), m.text().slice(0, 200)); });
p.on("pageerror", e => console.log(T(), "pageerror", e.message)); p.on("error", e => console.log(T(), "PAGE CRASH", e.message));
p.on("requestfailed", r => console.log(T(), "reqfail", r.url().slice(-60), r.failure()?.errorText));
await p.goto(url).catch(e => console.log("goto", e.message));
for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 4000)); const s = await p.evaluate(() => ({ loading: document.querySelector(".loading small")?.textContent, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : 0 })).catch(e => "ERR " + e.message.slice(0, 50)); console.log(T(), JSON.stringify(s)); if (typeof s === "string") break; }
await b.close();
