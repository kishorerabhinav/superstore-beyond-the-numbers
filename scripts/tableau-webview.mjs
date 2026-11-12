// Inspect the 3D app running inside Tableau's Qt WebEngine (Tableau started with QTWEBENGINE_REMOTE_DEBUGGING=127.0.0.1:9333).
import puppeteer from "puppeteer-core";
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9333", defaultViewport: null });
const targets = b.targets().map(t => [t.type(), t.url()]); console.log(targets.filter(t => !t[1].startsWith("qrc")).map(t => t.join(" ")).join("\n"));
for (const t of b.targets()) {
  if (!/localhost:4173|github\.io/.test(t.url())) continue;
  const p = await t.page(); if (!p) continue;
  const frames = p.frames(); for (const f of frames) {
    if (!/localhost:4173|github\.io/.test(f.url())) continue;
    const info = await f.evaluate(() => {
      const c = document.createElement("canvas"); const gl2 = !!c.getContext("webgl2"), gl1 = !!document.createElement("canvas").getContext("webgl");
      return { url: location.href, ua: navigator.userAgent.slice(0, 140), webgl2: gl2, webgl1: gl1, loading: document.querySelector(".loading small")?.textContent, canvas: !!document.querySelector(".stage canvas"), size: [innerWidth, innerHeight] };
    }).catch(e => ({ err: e.message }));
    console.log(JSON.stringify(info, null, 1));
  }
}
await b.disconnect();
