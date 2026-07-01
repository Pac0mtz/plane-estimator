import { FileText, Loader2 } from "lucide-react";
import { useStore } from "../store/useStore.js";

const STAGES = [
  { key: "reading", label: "Reading file" },
  { key: "loading", label: "Loading document" },
  { key: "thumbnails", label: "Building page previews" },
  { key: "rendering", label: "Rendering first page" },
];

// Full-screen overlay that shows exactly what the PDF import is doing, stage by
// stage, with a real progress bar driven by pdf.js callbacks.
export default function ImportProgress() {
  const p = useStore((s) => s.importProgress);
  if (!p) return null;

  const activeIdx = STAGES.findIndex((s) => s.key === p.stage);
  const detail =
    p.stage === "thumbnails" && p.total
      ? `page ${p.page} of ${p.total}`
      : p.stage === "loading" && p.total
      ? `${p.pct}%`
      : p.stage === "rendering"
      ? "full resolution"
      : "";

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-brand/20 text-brand flex items-center justify-center">
            <FileText size={20} />
          </div>
          <div>
            <div className="font-semibold">Importing plan set</div>
            <div className="text-xs text-slate-400">This stays in your browser — nothing uploads.</div>
          </div>
        </div>

        <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-4">
          <div className="h-full bg-brand transition-all duration-200"
            style={{ width: `${p.stage === "thumbnails" || p.stage === "loading" ? p.pct : activeIdx >= 3 ? 92 : 40}%` }} />
        </div>

        <ul className="flex flex-col gap-1.5">
          {STAGES.map((s, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <li key={s.key} className={`flex items-center gap-2 text-sm ${done ? "text-emerald-400" : active ? "text-slate-100" : "text-slate-600"}`}>
                {active ? <Loader2 size={14} className="animate-spin" /> : <span className={`w-3.5 h-3.5 rounded-full inline-block ${done ? "bg-emerald-500" : "bg-slate-700"}`} />}
                <span className="flex-1">{s.label}</span>
                {active && detail && <span className="text-xs text-slate-400 tabular-nums">{detail}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
