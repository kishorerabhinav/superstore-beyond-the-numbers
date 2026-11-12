// Generates "Superstore Beyond the Numbers.twb/.twbx": a numbers-led Tableau dashboard on Sample - Superstore
// with the live 3D experience (GitHub Pages) embedded in a Web Page zone.
//   node build.js
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const L = require("./tiled_layout");
const HERE = __dirname, NAME = "Superstore Beyond the Numbers", OUT = path.join(HERE, NAME + ".twb");
const APP_URL = "https://kishorerabhinav.github.io/superstore-beyond-the-numbers/";
const DS = "federated.superstore", DSC = "Sample - Superstore";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;").replace(/"/g, "&quot;");
const q = s => `"${s}"`;
const guid = () => "{" + crypto.randomUUID().toUpperCase() + "}";
const F = n => `[${DS}].[${n}]`;

// ---------- tokens: charcoal, warm white, restrained amber / green (matches the 3D app) ----------
const C = { bg: "#141518", card: "#1c1d21", line: "#2c2e33", ink: "#f3efe7", sec: "#b9b3a8", muted: "#847f77", amber: "#e7b46a", green: "#8fd3a8", loss: "#f2a24a" };
const SERIF = "Georgia", SANS = "Trebuchet MS";

// ---------- source columns (same file as the app: every order line of Sample - Superstore 2026.3) ----------
const SRC = [
  ["Row ID", "integer"], ["Order ID", "string"], ["Order Date", "date"], ["Ship Date", "date"], ["Ship Mode", "string"],
  ["Customer ID", "string"], ["Customer Name", "string"], ["Segment", "string"], ["Country/Region", "string"], ["City", "string"],
  ["State/Province", "string"], ["Postal Code", "string"], ["Region", "string"], ["Product ID", "string"], ["Category", "string"],
  ["Sub-Category", "string"], ["Product Name", "string"], ["Sales", "real"], ["Quantity", "integer"], ["Discount", "real"],
  ["Profit", "real"], ["Returned", "string"], ["Regional Manager", "string"],
];
const RT = { string: 129, integer: 20, real: 5, date: 133 };
const RAW_MEASURES = new Set(["Sales", "Quantity", "Discount", "Profit", "Row ID"]);

// ---------- parameters (drive every sheet through one scope calc) ----------
const P = {}; let pn = 0; const params = [];
function strParam(key, caption, list, def) { const name = `[Parameter ${++pn}]`; P[key] = `[Parameters].${name}`; params.push(`<column caption='${esc(caption)}' datatype='string' name='${name}' param-domain-type='list' role='measure' type='nominal' value='${esc(q(def))}'><calculation class='tableau' formula='${esc(q(def))}' /><members>${list.map(m => `<member value='${esc(q(m))}' />`).join("")}</members></column>`); }
strParam("year", "Year", ["All", "2023", "2024", "2025", "2026"], "All");
strParam("region", "Region", ["All", "Central", "East", "South", "West"], "All");
strParam("category", "Category", ["All", "Furniture", "Office Supplies", "Technology"], "All");
strParam("segment", "Segment", ["All", "Consumer", "Corporate", "Home Office"], "All");

