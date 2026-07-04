import { Loader2, FileText } from "lucide-react";
import { useStore } from "../store/useStore.js";

const STAGES = [
  { key: "opening", label: "Opening sheet" },
  { key: "rendering", label: "Rendering plan" },
  { key: "encoding", label: "Preparing image" },
  { key: "decoding", label: "Finishing up" },
];

const stageIdx = (key) => {
  const i = STAGES.findIndex((s) => s.key === key);
  return i >= 0 ? i : 0;
};

// Canvas overlay while a PDF sheet is rasterized at full resolution.
export default function SheetLoadOverlay() {
  const load = useStore((s) => s.pageLoad);
  const thumb = useStore((s) => (load ? s.pages[load.page]?.thumb : null));
  if (!load) return null;

  const activeIdx = stageIdx(load.stage);
  const stageLabel = STAGES.find((s) => s.key === load.stage)?.label || "Loading…";

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/75 backdrop-blur-[2px] pointer-events-none">
      {thumb && (
        <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-contain opacity-20 blur-[1px] scale-95" />
      )}
      <div className="relative w-full max-w-xs mx-4 rounded-xl border border-slate-700 bg-slate-900/95 p-5 text-slate-100 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-brand/20 text-brand flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{load.label || "Loading sheet"}</div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Loader2 size={12} className="animate-spin shrink-0" />
              {stageLabel}
            </div>
          </div>
        </div>

        <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-3">
          <div className="h-full bg-brand transition-all duration-150 ease-out" style={{ width: `${load.pct || 0}%` }} />
        </div>
        <div className="text-right text-[11px] text-slate-400 tabular-nums mb-3">{load.pct || 0}%</div>

        <ul className="flex flex-col gap-1">
          {STAGES.map((s, i) => {
            const done = i < activeIdx || load.stage === "done";
            const active = i === activeIdx && load.stage !== "done";
            return (
              <li key={s.key} className={`flex items-center gap-2 text-xs ${done ? "text-emerald-400" : active ? "text-slate-100" : "text-slate-600"}`}>
                {active ? <Loader2 size={12} className="animate-spin shrink-0" /> : (
                  <span className={`w-3 h-3 rounded-full shrink-0 ${done ? "bg-emerald-500" : "bg-slate-700"}`} />
                )}
                {s.label}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
