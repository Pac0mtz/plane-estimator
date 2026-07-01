# Plan Forge — Takeoff

A plan-takeoff module for Dovinos Bid Studio. Trace areas, walls and counts over a
floor plan or elevation, and each **trade layer explodes into a live, priced material
list** — the piece Togal / STACK leave to a spreadsheet.

Built the way you already work: **Vite + React + react-konva (canvas) + Zustand**.

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

- **Calibrate** — click two points a known distance apart, type the feet. Sets pixels-per-foot.
  The bundled demo plan is pre-scaled (8 px/ft, a ~33'×72' shell echoing Chipotle #6277).
- **Draw** — pick a trade layer (right panel); the tool auto-switches to area / line / count.
  Click vertices, then **Finish**. Scroll to zoom, **Pan** to move.
- **Select** — tap any shape to select, then **Delete selected**.
- **Export** — CSV rollup (Trade → Assembly → Material → qty → cost). Same shape that feeds
  a Minnie Bird proposal line-item table.

Work persists to `localStorage` (demo plans + traces). Uploaded images are not persisted.

## Where to extend

| File | What it holds |
|---|---|
| `src/lib/assemblies.js` | The assembly catalog + material-explosion engine. **Swap in your 481-item price book here.** |
| `src/store/useStore.js` | Zustand store (tools, layers, traces, calibration). Replace `persist` with a Neon-backed API for multi-device projects. |
| `src/components/PlanCanvas.jsx` | react-konva canvas (zoom/pan/trace). Add multi-page plan sets and PDF rasterization here. |
| `src/lib/exportCsv.js` | CSV builder → wire directly into Bid Studio to auto-fill the blue PDF. |

## Roadmap hooks
- **PDF pages** — render plan-set PDFs to canvas (pdf.js) so you skip the image export step.
- **Editable assemblies** — a UI over `assemblies.js` bound to your price book.
- **AI pre-seed** — GPT-4o vision pass to auto-detect rooms/walls/doors, estimator confirms.
- **Bid Studio handoff** — POST the rollup to your proposal generator.
