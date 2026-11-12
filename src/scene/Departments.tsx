import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEPARTMENTS, type Department } from "./layout";
import { useApp } from "../state/AppState";
import { Model } from "./Instanced";
import { useSurface } from "./assets";

/** Canvas texture with crisp text in the UI typeface (waits for the web font). */
export function useLabelTexture(lines: { text: string; size: number; weight?: number; color?: string; tracking?: number }[], w = 1024, h = 160, bg = "transparent") {
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => { document.fonts?.ready.then(() => setFontReady(true)); }, []);
  return useMemo(() => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")!;
    if (bg !== "transparent") { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    const total = lines.reduce((a, l) => a + l.size * 1.25, 0); let y = (h - total) / 2;
    for (const l of lines) {
      g.font = `${l.weight ?? 600} ${l.size}px Mulish, "Trebuchet MS", sans-serif`; g.fillStyle = l.color ?? "#1a1b1e"; g.textAlign = "center"; g.textBaseline = "top";
      if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${l.tracking ?? 0}px`;
      g.fillText(l.text, w / 2, y); y += l.size * 1.25;
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lines), fontReady, w, h, bg]);
}

export function Departments() {
  return <group>{DEPARTMENTS.map(d => <Dept key={d.id} d={d} />)}</group>;
}

function Dept({ d }: { d: Department }) {
  const { s, dispatch } = useApp();
  const b = d.bounds, w = b.x1 - b.x0, dpt = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  const active = s.dept === d.id, hover = s.hoverDept === d.id;
  const glow = useRef(0);
  const strip = useRef<THREE.MeshBasicMaterial>(null), light = useRef<THREE.PointLight>(null);
  const terrazzo = useSurface("terrazzo_tiles", [w / 4, dpt / 4]), oak = useSurface("oak_veneer_01", [w / 2.2, dpt / 0.5]);
  const floorMat = useMemo(() => {
    if (d.floor === "terrazzo") return new THREE.MeshStandardMaterial({ ...terrazzo, color: "#e7e4df", roughness: 0.35, envMapIntensity: 0.7 });
    if (d.floor === "oak") return new THREE.MeshStandardMaterial({ ...oak, color: "#dcc09d", roughness: 0.55 });
    if (d.floor === "walnut") return new THREE.MeshStandardMaterial({ ...oak, color: "#8a6446", roughness: 0.5 });
    return new THREE.MeshStandardMaterial({ ...terrazzo, color: "#a9a49c", roughness: 0.4, envMapIntensity: 0.6 });
  }, [d.floor, terrazzo, oak]);
  const label = useLabelTexture([{ text: d.name.toUpperCase(), size: 92, weight: 700, tracking: 18, color: "#17181b" }], 1400, 220, "#f3efe7");
  const accent = useMemo(() => new THREE.Color(d.accent), [d.accent]);
  const dimmed = s.dept != null && !active;
  useFrame((_, dt) => {
    const t = active ? 1 : hover ? 0.6 : dimmed ? 0.05 : 0.22; glow.current += (t - glow.current) * Math.min(1, dt * 3);
    if (strip.current) strip.current.color.copy(accent).multiplyScalar(0.6 + glow.current * 3.2);
    if (light.current) light.current.intensity = 6 + glow.current * 40;
  });
  const edges = useMemo(() => [[cx, b.z0, w, 0.06], [cx, b.z1, w, 0.06], [b.x0, cz, 0.06, dpt], [b.x1, cz, 0.06, dpt]] as const, [cx, cz, w, dpt, b]);
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.008, cz]} receiveShadow material={floorMat}><planeGeometry args={[w, dpt]} /></mesh>
    {edges.map(([x, z, ew, ed], i) => <mesh key={i} position={[x, 0.012, z]}><boxGeometry args={[ew, 0.01, ed]} /><meshBasicMaterial ref={i === 0 ? strip : undefined} color={accent} toneMapped={false} /></mesh>)}
    {s.quality !== "low" ? <pointLight ref={light} position={[cx, 5.6, cz]} color={d.accent} distance={22} decay={1.6} intensity={8} /> : null}
    {/* hanging department sign with the name on its lit face */}
    <group position={d.signPos}>
      <Model model="dept_sign" position={[0, 0, 0]} shadows={false} />
      <mesh position={[0, 0.31, 0.053]}><planeGeometry args={[3.0, 0.47]} /><meshBasicMaterial map={label} toneMapped={false} /></mesh>
      <mesh position={[0, 0.31, -0.053]} rotation={[0, Math.PI, 0]}><planeGeometry args={[3.0, 0.47]} /><meshBasicMaterial map={label} toneMapped={false} /></mesh>
    </group>
    {/* invisible hit volume */}
    <mesh position={[cx, 1.4, cz]}
      onPointerOver={e => { e.stopPropagation(); if (!s.firstPerson) { dispatch({ type: "hoverDept", value: d.id }); document.body.style.cursor = "pointer"; } }}
      onPointerOut={() => { dispatch({ type: "hoverDept", value: null }); document.body.style.cursor = ""; }}
      onClick={e => { e.stopPropagation(); if (!s.firstPerson && s.introDone && s.experience === "explore") dispatch({ type: "dept", value: d.id }); }}>
      <boxGeometry args={[w, 2.8, dpt]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  </group>;
}
