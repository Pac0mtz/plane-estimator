import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { centroid } from "../lib/geometry.js";

const ctrOf = (o) => (o.type === "count" ? o.pts[0] : centroid(o.pts));

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
      <button
        onClick={() => setOpen(true)}
        aria-label="Search the plan"
        className="canvas-search-pill absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 h-9 rounded-full bg-slate-950/90 border border-slate-700/60 text-slate-300 text-xs hover:bg-slate-900 hover:border-slate-600 hover:text-slate-100 shadow-lg shadow-black/20 backdrop-blur-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
      >
        <Search size={14} className="text-slate-500" />
        <span>Search plan</span>
        <kbd className="hidden lg:inline text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700/50">/</kbd>
      </button>
    );
  }

  return (
    <div className="canvas-search-pill absolute top-4 left-1/2 -translate-x-1/2 z-30 w-80 max-w-[calc(100%-2rem)]">
      <div className="flex items-center gap-2 px-3 h-10 rounded-xl bg-slate-950/95 border border-brand/30 shadow-xl shadow-black/30 backdrop-blur-md ring-1 ring-brand/10">
        <Search size={15} className="text-brand shrink-0" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a wall, door, area…"
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none min-w-0"
        />
        <button onClick={() => { setOpen(false); setQ(""); }} aria-label="Close search" className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors">
          <X size={15} />
        </button>
      </div>
      {results.length > 0 && (
        <div className="mt-1.5 rounded-xl bg-slate-950/95 border border-slate-700/60 shadow-xl overflow-hidden backdrop-blur-md animate-[takeoff-scale-in_0.2s_ease-out_both]">
          {results.map((r, i) => (
            <button
              key={r.tag + r.id}
              onClick={() => onLocate(r.pt)}
              style={{ animationDelay: `${i * 30}ms` }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-slate-800/80 transition-colors border-b border-slate-800/50 last:border-0"
            >
              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${r.tag === "AI" ? "bg-violet-900/50 text-violet-200" : "bg-slate-800 text-slate-400"}`}>{r.tag}</span>
              <span className="text-xs text-slate-200 flex-1 truncate font-medium">{r.label}</span>
              <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
      {q && results.length === 0 && (
        <div className="mt-1.5 px-3 py-2.5 text-xs text-slate-500 bg-slate-950/95 border border-slate-700/60 rounded-xl backdrop-blur-md">
          No matches on this sheet.
        </div>
      )}
    </div>
  );
}
