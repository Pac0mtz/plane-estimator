// ---------------------------------------------------------------------------
// Single entry point for bringing a plan into the takeoff. Shared by the
// "Upload plan" button and the canvas drag-and-drop zone so both behave
// identically. PDFs open a preview modal first (trades + options) before
// committing; images import immediately.
// ---------------------------------------------------------------------------
import { openPdf, renderPage, closePdf } from "./pdf.js";
import { useStore, START_LAYERS } from "../store/useStore.js";
import { hasKey, detectScale } from "./aiDetect.js";
import { generatePlanSummary } from "./planAssistant.js";
import { persistUploadedPlan } from "./restorePlan.js";

const DEFAULT_ASMS = START_LAYERS.map((l) => l.asm);
export const DEFAULT_IMPORT_OPTIONS = {
  autoScale: true,
  openAssistant: true,
  replaceLayers: true,
};

// Auto-calibrate the current page from its printed scale note × render DPI.
export async function maybeAutoScale() {
  const st = useStore.getState();
  if (!hasKey() || st.ppf || st.scaleReading) return;
  if (st.bg.type !== "img" || !st.bg.href) return;
  const dpi = st.pages[st.activePage]?.dpi;
  if (!dpi) return;
  st.setScaleReading(true);
  try {
    const { paperInchesPerFoot, scaleNote } = await detectScale({ imageDataUrl: st.bg.href, bg: st.bg });
    if (paperInchesPerFoot > 0) useStore.getState().setPpf(dpi * paperInchesPerFoot, `AI scale ${scaleNote || ""}`.trim());
  } catch {
    /* silent — user can still Detect scale / Calibrate manually */
  } finally {
    useStore.getState().setScaleReading(false);
  }
}

function sheetLabel(pg, index) {
  if (!pg) return `Sheet ${index + 1}`;
  const no = pg.sheetNo || `Sheet ${index + 1}`;
  return pg.title ? `${no} · ${pg.title}` : no;
}

// Lazy-render a PDF page onto the canvas with progress feedback.
export async function loadPageIfNeeded(index, store = useStore.getState(), onError = (m) => store.setAiError(m)) {
  const pg = store.pages[index];
  if (!pg || pg.loaded) return true;
  const label = sheetLabel(pg, index);
  store.setPageLoad({ page: index, stage: "opening", pct: 0, label });
  try {
    const result = await renderPage(index, {
      onProgress: ({ stage, pct }) => store.setPageLoad({ page: index, stage, pct, label }),
    });
    useStore.getState().setPageImage(index, result);
    return true;
  } catch (err) {
    onError(`Could not load sheet: ${err.message}`);
    return false;
  } finally {
    useStore.getState().setPageLoad(null);
  }
}

async function detectTradesForPreview(store) {
  const prev = store.importPreview;
  if (!prev?.thumbs) return;
  store.patchImportPreview({ tradesBusy: true, tradesError: null });
  try {
    const { summary, trades } = await generatePlanSummary({
      sheetIndex: prev.sheetIndex,
      pagesText: prev.thumbs.map((t) => t.text),
    });
    const asms = [...new Set(trades.map((t) => t.asm).filter(Boolean))];
    store.patchImportPreview({
      tradesBusy: false,
      summary,
      trades,
      selectedAsms: asms.length ? asms : prev.selectedAsms,
    });
  } catch (err) {
    store.patchImportPreview({ tradesBusy: false, tradesError: err.message });
  }
}

