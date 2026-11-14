/** Wide charts for the Analytical Journey. Hairline axes, numbers at the marks, Georgia italic annotations. */
import { scaleLinear, scaleBand } from "d3-scale";
import { area, line, curveMonotoneX } from "d3-shape";
import { motion } from "framer-motion";
import { MONTHS, money, pct } from "../data/format";

const W = 760;
const ease = [0.2, 0.7, 0.1, 1] as const;
const Ann = ({ x, y, children, anchor = "start" }: { x: number; y: number; children: string; anchor?: "start" | "middle" | "end" }) => <text className="ann" x={x} y={y} textAnchor={anchor}>{children}</text>;

/** Sales bars by year with profit beneath and the margin on each column. */
export function YearChart({ data }: { data: { year: number; sales: number; profit: number; margin: number }[] }) {
  const H = 260, m = { t: 34, b: 44 };
  const x = scaleBand<number>().domain(data.map(d => d.year)).range([10, W - 10]).padding(0.38);
  const y = scaleLinear().domain([0, Math.max(1, ...data.map(d => d.sales))]).range([H - m.b, m.t]);
  return <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Sales and profit by year">
    <line x1={0} x2={W} y1={H - m.b} y2={H - m.b} stroke="rgba(243,239,231,.3)" strokeWidth={0.6} />
    {data.map((d, i) => { const bx = x(d.year)!, bw = x.bandwidth(), ys = y(d.sales), yp = y(Math.max(0, d.profit));
      return <g key={d.year}>
        <motion.rect x={bx} width={bw} rx={2} fill="rgba(243,239,231,.16)" initial={{ y: H - m.b, height: 0 }} animate={{ y: ys, height: H - m.b - ys }} transition={{ duration: 1, delay: i * 0.08, ease }} />
        <motion.rect x={bx} width={bw} rx={2} fill={d.profit < 0 ? "#f2a24a" : "#8fd3a8"} initial={{ y: H - m.b, height: 0 }} animate={{ y: yp, height: H - m.b - yp }} transition={{ duration: 1, delay: 0.3 + i * 0.08, ease }} />
        <text className="val big" x={bx + bw / 2} y={ys - 10} textAnchor="middle">{money(d.sales)}</text>
        <text className="val" x={bx + bw / 2} y={Math.min(yp - 6, H - m.b - 6)} textAnchor="middle" style={{ fill: "#8fd3a8" }}>{money(d.profit)}</text>
        <text x={bx + bw / 2} y={H - m.b + 18} textAnchor="middle" style={{ fontSize: 13, fill: "#f3efe7", fontWeight: 700 }}>{d.year}</text>
        <text className="ann" x={bx + bw / 2} y={H - m.b + 34} textAnchor="middle">{pct(d.margin)} margin</text>
      </g>; })}
    <Ann x={10} y={14}>sales (light) and profit (green) by year</Ann>
  </svg>;
}

