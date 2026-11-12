import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import { BAYS, type Bay } from "./layout";
import { InstancedModel, type Inst } from "./Instanced";
import { rng } from "./assets";
import { useApp } from "../state/AppState";
import { useLabelTexture } from "./Departments";

/** How each product sits on a shelf: footprint along the shelf (fw), depth (fd), height, rows deep, stack height, rotation. */
const FIT: Record<string, { fw: number; fd: number; h: number; rows: number; stack: number; ry: number; s?: number }> = {
  prod_binder: { fw: 0.056, fd: 0.3, h: 0.31, rows: 1, stack: 1, ry: Math.PI / 2 },
  prod_ream: { fw: 0.3, fd: 0.21, h: 0.052, rows: 1, stack: 5, ry: Math.PI / 2 },
  prod_bin: { fw: 0.4, fd: 0.29, h: 0.22, rows: 1, stack: 1, ry: Math.PI / 2 },
  prod_smallbox: { fw: 0.165, fd: 0.105, h: 0.08, rows: 1, stack: 3, ry: Math.PI / 2 },
  prod_tin: { fw: 0.205, fd: 0.095, h: 0.032, rows: 1, stack: 4, ry: Math.PI / 2 },
  prod_carton: { fw: 0.125, fd: 0.075, h: 0.22, rows: 1, stack: 1, ry: Math.PI / 2 },
  tech_headphones: { fw: 0.29, fd: 0.2, h: 0.34, rows: 1, stack: 1, ry: Math.PI / 2, s: 0.9 },
  tech_keyboard: { fw: 0.45, fd: 0.14, h: 0.03, rows: 1, stack: 1, ry: Math.PI / 2 },
  tech_printer: { fw: 0.46, fd: 0.4, h: 0.24, rows: 1, stack: 1, ry: -Math.PI / 2 },
};
const SHELF_Y = [0.12, 0.516, 0.876, 1.236];
const MODULE = 1.25;

export const PALETTE: Record<string, string[]> = {
  Binders: ["#1f3a5f", "#2b2d31", "#8c2f39", "#3d6b8c", "#e5e1d8", "#4f6d4a"], Paper: ["#f4f1ea", "#ece6d6", "#f7f7f2", "#dfe9f0"],
  Storage: ["#3a3d42", "#9aa3ab", "#d9d7d2", "#5d7a8c"], Art: ["#c0533c", "#e2b34a", "#3f7f6e", "#4a5d8c", "#e4ddd0"],
  Envelopes: ["#c9a77c", "#efe8da", "#b88f5e"], Labels: ["#f2efe6", "#e9d77a", "#dfe6ea"], Fasteners: ["#6f8fa8", "#9aa3ab", "#c4c9cc"],
  Supplies: ["#b98d5f", "#d9c3a0", "#8a6a4a"], Accessories: ["#2b2d31", "#d9d7d2", "#3b4a5c"], Machines: ["#e8e6e1", "#2b2d31"],
};

export function marginColor(m: number, strength = 1) {
  const c = new THREE.Color(m < 0 ? "#F2A24A" : m < 0.08 ? "#F3E6D0" : "#8FD3A8");
  return c.multiplyScalar(strength);
}

/** Fill fraction: square root keeps small sub-categories visible while preserving order. */
export function useFill() {
  const { subs } = useApp();
  return useMemo(() => {
    const max = Math.max(1, ...[...subs.values()].map(g => g.sales));
    return (sub: string) => { const g = subs.get(sub); return g ? Math.max(0.05, Math.sqrt(g.sales / max)) : 0; };
  }, [subs]);
}

export function Stock() {
  return <group>{BAYS.map(b => b.display === "gondola" ? <GondolaRun key={b.sub} bay={b} /> : b.display === "tables" ? <TableBay key={b.sub} bay={b} /> :
    b.display === "floor" ? <FloorBay key={b.sub} bay={b} /> : b.display === "wall" ? <WallBay key={b.sub} bay={b} /> : <Showroom key={b.sub} bay={b} />)}</group>;
}

