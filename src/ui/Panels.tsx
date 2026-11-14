import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useApp } from "../state/AppState";
import { DEPARTMENTS, deptById, type DeptId } from "../scene/layout";
import { deptView, salesStory, profitStory, segmentStory, geoStory, productList, productDetail } from "../data/derive";
import { money, pct, int, MONTHS } from "../data/format";
import { MonthlyChart, BarList, DiscountChart, SeasonChart, Histogram } from "./charts";
import { Count } from "./Chrome";
import { camApi } from "../scene/shared";

gsap.registerPlugin(ScrollTrigger);

function Panel({ kick, title, intro, onClose, children }: { kick: string; title: string; intro?: ReactNode; onClose?: () => void; children: ReactNode }) {
  return <motion.aside className="panel" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.55, ease: [0.2, 0.7, 0.1, 1] }} aria-label={title}>
    <div className="panel-h"><div><div className="kick">{kick}</div><h2>{title}</h2>{intro ? <p>{intro}</p> : null}</div>
      {onClose ? <button className="icon-btn x" onClick={onClose} aria-label="Close panel">✕</button> : null}</div>
    <div className="panel-b">{children}</div>
  </motion.aside>;
}
const Stat = ({ v, l, cls }: { v: ReactNode; l: string; cls?: string }) => <div className="stat"><div className={`v ${cls ?? ""}`}>{v}</div><div className="l">{l}</div></div>;

/* ---------------- Department ---------------- */
export function DeptPanel() {
  const { s, dispatch, k } = useApp();
  const d = s.dept ? deptById(s.dept) : null;
  const v = useMemo(() => (d ? deptView(s.ds, s.filters, d, k.sales) : null), [d, s.ds, s.filters, k.sales]);
  const order: DeptId[] = ["technology", "appliances", "office", "furniture"];
  const step = (n: number) => { if (!s.dept) return; dispatch({ type: "dept", value: order[(order.indexOf(s.dept) + n + 4) % 4] }); };
  return <AnimatePresence>{d && v ? <Panel key={d.id} kick="Department" title={d.name} onClose={() => dispatch({ type: "dept", value: null })}
    intro={<>{pct(v.share)} of sales in scope{d.note ? <> · <i style={{ fontFamily: "var(--serif)" }}>{d.note}</i></> : null}</>}>
    <div className="hero-num"><span className="v"><Count value={v.agg.sales} fmt={x => money(x)} /></span><span className="l">sales</span></div>
    <div className="grid2">
      <Stat v={<Count value={v.agg.profit} fmt={x => money(x)} />} l="Profit" cls={v.agg.profit < 0 ? "neg" : "pos"} />
      <Stat v={<Count value={v.margin} fmt={x => pct(x)} />} l="Margin" cls={v.margin < 0 ? "neg" : ""} />
      <Stat v={<Count value={v.agg.orders} fmt={int} />} l="Orders" />
      <Stat v={<Count value={v.avgDiscount} fmt={x => pct(x)} />} l="Avg discount" />
      <Stat v={<Count value={v.aov} fmt={x => money(x)} />} l="Avg order value" />
      <Stat v={<Count value={v.agg.quantity} fmt={int} />} l="Units sold" />
    </div>
    <div className="sec"><h3>Monthly performance</h3><MonthlyChart data={v.months} /></div>
    <div className="sec"><h3>Sub-categories</h3><BarList data={v.subs} /><div className="note">Bar = sales; figure on the right = profit margin. The shelves for each sub-category are stocked in proportion to its sales, and their rail light shows its margin.</div></div>
    <div className="sec"><h3>Top-selling products</h3><div className="rows">{v.topProducts.map(p => <div className="row" key={p.key}><span className="n" title={p.key}>{p.key}</span><span className="a">{money(p.sales)}</span><span className={`b ${p.margin < 0 ? "neg" : "pos"}`}>{pct(p.margin)}</span></div>)}</div></div>
    {v.lossProducts.length ? <div className="sec"><h3>Biggest losses</h3><div className="rows">{v.lossProducts.map(p => <div className="row" key={p.key}><span className="n" title={p.key}>{p.key}</span><span className="a neg">{money(p.profit)}</span><span className="b">{pct(p.avgDiscount, 0)} off</span></div>)}</div></div> : null}
    <div className="sec"><h3>Discount and profit</h3><DiscountChart data={v.bands} /></div>
    <div className="chips"><button className="chip" onClick={() => step(-1)}>← Previous</button><button className="chip" onClick={() => step(1)}>Next department →</button></div>
  </Panel> : null}</AnimatePresence>;
}