/** Monthly sales line with profit, peak called out. */
export function MonthTrend({ data }: { data: { year: number; month: number; sales: number; profit: number }[] }) {
  const H = 240, m = { l: 6, r: 6, t: 30, b: 26 };
  if (!data.length) return null;
  const x = scaleLinear().domain([0, data.length - 1]).range([m.l, W - m.r]);
  const y = scaleLinear().domain([Math.min(0, ...data.map(d => d.profit)), Math.max(...data.map(d => d.sales))]).range([H - m.b, m.t]).nice();
  const a = area<typeof data[number]>().x((_, i) => x(i)).y0(y(0)).y1(d => y(d.sales)).curve(curveMonotoneX)(data)!;
  const l = line<typeof data[number]>().x((_, i) => x(i)).y(d => y(d.sales)).curve(curveMonotoneX)(data)!;
  const p = line<typeof data[number]>().x((_, i) => x(i)).y(d => y(d.profit)).curve(curveMonotoneX)(data)!;
  const pk = data.reduce((b, d, i) => (d.sales > data[b].sales ? i : b), 0);
  const key = data.map(d => Math.round(d.sales)).join(",");
  return <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Monthly sales and profit">
    <defs><linearGradient id="jg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e7b46a" stopOpacity=".35" /><stop offset="1" stopColor="#e7b46a" stopOpacity="0" /></linearGradient></defs>
    {y.ticks(4).map(t => <g key={t}><line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="rgba(243,239,231,.08)" strokeDasharray="1 3" /><text x={W - m.r} y={y(t) - 3} textAnchor="end">{money(t)}</text></g>)}
    {data.map((d, i) => d.month === 0 ? <g key={i}><line x1={x(i)} x2={x(i)} y1={m.t} y2={H - m.b} stroke="rgba(243,239,231,.14)" strokeDasharray="1 3" /><text x={x(i) + 4} y={H - 8} style={{ fontSize: 12, fill: "#b9b3a8", fontWeight: 700 }}>{d.year}</text></g> : null)}
    <motion.path key={`a${key}`} d={a} fill="url(#jg)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, delay: 0.5 }} />
    <motion.path key={`l${key}`} d={l} fill="none" stroke="#e7b46a" strokeWidth={1.8} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, ease }} />
    <motion.path key={`p${key}`} d={p} fill="none" stroke="#8fd3a8" strokeWidth={1.2} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, delay: 0.3, ease }} />
    <circle cx={x(pk)} cy={y(data[pk].sales)} r={3.5} fill="#f3efe7" />
    <text className="val big" x={Math.min(W - 150, x(pk) + 8)} y={Math.max(m.t + 10, y(data[pk].sales) + 4)}>{money(data[pk].sales)} · {MONTHS[data[pk].month]} {data[pk].year}</text>
    <Ann x={m.l} y={14}>sales (amber) and profit (green), month by month</Ann>
  </svg>;
}

/** Seasonality: twelve calendar months, Q4 shaded. */
export function SeasonBars({ data }: { data: { month: number; sales: number }[] }) {
  const H = 220, m = { t: 30, b: 24 };
  const x = scaleBand<number>().domain(data.map(d => d.month)).range([6, W - 6]).padding(0.24);
  const y = scaleLinear().domain([0, Math.max(1, ...data.map(d => d.sales))]).range([H - m.b, m.t]);
  const top = data.reduce((b, d) => (d.sales > b.sales ? d : b), data[0]);
  return <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Sales by calendar month">
    <rect x={x(9)! - 6} y={m.t - 18} width={x(11)! + x.bandwidth() - x(9)! + 12} height={H - m.b - m.t + 18} fill="rgba(231,180,106,.07)" rx={6} />
    <text className="ann" x={x(9)! + 2} y={m.t - 6}>Q4</text>
    {data.map(d => <g key={d.month}>
      <motion.rect x={x(d.month)} width={x.bandwidth()} rx={2} fill={d === top ? "#e7b46a" : d.month >= 9 ? "rgba(231,180,106,.55)" : "rgba(243,239,231,.3)"}
        initial={{ y: H - m.b, height: 0 }} animate={{ y: y(d.sales), height: H - m.b - y(d.sales) }} transition={{ duration: 0.8, delay: d.month * 0.04, ease }} />
      <text x={x(d.month)! + x.bandwidth() / 2} y={H - 8} textAnchor="middle" style={{ fontSize: 11.5, fill: "#b9b3a8" }}>{MONTHS[d.month]}</text>
      <text className="val" x={x(d.month)! + x.bandwidth() / 2} y={y(d.sales) - 5} textAnchor="middle">{money(d.sales, 0)}</text>
    </g>)}
  </svg>;
}

