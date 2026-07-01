import { X, Download } from "lucide-react";
import { buildCsv, download } from "../lib/exportCsv.js";

export default function ExportModal({ rollup, grand, onClose }) {
  const csv = buildCsv(rollup, grand);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-2xl p-4 text-slate-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-2">
          <b>Takeoff export (CSV)</b>
          <div className="flex-1" />
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <textarea readOnly value={csv}
          className="w-full h-64 bg-slate-950 border border-slate-700 rounded p-2 text-[11px] font-mono text-slate-200" />
        <div className="flex items-center gap-2 mt-2">
          <button onClick={() => download("planforge-takeoff.csv", csv)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-brand hover:bg-brand2">
            <Download size={14} /> Download CSV
          </button>
          <span className="text-[11px] text-slate-500">This rollup is the shape that feeds a Minnie Bird proposal line-item table.</span>
        </div>
      </div>
    </div>
  );
}
