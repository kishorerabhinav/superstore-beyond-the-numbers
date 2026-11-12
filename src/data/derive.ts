/** Higher-level views over the engine. Each takes the dataset and the active filters, so every view follows the filters. */
import { select, aggregate, groupBy, monthly, seasonality, discountBands, type Dataset, type Filters, type Group } from "./engine";
import type { Department } from "../scene/layout";

export function deptLines(ds: Dataset, f: Filters, d: Department): Uint32Array {
  if (f.category && f.category !== d.filter.category) return new Uint32Array(0);
  const idx = select(ds, { ...f, category: d.filter.category });
  const sub = ds.dims.subCategory, dict = ds.dict.subCategory;
  const inc = d.filter.subCategories?.map(s => dict.indexOf(s)), exc = d.filter.excludeSub?.map(s => dict.indexOf(s));
  if (!inc && !exc) return idx;
  const out: number[] = [];
  for (let k = 0; k < idx.length; k++) { const c = sub[idx[k]]; if (inc && !inc.includes(c)) continue; if (exc && exc.includes(c)) continue; out.push(idx[k]); }
  return Uint32Array.from(out);
}

export interface DeptView {
  agg: ReturnType<typeof aggregate>; margin: number; avgDiscount: number; aov: number; share: number;
  subs: Group[]; topProducts: Group[]; lossProducts: Group[]; months: ReturnType<typeof monthly>; bands: ReturnType<typeof discountBands>;
}
export function deptView(ds: Dataset, f: Filters, d: Department, totalSales: number): DeptView {
  const idx = deptLines(ds, f, d), agg = aggregate(ds, idx);
  const prods = groupBy(ds, idx, "productName");
  return { agg, margin: agg.sales ? agg.profit / agg.sales : 0, avgDiscount: agg.lines ? agg.discountSum / agg.lines : 0, aov: agg.orders ? agg.sales / agg.orders : 0,
    share: totalSales ? agg.sales / totalSales : 0, subs: groupBy(ds, idx, "subCategory"), topProducts: prods.slice(0, 5),
    lossProducts: [...prods].sort((a, b) => a.profit - b.profit).filter(p => p.profit < 0).slice(0, 3), months: monthly(ds, idx), bands: discountBands(ds, idx) };
}

/** Per sub-category numbers that drive the shelves (stock shown, rail light). */
export function subCategoryStats(ds: Dataset, f: Filters) {
  const m = new Map<string, Group>();
  for (const g of groupBy(ds, select(ds, f), "subCategory")) m.set(g.key, g);
  return m;
}

export function salesStory(ds: Dataset, f: Filters) {
  const idx = select(ds, f);
  return { months: monthly(ds, idx), season: seasonality(ds, idx), categories: groupBy(ds, idx, "category"), subs: groupBy(ds, idx, "subCategory"), top: groupBy(ds, idx, "productName").slice(0, 8) };
}

export function profitStory(ds: Dataset, f: Filters) {
  const idx = select(ds, f);
  const subs = groupBy(ds, idx, "subCategory");
  const prods = groupBy(ds, idx, "productName");
  return { categories: groupBy(ds, idx, "category"), subs, negative: subs.filter(s => s.profit < 0).sort((a, b) => a.profit - b.profit),
    worstProducts: [...prods].sort((a, b) => a.profit - b.profit).slice(0, 6), bands: discountBands(ds, idx) };
}

export function segmentStory(ds: Dataset, f: Filters) {
  const idx = select(ds, f);
  const segs = groupBy(ds, idx, "segment").map(g => {
    const lines = Array.from(idx).filter(i => ds.dims.segment[i] === g.code);
    const customers = new Set(lines.map(i => ds.customerId[i])).size;
    return { ...g, customers, aov: g.orders ? g.sales / g.orders : 0, ordersPerCustomer: customers ? g.orders / customers : 0,
      cats: groupBy(ds, lines, "category"), ship: groupBy(ds, lines, "shipMode"), months: monthly(ds, lines) };
  });
  return { segs, total: aggregate(ds, idx) };
}

export function geoStory(ds: Dataset, f: Filters) {
  // the map always shows every region; the selected region is highlighted rather than filtered away
  const idx = select(ds, f, ["region"]);
  const us = ds.dict.country.indexOf("United States");
  const usIdx: number[] = [], caIdx: number[] = [];
  for (let k = 0; k < idx.length; k++) (ds.dims.country[idx[k]] === us ? usIdx : caIdx).push(idx[k]);
  const regionOf = new Map<string, string>();
  for (const i of usIdx) regionOf.set(ds.dict.state[ds.dims.state[i]], ds.dict.region[ds.dims.region[i]]);
  return { states: groupBy(ds, usIdx, "state"), regions: groupBy(ds, idx, "region"), cities: groupBy(ds, f.region ? usIdx.filter(i => ds.dict.region[ds.dims.region[i]] === f.region) : usIdx, "city").slice(0, 10),
    canada: aggregate(ds, caIdx), regionOf };
}

export function productList(ds: Dataset, f: Filters) { return groupBy(ds, select(ds, f), "productName"); }

export function productDetail(ds: Dataset, f: Filters, name: string) {
  const code = ds.dict.productName.indexOf(name), all = select(ds, f);
  const lines: number[] = []; for (let k = 0; k < all.length; k++) if (ds.dims.productName[all[k]] === code) lines.push(all[k]);
  const agg = aggregate(ds, lines);
  const disc = new Map<number, number>(); for (const i of lines) { const d = Math.round(ds.discount[i] * 100); disc.set(d, (disc.get(d) ?? 0) + 1); }
  const first = lines[0];
  return { name, agg, margin: agg.sales ? agg.profit / agg.sales : 0,
    category: first != null ? ds.dict.category[ds.dims.category[first]] : "", sub: first != null ? ds.dict.subCategory[ds.dims.subCategory[first]] : "",
    segments: groupBy(ds, lines, "segment"), regions: groupBy(ds, lines, "region"), months: monthly(ds, lines), discounts: [...disc.entries()].sort((a, b) => a[0] - b[0]) };
}
