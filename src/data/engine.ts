/**
 * Superstore data engine.
 *
 * Every number in the experience is computed here from the order lines in public/data/superstore.json
 * (built from the official "Sample - Superstore.xlsx" by scripts/build-data.mjs). Nothing is hard-coded.
 *
 * Definitions (see docs/DATA.md):
 *  - Order line  = one row of the Orders sheet (a product on an order).
 *  - Orders      = COUNT(DISTINCT Order ID) over the filtered lines.
 *  - Sales, Profit, Quantity = SUM over the filtered lines. Profit can be negative.
 *  - Profit margin = SUM(Profit) / SUM(Sales)  (not an average of line margins).
 *  - Average discount = mean of the line-level Discount field, as Tableau's AVG([Discount]).
 *    A sales-weighted alternative is reported as `weightedDiscount` (discount on list price).
 *  - Average order value (AOV) = SUM(Sales) / Orders.
 *  - Year-over-year growth = Sales in the latest year in scope ÷ Sales in the year before, − 1,
 *    with every other filter applied to both years.
 */

export interface RawDataset {
  source: string; sheet: string; rows: number; epoch: string;
  dict: Record<string, string[]>;
  cols: {
    orderId: number[]; orderDate: number[]; shipDate: number[]; shipMode: number[]; customerId: number[]; customerName: number[];
    segment: number[]; country: number[]; city: number[]; state: number[]; region: number[]; productId: number[];
    category: number[]; subCategory: number[]; productName: number[];
    sales: number[]; quantity: number[]; discount: number[]; profit: number[];
  };
}

export type Dim = "shipMode" | "segment" | "country" | "city" | "state" | "region" | "category" | "subCategory" | "productName" | "customerId";

export interface Dataset {
  n: number; source: string;
  dict: Record<string, string[]>;
  orderId: Uint32Array; customerId: Uint32Array;
  orderDay: Int32Array; shipDay: Int32Array;
  year: Uint16Array; month: Uint8Array;           // calendar year, month 0–11 of the order date
  dims: Record<Dim, Uint16Array>;
  sales: Float64Array; profit: Float64Array; quantity: Uint16Array; discount: Float32Array;
  years: number[];
  nOrders: number;
}

export interface Filters { year: number | null; region: string | null; category: string | null; segment: string | null; shipMode: string | null; }
export const NO_FILTERS: Filters = { year: null, region: null, category: null, segment: null, shipMode: null };

export interface Agg { sales: number; profit: number; quantity: number; lines: number; orders: number; discountSum: number; listSales: number; listDiscount: number; }
export interface Kpis extends Agg { margin: number; avgDiscount: number; weightedDiscount: number; aov: number; yoy: number | null; yoyYears: [number, number] | null; }

export function buildDataset(raw: RawDataset): Dataset {
  const c = raw.cols, n = raw.rows;
  const epoch = Date.parse(raw.epoch + "T00:00:00Z");
  const orderDay = Int32Array.from(c.orderDate), shipDay = Int32Array.from(c.shipDate);
  const year = new Uint16Array(n), month = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const d = new Date(epoch + orderDay[i] * 864e5); year[i] = d.getUTCFullYear(); month[i] = d.getUTCMonth(); }
  const u16 = (a: number[]) => Uint16Array.from(a);
  const dims = { shipMode: u16(c.shipMode), segment: u16(c.segment), country: u16(c.country), city: u16(c.city), state: u16(c.state), region: u16(c.region),
    category: u16(c.category), subCategory: u16(c.subCategory), productName: u16(c.productName), customerId: u16(c.customerId) } as Record<Dim, Uint16Array>;
  const years = [...new Set(year)].sort((a, b) => a - b);
  return { n, source: raw.source, dict: raw.dict, orderId: Uint32Array.from(c.orderId), customerId: Uint32Array.from(c.customerId), orderDay, shipDay, year, month, dims,
    sales: Float64Array.from(c.sales), profit: Float64Array.from(c.profit), quantity: Uint16Array.from(c.quantity), discount: Float32Array.from(c.discount),
    years, nOrders: raw.dict.orderId.length };
}

export const code = (ds: Dataset, dim: Dim, value: string) => ds.dict[dim].indexOf(value);
export const label = (ds: Dataset, dim: Dim, c: number) => ds.dict[dim][c];

/** Indices of the lines that pass the filters. `except` drops one filter (e.g. for YoY across years). */
export function select(ds: Dataset, f: Filters, except: (keyof Filters)[] = []): Uint32Array {
  const use = (k: keyof Filters) => f[k] != null && !except.includes(k);
  const tests: ((i: number) => boolean)[] = [];
  if (use("year")) { const y = f.year!; tests.push(i => ds.year[i] === y); }
  for (const [k, dim] of [["region", "region"], ["category", "category"], ["segment", "segment"], ["shipMode", "shipMode"]] as const) {
    if (use(k)) { const cv = code(ds, dim, f[k] as string), arr = ds.dims[dim]; tests.push(i => arr[i] === cv); }
  }
  const out = new Uint32Array(ds.n); let m = 0;
  outer: for (let i = 0; i < ds.n; i++) { for (const t of tests) if (!t(i)) continue outer; out[m++] = i; }
  return out.subarray(0, m);
}

const emptyAgg = (): Agg => ({ sales: 0, profit: 0, quantity: 0, lines: 0, orders: 0, discountSum: 0, listSales: 0, listDiscount: 0 });
let stampArr: Int32Array | null = null, stampN = 0;
function stamps(ds: Dataset) { if (!stampArr || stampArr.length !== ds.nOrders) stampArr = new Int32Array(ds.nOrders); return stampArr; }

