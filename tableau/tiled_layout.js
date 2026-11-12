// Tiled dashboard layout engine for generated .twb files.
// Build a tree of vertical/horizontal containers with fixed pixel sizes, then serialise it to Tableau tiled zones.
//
//   const L = require("./tiled_layout");
//   const page = L.v([ L.h([L.gap(40), L.txt(1120, runs), L.gap(40)], { size: 60, bg: "#fff" }), ... ]);
//   const { zonesXml, height } = L.serialize(page, { width: 1200 });
//   // put zonesXml inside: <zones><zone h='100000' id='1' type-v2='layout-basic' w='100000' x='0' y='0'>${zonesXml}...</zone></zones>
//
// Node kinds: v / h (containers), txt (formatted-text runs), sheet (worksheet name), param (parameter control), gap (empty zone).
// `size` = pixels along the PARENT's axis (height in a v, width in an h). Children without a size share leftover space.
// Options per node: bg (background colour), border (1px solid colour), pad (inner padding px), top (lead-in px for text),
// align ("right" | "center" for text).
// Notes from practice: text zones centre vertically; parameter controls inside nested containers need a fixed size.
const v = (ch, o = {}) => ({ k: "v", ch: ch.filter(Boolean), ...o });
const h = (ch, o = {}) => ({ k: "h", ch: ch.filter(Boolean), ...o });
const txt = (size, runs, o = {}) => ({ k: "text", size, runs, ...o });
const sheet = (size, name, o = {}) => ({ k: "sheet", size, name, ...o });
const param = (size, p, o = {}) => ({ k: "param", size, param: p, ...o });
const web = (size, url, o = {}) => ({ k: 'web', size, url, ...o });
const filt = (size, field, sheetName, mode, o = {}) => ({ k: "filter", size, field, sheetName, mode, ...o });
const gap = (size, bg) => ({ k: "blank", size, bg });
const rule = (color = "#dce2e7", th = 1) => ({ k: "blank", size: th, bg: color });
const sum = ch => ch.reduce((s, c) => s + (c.size || 0), 0);

function place(n, x, y, w, hh) {
  n.x = x; n.y = y; n.w = w; n.h = hh;
  if (n.k !== "v" && n.k !== "h") return;
  const along = n.k === "v" ? hh : w, flex = n.ch.filter(c => !c.size).length;
  const each = flex ? Math.max(0, (along - sum(n.ch)) / flex) : 0;
  let off = 0;
  for (const c of n.ch) { const s = c.size || each; if (n.k === "v") place(c, x, y + off, w, s); else place(c, x + off, y, s, hh); off += s; }
}
const zstyle = (bg, border, pad = 0) => `<zone-style><format attr='border-color' value='${border || "#000000"}' /><format attr='border-style' value='${border ? "solid" : "none"}' /><format attr='border-width' value='${border ? 1 : 0}' /><format attr='margin' value='0' /><format attr='padding' value='${pad}' />${bg ? `<format attr='background-color' value='${bg}' />` : ""}</zone-style>`;

function serialize(root, { width = 1200, height, firstId = 10 } = {}) {
  const H = height || sum(root.ch);
  place(root, 0, 0, width, H);
  const ux = px => Math.round(px / width * 100000), uy = px => Math.round(px / H * 100000);
  let id = firstId;
  const ser = (n, parentAxis) => {
    const g = `h='${uy(n.h)}' w='${ux(n.w)}' x='${ux(n.x)}' y='${uy(n.y)}'`, zid = id++;
    const fx = n.size && parentAxis ? ` fixed-size='${Math.round(n.size)}' is-fixed='true'` : "";
    if (n.k === "v" || n.k === "h") return `<zone${fx} ${g} id='${zid}' param='${n.k === "v" ? "vert" : "horz"}' type-v2='layout-flow'>${n.ch.map(c => ser(c, n.k)).join("")}${zstyle(n.bg, n.border, n.pad)}</zone>`;
    if (n.k === "blank") return `<zone${fx} ${g} id='${zid}' type-v2='empty'>${zstyle(n.bg)}</zone>`;
    if (n.k === "text") {
      const runs = n.align ? n.runs.replace(/<run /g, `<run fontalignment='${n.align === "right" ? 2 : 1}' `) : n.runs;
      const lead = n.top ? `<run fontsize='${Math.max(1, Math.round(n.top * 0.5))}'>Æ&#10;</run>` : "";
      return `<zone${fx} forceUpdate='true' ${g} id='${zid}' type-v2='text'><formatted-text>${lead}${runs}</formatted-text>${zstyle(n.bg, n.border, n.pad)}</zone>`;
    }
    if (n.k === "sheet") return `<zone${fx} ${g} id='${zid}' name='${n.name}' show-title='false'>${zstyle(n.bg, n.border, n.pad)}</zone>`;
    if (n.k === "param") return `<zone${fx} ${g} id='${zid}' mode='compact' param='${n.param}' show-title='false' type-v2='paramctrl'>${zstyle(n.bg, n.border, n.pad == null ? 2 : n.pad)}</zone>`;
    if (n.k === 'web') return `<zone${fx} ${g} id='${zid}' param='${n.url}' type-v2='web'>${zstyle(n.bg, n.border, n.pad)}</zone>`;
    if (n.k === "filter") return `<zone${fx} ${g} id='${zid}' mode='${n.mode}' name='${n.sheetName}' param='${n.field}' show-title='false' type-v2='filter' values='database'>${zstyle(n.bg, n.border, n.pad == null ? 2 : n.pad)}</zone>`;
    throw new Error("unknown node " + n.k);
  };
  return { zonesXml: ser(root, null), height: H, nextId: id };
}

module.exports = { v, h, txt, sheet, param, filt, web, gap, rule, serialize, zstyle };
