import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import { geoAlbersUsa } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import usTopo from "us-atlas/states-10m.json";
import { ATRIUM } from "./layout";
import { useApp } from "../state/AppState";
import { geoStory } from "../data/derive";
import { money, pct, int } from "../data/format";
import { useParts } from "./assets";
import { InstancedModel } from "./Instanced";

const TABLE = { w: 11.4, d: 7.4, h: 0.86 };
type Feat = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { name: string }>;

function useStateShapes() {
  return useMemo(() => {
    const topo = usTopo as unknown as Topology<{ states: GeometryCollection<{ name: string }> }>;
    const fc = feature(topo, topo.objects.states) as unknown as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { name: string }>;
    const W = 960, H = 600, proj = geoAlbersUsa().fitSize([W, H], fc);
    const sx = (TABLE.w - 0.6) / W, sz = (TABLE.d - 0.6) / H;
    return (fc.features as Feat[]).map(f => {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      const shapes: THREE.Shape[] = [];
      for (const poly of polys) {
        const rings = poly.map(r => r.map(c => proj(c as [number, number])).filter(Boolean).map(pt => new THREE.Vector2((pt![0] - W / 2) * sx, -(pt![1] - H / 2) * sz)));
        if (!rings[0] || rings[0].length < 3) continue;
        const sh = new THREE.Shape(rings[0]); rings.slice(1).forEach(h => h.length > 2 && sh.holes.push(new THREE.Path(h))); shapes.push(sh);
      }
      const geom = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 1 });
      const c = new THREE.Box2(); shapes.forEach(sh => sh.getPoints().forEach(p => c.expandByPoint(p)));
      const ctr = c.getCenter(new THREE.Vector2());
      return { name: f.properties.name, geom, cx: ctr.x, cz: -ctr.y };
    });
  }, []);
}

export function Atrium() {
  return <group position={[ATRIUM.x, 0, ATRIUM.z]}>
    <mesh position={[0, TABLE.h / 2, 0]} castShadow receiveShadow><boxGeometry args={[TABLE.w + 0.3, TABLE.h, TABLE.d + 0.3]} /><meshStandardMaterial color="#1b1c1f" roughness={0.45} metalness={0.3} /></mesh>
    <mesh position={[0, TABLE.h + 0.006, 0]} receiveShadow><boxGeometry args={[TABLE.w, 0.012, TABLE.d]} /><meshStandardMaterial color="#26282c" roughness={0.3} metalness={0.2} /></mesh>
    <mesh position={[0, TABLE.h - 0.03, 0]}><boxGeometry args={[TABLE.w + 0.34, 0.03, TABLE.d + 0.34]} /><meshBasicMaterial color={[0.9, 0.62, 0.32]} toneMapped={false} /></mesh>
    <StatesMap />
    <Plinth />
  </group>;
}

function StatesMap() {
  const { s, dispatch } = useApp();
  const shapes = useStateShapes();
  const geo = useMemo(() => geoStory(s.ds, s.filters), [s.ds, s.filters]);
  const [hover, setHover] = useState<string | null>(null);
  const max = useMemo(() => Math.max(1, ...geo.states.map(g => g.sales)), [geo]);
  const byName = useMemo(() => new Map(geo.states.map(g => [g.key, g])), [geo]);
  const meshes = useRef<Record<string, THREE.Mesh | null>>({});
  const mats = useMemo(() => Object.fromEntries(shapes.map(sh => [sh.name, new THREE.MeshStandardMaterial({ color: "#3a3d42", roughness: 0.55, metalness: 0.1 })])), [shapes]);
  const focus = s.experience === "geo";
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 3);
    for (const sh of shapes) {
      const m = meshes.current[sh.name]; if (!m) continue; const g = byName.get(sh.name);
      const h = g ? 0.03 + (focus ? 1.9 : 0.7) * (g.sales / max) : 0.015;
      m.scale.z += (h - m.scale.z) * k;
      const region = geo.regionOf.get(sh.name), dim = s.filters.region && region !== s.filters.region;
      const target = new THREE.Color(!g ? "#2a2c30" : g.margin < 0 ? "#D98A3A" : g.margin < 0.1 ? "#BFB6A6" : "#5FB08A");
      if (dim) target.lerp(new THREE.Color("#2a2c30"), 0.75);
      if (hover === sh.name) target.offsetHSL(0, 0, 0.12);
      const mat = mats[sh.name]; mat.color.lerp(target, k);
    }
  });
  const over = (n: string) => (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(n); document.body.style.cursor = "pointer"; };
  const out = () => { setHover(null); document.body.style.cursor = ""; };
  const hg = hover ? byName.get(hover) : null, hs = hover ? shapes.find(x => x.name === hover) : null;
  return <group position={[0, TABLE.h + 0.012, 0]}>
    {shapes.map(sh => <mesh key={sh.name} ref={el => { meshes.current[sh.name] = el; }} geometry={sh.geom} material={mats[sh.name]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, 0.02]} castShadow receiveShadow
      onPointerOver={over(sh.name)} onPointerOut={out}
      onClick={e => { e.stopPropagation(); const r = geo.regionOf.get(sh.name); if (r) dispatch({ type: "filter", key: "region", value: s.filters.region === r ? null : r }); }} />)}
    {/* Canada: 200 order lines in ten provinces, assigned to the four regions in the dataset */}
    <group position={[3.6, 0, -3.2]}>
      <mesh position={[0, 0.05 + (geo.canada.sales / max) * 0.95, 0]} castShadow><cylinderGeometry args={[0.16, 0.16, 0.1 + (geo.canada.sales / max) * 1.9, 24]} /><meshStandardMaterial color="#9aa6b8" roughness={0.4} /></mesh>
      {focus ? <Html position={[0, 0.5, 0]} center distanceFactor={9} className="map-tag">Canada · {money(geo.canada.sales)}</Html> : null}
    </group>
    {hg && hs ? <Html position={[hs.cx, 0.4 + (focus ? 1.9 : 0.7) * (hg.sales / max), hs.cz]} center distanceFactor={8} className="map-tip">
      <b>{hs.name}</b><span>{money(hg.sales)} sales · {pct(hg.margin)} margin</span><span>{int(hg.orders)} orders · {geo.regionOf.get(hs.name)}</span>
    </Html> : null}
  </group>;
}

