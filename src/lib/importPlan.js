// ---------------------------------------------------------------------------
// Single entry point for bringing a plan into the takeoff. Shared by the
// "Upload plan" button and the canvas drag-and-drop zone so both behave
// identically. Accepts PDF and raster images; gives friendly guidance for CAD
// formats a browser can't read directly.
// ---------------------------------------------------------------------------
import { openPdf, renderPage, closePdf } from "./pdf.js";
import { useStore } from "../store/useStore.js";
import { hasKey, detectScale } from "./aiDetect.js";
import { generatePlanSummary } from "./planAssistant.js";

// Auto-calibrate the current page from its printed scale note × render DPI.
// Runs only while the set is still uncalibrated, so it retries page-by-page
// (a cover with no scale is skipped) until it finds a scale, then stops.
export async function maybeAutoScale() {
  const st = useStore.getState();
  if (!hasKey() || st.ppf || st.scaleReading) return;
  if (st.bg.type !== "img" || !st.bg.href) return;
  const dpi = st.pages[st.activePage]?.dpi; // exact scale needs the PDF render DPI
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

// After a plan set loads, auto-detect trades + write a project summary and open
// the assistant to show it. Fire-and-forget; never blocks the import.
async function runPlanAnalysis() {
  const st = useStore.getState();
  if (st.pages.length <= 1) return; // single image — nothing to summarize
  if (!hasKey()) {
    st.setPlanSummary({ busy: false, note: "Add an OpenAI key to auto-detect trades and summarize this set." });
    st.setAssistantOpen(true);
    return;
  }
  st.setAssistantOpen(true);
  st.setPlanSummary({ busy: true });
  try {
    const cur = useStore.getState();
    const { summary, trades } = await generatePlanSummary({
      sheetIndex: cur.sheetIndex,
      pagesText: cur.pages.map((p) => p.text),
    });
    useStore.getState().setPlanSummary({ busy: false, summary, trades });
  } catch (err) {
    useStore.getState().setPlanSummary({ busy: false, error: err.message });
  }
}

export const ACCEPT = "image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.webp";

const isPdf = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isImage = (f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(f.name);

// store = useStore.getState(); onError(message) surfaces problems to the UI.
export async function importPlanFile(file, store, onError = (m) => alert(m)) {
  if (!file) return;

  if (isPdf(file)) {
    store.setImportProgress({ stage: "reading", page: 0, total: 0, pct: 0 });
    try {
      closePdf();
      const { thumbs, sheetIndex } = await openPdf(file, { onProgress: store.setImportProgress });
      store.loadPdf(thumbs, sheetIndex);
      store.setImportProgress({ stage: "rendering", page: 0, total: thumbs.length, pct: 0 });
      store.setPageImage(0, await renderPage(0));
      runPlanAnalysis(); // auto trade-detection + summary (non-blocking)
      maybeAutoScale(); // auto-calibrate from the scale note (non-blocking)
    } catch (err) {
      onError("Could not read that PDF: " + err.message);
    } finally {
      store.setImportProgress(null);
    }
    return;
  }

  if (isImage(file)) {
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => store.loadImage(rd.result, img);
      img.onerror = () => onError("Could not read that image.");
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
    return;
  }

  // CAD formats — the browser can't rasterize these on its own.
  if (/\.dxf$/i.test(file.name))
    return onError("DXF (CAD) import isn't wired up yet. For now, export the drawing to PDF from your CAD software and upload that.");
  if (/\.dwg$/i.test(file.name))
    return onError("DWG is a binary CAD format browsers can't open directly. Export it to PDF (or DXF) from AutoCAD/Revit and upload that — PDF keeps the vector text so the assistant can read the sheets.");

  onError("Unsupported file type. Upload a PDF or an image (PNG/JPG). For CAD, export to PDF first.");
}
