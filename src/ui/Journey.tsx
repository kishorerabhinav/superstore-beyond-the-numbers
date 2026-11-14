/** The Analytical Journey: Superstore told chapter by chapter. Big numbers lead; every sentence is computed from the data. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useApp } from "../state/AppState";
import { journey } from "../data/journey";
import { money, pct, int, signedPct, MONTHS } from "../data/format";
import { Count } from "./Chrome";
import { BarList } from "./charts";
import { YearChart, MonthTrend, SeasonBars, ProfitBars, DiscountBars, MarginMatrix, Pareto, ShipBars } from "./journeyCharts";

type Big = { v: number; f: (x: number) => string; l: string; tone?: "pos" | "neg" | "amber" };
function Bigs({ items }: { items: Big[] }) {
  return <div className="bigs">{items.map(b => <div className="bigstat" key={b.l}><div className={`v ${b.tone ?? ""}`}><Count value={b.v} fmt={b.f} /></div><div className="l">{b.l}</div></div>)}</div>;
}
function Chapter({ id, n, kick, title, body, bigs, children }: { id: string; n: number; kick: string; title: ReactNode; body?: ReactNode; bigs?: Big[]; children?: ReactNode }) {
  return <section className="chap" id={id} data-chap={n}>
    <motion.div className="chap-in" initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.8, ease: [0.2, 0.7, 0.1, 1] }}>
      <div className="chap-h"><div className="kick">{String(n).padStart(2, "0")} · {kick}</div><h2>{title}</h2>{body ? <p className="lede">{body}</p> : null}</div>
      {bigs ? <Bigs items={bigs} /> : null}
      {children ? <div className="chap-chart">{children}</div> : null}
    </motion.div>
  </section>;
}

const CHAPTERS = ["Overview", "Growth", "Momentum", "Seasons", "Departments", "Profit leaks", "Discounts", "Geography", "Customers", "Shipping", "Products"];

export function Journey({ onStore }: { onStore: () => void }) {
  const { s } = useApp();
  const j = useMemo(() => journey(s.ds, s.filters), [s.ds, s.filters]);
  const [capIdx, setCapIdx] = useState(99);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current; if (!el) return;
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.chap)); }), { root: el, rootMargin: "-40% 0px -55% 0px" });
    el.querySelectorAll(".chap").forEach(c => io.observe(c)); return () => io.disconnect();
  }, []);
  const go = (i: number) => { const el = root.current?.querySelector(`[data-chap="${i}"] .chap-in`) as HTMLElement | null; if (el && root.current) root.current.scrollTo({ top: el.offsetTop - 120, behavior: "smooth" }); }

  const k = j.k, money0 = (x: number) => money(x), pct1 = (x: number) => pct(x);
  const levels = j.bands.map(b => b.discount);
  const ci = Math.min(capIdx, levels.length - 1), cap = ci >= levels.length - 1 ? 1 : levels[ci];
  const kept = j.bands.filter(b => b.discount <= cap), keptSales = kept.reduce((a, b) => a + b.sales, 0), keptProfit = kept.reduce((a, b) => a + b.profit, 0);
  const topCat = j.cats[0], lowCat = [...j.cats].sort((a, b) => a.margin - b.margin)[0];
  const topRegion = j.regions[0], lowRegion = [...j.regions].sort((a, b) => a.margin - b.margin)[0];
  const consumer = j.segs[0];
  const fastest = j.ship[0], slowest = j.ship[j.ship.length - 1];
  const avgMonth = j.months.length ? j.months.reduce((a, m) => a + m.sales, 0) / j.months.length : 0;
  const empty = k.lines === 0;

  return <div className="journey" ref={root}>
    <nav className="rail" aria-label="Chapters">{CHAPTERS.map((c, i) => <button key={c} className={active === i ? "on" : ""} onClick={() => go(i)}><i />{c}</button>)}</nav>
    {empty ? <div className="chap"><div className="chap-in"><h2>No order lines match these filters.</h2><p className="lede">Clear a filter to see the journey.</p></div></div> : <>

    <Chapter id="overview" n={0} kick="The business at a glance" title={<>Superstore sold <b>{money(k.sales)}</b> and kept <b className="pos">{money(k.profit)}</b>.</>}
      body={<>{int(k.orders)} orders from {int(j.customers)} customers, {int(k.quantity)} units across {j.subs.length} sub-categories. Each chapter below follows one question, and every figure follows the filters above.</>}
      bigs={[{ v: k.sales, f: money0, l: "Sales" }, { v: k.profit, f: money0, l: "Profit", tone: k.profit < 0 ? "neg" : "pos" }, { v: k.margin, f: pct1, l: "Profit margin" }, { v: k.orders, f: int, l: "Orders" },
        { v: k.aov, f: money0, l: "Average order value" }, { v: k.avgDiscount, f: pct1, l: "Average discount" }, { v: k.quantity, f: int, l: "Units sold" },
        { v: k.yoy ?? 0, f: x => (k.yoy == null ? "—" : signedPct(x)), l: k.yoyYears ? `Sales growth ${k.yoyYears[1]} vs ${k.yoyYears[0]}` : "Sales growth", tone: k.yoy == null ? undefined : k.yoy >= 0 ? "pos" : "neg" }]} />

    <Chapter id="growth" n={1} kick="Growth" title={j.growth ? <>Sales grew <b>{pct(j.growth.sales, 0)}</b> from {j.growth.from} to {j.growth.to}{j.growth.profit != null ? <>, and profit grew <b className="pos">{pct(j.growth.profit, 0)}</b></> : null}.</> : <>One year in scope.</>}
      body={(() => { const a = j.years.find(y => y.sales > 0)?.margin ?? 0, z = [...j.years].reverse().find(y => y.sales > 0)?.margin ?? 0;
        return <>The margin moved from {pct(a)} to {pct(z)}: the store keeps {z >= a ? "more" : "less"} of each sale than it did at the start.</>; })()}
      bigs={j.growth ? [{ v: j.growth.sales, f: x => signedPct(x, 0), l: `Sales ${j.growth.from}→${j.growth.to}`, tone: "pos" }, ...(j.growth.profit != null ? [{ v: j.growth.profit, f: (x: number) => signedPct(x, 0), l: `Profit ${j.growth.from}→${j.growth.to}`, tone: "pos" as const }] : []), { v: j.years[j.years.length - 1].sales, f: money0, l: `Sales in ${j.years[j.years.length - 1].year}` }] : undefined}>
      <YearChart data={j.years} />
    </Chapter>

    <Chapter id="momentum" n={2} kick="Momentum" title={j.bestMonth ? <>The best month was <b>{MONTHS[j.bestMonth.month]} {j.bestMonth.year}</b>, at {money(j.bestMonth.sales)}.</> : "Month by month"}
      body={<>An average month brings in {money(avgMonth)}; the line shows how uneven that is.</>}
      bigs={[{ v: j.bestMonth?.sales ?? 0, f: money0, l: "Best month" }, { v: avgMonth, f: money0, l: "Average month" }, { v: j.months.length, f: int, l: "Months of trading" }]}>
      <MonthTrend data={j.months} />
    </Chapter>

    <Chapter id="seasons" n={3} kick="Seasons" title={<>The last quarter brings in <b>{pct(j.q4Share, 0)}</b> of the year's sales.</>}
      body={<>{MONTHS[j.peak.month]} is the strongest month and {MONTHS[j.low.month]} the quietest, summed across the years in scope.</>}
      bigs={[{ v: j.q4Share, f: x => pct(x, 0), l: "Share of sales in Oct–Dec", tone: "amber" }, { v: j.peak.sales, f: money0, l: `${MONTHS[j.peak.month]}, the peak` }, { v: j.low.sales, f: money0, l: `${MONTHS[j.low.month]}, the low` }]}>
      <SeasonBars data={j.season} />
    </Chapter>

    <Chapter id="departments" n={4} kick="Departments" title={<><b>{topCat?.key}</b> leads with {pct(topCat ? topCat.sales / k.sales : 0, 0)} of sales; <b className="neg">{lowCat?.key}</b> keeps only {pct(lowCat?.margin ?? 0)}.</>}
      bigs={j.cats.map(c => ({ v: c.sales, f: money0, l: `${c.key} · ${pct(c.margin)} margin`, tone: c.margin < 0.05 ? "neg" as const : undefined }))}>
      <BarList data={j.cats} />
    </Chapter>

    <Chapter id="leaks" n={5} kick="Where profit leaks" title={j.losers.length ? <><b className="neg">{j.losers.length}</b> sub-categor{j.losers.length === 1 ? "y loses" : "ies lose"} money: {j.losers.map(l => l.key).join(", ")}.</> : <>Every sub-category makes money here.</>}
      body={j.bestMargin ? <>{j.bestMargin.key} keeps the most of each sale, {pct(j.bestMargin.margin)}.</> : null}
      bigs={[{ v: j.losers.reduce((a, l) => a + l.profit, 0), f: money0, l: "Lost by loss-making sub-categories", tone: "neg" }, { v: j.bestMargin?.margin ?? 0, f: pct1, l: `${j.bestMargin?.key ?? ""} margin`, tone: "pos" }]}>
      <ProfitBars data={[...j.subs].sort((a, b) => b.profit - a.profit)} />
    </Chapter>

    <Chapter id="discounts" n={6} kick="Discounts" title={<>Order lines discounted above 20% <b className="neg">lost {money(-Math.min(0, j.deepProfit))}</b> on {money(j.deepSales)} of sales.</>}
      body={<>Without a discount, lines kept {pct(j.none ? j.none.profit / (j.none.sales || 1) : 0)} of every sale. Move the slider to decline deep discounts and see what the store would have kept.</>}
      bigs={[{ v: j.deepProfit, f: money0, l: `Profit on ${int(j.deepLines)} lines over 20% off`, tone: "neg" }, { v: keptProfit, f: money0, l: cap < 1 ? `Profit if lines over ${Math.round(cap * 100)}% were declined` : "Profit as sold", tone: "pos" }, { v: keptSales, f: money0, l: cap < 1 ? "Sales that would remain" : "Sales as sold" }]}>
      <div className="whatif-row"><label htmlFor="cap">Decline lines discounted above</label>
        <input id="cap" type="range" min={0} max={Math.max(0, levels.length - 1)} step={1} value={ci} onChange={e => setCapIdx(+e.target.value)} />
        <span className="num">{cap < 1 ? `${Math.round(cap * 100)}%` : "No limit"}</span></div>
      <DiscountBars data={j.bands} cap={cap} />
    </Chapter>

    <Chapter id="geography" n={7} kick="Geography" title={<>The <b>{topRegion?.key}</b> sells the most; the <b className="neg">{lowRegion?.key}</b> keeps the least, {pct(lowRegion?.margin ?? 0)}.</>}
      body={<>Margin by region and department. Amber cells lose money.</>}
      bigs={j.regions.map(r => ({ v: r.sales, f: money0, l: `${r.key} · ${pct(r.margin)}` }))}>
      <MarginMatrix data={j.matrix} />
      <div className="two-col"><div><h3 className="sub">Top states by sales</h3><BarList data={j.topStates} /></div><div><h3 className="sub">Least profitable states</h3><BarList data={j.worstStates} /></div></div>
    </Chapter>

    <Chapter id="customers" n={8} kick="Customers" title={<><b>{pct(j.repeat, 0)}</b> of customers came back for more than one order.</>}
      body={<>The {consumer?.key} segment is the largest, with {pct(consumer ? consumer.sales / k.sales : 0, 0)} of sales. The ten biggest customers account for {pct(j.top10Share)} of all sales.</>}
      bigs={[{ v: j.customers, f: int, l: "Customers" }, { v: j.ordersPerCustomer, f: x => x.toFixed(1), l: "Orders per customer" }, { v: j.repeat, f: x => pct(x, 0), l: "Repeat customers", tone: "pos" }, { v: j.top10Share, f: pct1, l: "Sales from the top 10 customers" }]}>
      <BarList data={j.segs} />
    </Chapter>

    <Chapter id="shipping" n={9} kick="Shipping" title={<>An order takes <b>{j.avgShipDays.toFixed(1)} days</b> to ship on average.</>}
      body={fastest && slowest ? <>{fastest.key} ships in {fastest.days.toFixed(1)} days; {slowest.key} takes {slowest.days.toFixed(1)}.</> : null}
      bigs={[{ v: j.avgShipDays, f: x => `${x.toFixed(1)} d`, l: "Average days to ship" }, ...(fastest ? [{ v: fastest.days, f: (x: number) => `${x.toFixed(1)} d`, l: fastest.key }] : []), ...(slowest ? [{ v: slowest.days, f: (x: number) => `${x.toFixed(1)} d`, l: slowest.key }] : [])]}>
      <ShipBars data={j.ship} />
    </Chapter>

    <Chapter id="products" n={10} kick="Products" title={<><b>{pct(j.p80, 0)}</b> of products bring in 80% of sales.</>}
      body={<>The top fifth of the {int(j.prods.length)} products sold accounts for {pct(j.top20Share, 0)} of revenue; the long tail matters less than its size suggests.</>}
      bigs={[{ v: j.prods.length, f: int, l: "Products sold" }, { v: j.top20Share, f: x => pct(x, 0), l: "Sales from the top 20% of products", tone: "amber" }, { v: j.prods[0]?.sales ?? 0, f: money0, l: `Top product: ${(j.prods[0]?.key ?? "").slice(0, 34)}${(j.prods[0]?.key ?? "").length > 34 ? "…" : ""}` }]}>
      <Pareto data={j.pareto} p80={j.p80} />
    </Chapter>

    <section className="chap end"><div className="chap-in">
      <div className="kick">Beyond the numbers</div><h2>Walk the store these numbers describe.</h2>
      <p className="lede">The 3D store stocks every shelf from the same data: fuller shelves sell more, rail lights show margin, the map table rises with sales.</p>
      <div className="btns"><button className="btn" onClick={onStore}>Open the 3D store</button></div>
      <p className="srcnote">Source: Tableau Sample - Superstore (2026.3), {int(s.ds.n)} order lines. Orders = distinct Order IDs · margin = profit ÷ sales · average discount = mean of line discounts.</p>
    </div></section>
    </>}
  </div>;
}
