import { Upload, FileText, RotateCcw, Loader2, Sparkles, Ruler } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { useRef, useState } from "react";
import { importPlanFile, ACCEPT } from "../lib/importPlan.js";

// One header button. Label collapses to icon-only below `show` breakpoint.
function HBtn({ icon: Icon, label, onClick, disabled, tone = "ghost", on, show = "lg", title, spin }) {
  const tones = {
    ghost: "bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/40",
    primary: "bg-brand hover:bg-brand2 text-white shadow-sm shadow-brand/20 border border-brand/30",
    violet: on ? "bg-violet-600 text-white border border-violet-500/50 header-ai-on" : "bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/40",
    aiprimary: "bg-violet-600 hover:bg-violet-500 text-white",
  };
  return (
    <button onClick={onClick} disabled={disabled} title={title || label}
      className={`flex items-center gap-1.5 h-8 lg:h-9 px-2.5 lg:px-3.5 rounded-lg text-xs lg:text-[13px] font-medium disabled:opacity-50 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] ${tones[tone]}`}>
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
      className="takeoff-header takeoff-chrome flex items-center gap-2 px-3 lg:px-5 h-12 lg:h-14 min-h-12 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md text-slate-100 shrink-0 sticky top-0 z-30 max-md:overflow-x-auto max-md:scrollbar-none shadow-sm shadow-black/10">
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        {!hideProjectInfo && project?.name ? (
          <span className="font-semibold tracking-tight truncate max-w-[120px] sm:max-w-[220px] lg:max-w-[320px] text-sm lg:text-[15px]">{project.name}</span>
        ) : (
          <span className="font-semibold tracking-tight text-slate-200 shrink-0 text-sm lg:text-[15px]">Takeoff</span>
        )}
        <span className={`flex items-center gap-1.5 text-[11px] px-2.5 h-6 lg:h-7 rounded-lg shrink-0 tabular-nums border transition-colors ${
          s.scaleReading ? "bg-violet-950/50 text-violet-300 border-violet-800/50" :
          ppf ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/40" :
          "bg-amber-950/40 text-amber-300 border-amber-800/40"
        }`}>
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
        {dpi && <span className="hidden lg:inline text-[11px] px-2.5 h-7 leading-7 rounded-md bg-slate-800/90 text-slate-400 shrink-0 border border-slate-700/50"><b className="text-slate-200">{dpi}</b> dpi</span>}
      </div>

      <div className="flex-1" />

      {/* AI cluster — the assistant reads schedules/trades (reliable). Takeoff
          is done with Read dimensions + Measure wall in the toolbar. */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <HBtn icon={Sparkles} label="AI" tone="violet" on={assistantOpen} onClick={onToggleAssistant}
          title="AI plan assistant — summarize sheets, list trades, read schedules" show="sm" />
      </div>

      <div className="h-5 w-px bg-slate-800 mx-0.5 hidden sm:block shrink-0" />

      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {!s.activeProjectId && s.bg.type === "demo" && <HBtn icon={RotateCcw} label="Demo" onClick={s.resetDemo} title="Load demo plan" show="xl" />}
        <HBtn icon={Upload} label={busy ? "Reading…" : "Upload"} onClick={() => fileRef.current?.click()} disabled={busy} spin={busy}
          title="Upload a PDF or image plan" show="sm" />
        <HBtn icon={FileText} label="Proposal" tone="primary" onClick={onExport} title="Generate proposal PDF or CSV" show="sm" />
      </div>

      <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onFile} />
    </div>
  );
}
