import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import { useApp, type Experience } from "../state/AppState";
import { money, pct, int, signedPct } from "../data/format";
import { camApi } from "../scene/CameraDirector";
import { NO_FILTERS, type Filters } from "../data/engine";

/** Animated number that eases to its new value whenever it changes. */
export function Count({ value, fmt, delay = 0 }: { value: number; fmt: (v: number) => string; delay?: number }) {
  const [v, setV] = useState(0); const prev = useRef(0);
  useEffect(() => { const c = animate(prev.current, value, { duration: 1.4, delay, ease: [0.2, 0.7, 0.1, 1], onUpdate: x => setV(x) }); prev.current = value; return () => c.stop(); }, [value, delay]);
  return <>{fmt(v)}</>;
}

const NAV: [Experience, string][] = [["explore", "Explore"], ["sales", "Store tour"], ["profit", "Profitability"], ["customers", "Customers"], ["geo", "Geography"], ["products", "Products"]];

export function TopBar({ onData, view, setView }: { onData: () => void; view: "journey" | "store"; setView: (v: "journey" | "store") => void }) {
  const { s, dispatch } = useApp();
  const store = view === "store";
  return <header className="top">
    <div className="brand"><b>SUPERSTORE</b><span>Beyond the Numbers</span></div>
    <nav className="nav" aria-label="Views">
      <button aria-pressed={!store} onClick={() => setView("journey")}>Analytical journey</button>
      {store ? NAV.map(([id, label]) => <button key={id} aria-pressed={s.experience === id} onClick={() => dispatch({ type: "experience", value: id })}>{label}</button>)
        : <button aria-pressed={false} onClick={() => setView("store")}>3D store</button>}
    </nav>
    <div className="tools">
      {store ? <>
        <button className="icon-btn" title="Walk the store (first person)" aria-pressed={s.firstPerson} onClick={() => dispatch({ type: "firstPerson", value: !s.firstPerson })}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="3" r="1.6" /><path d="M8 5v5l-2.5 4M8 10l2.5 4M5 7.5h6" /></svg>Walk</button>
        <button className="icon-btn" title="Reset camera" onClick={() => { dispatch({ type: "dept", value: null }); camApi.current?.reset(); }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" /></svg></button>
        <button className="icon-btn" title={s.sound ? "Mute sound" : "Turn sound on"} aria-pressed={s.sound} onClick={() => dispatch({ type: "sound", value: !s.sound })}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z" fill="currentColor" stroke="none" />{s.sound ? <path d="M11 5.5c1 1.4 1 3.6 0 5M12.8 4c1.8 2.3 1.8 5.7 0 8" /> : <path d="M11 6l3.5 4M14.5 6L11 10" />}</svg></button>
      </> : null}
      <button className="icon-btn" title="How the numbers are calculated" onClick={onData}>Data</button>
    </div>
  </header>;
}

const FIELDS: { key: keyof Filters; label: string; dim: string }[] = [
  { key: "year", label: "Year", dim: "year" }, { key: "region", label: "Region", dim: "region" }, { key: "category", label: "Category", dim: "category" }, { key: "segment", label: "Segment", dim: "segment" }, { key: "shipMode", label: "Ship mode", dim: "shipMode" }];

export function FiltersBar() {
  const { s, dispatch } = useApp();
  const any = Object.values(s.filters).some(v => v != null);
  return <div className="filters" role="group" aria-label="Filters">
    {FIELDS.map(f => <div key={f.key} className={`pill${s.filters[f.key] ? " on" : ""}`}>
      <label htmlFor={`f-${f.key}`}>{f.label}</label>
      <select id={`f-${f.key}`} value={s.filters[f.key] != null ? String(s.filters[f.key]) : ""} onChange={e => dispatch({ type: "filter", key: f.key, value: e.target.value ? (f.key === "year" ? Number(e.target.value) : e.target.value) : null })}>
        <option value="">All</option>{(f.dim === "year" ? s.ds.years.map(String) : [...s.ds.dict[f.dim]].sort()).map(v => <option key={v} value={v}>{v}</option>)}
      </select></div>)}
    {any ? <button className="clear" onClick={() => dispatch({ type: "resetFilters" })}>Clear</button> : null}
  </div>;
}

export function Timeline() {
  const { s, dispatch } = useApp();
  const opts: (number | null)[] = [null, ...s.ds.years];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [knob, setKnob] = useState({ left: 0, width: 0 });
  const idx = opts.indexOf(s.filters.year);
  useEffect(() => { const b = refs.current[idx]; if (b) setKnob({ left: b.offsetLeft, width: b.offsetWidth }); }, [idx]);
  return <div className="timeline" role="group" aria-label="Year">
    <span className="lbl">Year</span>
    <div className="years">
      <motion.span className="knob" animate={knob} transition={{ type: "spring", stiffness: 380, damping: 34 }} />
      {opts.map((y, i) => <button key={String(y)} ref={el => { refs.current[i] = el; }} aria-pressed={s.filters.year === y} onClick={() => dispatch({ type: "filter", key: "year", value: y })}>{y ?? "All"}</button>)}
    </div>
  </div>;
}

export function KpiStrip() {
  const { k } = useApp();
  const items: [string, number, (v: number) => string, string?][] = [
    ["Sales", k.sales, v => money(v)], ["Profit", k.profit, v => money(v), k.profit < 0 ? "neg" : ""], ["Profit margin", k.margin, v => pct(v)], ["Orders", k.orders, int],
    ["Avg order value", k.aov, v => money(v)], ["Avg discount", k.avgDiscount, v => pct(v)], ["Quantity sold", k.quantity, int],
    [k.yoyYears ? `Sales vs ${k.yoyYears[0]}` : "YoY growth", k.yoy ?? 0, v => (k.yoy == null ? "—" : signedPct(v)), k.yoy == null ? "" : k.yoy >= 0 ? "pos" : "neg"]];
  return <div className="kpis" aria-label="Key figures for the current filters">
    {items.map(([l, v, f, c]) => <div className="kpi" key={l}><span className={`v ${c ?? ""}`}><Count value={v} fmt={f} /></span><span className="l">{l}</span></div>)}
  </div>;
}

/** Captions for the opening film, keyed to the camera director's beats. */
export function IntroOverlay() {
  const { s, dispatch, k } = useApp();
  const b = s.storyStep;
  const depts: Record<number, [string, string]> = { 5: ["Technology", "Phones, accessories, machines and copiers"], 6: ["Appliances", "Kitchen and office appliances"], 7: ["Office Supplies", "Binders, paper, storage and the everyday"], 8: ["Furniture", "Chairs, tables, bookcases and furnishings"] };
  if (s.introDone) return null;
  return <div className="intro">
    <div className="letterbox t" style={{ transform: b >= 9 ? "translateY(-100%)" : "none" }} />
    <div className="letterbox b" style={{ transform: b >= 9 ? "translateY(100%)" : "none" }} />
    <div className="blackout" style={{ opacity: b === 0 ? 1 : 0 }} />
    <div className="title-card"><AnimatePresence>
      {b >= 1 && b <= 3 ? <motion.div key="title" initial={{ opacity: 0, y: 14, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, filter: "blur(6px)" }} transition={{ duration: 1.6, ease: [0.2, 0.7, 0.1, 1] }}>
        <h1>SUPERSTORE</h1>
        <AnimatePresence>{b >= 2 ? <motion.div key="s" className="sub" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4 }}>Beyond the Numbers.</motion.div> : null}</AnimatePresence>
        <AnimatePresence>{b >= 2 ? <motion.div key="t" className="tag" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4, delay: 0.9 }}>An interactive retail intelligence experience</motion.div> : null}</AnimatePresence>
      </motion.div> : null}
    </AnimatePresence></div>
    <AnimatePresence mode="wait">
      {depts[b] ? <motion.div key={`d${b}`} className="caption" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.9, ease: [0.2, 0.7, 0.1, 1] }}>
        <div className="kick">Department</div><h2>{depts[b][0]}</h2><p>{depts[b][1]}</p></motion.div> : null}
      {b === 4 ? <motion.div key="enter" className="caption" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }}>
        <div className="kick">Every product has a story</div><h2>Every transaction reveals an opportunity.</h2></motion.div> : null}
    </AnimatePresence>
    <div className="bizkpis-wrap"><AnimatePresence>
      {b >= 9 ? <motion.div key="biz" className="bizkpis" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
        {([["Total sales", k.sales, (v: number) => money(v)], ["Total profit", k.profit, (v: number) => money(v)], ["Orders", k.orders, int], ["Average discount", k.avgDiscount, (v: number) => pct(v)], ["Profit margin", k.margin, (v: number) => pct(v)]] as const)
          .map(([l, v, f], i) => <div className="stat" key={l}><div className="v"><Count value={v} fmt={f} delay={0.25 * i} /></div><div className="l">{l}</div></div>)}
      </motion.div> : null}
    </AnimatePresence></div>
    <div className="skip"><button className="btn ghost" onClick={() => dispatch({ type: "introDone" })}>Skip intro</button></div>
  </div>;
}

export const anyFilter = (f: Filters) => Object.keys(NO_FILTERS).some(k => f[k as keyof Filters] != null);
