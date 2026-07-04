import { useState } from "react";
import { Eye, EyeOff, Layers, Plus, Sparkles } from "lucide-react";
import { useStore } from "../store/useStore.js";
import TradeResearchModal from "./TradeResearchModal.jsx";

const money = (n) => "$" + Math.round(n).toLocaleString();

export default function LayersPanel({ rollup }) {
  const { activeId, setActive, toggleLayer, addLayer } = useStore();
  const [researchOpen, setResearchOpen] = useState(false);
  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2">
        <Layers size={14} /> TRADE LAYERS
        <button onClick={() => setResearchOpen(true)} title="Research related trades"
          className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-violet-900/50 hover:bg-violet-800/60 text-violet-200">
          <Sparkles size={11} /> Research
        </button>
        <button onClick={() => addLayer()} title="New layer" aria-label="New layer"
          className="ml-auto flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">
          <Plus size={12} /> New
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {rollup.map((r) => (
          <div key={r.layer.id}
            onClick={() => setActive(r.layer.id)}
            role="button" tabIndex={0} aria-pressed={activeId === r.layer.id} aria-label={`${r.layer.name} layer`}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(r.layer.id); } }}
            className={`rounded p-2 cursor-pointer border ${
              activeId === r.layer.id ? "border-brand bg-slate-800" : "border-transparent bg-slate-900 hover:bg-slate-800"
            }`}>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: r.layer.color }} />
              <span className="text-sm font-medium flex-1 truncate">{r.layer.name}</span>
              {r.layer.auto && <span title="Created by AI detect"><Sparkles size={11} className="text-violet-400 shrink-0" /></span>}
              <button onClick={(e) => { e.stopPropagation(); toggleLayer(r.layer.id); }}
                aria-label={r.layer.visible ? `Hide ${r.layer.name}` : `Show ${r.layer.name}`}
                className="text-slate-400 hover:text-white">
                {r.layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
              <span>{r.qty ? r.qty.toFixed(r.asm.unit === "EA" ? 0 : 1) : 0} {r.asm.unit} · {r.count} trace{r.count === 1 ? "" : "s"}</span>
              <span className="font-semibold text-emerald-400">{money(r.cost)}</span>
            </div>
          </div>
        ))}
      </div>
      {researchOpen && <TradeResearchModal mode="takeoff" onClose={() => setResearchOpen(false)} />}
    </div>
  );
}
