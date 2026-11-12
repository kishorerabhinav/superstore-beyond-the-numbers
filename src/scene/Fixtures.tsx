import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { CUTAWAY_Y } from "./Building";
import { useMemo, useRef } from "react";
import { CHECKOUTS, ROUTES, STORE } from "./layout";
import { InstancedModel, Model, type Inst } from "./Instanced";
import { useParts } from "./assets";
import { useApp } from "../state/AppState";
import { useLabelTexture } from "./Departments";
import { segmentStory } from "../data/derive";

export function Fixtures() {
  const checkouts: Inst[] = useMemo(() => CHECKOUTS.map(c => ({ p: [c.x, 0, c.z] as [number, number, number], ry: Math.PI / 2 })), []);
  const parked: Inst[] = useMemo(() => [
    ...Array.from({ length: 7 }, (_, i) => ({ p: [-7.6 + i * 0.32, 0, 15.6] as [number, number, number], ry: Math.PI / 2 })),
    ...Array.from({ length: 6 }, (_, i) => ({ p: [6.0 + i * 0.32, 0, 15.6] as [number, number, number], ry: Math.PI / 2 })),
    { p: [-21.8, 0, 2.2], ry: 0.6 }, { p: [11.5, 0, -6.4], ry: -1.2 }, { p: [-12.2, 0, -12.5], ry: 2.2 }, { p: [16.8, 0, 2.6], ry: 1.4 },
  ], []);
  const lamps = useMemo(() => [[-17.8, -15.5], [-17.8, 1.5], [17.8, 1.5], [17.8, -15.5], [0, -15.5], [12.6, -19.4], [-4, 4], [4, 4]].map(([x, z]) => [x, z]), []);
  const plantsOut: Inst[] = useMemo(() => [-24, -14, 14, 24].flatMap(x => [{ p: [x - 1.1, 0.55, STORE.z1 + 6.6] as [number, number, number], ry: x }, { p: [x + 1.1, 0.55, STORE.z1 + 6.6] as [number, number, number], ry: -x }]), []);
  const lampsRef = useRef<THREE.Group>(null); const camera = useThree(st => st.camera);
  useFrame(() => { if (lampsRef.current) lampsRef.current.visible = camera.position.y < CUTAWAY_Y; });
  const plantsIn: Inst[] = useMemo(() => [[-6.5, 9], [6.5, 9], [-6.5, -8], [6.5, -8], [-28.6, 16.8], [28.6, 16.8]].map(([x, z], i) => ({ p: [x, 0, z] as [number, number, number], ry: i, s: 1.6 })), []);
  return <group>
    <InstancedModel model="checkout" items={checkouts} />
    <InstancedModel model="cart" items={parked} />
    <InstancedModel model="potted_plant_02" items={plantsOut} scale={1.4} />
    <InstancedModel model="potted_plant_01" items={plantsIn} />
    <group ref={lampsRef}>{lamps.map(([x, z], i) => <group key={i} position={[x, STORE.height - 2.6, z]}>
      <Model model="modern_ceiling_lamp_01" position={[0, 0, 0]} scale={1.6} shadows={false} />
      <mesh position={[0, 1.4, 0]}><cylinderGeometry args={[0.004, 0.004, 2.6]} /><meshStandardMaterial color="#222" /></mesh>
    </group>)}</group>
    <LaneSigns />
  </group>;
}

function LaneSigns() {
  return <group>{CHECKOUTS.filter(c => c.segment).map(c => <LaneSign key={c.x} x={c.x} z={c.z} text={c.segment!} />)}</group>;
}
function LaneSign({ x, z, text }: { x: number; z: number; text: string }) {
  const tex = useLabelTexture([{ text: text.toUpperCase(), size: 64, weight: 700, tracking: 8, color: "#f3efe7" }], 800, 120, "#1b1c1f");
  return <mesh position={[x - 0.3, 3.35, z + 1.15]}><planeGeometry args={[1.5, 0.225]} /><meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} /></mesh>;
}

/** Shoppers. Most walk loops through the aisles (some pushing carts); in the Customers experience
 *  the three segment lanes fill with queues sized by each segment's share of orders. */
