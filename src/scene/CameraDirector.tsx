import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraControls, PointerLockControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { SHOTS, deptShot, STORE, type Shot } from "./layout";
import { useApp, prefersReducedMotion } from "../state/AppState";
import { camApi } from "./shared";
export { camApi };

/** Intro beats (the UI shows the caption for the current beat). */
export const INTRO_BEATS = ["dark", "arrival", "approach", "doors", "enter", "technology", "appliances", "office", "furniture", "business", "done"] as const;


// Sales journey path: entrance → technology → office aisles → atrium → furniture → appliances → checkouts
const JOURNEY: Shot[] = [SHOTS.salesStart, { pos: [-6, 3.2, 6], target: [-18, 1, 2] }, { pos: [-11, 2.4, -9], target: [-21, 1, -16] }, { pos: [-2, 5.5, -6], target: [0, 0.8, -15.5] },
  { pos: [9, 3, -9], target: [18, 0.8, -16] }, { pos: [9, 3.4, 9], target: [20, 1, 2] }, { pos: [2, 4.6, 6], target: [18, 1, 13] }];
const jPos = new THREE.CatmullRomCurve3(JOURNEY.map(s => new THREE.Vector3(...s.pos)), false, "centripetal");
const jTgt = new THREE.CatmullRomCurve3(JOURNEY.map(s => new THREE.Vector3(...s.target)), false, "centripetal");

