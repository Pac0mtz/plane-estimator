import { BookOpen, RotateCcw, Layers } from "lucide-react";
import { useStore } from "../store/useStore.js";

const money2 = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const geomLabel = { area: "SF (area)", linear: "LF (linear)", count: "EA (count)" };

// Editable assembly + material catalog. Edits flow straight into the pricing
// engine via the store's priceBook. Swap in the full 481-item book here.
export default function PriceBookPage() {
  const { priceBook, updateMaterial, resetPriceBook } = useStore();
  const keys = Object.keys(priceBook);

  const bookTotalPerUnit = (asm) => asm.materials.reduce((s, m) => s + m.per * (1 + m.waste) * m.cost, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center gap-3 mb-5 max-w-4xl mx-auto w-full">
        <BookOpen className="text-brand" />
        <h1 className="text-xl font-bold">Price book</h1>
        <span className="text-sm text-slate-500">{keys.length} assemblies · NW Ohio material cost</span>
        <div className="flex-1" />
        <button onClick={() => confirm("Reset all prices to built-in defaults?") && resetPriceBook()}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded bg-slate-800 hover:bg-slate-700">
          <RotateCcw size={15} /> Reset defaults
        </button>
      </div>

      <div className="max-w-4xl mx-auto w-full flex flex-col gap-4">
        {keys.map((k) => {
          const asm = priceBook[k];
          return (
            <div key={k} className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50">
                <Layers size={15} className="text-brand" />
                <span className="font-semibold">{asm.name}</span>
                <span className="text-xs text-slate-500">{geomLabel[asm.geom]}</span>
                <div className="flex-1" />
                <span className="text-xs text-slate-400">≈ <b className="text-emerald-400">{money2(bookTotalPerUnit(asm))}</b> / {asm.unit}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-slate-500 border-b border-slate-800">
                    <th className="text-left font-medium px-4 py-1.5">Material</th>
                    <th className="text-right font-medium px-2 py-1.5 w-20">Per unit</th>
                    <th className="text-right font-medium px-2 py-1.5 w-20">Waste %</th>
                    <th className="text-right font-medium px-4 py-1.5 w-28">Unit cost</th>
                  </tr>
                </thead>
                <tbody>
                  {asm.materials.map((m, i) => (
                    <tr key={i} className="border-b border-slate-800/60 last:border-0">
                      <td className="px-4 py-1.5">
                        <input value={m.name} onChange={(e) => updateMaterial(k, i, { name: e.target.value })}
                          className="w-full bg-transparent text-slate-200 focus:outline-none focus:bg-slate-950 rounded px-1 py-0.5" />
                      </td>
                      <td className="px-2 py-1.5">
                        <NumCell value={m.per} step="0.05" onChange={(v) => updateMaterial(k, i, { per: v })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <NumCell value={Math.round(m.waste * 100)} step="1" suffix="%" onChange={(v) => updateMaterial(k, i, { waste: v / 100 })} />
                      </td>
                      <td className="px-4 py-1.5">
                        <NumCell value={m.cost} step="0.01" prefix="$" onChange={(v) => updateMaterial(k, i, { cost: v })} align="right" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        <p className="text-xs text-slate-500">Edits save automatically and reprice every project instantly. Reset restores the built-in NW-Ohio defaults.</p>
      </div>
    </div>
  );
}

function NumCell({ value, onChange, step = "1", prefix = "", suffix = "", align = "right" }) {
  return (
    <div className={`flex items-center gap-0.5 ${align === "right" ? "justify-end" : ""}`}>
      {prefix && <span className="text-slate-500">{prefix}</span>}
      <input type="number" step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-16 bg-transparent text-right text-slate-200 tabular-nums focus:outline-none focus:bg-slate-950 rounded px-1 py-0.5" />
      {suffix && <span className="text-slate-500">{suffix}</span>}
    </div>
  );
}