export function People() {
  const { s } = useApp();
  const walkers = useRef<{ route: number; t: number; speed: number; cart: boolean; offset: number }[]>(
    Array.from({ length: 14 }, (_, i) => ({ route: i % ROUTES.length, t: (i * 0.137) % 1, speed: 0.011 + (i % 4) * 0.0022, cart: i % 3 === 0, offset: ((i % 3) - 1) * 0.5 })));
  const walk = useParts("figure_walk"), stand = useParts("figure_stand"), cart = useParts("cart");
  const wRef = useRef<THREE.InstancedMesh[]>([]), cRef = useRef<THREE.InstancedMesh[]>([]), qRef = useRef<THREE.InstancedMesh[]>([]);
  const routes = useMemo(() => ROUTES.map(r => new THREE.CatmullRomCurve3(r.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "centripetal", 0.4)), []);
  const seg = useMemo(() => segmentStory(s.ds, s.filters), [s.ds, s.filters]);
  const queue = useMemo(() => {
    if (s.experience !== "customers") return [] as [number, number, number][];
    const total = seg.segs.reduce((a, g) => a + g.orders, 0) || 1, out: [number, number, number][] = [];
    for (const lane of CHECKOUTS.filter(c => c.segment)) {
      const g = seg.segs.find(x => x.key === lane.segment); const n = g ? Math.max(1, Math.round((g.orders / total) * 12)) : 0;
      for (let k = 0; k < n; k++) out.push([lane.x + 0.75, 0, lane.z - 1.6 - k * 0.85]);
    }
    return out;
  }, [s.experience, seg]);
  const m4 = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const p = useMemo(() => new THREE.Vector3(), []), tan = useMemo(() => new THREE.Vector3(), []), one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  useFrame((st, dt) => {
    const time = st.clock.elapsedTime; let ci = 0;
    walkers.current.forEach((w, i) => {
      w.t = (w.t + w.speed * dt * (s.experience === "customers" ? 0.5 : 1)) % 1;
      const c = routes[w.route]; c.getPointAt(w.t, p); c.getTangentAt(w.t, tan);
      p.x += tan.z * w.offset; p.z -= tan.x * w.offset; p.y = Math.abs(Math.sin(time * 4.2 + i)) * 0.025;
      q.setFromAxisAngle(up, Math.atan2(tan.x, tan.z));
      m4.compose(p, q, one); wRef.current.forEach(im => im?.setMatrixAt(i, m4));
      if (w.cart) { p.addScaledVector(tan, 0.95); p.y = 0; q.setFromAxisAngle(up, Math.atan2(tan.x, tan.z) + Math.PI / 2); m4.compose(p, q, one); cRef.current.forEach(im => im?.setMatrixAt(ci, m4)); ci++; }
    });
    wRef.current.forEach(im => { if (im) im.instanceMatrix.needsUpdate = true; });
    cRef.current.forEach(im => { if (im) { im.count = ci; im.instanceMatrix.needsUpdate = true; } });
    qRef.current.forEach(im => { if (!im) return; queue.forEach((qp, k) => { q.setFromAxisAngle(up, Math.PI + Math.sin(time * 0.6 + k) * 0.15); m4.compose(p.set(qp[0], 0, qp[2]), q, one); im.setMatrixAt(k, m4); }); im.count = queue.length; im.instanceMatrix.needsUpdate = true; });
  });
  return <group>
    {walk.parts.map((pt, k) => <instancedMesh key={`w${k}`} ref={el => { if (el) wRef.current[k] = el; }} args={[pt.geometry, pt.material, walkers.current.length]} castShadow frustumCulled={false} />)}
    {cart.parts.map((pt, k) => <instancedMesh key={`c${k}`} ref={el => { if (el) cRef.current[k] = el; }} args={[pt.geometry, pt.material, walkers.current.length]} castShadow frustumCulled={false} />)}
    {stand.parts.map((pt, k) => <instancedMesh key={`q${k}`} ref={el => { if (el) qRef.current[k] = el; }} args={[pt.geometry, pt.material, 40]} castShadow frustumCulled={false} />)}
  </group>;
}
