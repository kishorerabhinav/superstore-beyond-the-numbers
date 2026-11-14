import { Component, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { loadDataset, type Dataset } from "./data/engine";
import { AppStateProvider, useApp } from "./state/AppState";
import { StoreCanvas, hasWebGL } from "./scene/StoreCanvas";
import { TopBar, FiltersBar, Timeline, KpiStrip } from "./ui/Chrome";
import { DeptPanel, ExploreHint, SalesJourney, ProfitPanel, CustomersPanel, GeoPanel, ProductsPanel } from "./ui/Panels";
import { Loader, DataNote, WalkOverlay, DeptHover } from "./ui/Extras";
import { Journey } from "./ui/Journey";
import { setSound, whoosh } from "./audio/ambience";

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
    </div> : <Store webgl={webgl} view={view} setView={setView} onData={() => setShowData(true)} />}
    {showData ? <DataNote onClose={() => setShowData(false)} /> : null}
  </>;
}

/** The 3D store (mounted only when asked for, so the journey never touches the GPU). */
function Store({ webgl, view, setView, onData }: { webgl: boolean; view: View; setView: (v: View) => void; onData: () => void }) {
  const { s } = useApp();
  const [glKey, setGlKey] = useState(0);
  useEffect(() => { setSound(s.sound); }, [s.sound]);
  useEffect(() => { if (s.dept || s.experience !== "explore") whoosh(); }, [s.dept, s.experience]);
  // the numbers lead: soften and dim the store behind open analytics
  useEffect(() => {
    const focus = !s.firstPerson && (s.dept != null || ["profit", "customers", "products"].includes(s.experience));
    const soft = !s.firstPerson && ["geo", "sales"].includes(s.experience);
    document.body.classList.toggle("numbers-focus", focus); document.body.classList.toggle("numbers-soft", soft && !focus);
    return () => { document.body.classList.remove("numbers-focus", "numbers-soft"); };
  }, [s.dept, s.experience, s.firstPerson]);
  return <>
    {webgl ? <div className="stage"><SceneBoundary><StoreCanvas key={glKey} onLost={() => setTimeout(() => setGlKey(k => k + 1), 600)} /></SceneBoundary></div>
      : <div className="fallback2d"><div className="nogl"><div className="kick">3D view unavailable here</div><p className="lede">This window can't run 3D graphics (Tableau Desktop's built-in browser switches WebGL off). Open the dashboard on Tableau Public or in any web browser to walk the store. The Analytical Journey works everywhere.</p>
        <div className="btns"><button className="btn" onClick={() => setView("journey")}>Back to the journey</button></div></div></div>}
    <div className="ui">
      <TopBar view={view} setView={setView} onData={onData} />
      {s.experience !== "sales" ? <FiltersBar /> : null}
      <Timeline />
      {s.experience !== "sales" ? <KpiStrip /> : null}
      <AnimatePresence mode="wait">
        {s.experience === "explore" ? (s.dept ? <DeptPanel key="dept" /> : <ExploreHint key="hint" />) : null}
        {s.experience === "sales" ? <SalesJourney key="sales" /> : null}
        {s.experience === "profit" ? <ProfitPanel key="profit" /> : null}
        {s.experience === "customers" ? <CustomersPanel key="cust" /> : null}
        {s.experience === "geo" ? <GeoPanel key="geo" /> : null}
        {s.experience === "products" ? <ProductsPanel key="prod" /> : null}
      </AnimatePresence>
      <DeptHover />
      <WalkOverlay />
      {s.experience === "sales" ? <div className="scroll-hint">Scroll to travel through the store</div> : null}
    </div>
  </>;
}

class SceneBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() { return this.state.error ? <Message title="The 3D store could not start" body={`${this.state.error}. The Analytical Journey still works.`} /> : this.props.children; }
}

function Message({ title, body }: { title: string; body: string }) {
  return <div className="modal" style={{ background: "#0c0d0f" }}><div className="card"><h2>{title}</h2><p style={{ color: "var(--ink-2)" }}>{body}</p></div></div>;
}
