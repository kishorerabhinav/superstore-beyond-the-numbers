import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, PerformanceMonitor, AdaptiveDpr, Preload } from "@react-three/drei";
import { EffectComposer, N8AO, Bloom, Vignette, ToneMapping, SMAA } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useEffect } from "react";
import { hdriUrl } from "./assets";
import { Building } from "./Building";
import { Departments } from "./Departments";
import { Stock } from "./Stock";
import { Fixtures, People } from "./Fixtures";
import { Atrium } from "./Atrium";
import { CameraDirector } from "./CameraDirector";
import { SHOTS } from "./layout";
import { useApp, type Quality } from "../state/AppState";

export function StoreCanvas({ onLost }: { onLost?: () => void }) {
  const { s, dispatch } = useApp();
  const q = s.quality;
  const dpr: [number, number] = q === "high" ? [1, 2] : q === "medium" ? [1, 1.5] : [0.75, 1];
  const lower = (cur: Quality): Quality => (cur === "high" ? "medium" : "low");
  return <Canvas shadows={q === "low" ? false : "soft"} dpr={dpr} gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
    camera={{ position: SHOTS.exteriorFar.pos, fov: SHOTS.exteriorFar.fov, near: 0.1, far: 500 }}
    onCreated={({ gl }) => {
      gl.toneMapping = THREE.NoToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
      // if the GPU resets, recover on the lightest preset instead of leaving a blank page
      gl.domElement.addEventListener("webglcontextlost", e => { e.preventDefault(); dispatch({ type: "quality", value: "low" }); onLost?.(); }, { once: true });
    }}>
    <PerformanceMonitor onDecline={() => s.introDone && dispatch({ type: "quality", value: lower(s.quality) })} flipflops={2} />
    <AdaptiveDpr pixelated={false} />
    <Suspense fallback={null}>
      <Lighting quality={q} />
      <Building />
      <Departments />
      <Stock />
      <Fixtures />
      <People />
      <Atrium />
      <Preload all />
    </Suspense>
    <CameraDirector />
    <Effects quality={q} />
  </Canvas>;
}

function Lighting({ quality }: { quality: Quality }) {
  const { s } = useApp();
  const scene = useThree(st => st.scene);
  useEffect(() => { scene.fog = new THREE.Fog("#c9c3b8", 70, 190); }, [scene]);
  const profitMode = s.experience === "profit";
  return <>
    <Environment files={hdriUrl("canary_wharf")} background backgroundBlurriness={0.04} backgroundIntensity={0.55} environmentIntensity={profitMode ? 0.22 : 0.42} />
    <hemisphereLight args={["#fff4e6", "#2a2622", (profitMode ? 0.25 : 0.55) * (quality === "low" ? 1.6 : 1)]} />
    {/* soft skylight through the roof: the one shadow-casting light */}
    <directionalLight position={[-16, 34, 14]} intensity={profitMode ? 0.6 : 1.5} color="#fff0dc" castShadow={quality !== "low"}
      shadow-mapSize={quality === "high" ? [4096, 4096] : [1024, 1024]} shadow-bias={-0.0003} shadow-normalBias={0.04} shadow-radius={6}
      shadow-camera-left={-36} shadow-camera-right={36} shadow-camera-top={30} shadow-camera-bottom={-30} shadow-camera-near={1} shadow-camera-far={90} />
    {/* warm interior fill under the ceiling fixtures */}
    {(quality === "low" ? [[0, -4]] : [[-14, -10], [14, -10], [-14, 6], [14, 6]]).map(([x, z]) => <pointLight key={`${x}${z}`} position={[x, 6.4, z]} intensity={(profitMode ? 12 : 40) * (quality === "low" ? 2.2 : 1)} distance={quality === "low" ? 60 : 26} decay={1.4} color="#ffe7c8" />)}
    {/* canopy downlight at the entrance */}
    <pointLight position={[0, 4.0, 20]} intensity={22} distance={10} decay={1.6} color="#ffd9a8" />
  </>;
}

function Effects({ quality }: { quality: Quality }) {
  if (quality === "low") return null;
  return <EffectComposer multisampling={0} enableNormalPass={false}>
    {quality === "high" ? <N8AO aoRadius={1.1} intensity={1.6} distanceFalloff={0.7} quality="medium" halfRes /> : <></>}
    <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={0.55} radius={0.72} />
    <Vignette offset={0.32} darkness={0.5} />
    <ToneMapping mode={ToneMappingMode.AGX} />
    <SMAA />
  </EffectComposer>;
}

/** True if the browser can create a WebGL2 (or WebGL) context. */
export function hasWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
