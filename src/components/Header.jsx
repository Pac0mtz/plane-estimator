import { Upload, Download, RotateCcw, Loader2, MessageSquareText, Ruler, ScanLine } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { useRef, useState } from "react";
import { extractPageVectors } from "../lib/pdf.js";
import { detectRuns } from "../lib/detectRuns.js";
import { importPlanFile, ACCEPT } from "../lib/importPlan.js";

// One header button. Label collapses to icon-only below `show` breakpoint.
function HBtn({ icon: Icon, label, onClick, disabled, tone = "ghost", on, show = "lg", title, spin }) {
  const tones = {
    ghost: "bg-slate-800 hover:bg-slate-700 text-slate-200",
    primary: "bg-brand hover:bg-brand2 text-white",
    violet: on ? "bg-violet-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-200",
    aiprimary: "bg-violet-600 hover:bg-violet-500 text-white",
  };
  return (
    <button onClick={onClick} disabled={disabled} title={title || label}
      className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium disabled:opacity-50 ${tones[tone]}`}>
      {spin ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
      <span className={show === "always" ? "" : `hidden ${show}:inline`}>{label}</span>
    </button>
  );
}

export default function Header({ onExport, projectName, assistantOpen, onToggleAssistant }) {
  const s = useStore();
  const { ppf, ppfNote } = s;
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const dpi = s.bg.type === "img" ? s.pages[s.activePage]?.dpi : null;

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    await importPlanFile(f, useStore.getState());
    setBusy(false);
  };

  // Detect walls/regions from the plan's REAL vector geometry (no vision).
  const runDetect = async () => {
    if (s.bg.type !== "img") { s.setAiError("Open an uploaded PDF page first."); return; }
    s.setAiBusy(true);
    try {
      const polylines = s.vectors[s.activePage] || (await extractPageVectors(s.activePage)).polylines;
      if (!s.vectors[s.activePage]) s.setVectors(s.activePage, polylines);
      const { regions, runs } = detectRuns(polylines, s.bg, { dimSamples: s.dims?.samples || [] });
      if (!regions.length && !runs.length) {
        s.setAiError("No vector geometry found here (scanned/image page). Use Measure wall or trace manually.");
        return;
      }
      s.ingestVectorRuns({ regions, runs });
    } catch (err) {
      s.setAiError(err.message);
    }
  };

  return (
    <header className="flex items-center gap-2 px-3 h-12 border-b border-slate-800 bg-slate-950 text-slate-100 shrink-0">
      {/* project + status */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold tracking-tight truncate max-w-[110px] sm:max-w-[180px]">{projectName || "Demo plan"}</span>
        <span className="hidden sm:flex items-center gap-1 text-[11px] px-2 h-6 rounded bg-slate-800 text-slate-300 shrink-0">
          {s.scaleReading ? <Loader2 size={11} className="animate-spin text-violet-400" /> : <Ruler size={11} className="text-slate-500" />}
          {s.scaleReading ? <span className="text-violet-300">reading scale…</span> : ppf ? <b className="text-emerald-400">{ppf.toFixed(1)} px/ft</b> : <b className="text-amber-400">not set</b>}
        </span>
        {dpi && <span className="hidden md:inline text-[11px] px-2 h-6 leading-6 rounded bg-slate-800 text-slate-400 shrink-0"><b className="text-slate-200">{dpi}</b> dpi</span>}
      </div>

      <div className="flex-1" />

      {/* AI cluster */}
      <div className="flex items-center gap-1.5">
        <HBtn icon={MessageSquareText} label="Assistant" tone="violet" on={assistantOpen} onClick={onToggleAssistant}
          title="Ask the AI plan assistant" />
        <HBtn icon={ScanLine} label={s.aiBusy ? "Detecting…" : "Detect walls"} tone="aiprimary" disabled={s.aiBusy} spin={s.aiBusy}
          onClick={runDetect} title="Detect walls, runs and regions from the plan's real vector geometry (no vision guessing)" />
      </div>

      <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

      {/* plan cluster */}
      <div className="flex items-center gap-1.5">
        {!projectName && <HBtn icon={RotateCcw} label="Demo" onClick={s.resetDemo} title="Reset to demo plan" show="xl" />}
        <HBtn icon={Upload} label={busy ? "Reading…" : "Upload"} onClick={() => fileRef.current?.click()} disabled={busy} spin={busy}
          title="Upload a PDF or image plan" show="md" />
        <HBtn icon={Download} label="Export" tone="primary" onClick={onExport} title="Export proposal / CSV" show="md" />
      </div>

      <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onFile} />
    </header>
  );
}
