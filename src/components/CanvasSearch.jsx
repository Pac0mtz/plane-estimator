import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { centroid } from "../lib/geometry.js";

const ctrOf = (o) => (o.type === "count" ? o.pts[0] : centroid(o.pts));

// Search the current sheet's detections + traces and jump/zoom to a match so
// the estimator can confirm where a number comes from on the plan.
export default function CanvasSearch({ traces, suggestions, layerName, qtyText, onLocate }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const t = traces.map((o) => ({ id: o.id, label: layerName(o.layer), sub: qtyText(o), tag: "trace", pt: ctrOf(o) }));
    const s = suggestions.map((o) => ({ id: o.id, label: o.element || o.layerName, sub: `${o.layerName} · ${qtyText(o)}`, tag: "AI", pt: ctrOf(o) }));
    return [...s, ...t];
  }, [traces, suggestions, layerName, qtyText]);

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return items.filter((i) => `${i.label} ${i.sub}`.toLowerCase().includes(n)).slice(0, 8);
  }, [items, q]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Search the plan"
        className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 h-8 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 shadow-lg">
        <Search size={13} /> Search plan
      </button>
    );
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-72">
      <div className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg bg-slate-900/95 border border-slate-700 shadow-xl">
        <Search size={14} className="text-slate-500" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a wall, door, area…"
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none" />
        <button onClick={() => { setOpen(false); setQ(""); }} aria-label="Close search" className="text-slate-500 hover:text-slate-200"><X size={14} /></button>
      </div>
      {results.length > 0 && (
        <div className="mt-1 rounded-lg bg-slate-900/95 border border-slate-700 shadow-xl overflow-hidden">
          {results.map((r) => (
            <button key={r.tag + r.id} onClick={() => onLocate(r.pt)}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-slate-800">
              <span className={`text-[9px] px-1 rounded ${r.tag === "AI" ? "bg-violet-900/60 text-violet-200" : "bg-slate-800 text-slate-400"}`}>{r.tag}</span>
              <span className="text-xs text-slate-200 flex-1 truncate">{r.label}</span>
              <span className="text-[10px] text-slate-500">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
      {q && results.length === 0 && <div className="mt-1 px-3 py-2 text-xs text-slate-500 bg-slate-900/95 border border-slate-700 rounded-lg">No matches on this sheet.</div>}
    </div>
  );
}
