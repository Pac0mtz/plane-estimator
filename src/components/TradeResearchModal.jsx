import { useState, useMemo } from "react";
import { X, Sparkles, Loader2, Search, Layers2, Hammer } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { researchTradeScope } from "../lib/tradeResearch.js";
import { hasKey } from "../lib/aiDetect.js";

const geomLabel = { area: "SF", linear: "LF", count: "EA" };

export default function TradeResearchModal({ onClose, mode = "takeoff" }) {
  const { priceBook, layers, addResearchTrades } = useStore();
  const [query, setQuery] = useState("");
  const [useReasoning, setUseReasoning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);

  const existingAsms = useMemo(() => new Set(layers.map((l) => l.asm)), [layers]);

  const run = async (e) => {
    e?.preventDefault();
    if (!query.trim()) { setError("Enter a scope to research."); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      const res = await researchTradeScope({ query: query.trim(), priceBook, useReasoning });
      setResult(res);
      setSelected(res.trades.length ? 0 : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!result || selected == null) return;
    const trade = result.trades[selected];
    if (!trade) return;
    addResearchTrades([trade], { bookOnly: mode === "pricebook" });
    onClose();
  };

  const title = mode === "pricebook" ? "Research trades & materials" : "Research trades to add";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col text-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 shrink-0">
          <Sparkles size={18} className="text-violet-400" />
          <b className="flex-1">{title}</b>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-4 flex flex-col gap-3 overflow-y-auto min-h-0">
          {!hasKey() && (
            <div className="text-sm text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2">
              Add an OpenAI key in the AI panel first.
            </div>
          )}

          <form onSubmit={run} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. asbestos removal, fireproofing, tenant demo…"
                className="input pl-8 w-full" />
            </div>
            <button type="submit" disabled={busy || !hasKey()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-sm font-medium shrink-0">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              Search
            </button>
          </form>

          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input type="checkbox" checked={useReasoning} onChange={(e) => setUseReasoning(e.target.checked)} className="accent-violet-500" />
            Use reasoning model (slower, more thorough)
          </label>

          {error && <div className="text-sm text-rose-300">{error}</div>}

          {result?.summary && (
            <p className="text-sm text-slate-300 leading-relaxed rounded-lg bg-slate-950 border border-slate-800 p-3">{result.summary}</p>
          )}

          {result?.trades?.length > 0 && (
            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-950 border-b border-slate-800 text-xs font-semibold text-slate-300">
                <Hammer size={13} className="text-violet-400" />
                Related trades & materials
                <span className="ml-auto font-normal text-slate-500">pick one to add</span>
              </div>
              <div className="max-h-[min(420px,50vh)] overflow-y-auto divide-y divide-slate-800">
                {result.trades.map((t, i) => {
                  const on = selected === i;
                  const hasLayer = t.existingAsm && existingAsms.has(t.existingAsm);
                  return (
                    <label key={i} className={`flex gap-3 p-3 cursor-pointer transition-colors ${on ? "bg-violet-950/20" : "bg-slate-900/40 hover:bg-slate-900/70"}`}>
                      <input type="radio" name="research-trade" checked={on} onChange={() => setSelected(i)}
                        className="accent-violet-500 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-100">{t.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{geomLabel[t.geom] || t.unit}</span>
                          {t.existingAsm && <span className="text-[10px] text-emerald-400/80">matches {t.existingAsm}</span>}
                          {hasLayer && <span className="text-[10px] text-amber-400/80">layer exists</span>}
                        </div>
                        {t.scope && <div className="text-[11px] text-slate-500 mt-0.5">{t.scope}</div>}
                        <ul className="mt-2 space-y-1 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                          {t.materials.map((m, mi) => (
                            <li key={mi} className="text-[11px] text-slate-400 flex gap-2">
                              <span className="text-slate-600 shrink-0">·</span>
                              <span className="text-slate-300">{m.name}</span>
                              <span className="text-slate-600 ml-auto shrink-0 tabular-nums">
                                {m.per} {m.u}
                                {(m.cost || m.labor || m.equip) ? ` · $${((m.cost || 0) + (m.labor || 0) + (m.equip || 0)).toFixed(2)}/${m.u}` : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {result && !result.trades?.length && (
            <div className="text-sm text-slate-500">No trades returned — try a different search term.</div>
          )}
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-slate-800 bg-slate-950 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm">Cancel</button>
          <div className="flex-1" />
          {result?.trades?.length > 0 && (
            <button onClick={apply} disabled={selected == null}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand hover:bg-brand2 disabled:opacity-50 text-sm font-medium">
              <Layers2 size={15} /> Add trade
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