/* ---------------- Explore hint ---------------- */
export function ExploreHint() {
  const { s, dispatch } = useApp();
  if (s.dept || s.firstPerson) return null;
  return <motion.div className="panel" style={{ top: "auto", height: "auto", bottom: 74 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
    <div className="panel-h"><div><div className="kick">Explore the store</div><h2 style={{ fontSize: 21 }}>Choose a department</h2>
      <p>Click a department in the store, or pick one here. Drag to orbit, scroll to zoom, right-drag to pan.</p></div></div>
    <div className="panel-b" style={{ paddingTop: 0 }}><div className="chips">{DEPARTMENTS.map(d => <button key={d.id} className="chip" onClick={() => dispatch({ type: "dept", value: d.id })}>{d.name}</button>)}</div></div>
  </motion.div>;
}

/* ---------------- A. Sales journey (scroll-driven) ---------------- */
export function SalesJourney() {
  const { s } = useApp();
  const st = useMemo(() => salesStory(s.ds, s.filters), [s.ds, s.filters]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    camApi.current?.path(0);
    const trig = ScrollTrigger.create({ scroller: el, trigger: el.firstElementChild as Element, start: "top top", end: "bottom bottom", scrub: 1.2,
      onUpdate: self => camApi.current?.path(self.progress) });
    return () => trig.kill();
  }, []);
  const total = st.categories.reduce((a, c) => a + c.sales, 0);
  const best = st.months.reduce((b, m) => (m.sales > (b?.sales ?? -1) ? m : b), st.months[0]);
  const peak = st.season.reduce((b, m) => (m.sales > b.sales ? m : b), st.season[0]), low = st.season.reduce((b, m) => (m.sales < b.sales ? m : b), st.season[0]);
  const steps: [string, string, ReactNode][] = [
    ["01 · Momentum", "Month by month", <><p className="lede">Sales in scope total <b>{money(total)}</b>. The busiest month was <b>{best ? `${MONTHS[best.month]} ${best.year}` : "—"}</b> at {best ? money(best.sales) : "—"}.</p><MonthlyChart data={st.months} height={140} /></>],
    ["02 · Seasons", "The rhythm of the year", <><p className="lede">Summed across the years in scope, <b>{MONTHS[peak.month]}</b> is the strongest month ({money(peak.sales)}) and <b>{MONTHS[low.month]}</b> the quietest ({money(low.sales)}).</p><SeasonChart data={st.season} height={130} /></>],
    ["03 · Departments", "Where revenue comes from", <><p className="lede">Each category's share of sales, with its profit margin on the right.</p><BarList data={st.categories} /></>],
    ["04 · Bestsellers", "The products that lead", <><p className="lede">The eight products with the highest sales in scope.</p><div className="rows">{st.top.map(p => <div className="row" key={p.key}><span className="n" title={p.key}>{p.key}</span><span className="a">{money(p.sales)}</span><span className={`b ${p.margin < 0 ? "neg" : "pos"}`}>{pct(p.margin)}</span></div>)}</div></>],
  ];
  return <div className="story" ref={ref} aria-label="Sales journey">
    <div>{steps.map(([kick, title, body]) => <section className="step" key={kick}><motion.div className="card" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ root: ref, amount: 0.4 }} transition={{ duration: 0.8 }}>
      <div className="kick">{kick}</div><h2>{title}</h2>{body}</motion.div></section>)}<div className="end" /></div>
  </div>;
}

