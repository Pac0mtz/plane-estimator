import { useState, useRef, useMemo } from "react";
import { BookOpen, RotateCcw, Layers, Plus, Trash2, Download, Upload, Search, FileJson, FileSpreadsheet } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { exportPriceBookJson, exportPriceBookCsv, parsePriceBookFile } from "../lib/priceBook.js";

const money2 = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const geomLabel = { area: "SF (area)", linear: "LF (linear)", count: "EA (count)" };

export default function PriceBookPage() {
  const { priceBook, updateMaterial, updateAssembly, addMaterial, removeMaterial, addAssembly, removeAssembly, importPriceBook, resetPriceBook } = useStore();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const fileRef = useRef(null);

  const keys = Object.keys(priceBook);
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return keys;
    return keys.filter((k) => `${priceBook[k].name} ${priceBook[k].materials.map((m) => m.name).join(" ")}`.toLowerCase().includes(n));
  }, [keys, q, priceBook]);

  const onImport = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const obj = await parsePriceBookFile(f);
      if (!importPriceBook(obj)) alert("That file didn't contain a valid price book.");
    } catch (err) {
      alert("Could not import: " + err.message);
    }
  };

  const bookTotalPerUnit = (asm) => asm.materials.reduce((s, m) => s + m.per * (1 + m.waste) * m.cost, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-wrap items-center gap-3 mb-4 max-w-4xl mx-auto w-full">
        <BookOpen className="text-brand" />
        <h1 className="text-xl font-bold">Price book</h1>
        <span className="text-sm text-slate-500 hidden sm:inline">{keys.length} assemblies · NW Ohio material cost</span>
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
            aria-label="Search price book"
            className="pl-8 pr-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand w-40" />
        </div>
        <div className="relative">
          <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded bg-slate-800 hover:bg-slate-700">
            <Download size={15} /> Export
          </button>
          {menu && (
            <div className="absolute right-0 mt-1 z-20 w-40 rounded-lg border border-slate-700 bg-slate-900 shadow-xl p-1" onMouseLeave={() => setMenu(false)}>
              <button onClick={() => { exportPriceBookJson(priceBook); setMenu(false); }} className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-slate-200 hover:bg-slate-800"><FileJson size={15} /> JSON (backup)</button>
              <button onClick={() => { exportPriceBookCsv(priceBook); setMenu(false); }} className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-slate-200 hover:bg-slate-800"><FileSpreadsheet size={15} /> CSV (edit)</button>
            </div>
          )}
        </div>
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded bg-slate-800 hover:bg-slate-700"><Upload size={15} /> Import</button>
        <button onClick={() => confirm("Reset all prices to built-in defaults?") && resetPriceBook()} title="Reset to defaults"
          className="flex items-center gap-1.5 text-sm px-2.5 py-2 rounded bg-slate-800 hover:bg-slate-700" aria-label="Reset to defaults"><RotateCcw size={15} /></button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
      </div>

      <div className="max-w-4xl mx-auto w-full flex flex-col gap-4">
        {filtered.map((k) => {
          const asm = priceBook[k];
          return (
            <div key={k} className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50">
                <Layers size={15} className="text-brand shrink-0" />
                <input value={asm.name} onChange={(e) => updateAssembly(k, { name: e.target.value })}
                  aria-label="Assembly name"
                  className="font-semibold bg-transparent focus:outline-none focus:bg-slate-950 rounded px-1 py-0.5 min-w-0 flex-1" />
                <select value={asm.geom} onChange={(e) => updateAssembly(k, { geom: e.target.value, unit: e.target.value === "linear" ? "LF" : e.target.value === "count" ? "EA" : "SF" })}
                  aria-label="Measurement type"
                  className="text-xs bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-300">
                  {Object.entries(geomLabel).map(([g, l]) => <option key={g} value={g}>{l}</option>)}
                </select>
                <span className="text-xs text-slate-400 hidden sm:inline">≈ <b className="text-emerald-400">{money2(bookTotalPerUnit(asm))}</b>/{asm.unit}</span>
                <button onClick={() => confirm(`Delete assembly “${asm.name}”?`) && removeAssembly(k)} aria-label="Delete assembly"
                  className="p-1.5 rounded hover:bg-rose-900/60 text-slate-500 hover:text-rose-300"><Trash2 size={14} /></button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-slate-500 border-b border-slate-800">
                    <th className="text-left font-medium px-4 py-1.5">Material</th>
                    <th className="text-right font-medium px-2 py-1.5 w-20">Per unit</th>
                    <th className="text-right font-medium px-2 py-1.5 w-20">Waste %</th>
                    <th className="text-right font-medium px-4 py-1.5 w-28">Unit cost</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {asm.materials.map((m, i) => (
                    <tr key={i} className="border-b border-slate-800/60 last:border-0 group">
                      <td className="px-4 py-1.5">
                        <input value={m.name} onChange={(e) => updateMaterial(k, i, { name: e.target.value })} aria-label="Material name"
                          className="w-full bg-transparent text-slate-200 focus:outline-none focus:bg-slate-950 rounded px-1 py-0.5" />
                      </td>
                      <td className="px-2 py-1.5"><NumCell value={m.per} step="0.05" onChange={(v) => updateMaterial(k, i, { per: v })} /></td>
                      <td className="px-2 py-1.5"><NumCell value={Math.round(m.waste * 100)} step="1" suffix="%" onChange={(v) => updateMaterial(k, i, { waste: v / 100 })} /></td>
                      <td className="px-4 py-1.5"><NumCell value={m.cost} step="0.01" prefix="$" onChange={(v) => updateMaterial(k, i, { cost: v })} /></td>
                      <td className="px-1">
                        <button onClick={() => removeMaterial(k, i)} aria-label="Delete material"
                          className="p-1 rounded text-slate-600 hover:text-rose-300 hover:bg-rose-900/40 opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => addMaterial(k)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-4 py-2 hover:bg-slate-800/50 w-full">
                <Plus size={13} /> Add material
              </button>
            </div>
          );
        })}

        <button onClick={addAssembly} className="flex items-center justify-center gap-1.5 text-sm text-slate-300 border border-dashed border-slate-700 rounded-lg py-3 hover:border-brand hover:text-brand">
          <Plus size={16} /> Add assembly
        </button>
        <p className="text-xs text-slate-500">Edits save automatically and reprice every project instantly. Export JSON to back up or share your book; import to load one (e.g. your 481-item book). CSV round-trips through a spreadsheet.</p>
      </div>
    </div>
  );
}

function NumCell({ value, onChange, step = "1", prefix = "", suffix = "" }) {
  return (
    <div className="flex items-center gap-0.5 justify-end">
      {prefix && <span className="text-slate-500">{prefix}</span>}
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-16 bg-transparent text-right text-slate-200 tabular-nums focus:outline-none focus:bg-slate-950 rounded px-1 py-0.5" />
      {suffix && <span className="text-slate-500">{suffix}</span>}
    </div>
  );
}
