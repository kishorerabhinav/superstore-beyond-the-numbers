/** Tiny, dependency-free bits shared between the journey and the 3D store.
 *  Keeping them here means the journey never imports three.js (and the 3D chunk can load lazily). */
import type { Shot } from "./layout";

/** Lite mode (integrated / software GPUs): set once at start-up from the GPU name. */
export const LITE = { on: false };

/** Imperative camera API, registered by the CameraDirector while the 3D store is mounted. */
export type CamApi = { flyTo: (shot: Shot, opts?: { duration?: number; arc?: number }) => void; reset: () => void; path: (t: number) => void };
export const camApi: { current: CamApi | null } = { current: null };

/** True if the browser can create a WebGL2 (or WebGL) context. */
export function hasWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
