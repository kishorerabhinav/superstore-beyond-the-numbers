import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); const logs = [];
p.on("pageerror", e => logs.push("pageerror " + e.message)); p.on("console", m => logs.push(m.type() + " " + m.text().slice(0, 200)));
await p.goto((process.argv[2] || "https://kishorerabhinav.github.io/superstore-beyond-the-numbers/") + "?v=" + Date.now());
await new Promise(r => setTimeout(r, 12000));
console.log(await p.evaluate(() => ({ loading: document.querySelector(".loading small")?.textContent, chap: document.querySelectorAll(".chap").length, top: !!document.querySelector(".top"), body: document.body.innerText.slice(0, 200) })));
console.log(logs.slice(0, 10).join("\n")); await b.close();
