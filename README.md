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
| **Takeoff** | The canvas workspace — import a plan, calibrate, trace, AI-detect, price it out. |
| **Price book** | Editable assembly + material catalog. Edits reprice every project instantly. Reset to NW-Ohio defaults. |

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
- **AI detect** — a vision pass suggests trace candidates (areas / walls / counts) per page,
  each with a confidence score. Accept/reject them in the review panel; accepted ones become
  real traces and price out. Runs in **demo-detection** mode with no key; paste an OpenAI key
  (panel key icon) to use real `gpt-4o` vision. See `src/lib/aiDetect.js`.
- **Calibrate** — click two points a known distance apart, type the feet. Sets pixels-per-foot.
  The bundled demo plan is pre-scaled (8 px/ft, a ~33'×72' shell echoing Chipotle #6277).
  Uploaded plans start unscaled — calibrate before quantities compute.
- **Draw** — pick a trade layer (right panel); the tool auto-switches to area / line / count.
  Click vertices, then **Finish**. Scroll to zoom, **Pan** to move. Traces are scoped per page.
- **Select** — tap any shape to select, then **Delete selected**.
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
