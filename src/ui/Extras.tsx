import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import { motion } from "framer-motion";
import { useApp } from "../state/AppState";
import { kpis, NO_FILTERS, select, aggregate } from "../data/engine";
import { money, pct, int, moneyFull } from "../data/format";

export function Loader({ dataReady, needs3d = true }: { dataReady: boolean; needs3d?: boolean }) {
  const { progress, active, total } = useProgress();
  const [gone, setGone] = useState(false);
  const [shaders, setShaders] = useState(() => !!(window as unknown as { __shadersReady?: boolean }).__shadersReady);
  useEffect(() => { const f = () => setShaders(true); window.addEventListener("shaders-ready", f); return () => window.removeEventListener("shaders-ready", f); }, []);
  const assetsDone = !active && total > 0 && progress >= 100;
  const done = dataReady && (!needs3d || (assetsDone && shaders));
  // wait until loading has stayed complete for a moment (drei reports 100% between batches), then roll the film
  useEffect(() => {
    if (!done) return;
    const t1 = setTimeout(() => { (window as unknown as { __sceneReady: boolean }).__sceneReady = true; window.dispatchEvent(new Event("scene-ready")); }, 1400);
    const t2 = setTimeout(() => setGone(true), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [done]);
  if (gone) return null;
  const pc = dataReady ? 8 + progress * 0.92 : 4;
  return <div className="loading" style={{ opacity: done ? 0 : 1 }} aria-live="polite">
    <div className="inner"><b>SUPERSTORE</b><div className="bar"><i style={{ width: `${pc}%` }} /></div>
      <small>{!dataReady ? "Reading 10,000 order lines" : assetsDone ? "Lighting the store" : `Building the store · ${Math.round(progress)}%`}</small></div>
  </div>;
}

/** Definitions and a live validation summary (the full check runs in the test suite against SQL). */
export function DataNote({ onClose }: { onClose: () => void }) {
  const { s } = useApp();
  const all = kpis(s.ds, NO_FILTERS);
  const years = s.ds.years.map(y => ({ y, a: aggregate(s.ds, select(s.ds, { ...NO_FILTERS, year: y })) }));
  const sumYears = years.reduce((a, x) => a + x.a.sales, 0);
  return <div className="modal" role="dialog" aria-modal="true" aria-label="About the data" onClick={onClose}>
    <motion.div className="card" onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <h2>About the data</h2>
      <p style={{ color: "var(--ink-2)" }}>Source: <b>{s.ds.source}</b> (Tableau's Sample Superstore, Orders sheet): {int(s.ds.n)} order lines, {int(s.ds.nOrders)} orders, {int(s.ds.dict.customerId.length)} customers,
        {" "}{s.ds.years[0]}–{s.ds.years[s.ds.years.length - 1]}. Every figure in the experience is computed in the browser from these lines; nothing is typed in.</p>
      <table><thead><tr><th>Measure</th><th>Definition</th><th>All data</th></tr></thead><tbody>
        <tr><td>Sales, Profit, Quantity</td><td>Sum over the order lines in scope. Profit can be negative.</td><td>{moneyFull(all.sales)} · {moneyFull(all.profit)} · {int(all.quantity)}</td></tr>
        <tr><td>Orders</td><td>Distinct Order IDs. One order can contain several lines.</td><td>{int(all.orders)} orders from {int(all.lines)} lines</td></tr>
        <tr><td>Profit margin</td><td>Total profit ÷ total sales (not an average of line margins).</td><td>{pct(all.margin, 2)}</td></tr>
        <tr><td>Average discount</td><td>Mean of the line-level Discount field, as Tableau's AVG([Discount]). Sales-weighted, on list price: {pct(all.weightedDiscount, 2)}.</td><td>{pct(all.avgDiscount, 2)}</td></tr>
        <tr><td>Average order value</td><td>Sales ÷ orders.</td><td>{money(all.aov)}</td></tr>
        <tr><td>Year-over-year growth</td><td>Sales in the latest year in scope ÷ the year before, − 1, with every other filter applied to both years.</td><td>{all.yoyYears ? `${all.yoyYears[1]} vs ${all.yoyYears[0]}: ${pct(all.yoy ?? 0, 2)}` : "—"}</td></tr>
      </tbody></table>
      <h2 style={{ fontSize: 21 }}>Checks</h2>
      <table><tbody>
        <tr><td>Columns and dates</td><td>All 19 required columns present; every Order and Ship Date parsed; no ship date before its order date; all discounts between 0 and 1.</td></tr>
        <tr><td>Years add up</td><td>{years.map(x => `${x.y}: ${money(x.a.sales)}`).join(" · ")} = {moneyFull(sumYears)} {Math.abs(sumYears - all.sales) < 0.5 ? "✓ matches total" : "✗ mismatch"}</td></tr>
        <tr><td>Independent SQL</td><td>The engine is tested against SQLite queries over the same lines (scripts/validate.py → src/data/engine.test.ts): totals, distinct orders, margin, average discount, AOV, YoY, every year, category, segment and region, two combined-filter cases, the loss-making sub-categories and the top product.</td></tr>
        <tr><td>Canada</td><td>The file includes 200 Canadian order lines (10 provinces). They count in every total and region; the US map shows them as a separate column.</td></tr>
        <tr><td>Appliances</td><td>The dataset files Appliances under Office Supplies. The store gives it its own department; the Office Supplies department excludes it so nothing is counted twice.</td></tr>
      </tbody></table>
      <p style={{ color: "var(--ink-3)", fontSize: 12 }}>3D assets: Poly Haven (CC0) and custom models built in Blender for this project.</p>
      <button className="btn" onClick={onClose}>Close</button>
    </motion.div>
  </div>;
}

export function WalkOverlay() {
  const { s, dispatch } = useApp();
  const [locked, setLocked] = useState(false);
  useEffect(() => { const f = () => setLocked(!!document.pointerLockElement); document.addEventListener("pointerlockchange", f); return () => document.removeEventListener("pointerlockchange", f); }, []);
  if (!s.firstPerson) return null;
  return locked ? <div className="crosshair" /> : <div className="walk"><div className="card"><h2>Walk the store</h2>
    <p>Move with W A S D or the arrow keys, look around with the mouse, hold Shift to walk faster. Press Esc to stop.</p>
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}><button id="walk-start" className="btn">Start walking</button><button className="btn ghost" onClick={() => dispatch({ type: "firstPerson", value: false })}>Cancel</button></div></div></div>;
}

/** Hover card for departments (shows the headline numbers before you click). */
export function DeptHover() {
  const { s } = useApp();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => { const f = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY }); addEventListener("pointermove", f); return () => removeEventListener("pointermove", f); }, []);
  if (!s.hoverDept || s.dept === s.hoverDept || s.experience !== "explore" || !s.introDone) return null;
  return <HoverCard id={s.hoverDept} x={pos.x} y={pos.y} />;
}
import { deptById } from "../scene/layout";
import { deptView } from "../data/derive";
function HoverCard({ id, x, y }: { id: Parameters<typeof deptById>[0]; x: number; y: number }) {
  const { s, k } = useApp(); const d = deptById(id); const v = deptView(s.ds, s.filters, d, k.sales);
  return <div className="hover-card" style={{ left: x, top: y - 14 }}><b>{d.name}</b><div>{money(v.agg.sales)} sales · {pct(v.margin)} margin</div><div style={{ color: "var(--amber)" }}>Click to explore</div></div>;
}
