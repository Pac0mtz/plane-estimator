import { Upload, FileText, RotateCcw, Loader2, Sparkles, Ruler } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { useRef, useState } from "react";
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

export default function Header({ onExport, assistantOpen, onToggleAssistant, hideProjectInfo = false }) {
  const s = useStore();
  const { ppf } = s;
  const project = s.activeProject();
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

  return (
    <div
      role="toolbar"
      aria-label="Takeoff tools"
      className="takeoff-header flex items-center gap-2 px-3 h-12 min-h-12 border-b border-slate-800 bg-slate-950 text-slate-100 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-2 min-w-0">
        {!hideProjectInfo && project?.name ? (
          <span className="font-semibold tracking-tight truncate max-w-[88px] sm:max-w-[180px]">{project.name}</span>
        ) : (
          <span className="font-semibold tracking-tight text-slate-200 shrink-0">Takeoff</span>
        )}
        <span className="flex items-center gap-1 text-[10px] sm:text-[11px] px-1.5 sm:px-2 h-5 sm:h-6 rounded bg-slate-800 text-slate-300 shrink-0 tabular-nums">
          {s.scaleReading ? (
            <>
              <Loader2 size={11} className="animate-spin text-violet-400 shrink-0" />
              <span className="text-violet-300 hidden sm:inline">reading scale…</span>
            </>
          ) : (
            <>
              <Ruler size={11} className="text-slate-500 shrink-0 hidden sm:block" />
              {ppf ? <b className="text-emerald-400">{ppf.toFixed(1)} px/ft</b> : <b className="text-amber-400">not set</b>}
            </>
          )}
        </span>
        {dpi && <span className="hidden md:inline text-[11px] px-2 h-6 leading-6 rounded bg-slate-800 text-slate-400 shrink-0"><b className="text-slate-200">{dpi}</b> dpi</span>}
      </div>

      <div className="flex-1" />

      {/* AI cluster — the assistant reads schedules/trades (reliable). Takeoff
          is done with Read dimensions + Measure wall in the toolbar. */}
      <div className="flex items-center gap-1.5">
        <HBtn icon={Sparkles} label="AI" tone="violet" on={assistantOpen} onClick={onToggleAssistant}
          title="AI plan assistant — summarize sheets, list trades, read schedules" show="sm" />
      </div>

      <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

      {/* plan cluster */}
      <div className="flex items-center gap-1.5">
        {!s.activeProjectId && s.bg.type === "demo" && <HBtn icon={RotateCcw} label="Demo" onClick={s.resetDemo} title="Load demo plan" show="xl" />}
        <HBtn icon={Upload} label={busy ? "Reading…" : "Upload"} onClick={() => fileRef.current?.click()} disabled={busy} spin={busy}
          title="Upload a PDF or image plan" show="sm" />
        <HBtn icon={FileText} label="Proposal" tone="primary" onClick={onExport} title="Generate proposal PDF or CSV" show="sm" />
      </div>

      <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onFile} />
    </div>
  );
}