/** Diverging horizontal bars: profit by item, sorted; label = profit and margin. */
export function ProfitBars({ data, label = d => d.key }: { data: { key: string; profit: number; margin: number; sales: number }[]; label?: (d: { key: string }) => string }) {
  const rowH = 24, H = data.length * rowH + 30, mid = 250;
  const max = Math.max(1, ...data.map(d => Math.abs(d.profit)));
  const x = scaleLinear().domain([-max, max]).range([mid - 160, W - 130]);
  return <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Profit by item">
    <line x1={x(0)} x2={x(0)} y1={6} y2={H - 6} stroke="rgba(243,239,231,.35)" strokeWidth={0.6} />
    {data.map((d, i) => { const yy = 14 + i * rowH, x0 = x(Math.min(0, d.profit)), w = Math.abs(x(d.profit) - x(0)); const neg = d.profit < 0;
      return <g key={d.key}>
        <text x={x(0) - (neg ? w + 10 : 10)} y={yy + 12} textAnchor="end" style={{ fontSize: 12.5, fill: "#f3efe7" }}>{label(d)}</text>
        <motion.rect y={yy + 2} height={14} rx={2} fill={neg ? "#f2a24a" : "#8fd3a8"} initial={{ x: x(0), width: 0 }} animate={{ x: x0, width: Math.max(1, w) }} transition={{ duration: 0.9, delay: i * 0.03, ease }} />
        <text className="val" x={neg ? x(0) + 8 : x(d.profit) + 8} y={yy + 13}>{money(d.profit)} <tspan style={{ fill: neg ? "#f2a24a" : "#b9b3a8", fontWeight: 400 }}>{pct(d.margin)}</tspan></text>
      </g>; })}
  </svg>;
}

/** Profit by discount level with a what-if cut-off line. */
export function DiscountBars({ data, cap }: { data: { discount: number; sales: number; profit: number; margin: number; lines: number }[]; cap: number }) {
  const H = 260, m = { t: 30, b: 46 };
  const x = scaleBand<number>().domain(data.map(d => d.discount)).range([10, W - 10]).padding(0.26);
  const y = scaleLinear().domain([Math.min(0, ...data.map(d => d.profit)), Math.max(0, ...data.map(d => d.profit))]).range([H - m.b, m.t]).nice();
  const capX = cap < 1 ? (() => { const after = data.find(d => d.discount > cap); return after ? x(after.discount)! - (x.step() * x.paddingInner()) / 2 : null; })() : null;
  return <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Profit by discount level">
    <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="rgba(243,239,231,.35)" strokeWidth={0.6} />
    {capX != null ? <g><rect x={capX} y={m.t - 20} width={W - capX} height={H - m.b - m.t + 20} fill="rgba(242,162,74,.06)" /><line x1={capX} x2={capX} y1={m.t - 20} y2={H - m.b} stroke="#f2a24a" strokeDasharray="4 3" /><text className="ann" x={capX + 6} y={m.t - 8} style={{ fill: "#f2a24a" }}>declined in the what-if</text></g> : null}
    {data.map(d => { const top = d.profit >= 0 ? y(d.profit) : y(0), h = Math.abs(y(d.profit) - y(0)), bx = x(d.discount)!, bw = x.bandwidth();
      return <g key={d.discount} opacity={capX != null && d.discount > cap ? 0.4 : 1}>
        <motion.rect x={bx} width={bw} rx={2} fill={d.profit < 0 ? "#f2a24a" : "#8fd3a8"} initial={{ y: y(0), height: 0 }} animate={{ y: top, height: Math.max(1, h) }} transition={{ duration: 0.9, ease }} />
        <text className="val" x={bx + bw / 2} y={d.profit >= 0 ? top - 6 : top + h + 14} textAnchor="middle">{money(d.profit, 0)}</text>
        <text x={bx + bw / 2} y={H - m.b + 18} textAnchor="middle" style={{ fontSize: 12.5, fill: "#f3efe7", fontWeight: 700 }}>{d.discount ? `${Math.round(d.discount * 100)}%` : "None"}</text>
        <text className="ann" x={bx + bw / 2} y={H - m.b + 33} textAnchor="middle">{pct(d.margin, 0)}</text>
      </g>; })}
    <Ann x={10} y={14}>profit by discount given · italic figure = margin</Ann>
  </svg>;
}

