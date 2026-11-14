/** Everything the Analytical Journey shows, computed from the order lines under the active filters. */
import { select, aggregate, groupBy, monthly, seasonality, discountBands, kpis, type Dataset, type Filters } from "./engine";

export function journey(ds: Dataset, f: Filters) {
  const idx = select(ds, f);
  const k = kpis(ds, f);
  const all = aggregate(ds, idx);

  // 1 · growth by year (other filters kept, every year shown)
  const years = ds.years.map(y => { const a = aggregate(ds, select(ds, { ...f, year: y })); return { year: y, sales: a.sales, profit: a.profit, orders: a.orders, margin: a.sales ? a.profit / a.sales : 0 }; });
  const ys = years.filter(y => y.sales > 0), first = ys[0], last = ys[ys.length - 1];
  const growth = first && last && first !== last ? { from: first.year, to: last.year, sales: last.sales / first.sales - 1, profit: first.profit ? last.profit / first.profit - 1 : null } : null;

  // 2 · months and seasons
  const months = monthly(ds, idx);
  const bestMonth = months.reduce((b, m) => (m.sales > (b?.sales ?? -1) ? m : b), months[0]);
  const season = seasonality(ds, idx);
  const seasonTotal = season.reduce((a, m) => a + m.sales, 0) || 1;
  const q4Share = (season[9].sales + season[10].sales + season[11].sales) / seasonTotal;
  const peak = season.reduce((b, m) => (m.sales > b.sales ? m : b), season[0]), low = season.reduce((b, m) => (m.sales < b.sales ? m : b), season[0]);

  // 3 · departments and sub-categories
  const cats = groupBy(ds, idx, "category");
  const subs = groupBy(ds, idx, "subCategory");
  const losers = subs.filter(s => s.profit < 0).sort((a, b) => a.profit - b.profit);
  const bestMargin = [...subs].filter(s => s.sales > 0).sort((a, b) => b.margin - a.margin)[0];

  // 4 · discounts
  const bands = discountBands(ds, idx);
  const deep = bands.filter(b => b.discount > 0.2), deepSales = deep.reduce((a, b) => a + b.sales, 0), deepProfit = deep.reduce((a, b) => a + b.profit, 0);
  const none = bands.find(b => b.discount === 0);
  const deepLines = deep.reduce((a, b) => a + b.lines, 0);

  // 5 · geography
  const regions = groupBy(ds, idx, "region");
  const states = groupBy(ds, idx, "state");
  const topStates = states.slice(0, 8);
  const worstStates = [...states].sort((a, b) => a.profit - b.profit).slice(0, 5);
  const matrix = regions.map(r => {
    const rl = Array.from(idx).filter(i => ds.dims.region[i] === r.code);
    return { region: r.key, cells: groupBy(ds, rl, "category").map(c => ({ category: c.key, sales: c.sales, margin: c.margin })) };
  });

  // 6 · customers
  const segs = groupBy(ds, idx, "segment");
  const custSales = new Map<number, number>(); const custOrders = new Map<number, Set<number>>();
  for (let n = 0; n < idx.length; n++) { const i = idx[n], c = ds.customerId[i]; custSales.set(c, (custSales.get(c) ?? 0) + ds.sales[i]); let o = custOrders.get(c); if (!o) custOrders.set(c, (o = new Set())); o.add(ds.orderId[i]); }
  const customers = custSales.size;
  const sortedCust = [...custSales.values()].sort((a, b) => b - a);
  const top10Share = all.sales ? sortedCust.slice(0, 10).reduce((a, v) => a + v, 0) / all.sales : 0;
  const repeat = customers ? [...custOrders.values()].filter(s => s.size > 1).length / customers : 0;
  const ordersPerCustomer = customers ? all.orders / customers : 0;

  // 7 · shipping
  const ship = groupBy(ds, idx, "shipMode").map(g => {
    let days = 0, n = 0; for (let j = 0; j < idx.length; j++) { const i = idx[j]; if (ds.dims.shipMode[i] === g.code) { days += ds.shipDay[i] - ds.orderDay[i]; n++; } }
    return { ...g, days: n ? days / n : 0 };
  }).sort((a, b) => a.days - b.days);
  let dsum = 0; for (let j = 0; j < idx.length; j++) dsum += ds.shipDay[idx[j]] - ds.orderDay[idx[j]];
  const avgShipDays = idx.length ? dsum / idx.length : 0;

  // 8 · products: how concentrated are sales?
  const prods = groupBy(ds, idx, "productName");
  const pTotal = prods.reduce((a, p) => a + Math.max(0, p.sales), 0) || 1;
  let cum = 0; const pareto: { x: number; y: number }[] = [{ x: 0, y: 0 }]; let p80 = 0;
  prods.forEach((p, i) => { cum += Math.max(0, p.sales); const y = cum / pTotal, x = (i + 1) / prods.length; if (!p80 && y >= 0.8) p80 = x; if (i % Math.max(1, Math.floor(prods.length / 120)) === 0 || i === prods.length - 1) pareto.push({ x, y }); });
  const top20Share = (() => { const n = Math.max(1, Math.round(prods.length * 0.2)); return prods.slice(0, n).reduce((a, p) => a + Math.max(0, p.sales), 0) / pTotal; })();

  return { k, all, years, growth, months, bestMonth, season, q4Share, peak, low, cats, subs, losers, bestMargin, bands, deepSales, deepProfit, deepLines, none,
    regions, topStates, worstStates, matrix, segs, customers, top10Share, repeat, ordersPerCustomer, ship, avgShipDays, prods, pareto, p80, top20Share };
}
export type Journey = ReturnType<typeof journey>;
