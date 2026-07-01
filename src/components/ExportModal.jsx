import { X, Download, FileText, FileSpreadsheet } from "lucide-react";
import { buildCsv, download } from "../lib/exportCsv.js";
import { exportProposalPdf } from "../lib/exportPdf.js";
import { useStore } from "../store/useStore.js";

export default function ExportModal({ rollup, grand, onClose }) {
  const csv = buildCsv(rollup, grand);
  const project = useStore((s) => s.activeProject());
  const client = useStore((s) => s.clientOf(project));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-2xl p-4 text-slate-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-3">
          <b>Export takeoff</b>
          <div className="flex-1" />
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex gap-2 mb-3">
          <button onClick={() => exportProposalPdf({ rollup, grand, project, client })}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded bg-brand hover:bg-brand2 font-medium">
            <FileText size={16} /> Download proposal PDF
          </button>
          <button onClick={() => download("planforge-takeoff.csv", csv)}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded bg-slate-800 hover:bg-slate-700">
            <FileSpreadsheet size={16} /> Download CSV
          </button>
        </div>

        <div className="text-[11px] text-slate-500 mb-1">CSV preview — feeds a Bid Studio line-item table:</div>
        <textarea readOnly value={csv}
          className="w-full h-56 bg-slate-950 border border-slate-700 rounded p-2 text-[11px] font-mono text-slate-200" />
      </div>
    </div>
  );
}
