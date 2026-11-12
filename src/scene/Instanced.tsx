import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useParts } from "./assets";

export interface Inst { p: [number, number, number]; ry?: number; rx?: number; s?: number; color?: string; on?: boolean }

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();

/**
 * Draws many copies of a (multi-material) GLB with one InstancedMesh per material part.
 * Instances whose `on` flag turns false shrink away; new ones grow in, so data-driven stock changes are animated.
 */
export function InstancedModel({ model, items, tint = "Pack", shadows = true, scale = 1, speed = 5 }: { model: string; items: Inst[]; tint?: string; shadows?: boolean; scale?: number; speed?: number }) {
  const { parts } = useParts(model);
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const cur = useRef<Float32Array>(new Float32Array(0));
  const animating = useRef(true);
  const cap = Math.max(1, items.length);
  const mats = useMemo(() => parts.map(p => {
    if (p.name !== tint) return p.material;
    const m = (p.material as THREE.MeshStandardMaterial).clone(); m.color.set("#ffffff"); return m;
  }), [parts, tint]);

  const colors = useMemo(() => items.map(it => new THREE.Color(it.color ?? "#ffffff")), [items]);
  useLayoutEffect(() => {
    if (cur.current.length !== items.length) { const n = new Float32Array(items.length); n.set(cur.current.subarray(0, Math.min(items.length, cur.current.length))); cur.current = n; }
    animating.current = true;
  }, [items, parts, tint]);

  useFrame((_, dt) => {
    if (!animating.current) return;
    let moving = false; const a = cur.current, k = Math.min(1, dt * speed);
    for (let i = 0; i < items.length; i++) {
      const t = items[i].on === false ? 0 : 1; const nv = a[i] + (t - a[i]) * k; a[i] = Math.abs(t - nv) < 0.002 ? t : nv; if (a[i] !== t) moving = true;
    }
    // pack only the visible instances to the front, so out-of-stock slots cost nothing on the GPU
    meshes.current.forEach((im, k) => {
      if (!im) return; let j = 0; const tinted = parts[k]?.name === tint;
      for (let i = 0; i < items.length; i++) {
        if (a[i] <= 0.001) continue;
        const it = items[i], s = (it.s ?? 1) * scale * easeOut(a[i]);
        e.set(it.rx ?? 0, it.ry ?? 0, 0); q.setFromEuler(e); v.set(it.p[0], it.p[1], it.p[2]); sc.set(s, s, s);
        im.setMatrixAt(j, m4.compose(v, q, sc)); if (tinted) im.setColorAt(j, colors[i]); j++;
      }
      im.count = j; im.instanceMatrix.needsUpdate = true; if (tinted && im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere();
    });
    animating.current = moving;
  });

  return <group>{parts.map((p, k) => (
    <instancedMesh key={`${k}-${cap}`} ref={el => { meshes.current[k] = el; }} args={[p.geometry, mats[k], cap]} castShadow={shadows} receiveShadow frustumCulled={false} />
  ))}</group>;
}
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

/** A single placed copy of a GLB (for one-off hero pieces). */
export function Model({ model, position, rotation = 0, scale = 1, shadows = true }: { model: string; position: [number, number, number]; rotation?: number; scale?: number; shadows?: boolean }) {
  const { parts } = useParts(model);
  return <group position={position} rotation={[0, rotation, 0]} scale={scale}>
    {parts.map((p, k) => <mesh key={k} geometry={p.geometry} material={p.material} castShadow={shadows} receiveShadow />)}
  </group>;
}
