// ---------------------------------------------------------------------------
// PDF plan-set loader (pdf.js). Handles large, multi-page documents by
// rendering cheap thumbnails up front and full-resolution pages on demand.
//
// Resolution strategy (v2): render each page at a real target DPI computed
// from its physical size (pdf.js gives page dimensions in points = 1/72"),
// capped to browser canvas limits. A 36x48" ARCH-E sheet that used to land at
// ~46 dpi (fixed 2200px) now renders near ~150 dpi. Pages are encoded as WebP
// (crisper than JPEG on black linework, ~30% smaller than PNG) and handed to
// the app as blob object URLs — no giant base64 strings in the store.
//
// NEXT (strategy 2 — re-render on zoom): renderPageRegion() below is the seam.
// Call it from the canvas when zoom settles to re-rasterize the visible area
// at zoom x devicePixelRatio, so zooming IN keeps getting sharper with bounded
// memory. Not yet wired to the Konva view — see PlanCanvas onWheel/onDragEnd.
// ---------------------------------------------------------------------------
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseSheetIndex, detectSheet, guessSheetNo, disciplineOf } from "./planIndex.js";
import { opListToPolylines, usefulPolylines } from "./vector.js";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
// Suppress harmless TrueType font warnings from CAD-exported PDFs (TT: undefined function).
pdfjs.GlobalWorkerOptions.verbosity = 0;

// Render caps — keep the raster crisp without blowing browser/memory limits.
const TARGET_DPI = 200; // aim; actual is lower once caps bite on huge sheets
const MAX_SIDE = 10000; // Chrome allows 16384/side; stay well under for Safari
const MAX_AREA = 40_000_000; // ~40 MP → ~160 MB decoded; the real memory guard
const PDF_POINTS_PER_INCH = 72;

let _doc = null; // current PDFDocumentProxy
const _urls = new Set(); // object URLs we own, so we can revoke them

// Pick a render scale that targets TARGET_DPI but respects the caps.
function scaleForPage(baseViewport) {
  let scale = TARGET_DPI / PDF_POINTS_PER_INCH;
  const w = baseViewport.width * scale;
  const h = baseViewport.height * scale;
  const sideShrink = Math.min(1, MAX_SIDE / Math.max(w, h));
  const areaShrink = Math.min(1, Math.sqrt(MAX_AREA / (w * h)));
  return scale * Math.min(sideShrink, areaShrink);
}

// The effective dpi a page will actually render at (for UI/feedback).
export function effectiveDpi(baseViewport) {
  return Math.round(scaleForPage(baseViewport) * PDF_POINTS_PER_INCH);
}

async function renderToCanvas(page, scale, onRenderPct) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  const task = page.render({ canvasContext: ctx, viewport, intent: "print" });
  if (onRenderPct) {
    task.onProgress = ({ loaded, total }) => {
      if (total > 0) onRenderPct(Math.round((loaded / total) * 100));
    };
  }
  await task.promise;
  return canvas;
}

// Encode a canvas to the best available lossless-ish codec for line art and
// return a blob object URL. WebP → PNG → JPEG, whichever the browser encodes.
function canvasToObjectUrl(canvas, { quality = 0.92 } = {}) {
  const tryType = (type, q) =>
    new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, q));
  return (async () => {
    let blob = await tryType("image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await tryType("image/png");
    if (!blob) blob = await tryType("image/jpeg", 0.9);
    const url = URL.createObjectURL(blob);
    _urls.add(url);
    return url;
  })();
}

async function decode(url) {
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });
  return img;
}

// Open a PDF File and build a light per-page manifest (thumbnails only).
// w/h are the FULL-res plan pixels each page WILL have, so takeoff scale and
// quantities are computed against the real rendered dimensions.
export async function openPdf(file, { thumbDim = 256, onProgress } = {}) {
  closePdf();
  const report = (stage, page, total) =>
    onProgress && onProgress({ stage, page, total, pct: total ? Math.round((page / total) * 100) : 0 });

  report("reading", 0, 0);
  const buf = await file.arrayBuffer();

  report("loading", 0, 0);
  const task = pdfjs.getDocument({ data: buf, verbosity: 0 });
  task.onProgress = ({ loaded, total }) => report("loading", loaded, total || loaded);
  _doc = await task.promise;

  const numPages = _doc.numPages;
  const thumbs = [];
  const texts = [];
  for (let i = 1; i <= numPages; i++) {
    report("thumbnails", i - 1, numPages);
    const page = await _doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const fullScale = scaleForPage(base);
    const thumbScale = thumbDim / Math.max(base.width, base.height);
    const canvas = await renderToCanvas(page, thumbScale);

    // pull the text layer (vector CAD sets carry real text — near free)
    let text = "";
    try {
      const tc = await page.getTextContent();
      text = tc.items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim();
    } catch { /* scanned page — no text layer */ }
    texts.push(text);

    thumbs.push({
      w: Math.round(base.width * fullScale),
      h: Math.round(base.height * fullScale),
      dpi: effectiveDpi(base),
      thumb: canvas.toDataURL("image/webp", 0.6),
      text,
    });
    page.cleanup();
  }
  report("thumbnails", numPages, numPages);

  // build the sheet index off the cover pages, then label every page
  const index = parseSheetIndex(texts.slice(0, 4).join(" \n "));
  thumbs.forEach((t) => {
    let det = detectSheet(t.text, index);
    if (!det) { const g = guessSheetNo(t.text, index); if (g) det = { no: g, title: index.get(g) || "" }; }
    t.sheetNo = det?.no || null;
    t.title = det?.title || (det?.no ? index.get(det.no) : "") || "";
    t.discipline = disciplineOf(t.sheetNo);
  });
  const sheetIndex = [...index].map(([no, title]) => ({ no, title, discipline: disciplineOf(no) }));

  return { numPages, thumbs, sheetIndex };
}