function GondolaRun({ bay }: { bay: Bay }) {
  const fill = useFill()(bay.sub);
  const [ox, , oz] = bay.origin, n = bay.maxModules;
  const modules: Inst[] = useMemo(() => Array.from({ length: n }, (_, i) => ({ p: [ox, 0, oz - i * MODULE - MODULE / 2], ry: Math.PI / 2 })), [ox, oz, n]);
  const stock = useMemo(() => {
    const byModel: Record<string, Inst[]> = {}; const r = rng(bay.sub.length * 97 + n);
    const pal = PALETTE[bay.sub] ?? ["#cccccc"];
    for (let m = 0; m < n; m++) for (const side of [-1, 1]) SHELF_Y.forEach((y, lvl) => {
      const key = bay.products[(m + lvl + (side > 0 ? 0 : 1)) % bay.products.length], f = FIT[key]; if (!f) return;
      const slots = Math.floor((MODULE - 0.1) / f.fw), on = Math.round(slots * fill);
      const z0 = oz - m * MODULE - 0.05 - f.fw / 2;
      const stackH = f.stack;
      for (let k = 0; k < slots; k++) for (let row = 0; row < f.rows; row++) for (let st = 0; st < stackH; st++) {
        const depthX = ox + side * (0.47 - f.fd / 2 - row * (f.fd + 0.005));
        const jitter = (r() - 0.5) * 0.006;
        (byModel[key] ||= []).push({ p: [depthX, y + 0.012 + st * f.h, z0 - k * f.fw + jitter], ry: f.ry + (side < 0 ? Math.PI : 0) + (r() - 0.5) * 0.04, s: f.s,
          color: pal[Math.floor(r() * pal.length)], on: k < on });
      }
    });
    return byModel;
  }, [bay, fill, n, ox, oz]);
  return <group>
    <InstancedModel model="gondola" items={modules} shadows />
    {Object.entries(stock).map(([key, items]) => <InstancedModel key={key} model={key} items={items} shadows={false} />)}
    <RailGlow bay={bay} />
    <AisleSign bay={bay} />
  </group>;
}

/** Light strips on the price rails, coloured by the sub-category's margin (one shared, animated material per run). */
function RailGlow({ bay }: { bay: Bay }) {
  const { subs, s } = useApp();
  const g = subs.get(bay.sub); const margin = g ? g.margin : 0;
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, color: "#333" }), []);
  const [ox, , oz] = bay.origin, len = bay.maxModules * MODULE;
  const target = useMemo(() => g ? marginColor(margin, s.experience === "profit" ? 2.6 : 0.9) : new THREE.Color(0.15, 0.15, 0.15), [g, margin, s.experience]);
  useFrame((_, dt) => { mat.color.lerp(target, Math.min(1, dt * 3)); });
  const strips = useMemo(() => { const o: [number, number][] = []; for (const side of [-1, 1]) for (const y of SHELF_Y) o.push([ox + side * 0.492, y + 0.008]); return o; }, [ox]);
  return <group>{strips.map(([x, y], i) => <mesh key={i} position={[x, y, oz - len / 2]} material={mat}><boxGeometry args={[0.006, 0.012, len - 0.1]} /></mesh>)}</group>;
}

