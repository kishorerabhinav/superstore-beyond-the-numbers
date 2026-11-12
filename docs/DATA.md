# Data and validation report

Source: Tableau **Sample - Superstore.xlsx** (2026.3), sheet *Orders*. Built by `scripts/build-data.mjs` into `public/data/superstore.json` (every order line, column-encoded; no pre-aggregation).

## Checks on load

- All 19 required columns present (plus Country/Region, Postal Code, Row ID).
- 10,194 order lines; every Order Date and Ship Date parsed (2023-01-02 to 2026-12-29); no ship date before its order date; all Sales, Quantity, Discount, Profit numeric; every discount between 0 and 1. **0 issues.**
- 9,994 US lines and 200 Canadian lines (10 provinces). Canada counts in every total and region; the US map shows it as a separate column.

## Definitions

| Measure | Definition |
|---|---|
| Order line | One row of the Orders sheet. |
| Orders | COUNT(DISTINCT Order ID). |
| Sales, Profit, Quantity | SUM over the lines in scope. Profit can be negative. |
| Profit margin | SUM(Profit) / SUM(Sales). |
| Average discount | Mean of the line-level Discount field (Tableau AVG([Discount])). A sales-weighted, list-price version is also computed. |
| Average order value | SUM(Sales) / Orders. |
| YoY growth | Sales in the latest year in scope / the previous year - 1, other filters applied to both. |

## Reference numbers (independent SQLite, `scripts/validate.py`)

| Measure | Value |
|---|---|
| Order lines | 10,194 |
| Orders | 5,111 |
| Sales | $2,326,534.35 |
| Profit | $292,296.81 |
| Profit margin | 12.56% |
| Average discount (line mean) | 15.54% |
| Average discount (sales-weighted, list price) | 19.70% |
| Average order value | $455.20 |
| Quantity | 38,654 |
| YoY sales growth 2026 vs 2025 | 20.91% |

By year: 2023 $494,040.21 · 2024 $472,993.03 · 2025 $615,415.41 · 2026 $744,085.70

Loss-making sub-categories: Tables, Bookcases, Supplies. Top product: Canon imageCLASS 2200 Advanced Copier ($61,599.82).

## Engine vs SQL

`src/data/engine.test.ts` (run `npm test`) checks the TypeScript engine that powers the app against these SQL results: all-data KPIs, every year, category, segment and region, two combined-filter cases (2025 × West × Technology; Corporate × First Class), the loss-making sub-categories and the top product. Tolerance: 1 cent on money, exact on counts. **All 4 test groups pass.**
