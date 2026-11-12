# SUPERSTORE — Beyond the Numbers

*Every product has a story. Every transaction reveals an opportunity.*

A cinematic, interactive 3D retail-intelligence experience built on Tableau's **Sample Superstore** dataset. You arrive outside a store at dusk, the glass doors slide open, the camera sweeps through four departments, and the business comes alive. Then you explore: fly to a department to see its numbers, walk the aisles in first person, or follow guided experiences on sales, profitability, customers, geography and products. The store itself is data-driven: shelves are stocked in proportion to each sub-category's sales, rail lights show its margin, states on the map table rise with sales, and the checkout lanes queue by customer segment.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
# or a production build
npm run build && npm run preview   # http://localhost:4173
```

Everything needed is in the repo (`public/data`, `public/assets`). To rebuild inputs from scratch:

| Command | What it does |
|---|---|
| `npm run data` | Reads `Sample - Superstore.xlsx`, validates it, writes `public/data/superstore.json`, then computes SQL reference numbers |
| `npm test` | Checks the data engine against the SQL reference (`src/data/engine.test.ts`) |
| `npm run assets` | Downloads the CC0 Poly Haven models, textures and HDRIs and optimises them (meshopt + WebP) |
| `npm run models` | Rebuilds the custom retail assets in Blender 5.3 (`scripts/blender/build_assets.py`) |
| `npm run e2e` | Drives the built app in Chrome (intro, departments, filters, experiences) and saves screenshots to `e2e-shots/` |

## Controls

- **Explore:** click a department (or pick one in the panel). Drag to orbit, scroll to zoom, right-drag to pan. The reset button returns to the overview.
- **Walk:** first-person mode. W A S D or arrows to move, mouse to look, Shift to walk faster, Esc to stop.
- **Filters:** Year (timeline), Region, Category, Segment and Ship mode update every number, chart and 3D element.
- **Sound** is off by default; turn it on with the speaker button.
- **Reduced motion:** with the OS setting on, the film cuts instead of flying, and transitions are instant.

## Architecture

```
src/
  data/       engine.ts (filters, aggregation, KPIs, typed columns) · derive.ts (department, segment, geo, product views) · format.ts
  state/      AppState.tsx (filters, experience, selection, quality; KPIs memoised per filter change)
  scene/      StoreCanvas (renderer, lights, post FX, adaptive quality) · CameraDirector (GSAP intro, arced fly-throughs, orbit, walk mode)
              Building (shell, textures, cutaway, doors) · Departments · Stock (data-driven shelves) · Fixtures (checkouts, carts, shoppers)
              Atrium (3D US map table, product plinth) · Instanced (multi-material GLB instancing) · layout.ts (all positions and shots)
  ui/         Chrome (top bar, filters, timeline, KPIs, intro captions) · Panels (department + five experiences) · charts.tsx · Extras (loader, data notes, walk overlay)
  audio/      ambience.ts (synthesised room tone, pad and transition swells; no audio files)
scripts/      build-data.mjs · validate.py · fetch-assets.mjs · blender/build_assets.py · e2e.mjs
docs/DATA.md  definitions and the validation report
```

**Stack:** React 19, TypeScript, Vite, three.js, React Three Fiber, drei, @react-three/postprocessing (N8AO ambient occlusion, bloom, AgX tone mapping), GSAP + ScrollTrigger, Framer Motion, d3-scale/shape/geo, topojson + us-atlas.

**Performance:** repeated products, shelving, fixtures and shoppers are GPU-instanced (one draw call per material part). Integrated and software GPUs start on a lighter preset, and a performance monitor steps quality down at runtime. Effects by preset:

| Preset | Effects |
|---|---|
| High | Mirror floor, ambient occlusion, 4K shadows |
| Medium | Bloom and soft shadows |
| Low | No post effects or shadows |

Without WebGL, the analytics still work.

## Assets

- **Poly Haven (CC0):** furniture, plants, lamps, small appliances, textures and HDRIs. See `public/assets/CREDITS.json`.
- **Built in Blender for this project:**
  - the building shell, glass facade, sliding doors and signage
  - gondola shelving and packaged stock
  - phones, laptops, monitors, copiers, printers and keyboards
  - fridges, coffee makers and toasters
  - bookcases, office chairs and tables
  - checkout lanes, shopping carts and architectural figures

## Data notes

See `docs/DATA.md`. In short:
- **Orders** are distinct Order IDs, not rows.
- **Margin** is total profit ÷ total sales.
- **Average discount** is the mean of the line discount (Tableau's AVG). A sales-weighted version is also available in the Data panel.
- **Appliances**, a sub-category of Office Supplies, has its own department in the store. The Office Supplies department excludes it, so nothing is counted twice.
- **Canada:** the 200 Canadian lines are included in all totals.
