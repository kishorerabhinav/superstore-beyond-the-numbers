import * as THREE from "three";
import { useGLTF, useTexture } from "@react-three/drei";
import { useMemo } from "react";

const BASE = import.meta.env.BASE_URL;
const POLYHAVEN = new Set(["sofa_02", "sofa_03", "mid_century_lounge_chair", "modern_arm_chair_01", "ArmChair_01", "modern_coffee_table_01", "modern_coffee_table_02",
  "side_table_01", "coffee_table_round_01", "modern_wooden_cabinet", "drawer_cabinet", "dining_chair_02", "round_wooden_table_01", "bar_chair_round_01",
  "metal_office_desk", "classic_laptop", "vintage_stapler", "binder_notebook", "cardboard_box_01", "wicker_basket_01", "vintage_microwave",
  "vintage_electric_kettle", "CoffeeCart_01", "potted_plant_01", "potted_plant_02", "potted_plant_04", "modern_ceiling_lamp_01", "wall_clock", "desk_lamp_arm_01"]);

export const modelUrl = (key: string) => POLYHAVEN.has(key) ? `${BASE}assets/models/${key}.glb` : `${BASE}assets/models/custom/${key}.glb`;
export const hdriUrl = (id: string) => `${BASE}assets/hdri/${id}_1k.hdr`;
export const texUrl = (id: string, map: "diff" | "nor" | "rough") => `${BASE}assets/textures/${id}_${map}.jpg`;

export interface Part { geometry: THREE.BufferGeometry; material: THREE.Material; name: string }

/** Flattens a GLB into (geometry, material) parts with the node transforms baked in, ready for instancing. */
export function useParts(key: string): { parts: Part[]; size: THREE.Vector3; box: THREE.Box3 } {
  const gltf = useGLTF(modelUrl(key));
  return useMemo(() => {
    const parts: Part[] = []; const box = new THREE.Box3();
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      if (mats.length > 1 && g.groups.length) {
        // split multi-material meshes into one geometry per material
        g.groups.forEach(gr => { const sub = g.clone(); sub.clearGroups(); sub.setIndex(sub.index ? Array.from(sub.index.array).slice(gr.start, gr.start + gr.count) : null); parts.push({ geometry: sub, material: fixMaterial(mats[gr.materialIndex ?? 0]), name: mats[gr.materialIndex ?? 0].name }); });
      } else parts.push({ geometry: g, material: fixMaterial(mats[0]), name: mats[0].name });
      g.computeBoundingBox(); box.union(g.boundingBox!);
    });
    return { parts, size: box.getSize(new THREE.Vector3()), box };
  }, [gltf]);
}

/** Glass from Blender arrives with transmission, which forces an extra render pass; swap it for a cheap reflective glass. */
export function fixMaterial(m: THREE.Material): THREE.Material {
  const sm = m as THREE.MeshPhysicalMaterial;
  if (m.name === "Glass" || m.name === "Acrylic" || (sm.transmission ?? 0) > 0) {
    return new THREE.MeshPhysicalMaterial({ name: m.name, color: "#cfdce0", roughness: 0.04, metalness: 0, transparent: true, opacity: m.name === "Glass" ? 0.16 : 0.3,
      envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.03 });
  }
  if (["Screen", "LaneLight", "SignLetters", "PriceRail", "ScannerGlass", "SignFace"].includes(m.name)) (m as THREE.MeshStandardMaterial).toneMapped = m.name !== "SignFace";
  return m;
}

/** PBR texture set with repeat, for retexturing named materials. */
export function useSurface(id: string, repeat: [number, number]) {
  const [map, normalMap, roughnessMap] = useTexture([texUrl(id, "diff"), texUrl(id, "nor"), texUrl(id, "rough")]);
  return useMemo(() => {
    // clone so the same image can be tiled differently on different surfaces
    const [a, b, c] = [map, normalMap, roughnessMap].map(t => { const k = t.clone(); k.wrapS = k.wrapT = THREE.RepeatWrapping; k.repeat.set(repeat[0], repeat[1]); k.anisotropy = 8; k.needsUpdate = true; return k; });
    a.colorSpace = THREE.SRGBColorSpace;
    return { map: a, normalMap: b, roughnessMap: c };
  }, [map, normalMap, roughnessMap, repeat[0], repeat[1]]);
}

/** Small seeded random so layouts are stable between renders. */
export function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
