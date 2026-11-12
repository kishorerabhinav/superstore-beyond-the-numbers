// Downloads CC0 assets from Poly Haven (https://polyhaven.com, licence CC0) and optimises models to GLB
// (meshopt geometry, WebP textures ≤1024px). Writes public/assets/CREDITS.json.
import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process";
const UA = { "User-Agent": "asset-fetch/1.0" };
const MODELS = ["sofa_02","sofa_03","mid_century_lounge_chair","modern_arm_chair_01","ArmChair_01","modern_coffee_table_01","modern_coffee_table_02",
  "side_table_01","coffee_table_round_01","modern_wooden_cabinet","drawer_cabinet","dining_chair_02","round_wooden_table_01","bar_chair_round_01",
  "metal_office_desk","classic_laptop","vintage_stapler","binder_notebook","decorative_book_set_01","cardboard_box_01","wicker_basket_01",
  "vintage_microwave","vintage_electric_kettle","CoffeeCart_01","potted_plant_01","potted_plant_02","potted_plant_04","modern_ceiling_lamp_01","wall_clock","desk_lamp_arm_01"];
const TEXTURES = ["smooth_concrete_floor","oak_veneer_01","terrazzo_tiles","plaster_grey_04","concrete_tiles","asphalt_floor"];
const HDRIS = ["brown_photostudio_02","canary_wharf"];
const tmp = path.resolve("assets-src"); fs.mkdirSync(tmp, { recursive: true });
const get = async (u) => { const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(`${r.status} ${u}`); return r; };
const save = async (u, f) => { if (fs.existsSync(f)) return; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.from(await (await get(u)).arrayBuffer())); };
const credits = [];
for (const id of MODELS) {
  const out = `public/assets/models/${id}.glb`; if (fs.existsSync(out)) { credits.push({ id, type: "model" }); continue; }
  try {
    const files = await (await get(`https://api.polyhaven.com/files/${id}`)).json();
    const g = files.gltf?.["1k"]?.gltf; if (!g) throw new Error("no 1k gltf");
    const dir = path.join(tmp, id); await save(g.url, path.join(dir, `${id}.gltf`));
    for (const [rel, f] of Object.entries(g.include || {})) await save(f.url, path.join(dir, rel));
    execSync(`npx gltf-transform optimize "${path.join(dir, id + ".gltf")}" "${out}" --compress meshopt --texture-compress webp --texture-size 1024`, { stdio: "pipe" });
    credits.push({ id, type: "model" }); console.log("model", id, (fs.statSync(out).size / 1024 | 0) + " KB");
  } catch (e) { console.log("FAILED", id, e.message.split("\n")[0]); }
}
for (const id of TEXTURES) {
  const files = await (await get(`https://api.polyhaven.com/files/${id}`)).json();
  const pick = (k) => files[k]?.["1k"]?.jpg?.url || files[k]?.["1k"]?.png?.url;
  for (const [k, name] of [["Diffuse", "diff"], ["nor_gl", "nor"], ["Rough", "rough"]]) { const u = pick(k); if (u) await save(u, `public/assets/textures/${id}_${name}.jpg`); }
  credits.push({ id, type: "texture" }); console.log("texture", id);
}
for (const id of HDRIS) {
  const files = await (await get(`https://api.polyhaven.com/files/${id}`)).json();
  await save(files.hdri["1k"].hdr.url, `public/assets/hdri/${id}_1k.hdr`); credits.push({ id, type: "hdri" }); console.log("hdri", id);
}
fs.writeFileSync("public/assets/CREDITS.json", JSON.stringify({ source: "Poly Haven (polyhaven.com)", licence: "CC0 1.0", assets: credits.map(c => ({ ...c, url: `https://polyhaven.com/a/${c.id}` })) }, null, 1));
