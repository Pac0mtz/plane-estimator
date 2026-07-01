import { useMemo } from "react";
import { Trash2, SlidersHorizontal } from "lucide-react";
import { useStore, PALETTE } from "../store/useStore.js";

const money = (n) => "$" + Math.round(n).toLocaleString();
const geomLabel = { area: "Area (SF)", linear: "Linear (LF)", count: "Count (EA)" };

// Properties panel for the active layer — edit name, colour, and assembly, and
// see its live quantity + cost. Detected walls each get their own colour here.
export default function LayerDetails({ rollup }) {
  const { activeId, layers, priceBook, updateLayer, removeLayer } = useStore();
  const layer = layers.find((l) => l.id === activeId);
  const r = rollup.find((x) => x.layer.id === activeId);

  // assembly options grouped by CSI division
  const groups = useMemo(() => {
    const g = {};
    Object.entries(priceBook).forEach(([k, a]) => { const d = a.div || "Other"; (g[d] = g[d] || []).push([k, a]); });
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [priceBook]);

  if (!layer) return null;
  const asmDef = priceBook[layer.asm];

  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-1.5">
        <SlidersHorizontal size={13} /> LAYER DETAILS
        {layer.auto && <span className="text-[9px] px-1 rounded bg-violet-900/50 text-violet-200">AI</span>}
      </div>
      <div className="rounded bg-slate-900 border border-slate-800 p-2.5 flex flex-col gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500">Name</span>
          <input value={layer.name} onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
            aria-label="Layer name"
            className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-brand" />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500">Color</span>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((c) => (
              <button key={c} onClick={() => updateLayer(layer.id, { color: c })} aria-label={`Set color ${c}`}
                className={`w-5 h-5 rounded ${layer.color === c ? "ring-2 ring-white ring-offset-1 ring-offset-slate-900" : ""}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500">Assembly</span>
          <select value={layer.asm} onChange={(e) => updateLayer(layer.id, { asm: e.target.value })}
            aria-label="Layer assembly"
            className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-brand">
            {groups.map(([div, items]) => (
              <optgroup key={div} label={div}>
                {items.map(([k, a]) => <option key={k} value={k}>{a.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <Stat label="Type" value={asmDef ? geomLabel[asmDef.geom].split(" ")[0] : "—"} />
          <Stat label="Quantity" value={r ? `${(r.qty || 0).toFixed(asmDef?.unit === "EA" ? 0 : 1)} ${asmDef?.unit || ""}` : "—"} />
          <Stat label="Cost" value={r ? money(r.cost) : "$0"} accent />
        </div>

        <button onClick={() => confirm(`Delete layer “${layer.name}” and its traces?`) && removeLayer(layer.id)}
          className="flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200">
          <Trash2 size={12} /> Delete layer
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-xs font-semibold ${accent ? "text-emerald-400" : "text-slate-200"}`}>{value}</div>
    </div>
  );
}
