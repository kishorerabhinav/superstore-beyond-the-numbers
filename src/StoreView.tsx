import { Component, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { useApp } from "./state/AppState";
import { StoreCanvas } from "./scene/StoreCanvas";
import { TopBar, FiltersBar, Timeline, KpiStrip } from "./ui/Chrome";
import { DeptPanel, ExploreHint, SalesJourney, ProfitPanel, CustomersPanel, GeoPanel, ProductsPanel } from "./ui/Panels";
import { WalkOverlay, DeptHover } from "./ui/Extras";
import { setSound, whoosh } from "./audio/ambience";
import { Message, type View } from "./App";

/** The 3D store (mounted only when asked for, so the journey never touches the GPU). */
export default function Store({ webgl, view, setView, onData }: { webgl: boolean; view: View; setView: (v: View) => void; onData: () => void }) {
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

