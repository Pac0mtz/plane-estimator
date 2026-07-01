import { useState, useMemo } from "react";
import { X, FileText, FileSpreadsheet } from "lucide-react";
import { buildCsv, download } from "../lib/exportCsv.js";
import { exportProposalPdf } from "../lib/exportPdf.js";
import { useStore } from "../store/useStore.js";

const money = (n) => "$" + Math.round(n).toLocaleString();

// Proposal generator: pick which trades to include, add a title / prepared-by /
// notes, preview the total, then generate a branded PDF (or CSV).
export default function ExportModal({ rollup, grand, onClose }) {
  const project = useStore((s) => s.activeProject());
  const client = useStore((s) => s.clientOf(project));

  const priced = rollup.filter((r) => r.qty > 0);
  const [included, setIncluded] = useState(() => new Set(priced.map((r) => r.layer.id)));
  const [title, setTitle] = useState(`${project?.name || "Project"} — Material Proposal`);
  const [preparedBy, setPreparedBy] = useState("Dovinos Bid Studio");
  const [notes, setNotes] = useState("Material, labor and equipment estimate; excludes permits, bonds, and taxes unless noted. Valid 30 days.");

  const toggle = (id) => setIncluded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selected = useMemo(() => priced.filter((r) => included.has(r.layer.id)), [priced, included]);
  const total = selected.reduce((s, r) => s + r.cost, 0);
  const csv = useMemo(() => buildCsv(selected, total), [selected, total]);

  const genPdf = () => exportProposalPdf({ rollup: selected, grand: total, project, client, title, preparedBy, notes });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-2xl p-4 text-slate-100 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-3">
          <b>Generate proposal</b>
          <div className="flex-1" />
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <label className="flex flex-col gap-1 sm:col-span-2"><span className="text-xs text-slate-400">Proposal title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-slate-400">Prepared by</span>
            <input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} className="input" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-slate-400">Client</span>
            <input value={client?.name || "—"} readOnly className="input opacity-70" /></label>
        </div>

        <div className="text-xs text-slate-400 mb-1">Line items to include</div>
        <div className="rounded border border-slate-800 divide-y divide-slate-800 mb-3">
          {priced.length === 0 && <div className="p-2.5 text-[11px] text-slate-500">No priced trades yet — trace some areas first.</div>}
          {priced.map((r) => (
            <label key={r.layer.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer">
              <input type="checkbox" checked={included.has(r.layer.id)} onChange={() => toggle(r.layer.id)} className="accent-brand" />
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: r.layer.color }} />
              <span className="flex-1">{r.layer.name} <span className="text-slate-500">· {r.qty.toFixed(r.asm.unit === "EA" ? 0 : 1)} {r.asm.unit}</span></span>
              <span className="text-emerald-400 font-medium">{money(r.cost)}</span>
            </label>
          ))}
        </div>

        <label className="flex flex-col gap-1 mb-3"><span className="text-xs text-slate-400">Notes & terms</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input resize-y" /></label>

        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-400">Proposal total <b className="text-emerald-400 text-lg ml-1">{money(total)}</b></div>
          <div className="flex-1" />
          <button onClick={() => download("planforge-takeoff.csv", csv)} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded bg-slate-800 hover:bg-slate-700"><FileSpreadsheet size={15} /> CSV</button>
          <button onClick={genPdf} disabled={selected.length === 0} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded bg-brand hover:bg-brand2 font-medium disabled:opacity-50"><FileText size={15} /> Generate proposal PDF</button>
        </div>
      </div>
    </div>
  );
}
