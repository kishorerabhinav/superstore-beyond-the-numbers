import { scaleLinear, scaleBand } from "d3-scale";
import { area, line, curveMonotoneX } from "d3-shape";
import { motion } from "framer-motion";
import { MONTHS, money, pct } from "../data/format";

const W = 352;

/** Monthly sales (area + line) with profit as a thin second line; draws itself on mount / filter change. */
export function MonthlyChart({ data, height = 120, showProfit = true }: { data: { year: number; month: number; sales: number; profit: number }[]; height?: number; showProfit?: boolean }) {
  if (!data.length) return <Empty h={height} />;
  const m = { l: 4, r: 4, t: 26, b: 18 };
  const x = scaleLinear().domain([0, data.length - 1]).range([m.l, W - m.r]);
  const max = Math.max(...data.map(d => d.sales)), min = Math.min(0, ...data.map(d => d.profit));
  const y = scaleLinear().domain([min, max]).range([height - m.b, m.t]).nice();
  const a = area<typeof data[number]>().x((_, i) => x(i)).y0(y(0)).y1(d => y(d.sales)).curve(curveMonotoneX)(data)!;
  const l = line<typeof data[number]>().x((_, i) => x(i)).y(d => y(d.sales)).curve(curveMonotoneX)(data)!;
  const p = line<typeof data[number]>().x((_, i) => x(i)).y(d => y(d.profit)).curve(curveMonotoneX)(data)!;
  const peak = data.reduce((b, d, i) => (d.sales > data[b].sales ? i : b), 0);
  const yearStarts = data.map((d, i) => (d.month === 0 || i === 0 ? i : -1)).filter(i => i >= 0);
  const key = data.map(d => Math.round(d.sales)).join(",");
  return <svg className="chart" viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Monthly sales and profit">
    <defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e7b46a" stopOpacity=".38" /><stop offset="1" stopColor="#e7b46a" stopOpacity="0" /></linearGradient></defs>
    {yearStarts.map(i => <g key={i}><line x1={x(i)} x2={x(i)} y1={m.t - 4} y2={height - m.b} stroke="rgba(243,239,231,.14)" strokeDasharray="1 3" />
      <text x={x(i) + 3} y={height - 5}>{data[i].year}</text></g>)}
    <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke="rgba(243,239,231,.3)" strokeWidth={0.6} />
    <motion.path key={`a${key}`} d={a} fill="url(#mg)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, delay: 0.4 }} />
    <motion.path key={`l${key}`} d={l} fill="none" stroke="#e7b46a" strokeWidth={1.4} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: [0.2, 0.7, 0.1, 1] }} />
    {showProfit ? <motion.path key={`p${key}`} d={p} fill="none" stroke="#8fd3a8" strokeWidth={1} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, delay: 0.3 }} /> : null}
    <circle cx={x(peak)} cy={y(data[peak].sales)} r={2.6} fill="#f3efe7" />
    <text className="val" x={Math.min(W - 60, x(peak) + 5)} y={Math.max(24, y(data[peak].sales) - 4)}>{money(data[peak].sales)}</text>
    <text className="ann" x={m.l} y={10}>{showProfit ? "sales (amber) and profit (green) by month" : "sales by month"}</text>
  </svg>;
}

/** Horizontal bars: length = sales, label = margin (green / amber when negative). */
export function BarList({ data, max: maxIn, onPick, active }: { data: { key: string; sales: number; profit: number; margin: number }[]; max?: number; onPick?: (k: string) => void; active?: string | null }) {
  const max = maxIn ?? Math.max(1, ...data.map(d => d.sales));
  return <div className="rows">{data.map(d => (
    <div key={d.key} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) 92px 52px", cursor: onPick ? "pointer" : undefined, opacity: active && active !== d.key ? 0.45 : 1 }} onClick={() => onPick?.(d.key)}>
      <span className="n">{d.key}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ flex: 1, height: 3, background: "rgba(243,239,231,.08)", borderRadius: 2, overflow: "hidden" }}>
          <motion.span style={{ display: "block", height: "100%", background: d.profit < 0 ? "var(--loss)" : "var(--ink-2)" }} initial={{ width: 0 }} animate={{ width: `${(d.sales / max) * 100}%` }} transition={{ duration: 0.9, ease: [0.2, 0.7, 0.1, 1] }} />
        </span>
        <span className="a" style={{ fontSize: 11.5, minWidth: 40, textAlign: "right" }}>{money(d.sales, 0)}</span>
      </span>
      <span className={`b ${d.margin < 0 ? "neg" : "pos"}`}>{pct(d.margin, 1)}</span>
    </div>))}</div>;
}