export function CameraDirector() {
  const { s, dispatch } = useApp();
  const ctl = useRef<CameraControls>(null);
  const camera = useThree(st => st.camera) as THREE.PerspectiveCamera;
  const tween = useRef<gsap.core.Animation | null>(null);
  const reduce = prefersReducedMotion();
  const cur = useRef({ pos: new THREE.Vector3(...SHOTS.exteriorFar.pos), tgt: new THREE.Vector3(...SHOTS.exteriorFar.target), fov: SHOTS.exteriorFar.fov ?? 40 });

  const apply = (p: THREE.Vector3, t: THREE.Vector3, fov: number) => {
    cur.current.pos.copy(p); cur.current.tgt.copy(t); cur.current.fov = fov;
    ctl.current?.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  };

  /** Arced dolly: position follows a quadratic curve lifted over the shelves; the look target eases independently. */
  const flyTo = (shot: Shot, { duration = 2.6, arc = 1 }: { duration?: number; arc?: number } = {}) => {
    tween.current?.kill();
    const c = ctl.current; if (!c) return;
    const p0 = c.getPosition(new THREE.Vector3()), t0 = c.getTarget(new THREE.Vector3()), f0 = camera.fov;
    const p2 = new THREE.Vector3(...shot.pos), t2 = new THREE.Vector3(...shot.target), f2 = shot.fov ?? f0;
    const dist = p0.distanceTo(p2), mid = p0.clone().lerp(p2, 0.5); mid.y = Math.max(p0.y, p2.y) + Math.min(6, dist * 0.18) * arc;
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p2), P = new THREE.Vector3(), T = new THREE.Vector3();
    if (reduce) { apply(p2, t2, f2); return; }
    const o = { u: 0 };
    tween.current = gsap.to(o, { u: 1, duration: Math.min(3.4, duration * (0.6 + Math.min(1, dist / 30) * 0.5)), ease: "power3.inOut",
      onUpdate: () => { curve.getPoint(o.u, P); const k = gsap.parseEase("power2.inOut")(o.u); T.copy(t0).lerp(t2, k); apply(P, T, f0 + (f2 - f0) * o.u); } });
  };
  const reset = () => flyTo(SHOTS.overview);
  const path = (t: number) => { tween.current?.kill(); const P = jPos.getPoint(Math.min(1, Math.max(0, t))), T = jTgt.getPoint(Math.min(1, Math.max(0, t))); apply(P, T, 50); };

  useEffect(() => { camApi.current = { flyTo, reset, path }; return () => { camApi.current = null; }; });

  // ------------- the opening film -------------
  useEffect(() => {
    const c = ctl.current; if (!c) return;
    c.setBoundary(new THREE.Box3(new THREE.Vector3(STORE.x0 - 6, 0, STORE.z0 - 4), new THREE.Vector3(STORE.x1 + 6, 30, STORE.z1 + 70)));
    if (s.introDone) { const o = SHOTS.overview; apply(new THREE.Vector3(...o.pos), new THREE.Vector3(...o.target), o.fov ?? 42); return; }
    const beat = (i: number) => () => dispatch({ type: "storyStep", value: i });
    const st = (sh: Shot) => ({ p: new THREE.Vector3(...sh.pos), t: new THREE.Vector3(...sh.target), f: sh.fov ?? 45 });
    const seq = [st(SHOTS.exteriorFar), st(SHOTS.exteriorNear), st(SHOTS.threshold), st(SHOTS.inside), st(SHOTS.reveal),
      st(deptShot("technology")), st(deptShot("appliances")), st(deptShot("office")), st(deptShot("furniture")), st(SHOTS.kpi)];
    apply(seq[0].p, seq[0].t, seq[0].f);
    if (reduce) { dispatch({ type: "storyStep", value: 9 }); const id = setTimeout(() => dispatch({ type: "introDone" }), 2500); apply(seq[9].p, seq[9].t, seq[9].f); return () => clearTimeout(id); }
    const o = { a: 0 }; const P = new THREE.Vector3(), T = new THREE.Vector3();
    const leg = (from: number, to: number, dur: number, ease = "power2.inOut") => {
      const A = seq[from], B = seq[to];
      return gsap.fromTo(o, { a: 0 }, { a: 1, duration: dur, ease, immediateRender: false, onUpdate: () => { P.copy(A.p).lerp(B.p, o.a); T.copy(A.t).lerp(B.t, o.a); apply(P, T, A.f + (B.f - A.f) * o.a); } });
    };
    const tl = gsap.timeline({ paused: true, onComplete: () => { dispatch({ type: "storyStep", value: 10 }); dispatch({ type: "introDone" }); } });
    tl.call(beat(0)).to({}, { duration: 1.2 })
      .call(beat(1)).add(leg(0, 1, 7.5, "power1.inOut"))
      .call(beat(2), undefined, "-=4.2")
      .call(() => { beat(3)(); dispatch({ type: "doors", value: true }); }, undefined, "-=1.6")
      .add(leg(1, 2, 2.6, "power1.inOut"))
      .call(beat(4)).add(leg(2, 3, 2.2, "sine.inOut")).add(leg(3, 4, 2.8))
      .call(beat(5)).add(leg(4, 5, 2.6)).to({}, { duration: 1.2 })
      .call(beat(6)).add(leg(5, 6, 2.8)).to({}, { duration: 1.1 })
      .call(beat(7)).add(leg(6, 7, 2.8)).to({}, { duration: 1.1 })
      .call(beat(8)).add(leg(7, 8, 2.8)).to({}, { duration: 1.1 })
      .call(beat(9)).add(leg(8, 9, 3.4)).to({}, { duration: 4.2 });
    tween.current = tl;
    // roll the film only once the store has finished loading
    const go = () => tl.play();
    if ((window as unknown as { __sceneReady?: boolean }).__sceneReady) go(); else window.addEventListener("scene-ready", go, { once: true });
    return () => { tl.kill(); window.removeEventListener("scene-ready", go); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // skip intro
  const wasDone = useRef(s.introDone);
  useEffect(() => { if (s.introDone && !wasDone.current) { wasDone.current = true; if (tween.current && tween.current.isActive()) { tween.current.kill(); flyTo(SHOTS.overview, { duration: 2.2 }); } } });

  // department & experience changes
  useEffect(() => { if (s.introDone && s.dept) flyTo(deptShot(s.dept)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [s.dept]);
  useEffect(() => {
    if (!s.introDone) return;
    const map: Partial<Record<typeof s.experience, Shot>> = { profit: SHOTS.overview, customers: SHOTS.customers, geo: SHOTS.map, products: SHOTS.plinth, sales: SHOTS.salesStart };
    const shot = map[s.experience]; if (shot) flyTo(shot); else if (s.experience === "explore" && !s.dept) flyTo(SHOTS.overview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.experience]);

  const interactive = s.introDone && !s.firstPerson && s.experience !== "sales";
  return <>
    <CameraControls ref={ctl} enabled={interactive} makeDefault minDistance={1.5} maxDistance={70} maxPolarAngle={Math.PI * 0.49} smoothTime={0.35} draggingSmoothTime={0.12}
      dollySpeed={0.6} truckSpeed={1.4} />
    {s.firstPerson ? <FirstPerson onExit={() => dispatch({ type: "firstPerson", value: false })} /> : null}
  </>;
}

/** Walk the store at eye height: click to look around, WASD / arrow keys to move, Esc to leave. */
function FirstPerson({ onExit }: { onExit: () => void }) {
  const camera = useThree(st => st.camera);
  const keys = useRef<Record<string, boolean>>({});
  useEffect(() => {
    camera.position.set(0, 1.65, 12); camera.lookAt(0, 1.6, 0);
    const d = (e: KeyboardEvent) => { keys.current[e.code] = true; }, u = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    addEventListener("keydown", d); addEventListener("keyup", u);
    return () => { removeEventListener("keydown", d); removeEventListener("keyup", u); };
  }, [camera]);
  const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  useFrame((_, dt) => {
    const k = keys.current, sp = (k.ShiftLeft ? 6 : 3.2) * dt;
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); right.crossVectors(fwd, camera.up).normalize();
    if (k.KeyW || k.ArrowUp) camera.position.addScaledVector(fwd, sp); if (k.KeyS || k.ArrowDown) camera.position.addScaledVector(fwd, -sp);
    if (k.KeyD || k.ArrowRight) camera.position.addScaledVector(right, sp); if (k.KeyA || k.ArrowLeft) camera.position.addScaledVector(right, -sp);
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, STORE.x0 + 0.6, STORE.x1 - 0.6); camera.position.z = THREE.MathUtils.clamp(camera.position.z, STORE.z0 + 0.6, STORE.z1 + 30); camera.position.y = 1.65;
  });
  return <PointerLockControls selector="#walk-start" onUnlock={onExit} />;
}
