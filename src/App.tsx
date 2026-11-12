import { Component, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { loadDataset, type Dataset } from "./data/engine";
import { AppStateProvider, useApp } from "./state/AppState";
import { StoreCanvas, hasWebGL } from "./scene/StoreCanvas";
import { TopBar, FiltersBar, Timeline, KpiStrip, IntroOverlay } from "./ui/Chrome";
import { DeptPanel, ExploreHint, SalesJourney, ProfitPanel, CustomersPanel, GeoPanel, ProductsPanel } from "./ui/Panels";
import { Loader, DataNote, WalkOverlay, DeptHover } from "./ui/Extras";
import { setSound, whoosh } from "./audio/ambience";

export default function App() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [webgl] = useState(hasWebGL);
  useEffect(() => { loadDataset().then(setDs).catch(e => setErr(String(e.message ?? e))); }, []);
  if (err) return <Message title="The dataset could not be loaded" body={`${err} Check that public/data/superstore.json exists (run npm run data), then reload.`} />;
  return <>
    {ds ? <AppStateProvider ds={ds}><Experience /></AppStateProvider> : null}
    <Loader dataReady={!!ds} needs3d={webgl} />
  </>;
}

function Experience() {
  const { s } = useApp();
  const { dispatch } = useApp();
  const [webgl] = useState(hasWebGL);
  const [showData, setShowData] = useState(false);
  // no WebGL (e.g. Tableau Desktop's built-in browser): skip the film and open the analytics directly
  useEffect(() => { if (!webgl && !s.introDone) dispatch({ type: "introDone" }); }, [webgl, s.introDone, dispatch]);
  const [glKey, setGlKey] = useState(0);
  useEffect(() => { setSound(s.sound); }, [s.sound]);
  useEffect(() => { if (s.dept || s.experience !== "explore") whoosh(); }, [s.dept, s.experience]);
  // the numbers lead: soften and dim the store behind open analytics
  useEffect(() => {
    const focus = s.introDone && !s.firstPerson && (s.dept != null || ["profit", "customers", "products"].includes(s.experience));
    const soft = s.introDone && !s.firstPerson && ["geo", "sales"].includes(s.experience);
    document.body.classList.toggle("numbers-focus", focus); document.body.classList.toggle("numbers-soft", soft && !focus);
  }, [s.dept, s.experience, s.introDone, s.firstPerson]);
  return <>
    {webgl ? <div className="stage"><SceneBoundary><StoreCanvas key={glKey} onLost={() => setTimeout(() => setGlKey(k => k + 1), 600)} /></SceneBoundary></div> : <div className="fallback2d"><div className="nogl"><div className="kick">3D view unavailable here</div><p className="lede">This window can't run 3D graphics (Tableau Desktop's built-in browser switches WebGL off). Open the dashboard on Tableau Public or in any web browser to walk the store. Every number here uses the same data, filters and definitions.</p></div></div>}
    {webgl ? <IntroOverlay /> : null}
    {s.introDone || !webgl ? <div className="ui">
      <TopBar onData={() => setShowData(true)} />
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
    </div> : null}
    {showData ? <DataNote onClose={() => setShowData(false)} /> : null}
  </>;
}

class SceneBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() { return this.state.error ? <Message title="The 3D store could not start" body={`${this.state.error}. The analytics still work: use the menu above.`} /> : this.props.children; }
}

function Message({ title, body }: { title: string; body: string }) {
  return <div className="modal" style={{ background: "#0c0d0f" }}><div className="card"><h2>{title}</h2><p style={{ color: "var(--ink-2)" }}>{body}</p></div></div>;
}
