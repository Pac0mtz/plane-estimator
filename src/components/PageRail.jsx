import { useStore } from "../store/useStore.js";
import { renderPage } from "../lib/pdf.js";
import { maybeAutoScale } from "../lib/importPlan.js";
import { useState, useMemo } from "react";
import { Loader2, Search, Trash2 } from "lucide-react";

// Sheet-index navigator for multi-page plan sets. Searchable, filterable by
// discipline, lazily renders full-res pages on demand. Scales to 100+ sheets.
export default function PageRail() {
  const { pages, activePage, setPage, setPageImage, removePage } = useStore();
  const [loading, setLoading] = useState(null);
  const [q, setQ] = useState("");
  const [disc, setDisc] = useState("all");

  const disciplines = useMemo(() => {
    const seen = new Map();
    pages.forEach((p) => { if (p.discipline) seen.set(p.discipline.code, p.discipline); });
    return [...seen.values()];
  }, [pages]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pages
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => disc === "all" || p.discipline?.code === disc)
      .filter(({ p, i }) =>
        !needle ||
        `${p.sheetNo || ""} ${p.title || ""}`.toLowerCase().includes(needle) ||
        (p.text || "").toLowerCase().includes(needle) ||
        `sheet ${i + 1}`.includes(needle)
      );
  }, [pages, q, disc]);

  if (pages.length <= 1) return null;

  const go = async (i) => {
    setPage(i);
    if (!pages[i].loaded) {
      setLoading(i);
      try { setPageImage(i, await renderPage(i)); maybeAutoScale(); } catch { /* leave blank */ }
      finally { setLoading(null); }
    } else {
      maybeAutoScale();
    }
  };

  return (
    <div className="w-56 shrink-0 border-r border-slate-800 bg-slate-950 flex flex-col">
      <div className="p-2 border-b border-slate-800">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Sheets · {pages.length}</span>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2 top-1.5 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sheets…"
            className="w-full pl-7 pr-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand" />
        </div>
        {disciplines.length > 1 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            <Chip on={disc === "all"} onClick={() => setDisc("all")}>All</Chip>
            {disciplines.map((d) => (
              <Chip key={d.code} on={disc === d.code} color={d.color} onClick={() => setDisc(d.code)}>{d.code}</Chip>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1">
        {filtered.map(({ p, i }) => (
          <div key={i} className={`group relative flex items-center gap-2 rounded p-1.5 ${i === activePage ? "bg-slate-800 ring-1 ring-brand" : "hover:bg-slate-900"}`}>
            <button onClick={() => go(i)} className="flex items-center gap-2 text-left flex-1 min-w-0">
              <div className="relative w-12 shrink-0 rounded border border-slate-700 overflow-hidden">
                {p.thumb ? <img src={p.thumb} alt="" className="w-full block bg-white" /> : <div className="w-full h-9 bg-slate-800" />}
                {loading === i && <span className="absolute inset-0 flex items-center justify-center bg-slate-900/60"><Loader2 size={12} className="animate-spin text-brand" /></span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  {p.discipline && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.discipline.color }} />}
                  <span className="text-xs font-medium text-slate-200 truncate">{p.sheetNo || `Sheet ${i + 1}`}</span>
                </div>
                {p.title && <div className="text-[10px] text-slate-500 truncate leading-tight">{p.title}</div>}
              </div>
            </button>
            {pages.length > 1 && (
              <button onClick={() => { if (confirm(`Remove sheet ${p.sheetNo || i + 1} from this set?`)) removePage(i); }}
                aria-label={`Delete sheet ${p.sheetNo || i + 1}`} title="Remove sheet"
                className="p-1 rounded text-slate-600 hover:text-rose-300 hover:bg-rose-900/40 opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div className="text-[11px] text-slate-600 p-3 text-center">No sheets match.</div>}
      </div>
    </div>
  );
}

function Chip({ on, color, children, onClick }) {
  return (
    <button onClick={onClick}
      className={`text-[10px] px-1.5 py-0.5 rounded ${on ? "bg-brand text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
      style={on && color ? { background: color, color: "#0a1420" } : undefined}>
      {children}
    </button>
  );
}