export function aggregate(ds: Dataset, idx: ArrayLike<number>): Agg {
  const a = emptyAgg(), st = stamps(ds), s = ++stampN;
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k]; a.sales += ds.sales[i]; a.profit += ds.profit[i]; a.quantity += ds.quantity[i]; a.lines++; a.discountSum += ds.discount[i];
    const d = ds.discount[i]; if (d < 1) { const list = ds.sales[i] / (1 - d); a.listSales += list; a.listDiscount += list * d; }
    const o = ds.orderId[i]; if (st[o] !== s) { st[o] = s; a.orders++; }
  }
  return a;
}

export interface Group extends Agg { key: string; code: number; margin: number; avgDiscount: number; }
/** Group the selected lines by a dimension; distinct orders are counted per group. */
export function groupBy(ds: Dataset, idx: ArrayLike<number>, dim: Dim): Group[] {
  const arr = ds.dims[dim], m = new Map<number, Agg & { seen: Set<number> }>();
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k], c = arr[i]; let g = m.get(c); if (!g) { g = { ...emptyAgg(), seen: new Set() }; m.set(c, g); }
    g.sales += ds.sales[i]; g.profit += ds.profit[i]; g.quantity += ds.quantity[i]; g.lines++; g.discountSum += ds.discount[i];
    const d = ds.discount[i]; if (d < 1) { const list = ds.sales[i] / (1 - d); g.listSales += list; g.listDiscount += list * d; }
    g.seen.add(ds.orderId[i]);
  }
  return [...m.entries()].map(([c, g]) => ({ key: ds.dict[dim][c], code: c, sales: g.sales, profit: g.profit, quantity: g.quantity, lines: g.lines,
    orders: g.seen.size, discountSum: g.discountSum, listSales: g.listSales, listDiscount: g.listDiscount,
    margin: g.sales ? g.profit / g.sales : 0, avgDiscount: g.lines ? g.discountSum / g.lines : 0 })).sort((a, b) => b.sales - a.sales);
}

export function kpis(ds: Dataset, f: Filters): Kpis {
  const idx = select(ds, f), a = aggregate(ds, idx);
  // YoY: compare the latest year in scope with the year before, all other filters kept
  const yr = f.year ?? ds.years[ds.years.length - 1], prev = yr - 1;
  let yoy: number | null = null, yoyYears: [number, number] | null = null;
  if (ds.years.includes(prev)) {
    const cur = aggregate(ds, select(ds, { ...f, year: yr })).sales, before = aggregate(ds, select(ds, { ...f, year: prev })).sales;
    if (before > 0) { yoy = cur / before - 1; yoyYears = [prev, yr]; }
  }
  return { ...a, margin: a.sales ? a.profit / a.sales : 0, avgDiscount: a.lines ? a.discountSum / a.lines : 0,
    weightedDiscount: a.listSales ? a.listDiscount / a.listSales : 0, aov: a.orders ? a.sales / a.orders : 0, yoy, yoyYears };
}

/** Monthly series over the selected lines: one point per (year, month) present in scope. */
export function monthly(ds: Dataset, idx: ArrayLike<number>) {
  const m = new Map<number, { sales: number; profit: number }>();
  for (let k = 0; k < idx.length; k++) { const i = idx[k], key = ds.year[i] * 12 + ds.month[i]; const g = m.get(key) ?? { sales: 0, profit: 0 }; g.sales += ds.sales[i]; g.profit += ds.profit[i]; m.set(key, g); }
  const keys = [...m.keys()].sort((a, b) => a - b); if (!keys.length) return [];
  const out = []; for (let key = keys[0]; key <= keys[keys.length - 1]; key++) { const g = m.get(key) ?? { sales: 0, profit: 0 }; out.push({ year: Math.floor(key / 12), month: key % 12, ...g }); }
  return out;
}

/** Seasonality: sales by calendar month summed across the years in scope. */
export function seasonality(ds: Dataset, idx: ArrayLike<number>) {
  const s = new Float64Array(12), p = new Float64Array(12);
  for (let k = 0; k < idx.length; k++) { const i = idx[k]; s[ds.month[i]] += ds.sales[i]; p[ds.month[i]] += ds.profit[i]; }
  return Array.from(s, (v, m) => ({ month: m, sales: v, profit: p[m] }));
}

/** Discount bands: how profit responds to the discount given on a line. */
export function discountBands(ds: Dataset, idx: ArrayLike<number>) {
  const m = new Map<number, Agg>();
  for (let k = 0; k < idx.length; k++) { const i = idx[k], d = Math.round(ds.discount[i] * 100) / 100; const g = m.get(d) ?? emptyAgg(); g.sales += ds.sales[i]; g.profit += ds.profit[i]; g.lines++; g.quantity += ds.quantity[i]; m.set(d, g); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([d, g]) => ({ discount: d, sales: g.sales, profit: g.profit, lines: g.lines, margin: g.sales ? g.profit / g.sales : 0 }));
}


export async function loadDataset(url = `${import.meta.env.BASE_URL}data/superstore.json`): Promise<Dataset> {
  const r = await fetch(url); if (!r.ok) throw new Error(`Could not load the dataset (${r.status}).`);
  const raw = (await r.json()) as RawDataset;
  for (const k of ["orderId", "orderDate", "sales", "profit", "discount", "quantity", "category", "subCategory", "region", "segment", "shipMode", "productName", "state", "city", "country"] as const)
    if (!raw.cols[k] || raw.cols[k].length !== raw.rows) throw new Error(`Dataset column "${k}" is missing or has the wrong length.`);
  return buildDataset(raw);
}
