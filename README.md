# Plan Forge

An estimator app for Dovinos Bid Studio. Manage **projects** and **clients**, import
large **PDF plan sets**, trace areas/walls/counts (with an **AI pre-seed** pass), and each
**trade layer explodes into a live, priced material list** driven by an editable **price
book** — then export a branded **proposal PDF** or CSV.

Built the way you already work: **Vite + React + react-konva (canvas) + Zustand**.

## App structure

A left sidebar navigates four areas:

| View | What it does |
|---|---|
| **Projects** | Create/edit/delete projects, attach a client, open one into the takeoff. Each project owns its takeoff (layers, traces, calibration). |
| **Clients** | Client records (name, company, email, phone); linked to projects and proposals. |
| **Takeoff** | The canvas workspace — import a plan, browse sheets, ask the AI assistant, calibrate, trace, AI-detect, price it out. |
| **Price book** | Full estimating catalog (19 assemblies across CSI divisions) with **material + labor + equipment** bare costs, **Overhead & Profit** markup, and a **location (city cost index) factor**. Search, add/remove rows & assemblies, **JSON/CSV export + JSON import** (load your own book). Edits reprice every project instantly. |

Everything persists to `localStorage` (records + vectors). Rendered plan images don't
persist — re-upload the plan after a refresh; your traces stay put.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Build for production:

```bash
npm run build      # outputs to /dist
npm run preview
```

## Deploy (Vercel)

```bash
npm i -g vercel
vercel               # framework auto-detected as Vite; build = "npm run build", output = "dist"
```

Or connect the repo in the Vercel dashboard — no config needed.

## How it works

- **Import** — **Upload plan** takes an image *or* a multi-page **PDF plan set** (pdf.js).
  Pages render on demand from a thumbnail rail on the left, so large sets stay light.
  Each page rasterizes at a **DPI computed from its real size** (target 200 dpi, capped to
  browser limits) and encodes to WebP via blob URLs — an ARCH-E sheet renders near ~150–200 dpi
  instead of the ~46 dpi a fixed pixel cap gave. The header shows the effective dpi per page.
  *Next:* re-render-on-zoom for sharper deep zoom — the `renderPageRegion()` seam in `src/lib/pdf.js`.
- **Sheet index** — on import, the text layer of every page is read to detect each sheet's
  number, title, and discipline (General / Architectural / Structural / MEP / …). The left
  rail becomes a searchable, discipline-filterable navigator over the whole set (`src/lib/planIndex.js`).
- **Auto trade detection** — right after a PDF imports, an AI pass reads the sheet index + text,
  writes a project summary, and lists every trade present (Concrete, Masonry, EIFS, Drywall,
  Roofing, MEP, …) with the sheets that cover each. It pops up in the assistant as a pinned
  Plan overview (`generatePlanSummary` in `src/lib/planAssistant.js`).
- **Plan assistant** — an AI chat (header → Assistant) that knows the sheet index and reads the
  open sheet's text + drawing. Ask "which sheets do I need for concrete?", "summarize this
  sheet", "list all schedules" — it answers concisely and cites sheets as clickable links that
  jump you there. Uses the OpenAI key (`src/lib/planAssistant.js`).
- **AI detect** — a vision pass suggests real construction elements: **doors** (count/EA),
  **walls** (linear/LF), and **areas** (slab/SF), each with an element label, confidence, and a
  note on what it saw. Accept/reject in the review panel; accepted ones price out. Demo-detection
  with no key; paste an OpenAI key for real `gpt-4o` vision. See `src/lib/aiDetect.js`.
- **Detect scale** — reads the drawing's scale bar / note and auto-calibrates pixels-per-foot
  (`detectScale` in `src/lib/aiDetect.js`), so you don't have to click two points by hand.
- **Auto-layers** — detect creates a **new trade layer per element type** it finds (each with its
  own color), so walls, slab, storefront, doors, etc. land on distinct, differently-colored layers.
- **Layer details / properties panel** — the active layer's editable properties (name, color
  swatches, assembly, live quantity + cost) plus New-layer and Delete-layer controls.
- **Hover to inspect & confirm** — hover any detection or trace to highlight it and see a
  properties card (element, type, quantity, confidence, layer, note). **Accept**, **delete**, or
  **Review** — which asks the AI to double-check the classification and note a local unit cost.
- **Search plan** — the search pill over the canvas finds a wall/door/area and zooms to it so you
  can confirm where a number comes from.
- **Calibrate** — click two points a known distance apart, type the feet. Sets pixels-per-foot.
  The bundled demo plan is pre-scaled (8 px/ft, a ~33'×72' shell echoing Chipotle #6277).
  Uploaded plans start unscaled — calibrate before quantities compute.
- **Draw** — pick a trade layer (right panel); the tool auto-switches to area / line / count.
  Click vertices, then **Finish**. Or use **Rectangle** for quick two-corner areas, and **Measure**
  for a non-destructive ruler. On-canvas zoom controls, plus keyboard shortcuts (V/H/C/M/D/R,
  Esc, Enter). The toolbar and analysis panel both collapse to give the canvas more room.
- **Select & edit** — click any shape to select it (drag its vertices to reshape), or **Exclude**
  it from the takeoff. The **Exclude area** tool (X) draws out-of-scope regions that never count.
- **Fit to screen** — the ⤢ button (or `F` / `0`) fits the whole page in view.
- **Proposal** — **Export** opens a proposal generator: pick line items, set title / prepared-by /
  notes & terms, preview the total, and generate a branded PDF.
- **Project trades** — when you create a project, pick which trades it includes so the layers are
  scoped up front.
- **Export** — CSV rollup (Trade → Assembly → Material → qty → cost). Same shape that feeds
  a Minnie Bird proposal line-item table.

Work persists to `localStorage` (demo plans + traces). Uploaded images/PDF pages are not persisted.

> **Security:** a browser-held OpenAI key is visible to anyone using the app — dev/local only.
> Before shipping, move `openaiDetect()` in `src/lib/aiDetect.js` behind a serverless proxy
> (e.g. a Vercel function) and call that instead. It's a one-function swap.

## Where to extend

| File | What it holds |
|---|---|
| `src/lib/assemblies.js` | The assembly catalog + material-explosion engine. **Swap in your 481-item price book here.** |
| `src/store/useStore.js` | Zustand store (tools, layers, traces, calibration). Replace `persist` with a Neon-backed API for multi-device projects. |
| `src/components/PlanCanvas.jsx` | react-konva canvas (zoom/pan/trace). Add multi-page plan sets and PDF rasterization here. |
| `src/lib/exportCsv.js` | CSV builder → wire directly into Bid Studio to auto-fill the blue PDF. |

## Roadmap hooks
- ~~**PDF pages** — render plan-set PDFs to canvas (pdf.js).~~ ✅ done — `src/lib/pdf.js`.
- ~~**AI pre-seed** — vision pass to auto-detect rooms/walls/doors, estimator confirms.~~ ✅ done
  (demo detector + OpenAI seam) — `src/lib/aiDetect.js`. Next: move behind a serverless proxy;
  per-page scale (plan sets mix scales); train prompts on your symbol legend.
- **Editable assemblies** — a UI over `assemblies.js` bound to your price book.
- **Bid Studio handoff** — POST the rollup to your proposal generator.