// Re-render a page thumbnail at a specific pixel size (longest side).
// Used by the sheet strip when the user enlarges the footer — sharper than
// upscaling the 256 px import thumb.
export async function renderThumb(index, thumbDim = 256) {
  if (!_doc) throw new Error("No PDF open");
  const page = await _doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const scale = thumbDim / Math.max(base.width, base.height);
  const canvas = await renderToCanvas(page, scale);
  const url = canvas.toDataURL("image/webp", 0.72);
  page.cleanup();
  return url;
}

// Render a single page at full (DPI-aware) resolution.
// Returns { href, w, h, dpi, img } — href is a blob object URL.
// onProgress({ stage, pct }) — stage: opening | rendering | encoding | decoding | done
export async function renderPage(index, { onProgress } = {}) {
  if (!_doc) throw new Error("No PDF open");
  const report = (stage, pct) => onProgress?.({ stage, pct });
  report("opening", 8);
  const page = await _doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  report("rendering", 12);
  const canvas = await renderToCanvas(page, scaleForPage(base), (renderPct) => {
    report("rendering", 12 + Math.round(renderPct * 0.68));
  });
  report("encoding", 84);
  const href = await canvasToObjectUrl(canvas);
  page.cleanup();
  report("decoding", 94);
  const img = await decode(href);
  report("done", 100);
  return { href, w: canvas.width, h: canvas.height, dpi: effectiveDpi(base), img };
}

// STRATEGY 2 SEAM — re-render a page at an explicit scale (e.g. current Konva
// zoom x devicePixelRatio) for sharp detail on deep zoom. Ready to call; not
// yet wired into the canvas view. Returns the same shape as renderPage.
export async function renderPageRegion(index, { scale = 1 } = {}) {
  if (!_doc) throw new Error("No PDF open");
  const page = await _doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const eff = Math.min(scaleForPage(base) * Math.max(1, scale), MAX_SIDE / Math.max(base.width, base.height));
  const canvas = await renderToCanvas(page, eff);
  const href = await canvasToObjectUrl(canvas);
  page.cleanup();
  return { href, w: canvas.width, h: canvas.height, img: await decode(href) };
}

// Extract the page's real vector geometry as polylines in the SAME pixel space
// the plan image renders at (so they overlay exactly). Returns [] for scanned
// pages (no vector content). Used by the snap-to-line takeoff tool.
export async function extractPageVectors(index) {
  if (!_doc) return { polylines: [], w: 0, h: 0, layers: [] };
  const page = await _doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: scaleForPage(base) });
  let polylines = [], layers = [];
  try {
    const opList = await page.getOperatorList();
    const raw = opListToPolylines(opList, vp.transform);
    // resolve optional-content group ids -> CAD layer names (if the PDF has any)
    let oc = null;
    try { oc = await _doc.getOptionalContentConfig(); } catch { /* none */ }
    if (oc) {
      const nameOf = (id) => { if (id == null) return null; try { return oc.getGroup(id)?.name || null; } catch { return null; } };
      for (const p of raw) p.layerName = nameOf(p.layer);
      layers = [...new Set(raw.map((p) => p.layerName).filter(Boolean))];
    }
    polylines = usefulPolylines(raw);
    // drop geometry drawn outside the sheet (off-page viewports/artifacts) so
    // nothing can snap or measure off the page
    const W = vp.width, H = vp.height;
    polylines = polylines.filter((p) => {
      const cx = p.pts.reduce((a, q) => a + q.x, 0) / p.pts.length;
      const cy = p.pts.reduce((a, q) => a + q.y, 0) / p.pts.length;
      return cx >= -0.02 * W && cx <= 1.02 * W && cy >= -0.02 * H && cy <= 1.02 * H;
    });
  } catch { /* no vector content */ }
  page.cleanup();
  return { polylines, w: Math.round(vp.width), h: Math.round(vp.height), layers };
}

// Text items with their pixel positions (same space as the plan image), used
// to read printed DIMENSIONS off the sheet. [] for scanned pages.
export async function extractPageText(index) {
  if (!_doc) return { items: [], w: 0, h: 0 };
  const page = await _doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: scaleForPage(base) });
  let items = [];
  try {
    const tc = await page.getTextContent();
    items = tc.items
      .filter((it) => it.str && it.str.trim())
      .map((it) => {
        const p = pdfjs.Util.applyTransform([it.transform[4], it.transform[5]], vp.transform);
        return { str: it.str, x: p[0], y: p[1] };
      });
  } catch { /* scanned page */ }
  page.cleanup();
  return { items, w: Math.round(vp.width), h: Math.round(vp.height) };
}

export function closePdf() {
  if (_doc) {
    _doc.destroy();
    _doc = null;
  }
  for (const u of _urls) URL.revokeObjectURL(u);
  _urls.clear();
}

// dev aid: reach the live PDF (same module instance the app uses) from the
// console/preview harness for smoke tests — dynamic import() would get a
// different instance whose _doc is null.
if (typeof window !== "undefined") window.__pdf = { extractPageText, extractPageVectors, renderPage };

// A blob/object URL can't be POSTed to the OpenAI API — convert to a base64
// data URL first. (Used by the AI detect path when a real key is set.)
export async function toDataUrl(url) {
  if (!url || url.startsWith("data:")) return url;
  const blob = await fetch(url).then((r) => r.blob());
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}
