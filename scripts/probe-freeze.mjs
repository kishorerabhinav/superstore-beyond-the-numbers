// Visible Chrome on the live site: records long frames (stalls), GPU resets and the app state every 4 s.
import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: false, defaultViewport: null, args: ["--window-size=1600,900"], dumpio: true });
const p = (await b.pages())[0]; const t0 = Date.now(); const T = () => ((Date.now() - t0) / 1000).toFixed(0);
p.on("pageerror", e => console.log(T(), "pageerror", e.message)); p.on("error", e => console.log(T(), "CRASH", e.message));
p.on("console", m => { if (m.type() === "error" || /context|lost/i.test(m.text())) console.log(T(), "console", m.text().slice(0, 160)); });
await p.evaluateOnNewDocument(() => { window.__long = []; let last = performance.now(); const f = t => { if (t - last > 400) window.__long.push([Math.round(t / 1000), Math.round(t - last)]); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
await p.goto(process.argv[2]);
for (let i = 0; i < 22; i++) {
  await new Promise(r => setTimeout(r, 4000));
  const s = await p.evaluate(() => ({ load: document.querySelector(".loading small")?.textContent ?? "done", step: document.querySelector(".caption h2, .title-card h1")?.textContent ?? (document.querySelector(".top") ? "UI" : ""), stalls: window.__long.splice(0) })).catch(e => "ERR " + e.message.slice(0, 40));
  console.log(T(), JSON.stringify(s)); if (typeof s === "string") break;
  if (i === 14) { await p.evaluate(() => document.querySelector(".skip button")?.click()); }
}
await b.close();
