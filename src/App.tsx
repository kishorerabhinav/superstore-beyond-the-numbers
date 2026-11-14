import { lazy, Suspense, useEffect, useState } from "react";
import { loadDataset, type Dataset } from "./data/engine";
import { AppStateProvider } from "./state/AppState";
import { hasWebGL } from "./scene/shared";
import { TopBar, FiltersBar } from "./ui/Chrome";
import { Loader, DataNote } from "./ui/Extras";
import { Journey } from "./ui/Journey";

// the 3D store (three.js, models, post-processing) loads only when opened
const StoreView = lazy(() => import("./StoreView"));

export type View = "journey" | "store";
const initialView = (): View => { try { return new URLSearchParams(location.search).get("view") === "store" ? "store" : "journey"; } catch { return "journey"; } };

export default function App() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [webgl] = useState(hasWebGL);
  const [view, setView] = useState<View>(initialView);
  useEffect(() => { loadDataset().then(setDs).catch(e => setErr(String(e.message ?? e))); }, []);
  if (err) return <Message title="The dataset could not be loaded" body={`${err} Check that public/data/superstore.json exists (run npm run data), then reload.`} />;
  return <>
    {ds ? <AppStateProvider ds={ds}><Shell view={view} setView={setView} webgl={webgl} /></AppStateProvider> : null}
    {/* the journey needs only the data; the 3D store also waits for its models and shaders */}
    <Loader key={view} dataReady={!!ds} needs3d={view === "store" && webgl} />
  </>;
}

function Shell({ view, setView, webgl }: { view: View; setView: (v: View) => void; webgl: boolean }) {
  const [showData, setShowData] = useState(false);
  return <>
    {view === "journey" ? <div className="ui-journey">
      <TopBar view={view} setView={setView} onData={() => setShowData(true)} />
      <FiltersBar />
      <Journey onStore={() => setView("store")} />
    </div> : <Suspense fallback={null}><StoreView webgl={webgl} view={view} setView={setView} onData={() => setShowData(true)} /></Suspense>}
    {showData ? <DataNote onClose={() => setShowData(false)} /> : null}
  </>;
}

export function Message({ title, body }: { title: string; body: string }) {
  return <div className="modal" style={{ background: "#0c0d0f" }}><div className="card"><h2>{title}</h2><p style={{ color: "var(--ink-2)" }}>{body}</p></div></div>;
}
