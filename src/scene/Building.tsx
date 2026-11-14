import * as THREE from "three";
import { useGLTF, MeshReflectorMaterial } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { modelUrl, useSurface, fixMaterial, lite } from "./assets";
import { STORE } from "./layout";
import { useApp } from "../state/AppState";

export function Building() {
  const { s } = useApp();
  const gltf = useGLTF(modelUrl("building"));
  const wall = useSurface("plaster_grey_04", [10, 2]);
  const oak = useSurface("oak_veneer_01", [1, 18]);
  const paving = useSurface("concrete_tiles", [40, 15]);
  const asphalt = useSurface("asphalt_floor", [30, 9]);
  const floor = useSurface("smooth_concrete_floor", [14, 10]);

  const scene = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse(o => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial; const n = mat.name;
      m.receiveShadow = true; m.castShadow = !["Roof", "Parapet", "Plaza", "Road", "Floor", "FacadeGlass", "FasciaBand", "SideClad", "WallN", "WallE", "WallW"].includes(m.name);
      if (n === "WallPlaster") m.material = lite(new THREE.MeshStandardMaterial({ name: n, normalMap: wall.normalMap, color: "#e4ded5", roughness: 0.92 }));
      else if (n === "Oak") m.material = lite(new THREE.MeshStandardMaterial({ name: n, ...oak, color: "#d9b48c", roughness: 0.6 }));
      else if (n === "PlazaPaving") m.material = lite(new THREE.MeshStandardMaterial({ name: n, ...paving, color: "#b9b6b0" }));
      else if (n === "Asphalt") m.material = lite(new THREE.MeshStandardMaterial({ name: n, ...asphalt, color: "#6c6c6c" }));
      else if (n === "FloorConcrete") m.material = lite(new THREE.MeshStandardMaterial({ name: n, ...floor, color: "#d9d6d0", roughness: 0.38, metalness: 0.05, envMapIntensity: 0.7 }));
      else if (n === "SignLetters") { const e = mat.clone(); e.emissive.set("#ffe7c2"); e.emissiveIntensity = 5; e.toneMapped = false; m.material = e; m.castShadow = false; }
      else m.material = fixMaterial(mat);
      if (n === "Glass") { m.castShadow = false; m.renderOrder = 2; }
    });
    return root;
  }, [gltf, wall, oak, paving, asphalt, floor]);
  // architectural cutaway: roof, parapet and ceiling dissolve when the camera rises above the ceiling
  const lid = useMemo(() => ["Roof", "Parapet", "CeilingBaffles"].map(n => scene.getObjectByName(n)).filter(Boolean) as THREE.Object3D[], [scene]);
  const camera = useThree(st => st.camera);
  useFrame(() => { const up = camera.position.y < CUTAWAY_Y; lid.forEach(o => { o.visible = up; }); });

  return <group>
    <primitive object={scene} />
    {/* polished floor reflection inside the store (high quality only) */}
    {s.quality === "high" ? (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, (STORE.z0 + STORE.z1) / 2]} receiveShadow>
        <planeGeometry args={[STORE.x1 - STORE.x0, STORE.z1 - STORE.z0]} />
        <MeshReflectorMaterial {...floor} color="#d4d1cb" roughness={0.55} metalness={0.05} blur={[420, 120]} resolution={1024} mixBlur={1.2} mixStrength={2.2}
          mirror={0.4} depthScale={0.6} minDepthThreshold={0.5} maxDepthThreshold={1.4} envMapIntensity={0.5} />
      </mesh>
    ) : null}
    <CeilingLights />
    <Doors />
  </group>;
}

/** Camera height above which the store is shown as a cutaway model. */
export const CUTAWAY_Y = 6.8;

/** Linear LED fixtures between the oak baffles. */
function CeilingLights() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const camera = useThree(st => st.camera);
  useFrame(() => { if (ref.current) ref.current.visible = camera.position.y < CUTAWAY_Y; });
  const rows = useMemo(() => { const out: [number, number][] = []; for (let x = -26; x <= 26; x += 6.5) for (let z = -20; z <= 14; z += 8.5) out.push([x, z]); return out; }, []);
  return <instancedMesh ref={el => { ref.current = el; if (!el) return; const m = new THREE.Matrix4(); rows.forEach(([x, z], i) => el.setMatrixAt(i, m.makeTranslation(x, STORE.height - 0.62, z))); el.instanceMatrix.needsUpdate = true; }}
    args={[undefined, undefined, rows.length]} frustumCulled={false}>
    <boxGeometry args={[0.12, 0.04, 5.6]} />
    <meshBasicMaterial color={[3.2, 2.9, 2.5]} toneMapped={false} />
  </instancedMesh>;
}

/** Automatic sliding doors: leaves glide open when the app says so (intro arrival, or on approach). */
function Doors() {
  const { s } = useApp();
  const l = useGLTF(modelUrl("door_left")), r = useGLTF(modelUrl("door_right"));
  const left = useMemo(() => prep(l.scene), [l]), right = useMemo(() => prep(r.scene), [r]);
  const gl = useRef<THREE.Group>(null), gr = useRef<THREE.Group>(null);
  useFrame((st, dt) => {
    // also open whenever the camera is near the entrance
    const cam = st.camera.position, near = Math.abs(cam.x) < 5 && cam.z > 12 && cam.z < 26;
    const open = s.doorsOpen || near ? 1 : 0;
    for (const [g, sgn] of [[gl.current, -1], [gr.current, 1]] as const) { if (!g) continue; const target = sgn * (1.1 + open * 2.15); g.position.x += (target - g.position.x) * Math.min(1, dt * 2.6); }
  });
  return <group position={[0, 0, STORE.z1 - 0.18]}>
    <group ref={gl} position={[-1.1, 0, 0]}><primitive object={left} /></group>
    <group ref={gr} position={[1.1, 0, 0]}><primitive object={right} /></group>
  </group>;
}
function prep(src: THREE.Object3D) { const o = src.clone(true); o.traverse(c => { const m = c as THREE.Mesh; if (m.isMesh) { m.material = fixMaterial(m.material as THREE.Material); m.castShadow = false; } }); return o; }
