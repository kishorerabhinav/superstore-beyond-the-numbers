// Opens an unminified build straight from disk (no server) and prints start-up errors with their stack.
import puppeteer from "puppeteer-core"; import path from "node:path"; import { pathToFileURL } from "node:url";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--allow-file-access-from-files"] });
const p = await b.newPage(); const logs = [];
p.on("pageerror", e => logs.push("pageerror " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 8).join("\n")));
p.on("console", m => logs.push(m.type() + " " + m.text().slice(0, 200)));
await p.goto(pathToFileURL(path.resolve(process.argv[2] || "dist-debug/index.html")).href); await new Promise(r => setTimeout(r, 6000));
console.log(await p.evaluate(() => ({ chap: document.querySelectorAll(".chap").length })), "\n" + logs.slice(0, 6).join("\n"));
await b.close();
