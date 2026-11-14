import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { kpis, NO_FILTERS, type Dataset, type Filters, type Kpis } from "../data/engine";
import { subCategoryStats } from "../data/derive";
import type { DeptId } from "../scene/layout";
import { LITE } from "../scene/shared";

export type Experience = "intro" | "explore" | "sales" | "profit" | "customers" | "geo" | "products";
export type Quality = "high" | "medium" | "low";

export interface State {
  ds: Dataset; filters: Filters; experience: Experience; dept: DeptId | null; hoverDept: DeptId | null;
  introDone: boolean; sound: boolean; firstPerson: boolean; quality: Quality; product: string | null;
  doorsOpen: boolean; storyStep: number;
}
export type Action =
  | { type: "filter"; key: keyof Filters; value: string | number | null } | { type: "resetFilters" }
  | { type: "experience"; value: Experience } | { type: "dept"; value: DeptId | null } | { type: "hoverDept"; value: DeptId | null }
  | { type: "introDone" } | { type: "sound"; value: boolean } | { type: "firstPerson"; value: boolean } | { type: "quality"; value: Quality }
  | { type: "product"; value: string | null } | { type: "doors"; value: boolean } | { type: "storyStep"; value: number };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "filter": return { ...s, filters: { ...s.filters, [a.key]: a.value } };
    case "resetFilters": return { ...s, filters: NO_FILTERS };
    case "experience": return { ...s, experience: a.value, dept: null, firstPerson: false, storyStep: 0 };
    case "dept": return { ...s, dept: a.value, experience: "explore", firstPerson: false };
    case "hoverDept": return s.hoverDept === a.value ? s : { ...s, hoverDept: a.value };
    case "introDone": return { ...s, introDone: true, experience: "explore", doorsOpen: true };
    case "sound": return { ...s, sound: a.value };
    case "firstPerson": return { ...s, firstPerson: a.value, dept: null };
    case "quality": try { sessionStorage.setItem("ss-quality", a.value); } catch { /* storage unavailable */ } return { ...s, quality: a.value };
    case "product": return { ...s, product: a.value };
    case "doors": return { ...s, doorsOpen: a.value };
    case "storyStep": return { ...s, storyStep: a.value };
  }
}

interface Ctx { s: State; dispatch: Dispatch<Action>; k: Kpis; subs: ReturnType<typeof subCategoryStats> }
const C = createContext<Ctx | null>(null);

/** Picks the starting preset from the GPU name before any 3D is created, so weak GPUs never see the heavy first frames. */
export function initialQuality(): Quality {
  try {
    const q = new URLSearchParams(location.search).get("quality"); if (q === "high" || q === "medium" || q === "low") return q;
    const saved = sessionStorage.getItem("ss-quality"); if (saved === "low" || saved === "medium") return saved;
    const c = document.createElement("canvas"), gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null; if (!gl) return "low";
    const ext = gl.getExtension("WEBGL_debug_renderer_info"); const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    if (/swiftshader|llvmpipe|software|basic render/i.test(name)) return "low";
    if (/intel|uhd|iris|mali|adreno|powervr|apple gpu/i.test(name)) return "low";
    return prefersReducedMotion() ? "medium" : "high";
  } catch { return "medium"; }
}
export const prefersReducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function AppStateProvider({ ds, children }: { ds: Dataset; children: ReactNode }) {
  const [s, dispatch] = useReducer(reducer, null, (): State => { const quality = initialQuality(); LITE.on = quality === "low"; return { ds, filters: NO_FILTERS, experience: "explore", dept: null, hoverDept: null, introDone: true,
    sound: false, firstPerson: false, quality, product: null, doorsOpen: true, storyStep: 10 }; });
  const k = useMemo(() => kpis(s.ds, s.filters), [s.ds, s.filters]);
  const subs = useMemo(() => subCategoryStats(s.ds, s.filters), [s.ds, s.filters]);
  const v = useMemo(() => ({ s, dispatch, k, subs }), [s, k, subs]);
  return <C.Provider value={v}>{children}</C.Provider>;
}

export function useApp() { const c = useContext(C); if (!c) throw new Error("useApp must be used inside AppStateProvider"); return c; }