/* ---------------- B. Profitability ---------------- */
export function ProfitPanel() {
  const { s, k } = useApp();
  const p = useMemo(() => profitStory(s.ds, s.filters), [s.ds, s.filters]);
  const deep = p.bands.filter(b => b.discount > 0.2), deepSales = deep.reduce((a, b) => a + b.sales, 0), deepProfit = deep.reduce((a, b) => a + b.profit, 0);
  return <Panel kick="Profitability" title="Where profit is made and lost" intro={<>Shelf rails now glow green where a sub-category makes money and amber where it loses it.</>}>
    <div className="hero-num"><span className={`v ${k.profit < 0 ? "neg" : "pos"}`}><Count value={k.profit} fmt={x => money(x)} /></span><span className="l">profit · {pct(k.margin)} margin</span></div>
    <div className="grid2"><Stat v={String(p.negative.length)} l="Sub-categories losing money" cls={p.negative.length ? "neg" : ""} /><Stat v={money(deepProfit)} l="Profit on lines over 20% off" cls={deepProfit < 0 ? "neg" : "pos"} /></div>
    <div className="sec"><h3>By category</h3><BarList data={p.categories} /></div>
    <div className="sec"><h3>Negative margins</h3>{p.negative.length ? <div className="rows">{p.negative.map(g => <div className="row" key={g.key}><span className="n">{g.key}</span><span className="a neg">{money(g.profit)}</span><span className="b neg">{pct(g.margin)}</span></div>)}</div> : <div className="note">No sub-category loses money in this selection.</div>}</div>
    <div className="sec"><h3>Discount impact</h3><DiscountChart data={p.bands} />
      <div className="note">Order lines discounted above 20% brought in {money(deepSales)} of sales and {deepProfit < 0 ? `lost ${money(-deepProfit)}` : `made ${money(deepProfit)}`}.</div></div>
    <div className="sec"><h3>Loss-making products</h3><div className="rows">{p.worstProducts.filter(x => x.profit < 0).map(x => <div className="row" key={x.key}><span className="n" title={x.key}>{x.key}</span><span className="a neg">{money(x.profit)}</span><span className="b">{pct(x.avgDiscount, 0)} off</span></div>)}</div></div>
  </Panel>;
}