// ---------- calculations ----------
const calcs = [];
const add = (id, caption, formula, type, fmt) => calcs.push({ id, caption, formula, type, fmt });
const notYear = `(${P.region} = "All" OR [Region] = ${P.region})\nAND (${P.category} = "All" OR [Category] = ${P.category})\nAND (${P.segment} = "All" OR [Segment] = ${P.segment})`;
add("c_scope", "In scope", `(${P.year} = "All" OR STR(YEAR([Order Date])) = ${P.year})\nAND ${notYear}`, "bdim");
add("c_scopey", "In scope (all years)", notYear, "bdim");
const money = x => `IF ISNULL(${x}) THEN "—" ELSE (IF ${x} < 0 THEN "−" ELSE "" END) + "$" + (IF ABS(${x}) >= 1000000 THEN STR(ROUND(ABS(${x}) / 1000000, 2)) + "M" ELSEIF ABS(${x}) >= 10000 THEN STR(ROUND(ABS(${x}) / 1000, 0)) + "K" ELSEIF ABS(${x}) >= 1000 THEN STR(ROUND(ABS(${x}) / 1000, 1)) + "K" ELSE STR(ROUND(ABS(${x}), 0)) END) END`;
const pctS = x => `IF ISNULL(${x}) THEN "—" ELSE (IF ${x} < 0 THEN "−" ELSE "" END) + STR(ROUND(ABS(${x}) * 100, 1)) + "%" END`;
// KPI measures
add("m_sales", "Sales", "SUM([Sales])", "meas", 'c"$"#,##0;-"$"#,##0');
add("m_profit", "Profit", "SUM([Profit])", "meas", 'c"$"#,##0;-"$"#,##0');
add("m_margin", "Profit Margin", "SUM([Profit]) / SUM([Sales])", "meas", "p0.0%");
add("m_orders", "Orders", "COUNTD([Order ID])", "meas", "n#,##0");
add("m_aov", "Avg Order Value", "SUM([Sales]) / COUNTD([Order ID])", "meas", 'c"$"#,##0;-"$"#,##0');
add("m_disc", "Avg Discount", "AVG([Discount])", "meas", "p0.0%");
add("m_qty", "Quantity", "SUM([Quantity])", "meas", "n#,##0");
// YoY: latest year in scope vs the year before, other filters applied to both
add("c_ty", "YoY target year", `IF ${P.year} = "All" THEN {FIXED : MAX(YEAR([Order Date]))} ELSE INT(${P.year}) END`, "rmeas", "n0");
add("m_yoy", "Sales YoY", `SUM(IF YEAR([Order Date]) = [c_ty] THEN [Sales] END) / SUM(IF YEAR([Order Date]) = [c_ty] - 1 THEN [Sales] END) - 1`, "meas", "p0.0%");
// display strings for the big numbers
add("s_sales", "Sales (display)", money("[m_sales]"), "smeas");
add("s_profit", "Profit (display)", money("[m_profit]"), "smeas");
add("s_margin", "Margin (display)", pctS("[m_margin]"), "smeas");
add("s_aov", "AOV (display)", money("[m_aov]"), "smeas");
add("s_disc", "Avg discount (display)", pctS("[m_disc]"), "smeas");
add("s_yoy", "YoY (display)", `IF ISNULL([m_yoy]) THEN "—" ELSE (IF [m_yoy] >= 0 THEN "+" ELSE "−" END) + STR(ROUND(ABS([m_yoy]) * 100, 1)) + "%" END`, "smeas");
add("s_yoyctx", "YoY context", `IF ISNULL([m_yoy]) THEN "no earlier year in the data" ELSE "sales, " + STR(MAX([c_ty])) + " vs " + STR(MAX([c_ty]) - 1) END`, "smeas");
add("s_scope", "Scope label", `(IF ${P.year} = "All" THEN "2023–2026" ELSE ${P.year} END) + (IF ${P.region} = "All" THEN "" ELSE " · " + ${P.region} END) + (IF ${P.category} = "All" THEN "" ELSE " · " + ${P.category} END) + (IF ${P.segment} = "All" THEN "" ELSE " · " + ${P.segment} END)`, "smeas");
// chart helpers
add("c_pl", "Profit or loss", `IF SUM([Profit]) >= 0 THEN "Profit" ELSE "Loss" END`, "smeas");
add("s_barlab", "Bar label", `${money("[m_sales]")} + "   " + ${pctS("[m_margin]")} + " margin"`, "smeas");
add("s_pllab", "Profit label", `${money("[m_profit]")} + "  ·  " + ${pctS("[m_margin]")}`, "smeas");

const cname = id => `Calculation_${id}`;
const fix = f => f.replace(/\[((?:c|m|s)_[a-z0-9]+)\]/g, (_, id) => `[${cname(id)}]`);

