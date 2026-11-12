import { NodeIO } from "@gltf-transform/core"; import { ALL_EXTENSIONS } from "@gltf-transform/extensions"; import { MeshoptDecoder } from "meshoptimizer"; import fs from "node:fs"; import path from "node:path";
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const rows = [];
for (const dir of ["public/assets/models", "public/assets/models/custom"]) for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".glb"))) {
  const doc = await io.read(path.join(dir, f)); let t = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const idx = p.getIndices(); t += (idx ? idx.getCount() : p.getAttribute("POSITION").getCount()) / 3; }
  rows.push([f, Math.round(t)]);
}
rows.sort((a, b) => b[1] - a[1]); console.log(rows.map(r => r.join(" ")).join("\n"));
