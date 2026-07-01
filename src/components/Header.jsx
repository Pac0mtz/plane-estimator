import { Upload, Download, RotateCcw, Sparkles, Loader2 } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { useRef, useState } from "react";
import { openPdf, renderPage, closePdf } from "../lib/pdf.js";
import { detectTakeoff, hasKey } from "../lib/aiDetect.js";

export default function Header({ onExport, projectName }) {
  const s = useStore();
  const { ppf, ppfNote, loadImage, loadPdf, setPageImage, resetDemo } = s;
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(null); // 'pdf' | null

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
      setBusy("pdf");
      s.setImportProgress({ stage: "reading", page: 0, total: 0, pct: 0 });
      try {
        closePdf();
        const { thumbs } = await openPdf(f, { onProgress: s.setImportProgress });
        loadPdf(thumbs);
        s.setImportProgress({ stage: "rendering", page: 0, total: thumbs.length, pct: 0 });
        const p0 = await renderPage(0);
        setPageImage(0, p0);
      } catch (err) {
        alert("Could not read PDF: " + err.message);
      } finally {
        s.setImportProgress(null);
        setBusy(null);
      }
      return;
    }

    // image
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => loadImage(rd.result, img);
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  };

  const runDetect = async () => {
    s.setAiBusy(true);
    try {
      const det = await detectTakeoff({ imageDataUrl: s.bg.href, bg: s.bg, layers: s.layers });
      s.setSuggestions(det);
    } catch (err) {
      s.setAiError(err.message);
    }
  };

  return (
    <header className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-100">
      <div className="font-bold tracking-tight truncate max-w-[220px]">
        {projectName || "Demo plan"}
        <span className="text-slate-500 font-normal"> · Takeoff</span>
      </div>
      <div className="ml-2 text-xs px-2 py-1 rounded bg-slate-800 text-slate-300">
        Scale:{" "}
        {ppf ? <b className="text-emerald-400">{ppf.toFixed(2)} px/ft</b> : <b className="text-amber-400">not set</b>}{" "}
        <span className="text-slate-500">({ppfNote})</span>
      </div>
      {s.bg.type === "img" && s.pages[s.activePage]?.dpi && (
        <div className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400" title="Render resolution of this page">
          <b className="text-slate-200">{s.pages[s.activePage].dpi}</b> dpi
        </div>
      )}
      <div className="flex-1" />

      <button onClick={runDetect} disabled={s.aiBusy}
        title={hasKey() ? "Detect takeoff regions with OpenAI vision" : "Detect takeoff regions (demo detections — no API key set)"}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-violet-700 hover:bg-violet-600 disabled:opacity-50">
        {s.aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {s.aiBusy ? "Detecting…" : "AI detect"}
      </button>

      <button onClick={resetDemo} title="Reset to demo plan"
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700">
        <RotateCcw size={14} /> Demo
      </button>
      <button onClick={() => fileRef.current?.click()} disabled={busy === "pdf"}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50">
        {busy === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {busy === "pdf" ? "Reading PDF…" : "Upload plan"}
      </button>
      <button onClick={onExport}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-brand hover:bg-brand2">
        <Download size={14} /> Export
      </button>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
    </header>
  );
}