/** Region × category margin matrix. */
export function MarginMatrix({ data }: { data: { region: string; cells: { category: string; sales: number; margin: number }[] }[] }) {
  const cats = ["Furniture", "Office Supplies", "Technology"], cw = (W - 140) / 3, rh = 54, H = 40 + data.length * rh;
  const col = (m: number) => m < 0 ? "rgba(242,162,74,.75)" : `rgba(143,211,168,${0.15 + Math.min(0.75, m * 3)})`;
  return <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Profit margin by region and category">
    {cats.map((c, j) => <text key={c} x={140 + cw * j + cw / 2} y={20} textAnchor="middle" style={{ fontSize: 12.5, fill: "#b9b3a8", fontWeight: 700 }}>{c}</text>)}
    {data.map((r, i) => <g key={r.region}>
      <text x={0} y={40 + i * rh + rh / 2 + 4} style={{ fontSize: 13, fill: "#f3efe7", fontWeight: 700 }}>{r.region}</text>
      {cats.map((c, j) => { const cell = r.cells.find(x => x.category === c); if (!cell) return null; const cx = 140 + cw * j;
        return <g key={c}><motion.rect x={cx + 3} y={40 + i * rh + 3} width={cw - 6} height={rh - 6} rx={6} fill={col(cell.margin)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: (i * 3 + j) * 0.04 }} />
          <text x={cx + cw / 2} y={40 + i * rh + rh / 2 + 1} textAnchor="middle" style={{ fontSize: 17, fill: "#141518", fontWeight: 800 }}>{pct(cell.margin)}</text>
          <text x={cx + cw / 2} y={40 + i * rh + rh / 2 + 16} textAnchor="middle" style={{ fontSize: 10.5, fill: "#141518", opacity: .75 }}>{money(cell.sales)} sales</text></g>; })}
    </g>)}
  </svg>;
}

/** Pareto curve: share of sales from the top x% of products. */
export function Pareto({ data, p80 }: { data: { x: number; y: number }[]; p80: number }) {
  const H = 240, m = { l: 34, r: 10, t: 20, b: 30 };
  const x = scaleLinear().domain([0, 1]).range([m.l, W - m.r]), y = scaleLinear().domain([0, 1]).range([H - m.b, m.t]);
  const l = line<{ x: number; y: number }>().x(d => x(d.x)).y(d => y(d.y)).curve(curveMonotoneX)(data)!;
  return <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Cumulative share of sales by product">
    {[0, 0.25, 0.5, 0.75, 1].map(t => <g key={t}><line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="rgba(243,239,231,.08)" strokeDasharray="1 3" /><text x={m.l - 6} y={y(t) + 4} textAnchor="end">{Math.round(t * 100)}%</text></g>)}
    <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="rgba(243,239,231,.18)" strokeDasharray="3 4" />
    <motion.path d={l} fill="none" stroke="#e7b46a" strokeWidth={2} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease }} />
    <line x1={x(p80)} x2={x(p80)} y1={y(0.8)} y2={H - m.b} stroke="#f3efe7" strokeDasharray="2 3" /><line x1={m.l} x2={x(p80)} y1={y(0.8)} y2={y(0.8)} stroke="#f3efe7" strokeDasharray="2 3" />
    <circle cx={x(p80)} cy={y(0.8)} r={4} fill="#f3efe7" />
    <text className="val big" x={x(p80) + 10} y={y(0.8) + 18}>{pct(p80, 0)} of products → 80% of sales</text>
    <text x={W - m.r} y={H - 8} textAnchor="end">share of products, best-selling first →</text>
    <Ann x={m.l} y={12}>dashed diagonal = every product selling equally</Ann>
  </svg>;
}

/** Ship modes: average days from order to shipment, bar length = days. */
export function ShipBars({ data }: { data: { key: string; days: number; orders: number; sales: number }[] }) {
  const rowH = 46, H = data.length * rowH + 10, max = Math.max(1, ...data.map(d => d.days));
  const x = scaleLinear().domain([0, max]).range([0, W - 330]);
  return <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Days to ship by mode">
    {data.map((d, i) => { const yy = 6 + i * rowH; return <g key={d.key}>
      <text x={0} y={yy + 20} style={{ fontSize: 13.5, fill: "#f3efe7", fontWeight: 700 }}>{d.key}</text>
      <text className="ann" x={0} y={yy + 36}>{d.orders.toLocaleString("en-US")} orders · {money(d.sales)}</text>
      <motion.rect x={170} y={yy + 8} height={18} rx={3} fill="#e7b46a" initial={{ width: 0 }} animate={{ width: Math.max(2, x(d.days)) }} transition={{ duration: 0.9, delay: i * 0.08, ease }} />
      <text className="val big" x={170 + x(d.days) + 10} y={yy + 23}>{d.days.toFixed(1)} days</text>
    </g>; })}
  </svg>;
}
