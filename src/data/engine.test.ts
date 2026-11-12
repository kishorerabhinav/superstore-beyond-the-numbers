// Compares the TypeScript engine with the independent SQLite reference (scripts/validate.py).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { buildDataset, kpis, select, aggregate, groupBy, NO_FILTERS, type RawDataset } from "./engine";

const raw = JSON.parse(fs.readFileSync("public/data/superstore.json", "utf8")) as RawDataset;
const ref = JSON.parse(fs.readFileSync("docs/validation-reference.json", "utf8"));
const ds = buildDataset(raw);
const close = (a: number, b: number, tol = 0.01) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe("Superstore engine vs SQL reference", () => {
  it("all-data KPIs", () => {
    const k = kpis(ds, NO_FILTERS), r = ref.all;
    expect(k.lines).toBe(r.lines); expect(k.orders).toBe(r.orders); expect(k.quantity).toBe(r.quantity);
    close(k.sales, r.sales); close(k.profit, r.profit); close(k.margin, r.margin, 1e-6); close(k.avgDiscount, r.avgDiscount, 1e-6);
    close(k.aov, r.aov, 1e-4); close(k.weightedDiscount, r.weightedDiscount, 1e-6); close(k.yoy!, ref.yoy2026, 1e-6);
  });
  it("by year, category, segment, region", () => {
    for (const [y, r] of Object.entries<any>(ref.byYear)) { const a = aggregate(ds, select(ds, { ...NO_FILTERS, year: +y })); close(a.sales, r.sales); close(a.profit, r.profit); expect(a.orders).toBe(r.orders); }
    const all = select(ds, NO_FILTERS);
    for (const g of groupBy(ds, all, "category")) { const r = ref.byCategory[g.key]; close(g.sales, r.sales); close(g.profit, r.profit); expect(g.orders).toBe(r.orders); close(g.avgDiscount, r.avgDiscount, 1e-6); }
    for (const g of groupBy(ds, all, "segment")) { const r = ref.bySegment[g.key]; close(g.sales, r.sales); close(g.profit, r.profit); expect(g.orders).toBe(r.orders); }
    for (const g of groupBy(ds, all, "region")) { const r = ref.byRegion[g.key]; close(g.sales, r.sales); close(g.profit, r.profit); }
  });
  it("combined filters", () => {
    const a = aggregate(ds, select(ds, { ...NO_FILTERS, year: 2025, region: "West", category: "Technology" })), r = ref.filtered_2025_West_Technology;
    close(a.sales, r.sales); close(a.profit, r.profit); expect(a.orders).toBe(r.orders); expect(a.lines).toBe(r.lines);
    const b = aggregate(ds, select(ds, { ...NO_FILTERS, segment: "Corporate", shipMode: "First Class" })), r2 = ref.filtered_Corporate_FirstClass;
    close(b.sales, r2.sales); close(b.profit, r2.profit); expect(b.orders).toBe(r2.orders);
  });
  it("loss-making sub-categories and top product", () => {
    const subs = groupBy(ds, select(ds, NO_FILTERS), "subCategory").filter(g => g.profit < 0).sort((a, b) => a.profit - b.profit).map(g => g.key);
    expect(subs).toEqual(ref.negativeSubCategories);
    const top = groupBy(ds, select(ds, NO_FILTERS), "productName")[0]; expect(top.key).toBe(ref.topProduct[0]); close(top.sales, ref.topProduct[1]);
  });
});