function AisleSign({ bay }: { bay: Bay }) {
  const tex = useLabelTexture([{ text: bay.sub.toUpperCase(), size: 74, weight: 700, tracking: 10, color: "#1b1c1f" }], 900, 150, "#f3efe7");
  const [ox, , oz] = bay.origin;
  return <group position={[ox, 1.78, oz - 0.1]}>
    <mesh position={[0, 0.13, 0]}><boxGeometry args={[0.05, 0.27, 1.2]} /><meshStandardMaterial color="#1d1f22" roughness={0.5} metalness={0.4} /></mesh>
    <mesh position={[0.027, 0.13, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[1.12, 0.19]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
    <mesh position={[-0.027, 0.13, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[1.12, 0.19]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
  </group>;
}

function TableBay({ bay }: { bay: Bay }) {
  const fill = useFill()(bay.sub);
  const [ox, , oz] = bay.origin;
  const tables: Inst[] = useMemo(() => Array.from({ length: bay.maxModules }, (_, i) => ({ p: [ox, 0, oz - i * 2.7], ry: Math.PI / 2 })), [bay, ox, oz]);
  const { phones, laptops } = useMemo(() => {
    const phones: Inst[] = [], laptops: Inst[] = []; let i = 0;
    const per = 2 * 6, total = per * bay.maxModules, on = Math.round(total * fill);
    tables.forEach(t => {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) phones.push({ p: [t.p[0] + (r - 0.5) * 0.36, 0.89, t.p[2] - 0.62 + c * 0.248], ry: r ? -Math.PI / 2 : Math.PI / 2, on: i++ < on });
      laptops.push({ p: [t.p[0], 0.89, t.p[2] + 0.62], ry: Math.PI, on: fill > 0.1 });
    });
    return { phones, laptops };
  }, [tables, fill, bay.maxModules]);
  return <group>
    <InstancedModel model="display_table" items={tables} />
    <InstancedModel model="tech_phone" items={phones} shadows={false} />
    <InstancedModel model="tech_laptop" items={laptops} shadows={false} />
    <InstancedModel model="tech_monitor" items={tables.map(t => ({ p: [t.p[0], 0.89, t.p[2] - 0.95] as [number, number, number], ry: Math.PI / 2, on: fill > 0.2 }))} shadows={false} />
  </group>;
}

function FloorBay({ bay }: { bay: Bay }) {
  const fill = useFill()(bay.sub);
  const [ox, , oz] = bay.origin;
  const items: Inst[] = useMemo(() => Array.from({ length: bay.maxModules }, (_, i) => ({ p: [ox, 0, oz - i * 1.0], ry: Math.PI / 2, on: i < Math.max(1, Math.round(bay.maxModules * fill)) })), [bay, ox, oz, fill]);
  return <InstancedModel model="tech_copier" items={items} />;
}

function WallBay({ bay }: { bay: Bay }) {
  const fill = useFill()(bay.sub);
  const [ox, , oz] = bay.origin;
  const fridges: Inst[] = useMemo(() => Array.from({ length: bay.maxModules }, (_, i) => ({ p: [ox, 0, oz - i * 0.84], ry: -Math.PI / 2, on: i < Math.max(1, Math.round(bay.maxModules * fill)) })), [bay, ox, oz, fill]);
  const counters: Inst[] = useMemo(() => [[18.2, 4.2], [18.2, 0.8], [13.4, 4.2], [13.4, 0.8]].map(([x, z]) => ({ p: [x, 0, z] as [number, number, number] })), []);
  const tops = useMemo(() => {
    const keys = ["app_coffee", "vintage_microwave", "app_toaster", "vintage_electric_kettle", "app_coffee"]; const out: Record<string, Inst[]> = {};
    let i = 0; const total = counters.length * keys.length, on = Math.round(total * fill);
    counters.forEach(c => keys.forEach((k, j) => { (out[k] ||= []).push({ p: [c.p[0] - 0.72 + j * 0.36, 0.92, c.p[2] + (j % 2 ? 0.08 : -0.06)], ry: (j % 2 ? 0.25 : -0.2), on: i++ < on }); }));
    return out;
  }, [counters, fill]);
  return <group>
    <InstancedModel model="app_fridge" items={fridges} />
    <InstancedModel model="app_counter" items={counters} />
    {Object.entries(tops).map(([k, items]) => <InstancedModel key={k} model={k} items={items} shadows={false} />)}
  </group>;
}

/** Furniture showroom vignettes: the number of pieces on the floor follows the sub-category's sales. */
const SHOWROOM: Record<string, { model: string; p: [number, number, number]; ry: number }[]> = {
  Chairs: Array.from({ length: 12 }, (_, i) => ({ model: ["furn_chair", "modern_arm_chair_01", "mid_century_lounge_chair", "dining_chair_02", "ArmChair_01", "bar_chair_round_01"][i % 6],
    p: [10.2 + (i % 4) * 1.6, 0, -10.2 - Math.floor(i / 4) * 1.6] as [number, number, number], ry: Math.PI + (i % 3 - 1) * 0.35 })),
  Tables: [["furn_table", 20.2, -10.6, 0], ["round_wooden_table_01", 24.4, -10.8, 0], ["metal_office_desk", 20.2, -13.4, Math.PI], ["modern_coffee_table_02", 24.2, -13.4, 0],
    ["coffee_table_round_01", 22.3, -12.1, 0], ["side_table_01", 26, -12.4, 0], ["furn_table", 22.3, -15.2, Math.PI / 2], ["side_table_01", 19.2, -15.4, 0]]
    .map(([m, x, z, r]) => ({ model: m as string, p: [x as number, 0, z as number] as [number, number, number], ry: r as number })),
  Bookcases: Array.from({ length: 7 }, (_, i) => ({ model: i % 3 === 2 ? "modern_wooden_cabinet" : i % 3 === 1 ? "drawer_cabinet" : "furn_bookcase", p: [25.6 - i * 1.6, 0, -21.85] as [number, number, number], ry: 0 })),
  Furnishings: [["sofa_02", 12.4, -21.2, 0], ["modern_coffee_table_01", 12.4, -19.4, 0], ["potted_plant_01", 9.6, -21.3, 0], ["desk_lamp_arm_01", 14.8, -21.0, 0],
    ["wicker_basket_01", 10.4, -18.4, 0], ["potted_plant_02", 16.2, -18.2, 0], ["sofa_03", 15.6, -17.0, -Math.PI / 2], ["potted_plant_04", 12.4, -19.4, 0], ["wall_clock", 12.4, -16.6, 0], ["wicker_basket_01", 9.8, -17.0, 0.5]]
    .map(([m, x, z, r]) => ({ model: m as string, p: [x as number, 0, z as number] as [number, number, number], ry: r as number })),
};
function Showroom({ bay }: { bay: Bay }) {
  const fill = useFill()(bay.sub);
  const slots = SHOWROOM[bay.sub] ?? [];
  const byModel = useMemo(() => {
    const on = Math.max(1, Math.round(slots.length * fill)); const out: Record<string, Inst[]> = {};
    slots.forEach((sl, i) => (out[sl.model] ||= []).push({ p: sl.model === "potted_plant_04" ? [sl.p[0], 0.45, sl.p[2]] : sl.model === "wall_clock" ? [sl.p[0], 0.4, sl.p[2]] : sl.p, ry: sl.ry, on: i < on }));
    return out;
  }, [slots, fill]);
  return <group>
    {bay.sub === "Furnishings" ? <mesh position={[12.6, 0.012, -19.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[6.4, 4.4]} /><meshStandardMaterial color="#cbbfae" roughness={1} /></mesh> : null}
    {Object.entries(byModel).map(([m, items]) => <InstancedModel key={m} model={m} items={items} />)}
  </group>;
}