/* ---------------- C. Customers ---------------- */
export function CustomersPanel() {
  const { s, dispatch } = useApp();
  const c = useMemo(() => segmentStory(s.ds, s.filters), [s.ds, s.filters]);
  const totalOrders = c.segs.reduce((a, g) => a + g.orders, 0) || 1;
  return <Panel kick="Customer intelligence" title="Who buys" intro={<>The three lanes on the right fill with shoppers in proportion to each segment's share of orders.</>}>
    {c.segs.map(g => <div className="sec" key={g.key} style={{ borderTop: ".5px solid var(--line)", paddingTop: 13 }}>
      <h3 style={{ display: "flex", justifyContent: "space-between" }}><span>{g.key}</span><button className="chip" aria-pressed={s.filters.segment === g.key} onClick={() => dispatch({ type: "filter", key: "segment", value: s.filters.segment === g.key ? null : g.key })}>{s.filters.segment === g.key ? "Filtered" : "Filter"}</button></h3>
      <div className="hero-num"><span className="v">{money(g.sales)}</span><span className="l">{pct(g.sales / (c.total.sales || 1), 0)} of sales</span></div>
      <div className="grid3"><Stat v={int(g.orders)} l={`${pct(g.orders / totalOrders, 0)} of orders`} /><Stat v={money(g.aov)} l="Avg order" /><Stat v={pct(g.margin)} l="Margin" cls={g.margin < 0 ? "neg" : ""} />
        <Stat v={int(g.customers)} l="Customers" /><Stat v={g.ordersPerCustomer.toFixed(1)} l="Orders / customer" /><Stat v={money(g.profit)} l="Profit" cls={g.profit < 0 ? "neg" : "pos"} /></div>
      <div className="note">Buys mostly {g.cats[0]?.key ?? "—"} ({pct(g.cats[0] ? g.cats[0].sales / g.sales : 0, 0)} of its sales); most often ships {g.ship.sort((a, b) => b.orders - a.orders)[0]?.key ?? "—"}.</div>
    </div>)}
  </Panel>;
}

/* ---------------- D. Geography ---------------- */
export function GeoPanel() {
  const { s, dispatch } = useApp();
  const g = useMemo(() => geoStory(s.ds, s.filters), [s.ds, s.filters]);
  const top = [...g.states].sort((a, b) => b.sales - a.sales).slice(0, 6), worst = [...g.states].sort((a, b) => a.profit - b.profit).slice(0, 4);
  return <Panel kick="Geographic intelligence" title={s.filters.region ? `${s.filters.region} region` : "The United States"} intro={<>States rise with sales and are coloured by margin. Click a state, or a region below, to focus.</>}>
    <div className="chips">{g.regions.map(r => <button key={r.key} className="chip" aria-pressed={s.filters.region === r.key} onClick={() => dispatch({ type: "filter", key: "region", value: s.filters.region === r.key ? null : r.key })}>{r.key} · {money(r.sales)}</button>)}</div>
    <div className="sec"><h3>Regions</h3><BarList data={g.regions} active={s.filters.region} onPick={key => dispatch({ type: "filter", key: "region", value: s.filters.region === key ? null : key })} /></div>
    <div className="sec"><h3>Top states</h3><BarList data={top} /></div>
    <div className="sec"><h3>{s.filters.region ? `Top cities in the ${s.filters.region}` : "Top cities"}</h3><BarList data={g.cities.slice(0, 6)} /></div>
    <div className="sec"><h3>Least profitable states</h3><div className="rows">{worst.map(x => <div className="row" key={x.key}><span className="n">{x.key}</span><span className={`a ${x.profit < 0 ? "neg" : ""}`}>{money(x.profit)}</span><span className={`b ${x.margin < 0 ? "neg" : ""}`}>{pct(x.margin)}</span></div>)}</div>
      <div className="note">Canada adds {money(g.canada.sales)} from {int(g.canada.lines)} order lines; it stands as the separate grey column in the north-east corner of the table.</div></div>
  </Panel>;
}

/* ---------------- E. Products ---------------- */
export function ProductsPanel() {
  const { s, dispatch } = useApp();
  const list = useMemo(() => productList(s.ds, s.filters), [s.ds, s.filters]);
  const [q, setQ] = useState(""); const [sub, setSub] = useState("");
  const subOf = useMemo(() => { const m = new Map<string, string>(); for (let i = 0; i < s.ds.n; i++) m.set(s.ds.dict.productName[s.ds.dims.productName[i]], s.ds.dict.subCategory[s.ds.dims.subCategory[i]]); return m; }, [s.ds]);
  const scoped = useMemo(() => (sub ? list.filter(p => subOf.get(p.key) === sub) : list), [list, sub, subOf]);
  const shown = useMemo(() => (q ? scoped.filter(p => p.key.toLowerCase().includes(q.toLowerCase())) : scoped).slice(0, 60), [scoped, q]);
  const subNames = useMemo(() => [...new Set(list.map(p => subOf.get(p.key) ?? ""))].filter(Boolean).sort(), [list, subOf]);
  const pickSub = (v: string) => { setSub(v); const first = (v ? list.filter(p => subOf.get(p.key) === v) : list)[0]; if (first) dispatch({ type: "product", value: first.key }); };
  useEffect(() => { if (!s.product && list[0]) dispatch({ type: "product", value: list[0].key }); }, [s.product, list, dispatch]);
  const d = useMemo(() => (s.product ? productDetail(s.ds, s.filters, s.product) : null), [s.ds, s.filters, s.product]);
  return <Panel kick="Product exploration" title={d?.name ?? "Choose a product"} intro={d ? <>{d.sub} · {d.category}</> : null}>
    <div className="selects">
      <div className="sel"><label htmlFor="p-sub">Sub-category</label><select id="p-sub" value={sub} onChange={e => pickSub(e.target.value)}>
        <option value="">All sub-categories ({int(list.length)} products)</option>{subNames.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
      <div className="sel"><label htmlFor="p-pick">Product, by sales</label><select id="p-pick" value={s.product ?? ""} onChange={e => dispatch({ type: "product", value: e.target.value })}>
        {scoped.slice(0, 300).map(p => <option key={p.key} value={p.key}>{p.key} · {money(p.sales)}</option>)}
        {s.product && !scoped.slice(0, 300).some(p => p.key === s.product) ? <option value={s.product}>{s.product}</option> : null}</select></div>
    </div>
    <div className="search"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${int(list.length)} products`} aria-label="Search products" /></div>
    <div className="plist">{shown.map(p => <button key={p.key} aria-pressed={s.product === p.key} onClick={() => dispatch({ type: "product", value: p.key })}><span>{p.key}</span><span className="num">{money(p.sales)}</span></button>)}</div>
    {d && d.agg.lines ? <>
      <div className="hero-num"><span className="v"><Count value={d.agg.sales} fmt={x => money(x)} /></span><span className="l">sales</span></div>
      <div className="grid3"><Stat v={int(d.agg.quantity)} l="Units sold" /><Stat v={money(d.agg.profit)} l="Profit" cls={d.agg.profit < 0 ? "neg" : "pos"} /><Stat v={pct(d.margin)} l="Margin" cls={d.margin < 0 ? "neg" : ""} />
        <Stat v={int(d.agg.orders)} l="Orders" /><Stat v={pct(d.agg.discountSum / d.agg.lines)} l="Avg discount" /><Stat v={money(d.agg.sales / Math.max(1, d.agg.orders))} l="Per order" /></div>
      <div className="sec"><h3>Monthly sales</h3><MonthlyChart data={d.months} height={100} /></div>
      <div className="sec"><h3>Discounts given</h3><Histogram data={d.discounts} /></div>
      <div className="sec"><h3>Customer segments</h3><BarList data={d.segments} /></div>
    </> : <div className="note">This product has no order lines for the current filters.</div>}
  </Panel>;
}