// Phase 1 — read the PDF and build thumbnails; keep the doc open for commit.
export async function beginPdfImport(file, store, onError = (m) => store.setAiError(m)) {
    store.setImportPreview({
      phase: "loading",
      fileName: file.name,
      sourceFile: file,
      progress: { stage: "reading", page: 0, total: 0, pct: 0 },
    selectedAsms: [...DEFAULT_ASMS],
    options: { ...DEFAULT_IMPORT_OPTIONS },
  });
  try {
    const { thumbs, sheetIndex } = await openPdf(file, {
      onProgress: (p) => store.patchImportPreview({ progress: p }),
    });
    store.setImportPreview({
      phase: "preview",
      fileName: file.name,
      thumbs,
      sheetIndex,
      previewPage: 0,
      trades: [],
      tradesBusy: hasKey(),
      tradesNote: hasKey() ? null : "Add an OpenAI key to auto-detect trades — pick layers manually below.",
      summary: null,
      selectedAsms: [...DEFAULT_ASMS],
      options: { ...DEFAULT_IMPORT_OPTIONS },
    });
    if (hasKey()) detectTradesForPreview(store);
  } catch (err) {
    closePdf();
    store.clearImportPreview();
    onError("Could not read that PDF: " + err.message);
  }
}

// Phase 2 — user confirmed: load into the takeoff, set layers, render page 1.
export async function commitPdfImport(store, onError = (m) => store.setAiError(m)) {
  const prev = store.importPreview;
  if (!prev || prev.phase !== "preview") return;

  const { thumbs, sheetIndex, selectedAsms, options, summary, trades } = prev;
  store.setImportProgress({ stage: "rendering", page: 0, total: thumbs.length, pct: 0 });

  try {
    store.loadPdf(thumbs, sheetIndex, prev.fileName);
    if (options.replaceLayers) store.setLayersFromAsms(selectedAsms);
    else store.addLayersForAsms(selectedAsms);

    store.setPageLoad({ page: 0, stage: "opening", pct: 0, label: sheetLabel(thumbs[0], 0) });
    const first = await renderPage(0, {
      onProgress: ({ stage, pct }) => store.setPageLoad({ page: 0, stage, pct, label: sheetLabel(thumbs[0], 0) }),
    });
    store.setPageImage(0, first);
    store.setPageLoad(null);

    if (prev.sourceFile) await persistUploadedPlan(store, prev.sourceFile);

    if (options.openAssistant) {
      store.setAssistantOpen(true);
      const picked = (trades || []).filter((t) => !t.asm || selectedAsms.includes(t.asm));
      if (summary || picked.length) store.setPlanSummary({ busy: false, summary, trades: picked });
      else if (prev.tradesNote) store.setPlanSummary({ busy: false, note: prev.tradesNote });
    }

    if (options.autoScale) maybeAutoScale();
  } catch (err) {
    onError("Import failed: " + err.message);
    store.setPageLoad(null);
  } finally {
    store.clearImportPreview();
    store.setImportProgress(null);
    store.setPageLoad(null);
  }
}

export function cancelPdfImport(store) {
  closePdf();
  store.clearImportPreview();
  store.setImportProgress(null);
}

export const ACCEPT = "image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.webp";

const isPdf = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isImage = (f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(f.name);

export async function importPlanFile(file, store, onError = (m) => store.setAiError(m)) {
  if (!file) return;

  if (isPdf(file)) {
    await beginPdfImport(file, store, onError);
    return;
  }

  if (isImage(file)) {
    const rd = new FileReader();
    rd.onload = async () => {
      const img = new Image();
      img.onload = async () => {
        store.loadImage(rd.result, img, file.name);
        await persistUploadedPlan(store, file);
      };
      img.onerror = () => onError("Could not read that image.");
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
    return;
  }

  if (/\.dxf$/i.test(file.name))
    return onError("DXF (CAD) import isn't wired up yet. For now, export the drawing to PDF from your CAD software and upload that.");
  if (/\.dwg$/i.test(file.name))
    return onError("DWG is a binary CAD format browsers can't open directly. Export it to PDF (or DXF) from AutoCAD/Revit and upload that — PDF keeps the vector text so the assistant can read the sheets.");

  onError("Unsupported file type. Upload a PDF or an image (PNG/JPG). For CAD, export to PDF first.");
}