const productModel = (sub: string, name: string): string => {
  const n = name.toLowerCase();
  if (sub === "Appliances") return n.includes("microwave") ? "vintage_microwave" : n.includes("kettle") ? "vintage_electric_kettle" : n.includes("toaster") ? "app_toaster" : n.includes("refrigerator") || n.includes("fridge") ? "app_fridge" : "app_coffee";
  if (sub === "Furnishings") return n.includes("clock") ? "wall_clock" : n.includes("lamp") ? "desk_lamp_arm_01" : "potted_plant_04";
  return ({ Phones: "tech_phone", Copiers: "tech_copier", Machines: "tech_printer", Accessories: n.includes("keyboard") ? "tech_keyboard" : "tech_headphones", Binders: "prod_binder", Paper: "prod_ream",
    Storage: "prod_bin", Art: "prod_tin", Envelopes: "prod_smallbox", Labels: "prod_smallbox", Fasteners: "prod_smallbox", Supplies: "prod_carton", Chairs: "furn_chair", Tables: "furn_table", Bookcases: "furn_bookcase" } as Record<string, string>)[sub] ?? "prod_carton";
};

/** Product spotlight: a stone plinth that shows the selected product (in the Products experience). */
function Plinth() {
  const { s } = useApp();
  const sub = useMemo(() => { if (!s.product) return null; const c = s.ds.dict.productName.indexOf(s.product); for (let i = 0; i < s.ds.n; i++) if (s.ds.dims.productName[i] === c) return s.ds.dict.subCategory[s.ds.dims.subCategory[i]]; return null; }, [s.product, s.ds]);
  const show = s.experience === "products";
  return <group position={[0, 0, 5.2]}>
    <mesh position={[0, 0.55, 0]} castShadow receiveShadow><cylinderGeometry args={[0.62, 0.68, 1.1, 48]} /><meshStandardMaterial color="#ece8e1" roughness={0.35} /></mesh>
    <mesh position={[0, 1.105, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.6, 0.008, 8, 64]} /><meshBasicMaterial color={[1.6, 1.1, 0.6]} toneMapped={false} /></mesh>
    <PlinthLight on={show} />
    {show && s.product && sub ? <Spinner key={s.product} model={productModel(sub, s.product)} /> : null}
  </group>;
}
/** Always mounted (adding a light at runtime would recompile every shader); it fades in for the Products experience. */
function PlinthLight({ on }: { on: boolean }) {
  const light = useRef<THREE.SpotLight>(null), target = useRef<THREE.Object3D>(null);
  useFrame((_, dt) => { const l = light.current; if (!l) return; if (target.current && l.target !== target.current) l.target = target.current; l.intensity += ((on ? 70 : 0) - l.intensity) * Math.min(1, dt * 2.5); });
  return <><object3D ref={target} position={[0, 1.1, 0]} /><spotLight ref={light} position={[0, 5.4, 0.6]} angle={0.32} penumbra={0.8} intensity={0} distance={9} decay={1.4} color="#fff3e2" /></>;
}
function Spinner({ model }: { model: string }) {
  // drawn through the same instanced path as the shelves, so no new shader programs need compiling on first view
  const { size, box } = useParts(model);
  const ref = useRef<THREE.Group>(null);
  const sc = Math.min(0.75 / Math.max(size.y, 0.01), 0.95 / Math.max(size.x, size.z, 0.01));
  const items = useMemo(() => [{ p: [-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2] as [number, number, number] }], [box]);
  useFrame((_, dt) => { if (ref.current) { ref.current.rotation.y += dt * 0.45; const t = ref.current.scale.x + (sc - ref.current.scale.x) * Math.min(1, dt * 3); ref.current.scale.setScalar(t); } });
  return <group position={[0, 1.11, 0]}><group ref={ref} scale={0.001}><InstancedModel model={model} items={items} /></group></group>;
}
