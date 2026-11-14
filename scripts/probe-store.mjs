// Opens the build (file or URL), checks the 3D store is the first view with no blocking loader, and screenshots it.
import puppeteer from "puppeteer-core"; import path from "node:path"; import { pathToFileURL } from "node:url";
const arg = process.argv[2] || "dist-debug/index.html";
const url = /^https?:/.test(arg) ? arg + "?v=" + Date.now() : pathToFileURL(path.resolve(arg)).href;
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--allow-file-access-from-files", "--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 860 }); const errs = [];
p.on("pageerror", e => errs.push(e.message));
await p.goto(url);
for (const t of [3, 20]) {
  await new Promise(r => setTimeout(r, t === 3 ? 3000 : 17000));
  console.log(t + "s", JSON.stringify(await p.evaluate(() => ({ ui: !!document.querySelector(".top"), canvas: !!document.querySelector(".stage canvas"), pill: document.querySelector(".loading small")?.textContent ?? "gone", intro: !!document.querySelector(".intro, .title-card") }))));
  await p.screenshot({ path: `e2e-shots/store-${t}s.png` });
}
console.log("errors", errs.length, errs.slice(0, 3).join(" | ")); await b.close();