// ---------- datasource ----------
const colDefs = SRC.map(([n, t]) => {
  if (n === "Order Date" || n === "Ship Date") return `<column datatype='date' name='[${n}]' role='dimension' type='ordinal' />`;
  if (RAW_MEASURES.has(n)) return `<column caption='${esc(n)} (line)' datatype='${t}' name='[${n}]' role='measure' type='quantitative' />`;
  return `<column datatype='string' name='[${esc(n)}]' role='dimension' type='nominal' />`;
}).join("\n");
const calcDefs = calcs.map(c => {
  const f = `<calculation class='tableau' formula='${esc(fix(c.formula))}' />`;
  if (c.type === "meas") return `<column caption='${esc(c.caption)}' datatype='real' default-format='${esc(c.fmt)}' name='[${cname(c.id)}]' role='measure' type='quantitative'>${f}</column>`;
  if (c.type === "rmeas") return `<column caption='${esc(c.caption)}' datatype='integer' name='[${cname(c.id)}]' role='measure' type='quantitative'>${f}</column>`;
  if (c.type === "smeas") return `<column caption='${esc(c.caption)}' datatype='string' name='[${cname(c.id)}]' role='measure' type='nominal'>${f}</column>`;
  return `<column caption='${esc(c.caption)}' datatype='boolean' name='[${cname(c.id)}]' role='dimension' type='nominal'>${f}</column>`;
}).join("\n");
const metaRecs = SRC.map(([n, t], i) => `<metadata-record class='column'><remote-name>${esc(n)}</remote-name><remote-type>${RT[t]}</remote-type><local-name>[${esc(n)}]</local-name><parent-name>[superstore_orders.csv]</parent-name><remote-alias>${esc(n)}</remote-alias><ordinal>${i}</ordinal><local-type>${t}</local-type><aggregation>${t === "string" ? "Count" : t === "date" ? "Year" : "Sum"}</aggregation><contains-null>true</contains-null></metadata-record>`).join("\n");
const HYPER_DB = "Data/Extracts/superstore.hyper";
const xmeta = SRC.map(([n, t], i) => `<metadata-record class='column'><remote-name>${esc(n)}</remote-name><remote-type>${RT[t]}</remote-type><local-name>[${esc(n)}]</local-name><parent-name>[Extract]</parent-name><remote-alias>${esc(n)}</remote-alias><ordinal>${i}</ordinal><local-type>${t}</local-type><aggregation>${t === "string" ? "Count" : t === "date" ? "Year" : "Sum"}</aggregation><contains-null>true</contains-null>${t === "string" ? "<collation flag='0' name='binary' />" : ""}<object-id>[Migrated Data]</object-id></metadata-record>`).join("\n");
const extract = `<extract count='-1' enabled='true' units='records'><connection access_mode='readonly' authentication='auth-none' author-locale='en_US' class='hyper' dbname='${HYPER_DB}' default-settings='yes' schema='Extract' sslmode='' tablename='Extract' update-time='11/13/2026 12:00:00 AM' username='tableau_internal_user'><relation name='Extract' table='[Extract].[Extract]' type='table' /><refresh><refresh-event add-from-file-path='Sample - Superstore' increment-value='%null%' refresh-type='create' rows-inserted='10194' timestamp-start='2026-11-13 00:00:00.000' /></refresh><metadata-records>${xmeta}</metadata-records></connection></extract>`;
// palette on the datasource (worksheet-level maps are ignored)
const plInst = `<column-instance column='[${cname("c_pl")}]' derivation='User' name='[usr:${cname("c_pl")}:nk]' pivot='key' type='nominal' />`;
const dsStyle = `<style><style-rule element='mark'><encoding attr='color' field='[usr:${cname("c_pl")}:nk]' type='palette'><map to='${C.green}'><bucket>&quot;Profit&quot;</bucket></map><map to='${C.loss}'><bucket>&quot;Loss&quot;</bucket></map></encoding></style-rule></style>`;
const dataSource = `<datasource caption='${DSC}' inline='true' name='${DS}' version='18.1'>
<connection class='federated'>
<named-connections><named-connection caption='superstore_orders' name='textscan.superstore'>
<connection class='textscan' directory='Data/${NAME}' filename='superstore_orders.csv' password='' server='' />
</named-connection></named-connections>
<relation connection='textscan.superstore' name='superstore_orders.csv' table='[superstore_orders#csv]' type='table'>
<columns character-set='UTF-8' header='yes' locale='en_US' separator=','>
${SRC.map(([n, t], i) => `<column datatype='${t}' name='${esc(n)}' ordinal='${i}' />`).join("\n")}
</columns></relation>
<metadata-records>
${metaRecs}
</metadata-records>
</connection>
<aliases enabled='yes' />
${colDefs}
${calcDefs}
${extract}
</datasource>`;
const paramSource = `<datasource hasconnection='false' inline='true' name='Parameters' version='18.1'><aliases enabled='yes' />\n${params.join("\n")}\n</datasource>`;

