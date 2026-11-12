// Reads the official Tableau "Sample - Superstore.xlsx" (Orders sheet), validates it, and writes
// public/data/superstore.json: a columnar, dictionary-encoded copy of every order line (no aggregation),
// plus data/orders.csv for the independent SQL validation in scripts/validate.py.
import XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const SRC = process.argv[2] || "C:/Users/Lenovo/Documents/My Tableau Repository/Datasources/2026.3/en_US-US/Sample - Superstore.xlsx";
const wb = XLSX.readFile(SRC, { cellDates: true });
const sheet = wb.Sheets["Orders"];
if (!sheet) throw new Error("Orders sheet not found. Sheets: " + wb.SheetNames.join(", "));
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

const REQUIRED = ["Row ID","Order ID","Order Date","Ship Date","Ship Mode","Customer ID","Customer Name","Segment","Country/Region","City","State/Province","Region","Product ID","Category","Sub-Category","Product Name","Sales","Quantity","Discount","Profit"];
const cols = Object.keys(rows[0]);
const missing = REQUIRED.filter(c => !cols.includes(c));
if (missing.length) throw new Error("Missing columns: " + missing.join(", "));

const iso = v => {
  if (v instanceof Date) { const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000); return d.toISOString().slice(0, 10); }
  if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v); return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`; }
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  throw new Error("Unparseable date: " + v);
};
const issues = [];
const dict = {}; const enc = (k, v) => { const d = dict[k] ||= { list: [], map: new Map() }; let i = d.map.get(v); if (i === undefined) { i = d.list.length; d.list.push(v); d.map.set(v, i); } return i; };
const C = { orderId:[], orderDate:[], shipDate:[], shipMode:[], customerId:[], customerName:[], segment:[], country:[], city:[], state:[], region:[], productId:[], category:[], subCategory:[], productName:[], sales:[], quantity:[], discount:[], profit:[] };
const csv = [["row_id","order_id","order_date","ship_date","ship_mode","customer_id","segment","country","city","state","region","product_id","category","sub_category","product_name","sales","quantity","discount","profit"].join(",")];
const q = s => `"${String(s).replace(/"/g,'""')}"`;
for (const r of rows) {
  const od = iso(r["Order Date"]), sd = iso(r["Ship Date"]);
  if (sd < od) issues.push(`Row ${r["Row ID"]}: ship date before order date`);
  for (const k of ["Sales","Quantity","Discount","Profit"]) if (typeof r[k] !== "number" || !isFinite(r[k])) issues.push(`Row ${r["Row ID"]}: ${k} not numeric`);
  if (r.Discount < 0 || r.Discount > 1) issues.push(`Row ${r["Row ID"]}: discount out of range`);
  C.orderId.push(enc("orderId", r["Order ID"])); C.orderDate.push(od); C.shipDate.push(sd);
  C.shipMode.push(enc("shipMode", r["Ship Mode"])); C.customerId.push(enc("customerId", r["Customer ID"])); C.customerName.push(enc("customerName", r["Customer Name"]));
  C.segment.push(enc("segment", r.Segment)); C.country.push(enc("country", r["Country/Region"])); C.city.push(enc("city", r.City)); C.state.push(enc("state", r["State/Province"])); C.region.push(enc("region", r.Region));
  C.productId.push(enc("productId", r["Product ID"])); C.category.push(enc("category", r.Category)); C.subCategory.push(enc("subCategory", r["Sub-Category"])); C.productName.push(enc("productName", r["Product Name"]));
  C.sales.push(Math.round(r.Sales * 10000) / 10000); C.quantity.push(r.Quantity); C.discount.push(r.Discount); C.profit.push(Math.round(r.Profit * 10000) / 10000);
  csv.push([r["Row ID"], q(r["Order ID"]), od, sd, q(r["Ship Mode"]), q(r["Customer ID"]), q(r.Segment), q(r["Country/Region"]), q(r.City), q(r["State/Province"]), q(r.Region), q(r["Product ID"]), q(r.Category), q(r["Sub-Category"]), q(r["Product Name"]), r.Sales, r.Quantity, r.Discount, r.Profit].join(","));
}
// dates: store as day offsets from the first date to keep the file small
const epoch = [...C.orderDate].sort()[0]; const day = s => Math.round((Date.parse(s) - Date.parse(epoch)) / 864e5);
const out = { source: path.basename(SRC), sheet: "Orders", rows: rows.length, epoch,
  dict: Object.fromEntries(Object.entries(dict).map(([k, v]) => [k, v.list])),
  cols: { ...C, orderDate: C.orderDate.map(day), shipDate: C.shipDate.map(day) } };
fs.writeFileSync("public/data/superstore.json", JSON.stringify(out));
fs.mkdirSync("data", { recursive: true }); fs.writeFileSync("data/orders.csv", csv.join("\n"));
console.log(JSON.stringify({ rows: rows.length, columns: cols.length, epoch, lastDate: [...C.orderDate].sort().at(-1), issues: issues.length, sample: issues.slice(0, 5),
  distinct: Object.fromEntries(Object.entries(dict).map(([k, v]) => [k, v.list.length])) }, null, 1));