/** Profit by discount level: bars up (profit) / down (loss); label = margin. */
export function DiscountChart({ data, height = 150 }: { data: { discount: number; sales: number; profit: number; margin: number }[]; height?: number }) {
  if (!data.length) return <Empty h={height} />;
  const m = { l: 4, r: 4, t: 18, b: 22 };
  const x = scaleBand<number>().domain(data.map(d => d.discount)).range([m.l, W - m.r]).padding(0.28);
  const ext = Math.max(...data.map(d => Math.abs(d.profit)));
  const y = scaleLinear().domain([Math.min(0, ...data.map(d => d.profit)), Math.max(0, ...data.map(d => d.profit))]).range([height - m.b, m.t]);
  return <svg className="chart" viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Profit by discount level">
    <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke="rgba(243,239,231,.35)" strokeWidth={0.6} />
    {data.map(d => { const h = Math.abs(y(d.profit) - y(0)); const top = d.profit >= 0 ? y(d.profit) : y(0);
      return <g key={d.discount}>
        <motion.rect x={x(d.discount)} width={x.bandwidth()} fill={d.profit < 0 ? "#f2a24a" : "#8fd3a8"} opacity={0.9} rx={1}
          initial={{ y: y(0), height: 0 }} animate={{ y: top, height: Math.max(1, h) }} transition={{ duration: 0.9, ease: [0.2, 0.7, 0.1, 1] }} />
        <text x={x(d.discount)! + x.bandwidth() / 2} y={height - 8} textAnchor="middle">{Math.round(d.discount * 100)}%</text>
        {Math.abs(d.profit) > ext * 0.12 ? <text className="val" x={x(d.discount)! + x.bandwidth() / 2} y={d.profit >= 0 ? top - 4 : top + h + 11} textAnchor="middle">{pct(d.margin, 0)}</text> : null}
      </g>; })}
    <text className="ann" x={m.l} y={11}>profit by discount level; label = margin</text>
  </svg>;
}

/** Sales by calendar month across the years in scope (seasonality). */
export function SeasonChart({ data, height = 110 }: { data: { month: number; sales: number }[]; height?: number }) {
  const m = { l: 4, r: 4, t: 16, b: 18 };
  const x = scaleBand<number>().domain(data.map(d => d.month)).range([m.l, W - m.r]).padding(0.22);
  const max = Math.max(1, ...data.map(d => d.sales)); const y = scaleLinear().domain([0, max]).range([height - m.b, m.t]);
  const top = data.reduce((b, d) => (d.sales > b.sales ? d : b), data[0]);
  return <svg className="chart" viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Sales by calendar month">
    {data.map(d => <g key={d.month}>
      <motion.rect x={x(d.month)} width={x.bandwidth()} rx={1} fill={d === top ? "#e7b46a" : "rgba(243,239,231,.38)"} initial={{ y: height - m.b, height: 0 }} animate={{ y: y(d.sales), height: height - m.b - y(d.sales) }} transition={{ duration: 0.8, delay: d.month * 0.03 }} />
      <text x={x(d.month)! + x.bandwidth() / 2} y={height - 5} textAnchor="middle">{MONTHS[d.month][0]}</text></g>)}
    <text className="ann" x={m.l} y={10}>sales by calendar month · peak in {MONTHS[top.month]}</text>
  </svg>;
}

/** Discount histogram for one product (count of order lines per discount level). */
export function Histogram({ data, height = 90 }: { data: [number, number][]; height?: number }) {
  if (!data.length) return <Empty h={height} />;
  const m = { l: 4, r: 4, t: 30, b: 18 };
  const x = scaleBand<number>().domain(data.map(d => d[0])).range([m.l, W - m.r]).padding(0.3);
  const max = Math.max(...data.map(d => d[1])); const y = scaleLinear().domain([0, max]).range([height - m.b, m.t]);
  return <svg className="chart" viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Discount distribution">
    {data.map(([d, n]) => <g key={d}><rect x={x(d)} width={x.bandwidth()} y={y(n)} height={height - m.b - y(n)} rx={1} fill={d > 20 ? "#f2a24a" : "rgba(243,239,231,.55)"} />
      <text x={x(d)! + x.bandwidth() / 2} y={height - 5} textAnchor="middle">{d}%</text><text className="val" x={x(d)! + x.bandwidth() / 2} y={y(n) - 3} textAnchor="middle">{n}</text></g>)}
    <text className="ann" x={m.l} y={10}>order lines by discount given</text>
  </svg>;
}

function Empty({ h }: { h: number }) { return <svg className="chart" viewBox={`0 0 ${W} ${h}`} width="100%"><text className="ann" x={4} y={h / 2}>No order lines for the current filters.</text></svg>; }