// ---------- dashboard: the 3D experience itself, full-bleed in a Web Page object (same as the mockup) ----------
const URL = process.env.APP_URL || APP_URL;
const dashboard = `<dashboard name='Beyond the Numbers'>
<style><style-rule element='table'><format attr='background-color' value='${C.bg}' /></style-rule></style>
<size maxheight='1000' maxwidth='1920' minheight='800' minwidth='1280' sizing-mode='range' />
<datasources />
<zones><zone h='100000' id='1' type-v2='layout-basic' w='100000' x='0' y='0'><zone h='100000' id='2' param='${URL}' type-v2='web' w='100000' x='0' y='0'><zone-style><format attr='border-style' value='none' /><format attr='margin' value='0' /><format attr='padding' value='0' /><format attr='background-color' value='${C.bg}' /></zone-style></zone></zone></zones>
<simple-id uuid='${guid()}' />
</dashboard>`;
const sheetNames = [];
const wsWin = name => `<window class='worksheet' hidden='true' maximized='false' name='${esc(name)}'><cards><edge name='left'><strip size='160'><card type='pages' /><card type='filters' /><card type='marks' /></strip></edge><edge name='top'><strip size='2147483647'><card type='columns' /></strip><strip size='2147483647'><card type='rows' /></strip><strip size='31'><card type='title' /></strip></edge></cards><viewpoint><zoom type='entire-view' /></viewpoint><simple-id uuid='${guid()}' /></window>`;
const xml = `<?xml version='1.0' encoding='utf-8' ?>
<workbook original-version='18.1' source-build='2026.3' version='18.1' xmlns:user='http://www.tableausoftware.com/xml/user'>
<document-format-change-manifest><AccessibleZoneTabOrder /><AnimationOnByDefault /><DatagraphCoreV1 /><IntuitiveSorting /><Layers /><MarkAnimation /><ObjectModelEncapsulateLegacy /><ObjectModelTableType /><ParameterAction /><SchemaViewerObjectModel /><SheetIdentifierTracking /><SortTagCleanup /><WindowsPersistSimpleIdentifiers /><WorksheetBackgroundTransparency /><ZoneBackgroundTransparency /><ZoneFriendlyName /></document-format-change-manifest>
<preferences />
<datasources>
${paramSource}
${dataSource}
</datasources>


<dashboards>
${dashboard}
</dashboards>
<windows source-height='30'>
<window class='dashboard' maximized='true' name='Beyond the Numbers'><viewpoints /><active id='-1' /><simple-id uuid='${guid()}' /></window>
${sheetNames.map(wsWin).join("\n")}
</windows>
</workbook>
`;
const OUT2 = process.env.OUT_TWB || OUT; fs.writeFileSync(OUT2, xml, "utf8");
console.log("wrote", OUT, (xml.length / 1024).toFixed(0) + " KB");
const zipSrc = fs.readFileSync(path.join(HERE, "zip_lib.js"), "utf8"); const zip = new Function("require", zipSrc + "; return zip;")(require);
const pkg = process.env.OUT_TWBX || OUT.replace(/\.twb$/, ".twbx");
fs.writeFileSync(pkg, zip([[path.basename(OUT), Buffer.from(xml, "utf8")], [`Data/${NAME}/superstore_orders.csv`, fs.readFileSync(path.join(HERE, "superstore_orders.csv"))], [HYPER_DB, fs.readFileSync(path.join(HERE, "superstore.hyper"))]]));
console.log("packaged", pkg);
