import { useState, useRef, useMemo, useEffect } from "react";
import { BookOpen, RotateCcw, Layers, Plus, Trash2, Download, Upload, Search, FileJson, FileSpreadsheet, SlidersHorizontal, Sparkles, MapPin, X, ChevronDown, ChevronRight } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { unitBare, DEFAULT_BOOK_META } from "../lib/assemblies.js";
import { exportPriceBookJson, exportPriceBookCsv, parsePriceBookFile } from "../lib/priceBook.js";
import PriceResearchModal from "./PriceResearchModal.jsx";
import TradeResearchModal from "./TradeResearchModal.jsx";

const money2 = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const geomLabel = { area: "SF (area)", linear: "LF (linear)", count: "EA (count)" };

export default function PriceBookPage() {
  const {
    priceBook, bookMeta, setBookMeta, updateMaterial, updateAssembly, addMaterial, removeMaterial,
    addAssembly, removeAssembly, importPriceBook, resetPriceBook,
    locations, activeLocationId, setActiveLocation, addLocation, updateActiveLocation, removeLocation,
  } = useStore();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [tradeResearchOpen, setTradeResearchOpen] = useState(false);
  const [addLocOpen, setAddLocOpen] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [expandedDiv, setExpandedDiv] = useState(null); // one CSI division open at a time
  const fileRef = useRef(null);
  const activeLoc = locations?.find((l) => l.id === activeLocationId) || locations?.[0];
  const overheadPct = bookMeta?.overheadPct ?? DEFAULT_BOOK_META.overheadPct;
  const profitPct = bookMeta?.profitPct ?? DEFAULT_BOOK_META.profitPct;
  const locFactor = activeLoc?.locationFactor ?? DEFAULT_BOOK_META.locationFactor;

  const keys = Object.keys(priceBook);
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return keys.filter((k) => !n || `${priceBook[k].name} ${priceBook[k].div || ""} ${priceBook[k].materials.map((m) => m.name).join(" ")}`.toLowerCase().includes(n));
  }, [keys, q, priceBook]);

  // group by CSI division for organization
  const groups = useMemo(() => {
    const g = {};
    filtered.forEach((k) => { const d = priceBook[k].div || "Other"; (g[d] = g[d] || []).push(k); });
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, priceBook]);

  // When searching, open the first matching division only.
  useEffect(() => {
    if (q.trim() && groups.length) setExpandedDiv(groups[0][0]);
    else if (!q.trim()) setExpandedDiv(null);
  }, [q, groups]);

  const toggleDiv = (div) => setExpandedDiv((cur) => (cur === div ? null : div));

  const onImport = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { const obj = await parsePriceBookFile(f); if (!importPriceBook(obj)) alert("That file didn't contain a valid price book."); }
    catch (err) { alert("Could not import: " + err.message); }
  };

  const num = (v) => (parseFloat(v) || 0);

  const submitNewLocation = (e) => {
    e?.preventDefault();
    const name = newLocName.trim();
    if (!name) return;
    addLocation(name);
    setNewLocName("");
    setAddLocOpen(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4 max-w-4xl mx-auto w-full">
        <BookOpen className="text-brand shrink-0" />
        <h1 className="text-lg md:text-xl font-bold">Price book</h1>
        <span className="text-sm text-slate-500 hidden md:inline">{keys.length} assemblies · material + labor + equipment</span>
        <div className="flex-1 min-w-[1rem]" />
        <div className="relative w-full sm:w-auto order-last sm:order-none">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search price book"
            className="w-full sm:w-36 pl-8 pr-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
        <div className="relative">
          <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded bg-slate-800 hover:bg-slate-700"><Download size={15} /> Export</button>
          {menu && (
            <div className="absolute right-0 mt-1 z-20 w-40 rounded-lg border border-slate-700 bg-slate-900 shadow-xl p-1" onMouseLeave={() => setMenu(false)}>
              <button onClick={() => { exportPriceBookJson(priceBook); setMenu(false); }} className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-slate-200 hover:bg-slate-800"><FileJson size={15} /> JSON (backup)</button>
              <button onClick={() => { exportPriceBookCsv(priceBook); setMenu(false); }} className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-slate-200 hover:bg-slate-800"><FileSpreadsheet size={15} /> CSV (edit)</button>
            </div>
          )}
        </div>
        <button onClick={() => setTradeResearchOpen(true)} className="flex items-center gap-1.5 text-sm px-2.5 md:px-3 py-2 rounded bg-violet-950 border border-violet-800/60 hover:bg-violet-900 text-violet-100"><Sparkles size={15} /> <span className="hidden sm:inline">Find trades</span><span className="sm:hidden">Trades</span></button>
        <button onClick={() => setResearchOpen(true)} className="flex items-center gap-1.5 text-sm px-2.5 md:px-3 py-2 rounded bg-violet-800/80 hover:bg-violet-700 text-violet-100"><Sparkles size={15} /> <span className="hidden sm:inline">Update prices</span><span className="sm:hidden">Prices</span></button>
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-sm px-2.5 md:px-3 py-2 rounded bg-slate-800 hover:bg-slate-700"><Upload size={15} /> Import</button>
        <button onClick={() => confirm("Reset all prices to built-in defaults?") && resetPriceBook()} title="Reset to defaults" aria-label="Reset to defaults" className="flex items-center gap-1.5 text-sm px-2.5 py-2 rounded bg-slate-800 hover:bg-slate-700"><RotateCcw size={15} /></button>
        <input ref={fileRef} type="file" accept="application/json,.json,text/csv,.csv" className="hidden" onChange={onImport} />
        </div>
      </div>

      {/* location tabs — each saved market has its own price book */}
      <div className="max-w-4xl mx-auto w-full mb-3 flex flex-wrap items-center gap-1.5">
        {(locations || []).map((loc) => (
          <button key={loc.id} onClick={() => setActiveLocation(loc.id)}
            className={`group flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              loc.id === activeLocationId
                ? "bg-brand/15 border-brand text-brand font-semibold"
                : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200"
            }`}>
            <MapPin size={11} />
            <span>{loc.name}</span>
            <span className="text-[10px] opacity-70 tabular-nums">×{(loc.locationFactor ?? 1).toFixed(2)}</span>
            {(locations || []).length > 1 && (
              <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); if (confirm(`Delete location “${loc.name}”?`)) removeLocation(loc.id); }}
                onKeyDown={(e) => e.key === "Enter" && e.stopPropagation()}
                className="ml-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-rose-900/50 hover:text-rose-300">
                <X size={10} />
              </span>
            )}
          </button>
        ))}
        {addLocOpen ? (
          <form onSubmit={submitNewLocation} className="flex items-center gap-1.5 pl-1">
            <input
              autoFocus
              value={newLocName}
              onChange={(e) => setNewLocName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && (setAddLocOpen(false), setNewLocName(""))}
              placeholder="City / market"
              aria-label="New location name"
              className="text-xs px-2.5 py-1.5 rounded-full bg-slate-950 border border-brand text-slate-100 placeholder:text-slate-600 focus:outline-none w-36"
            />
            <button type="submit" disabled={!newLocName.trim()}
              className="text-xs px-2.5 py-1.5 rounded-full bg-brand hover:bg-brand2 text-white font-medium disabled:opacity-40">
              Add
            </button>
            <button type="button" onClick={() => { setAddLocOpen(false); setNewLocName(""); }}
              className="p-1 rounded-full text-slate-500 hover:text-slate-200 hover:bg-slate-800" aria-label="Cancel">
              <X size={12} />
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setAddLocOpen(true)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-dashed border-slate-600 text-slate-500 hover:border-brand hover:text-brand">
            <Plus size={12} /> Add location
          </button>
        )}
      </div>

      {/* estimating settings — O&P global + active location factor */}
      <div className="max-w-4xl mx-auto w-full mb-4 rounded-lg border border-slate-800 bg-slate-900 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2"><SlidersHorizontal size={13} /> Estimating settings · <span className="text-slate-300 normal-case">{activeLoc?.name}</span></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Setting label="Location name"><input value={activeLoc?.name || ""} onChange={(e) => updateActiveLocation({ name: e.target.value })} className="input" /></Setting>
          <Setting label="Location factor" hint="city cost index ÷ 100"><input type="number" step="0.01" value={locFactor} onChange={(e) => updateActiveLocation({ locationFactor: num(e.target.value) })} className="input" /></Setting>
          <Setting label="Overhead %"><input type="number" step="1" value={overheadPct} onChange={(e) => setBookMeta({ overheadPct: num(e.target.value) })} className="input" /></Setting>
          <Setting label="Profit %"><input type="number" step="1" value={profitPct} onChange={(e) => setBookMeta({ profitPct: num(e.target.value) })} className="input" /></Setting>
        </div>
        <div className="text-[11px] text-slate-500 mt-2">Prices below are <b className="text-slate-300">bare</b> for this location tab. Takeoff totals add +{overheadPct + profitPct}% O&amp;P and ×{locFactor.toFixed(2)} location factor.</div>
      </div>

      <div className="max-w-4xl mx-auto w-full flex flex-col gap-2">
        {groups.length > 0 && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">{groups.length} division{groups.length === 1 ? "" : "s"} · one open at a time</span>
            {expandedDiv && (
              <button type="button" onClick={() => setExpandedDiv(null)}
                className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800">
                Close all
              </button>
            )}
          </div>
        )}
        {groups.map(([div, ks]) => {
          const open = expandedDiv === div;
          return (
          <div key={div} className="rounded-lg border border-slate-800 overflow-hidden">
            <button type="button" onClick={() => toggleDiv(div)} aria-expanded={open}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${open ? "bg-slate-800/80" : "bg-slate-900 hover:bg-slate-800/60"}`}>
              {open ? <ChevronDown size={14} className="text-brand shrink-0" /> : <ChevronRight size={14} className="text-slate-500 shrink-0" />}
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex-1">{div}</span>
              <span className="text-[10px] text-slate-500 tabular-nums">{ks.length} asm</span>
            </button>
            {open && (
            <div className="flex flex-col gap-3 p-3 pt-2 border-t border-slate-800 bg-slate-950/40">
              {ks.map((k) => {
                const asm = priceBook[k];
                return (
                  <div key={k} className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50">
                      <Layers size={15} className="text-brand shrink-0" />
                      <input value={asm.name} onChange={(e) => updateAssembly(k, { name: e.target.value })} aria-label="Assembly name" className="font-semibold bg-transparent focus:outline-none focus:bg-slate-950 rounded px-1 py-0.5 min-w-0 flex-1" />
                      <select value={asm.geom} onChange={(e) => updateAssembly(k, { geom: e.target.value, unit: e.target.value === "linear" ? "LF" : e.target.value === "count" ? "EA" : "SF" })} aria-label="Measurement type" className="text-xs bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-300">
                        {Object.entries(geomLabel).map(([g, l]) => <option key={g} value={g}>{l}</option>)}
                      </select>
                      <span className="text-xs text-slate-400 hidden sm:inline">≈ <b className="text-emerald-400">{money2(unitBare(asm))}</b>/{asm.unit} bare</span>
                      <button onClick={() => confirm(`Delete assembly “${asm.name}”?`) && removeAssembly(k)} aria-label="Delete assembly" className="p-1.5 rounded hover:bg-rose-900/60 text-slate-500 hover:text-rose-300"><Trash2 size={14} /></button>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] text-slate-500 border-b border-slate-800">
                          <th className="text-left font-medium px-4 py-1.5">Material</th>
                          <th className="text-right font-medium px-1 py-1.5 w-16">Per</th>
                          <th className="text-right font-medium px-1 py-1.5 w-16">Waste</th>
                          <th className="text-right font-medium px-1 py-1.5 w-20">Material $</th>
                          <th className="text-right font-medium px-1 py-1.5 w-20 text-sky-400/80">Labor $</th>
                          <th className="text-right font-medium px-1 py-1.5 w-20 text-amber-400/80">Equip $</th>
                          <th className="w-7"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {asm.materials.map((m, i) => (
                          <tr key={i} className="border-b border-slate-800/60 last:border-0 group">
                            <td className="px-4 py-1"><input value={m.name} onChange={(e) => updateMaterial(k, i, { name: e.target.value })} aria-label="Material name" className="w-full bg-transparent text-slate-200 focus:outline-none focus:bg-slate-950 rounded px-1 py-0.5" /></td>
                            <td className="px-1 py-1"><Num value={m.per} step="0.05" onChange={(v) => updateMaterial(k, i, { per: v })} /></td>
                            <td className="px-1 py-1"><Num value={Math.round((m.waste || 0) * 100)} step="1" suffix="%" onChange={(v) => updateMaterial(k, i, { waste: v / 100 })} /></td>
                            <td className="px-1 py-1"><Num value={m.cost} step="0.01" prefix="$" onChange={(v) => updateMaterial(k, i, { cost: v })} /></td>
                            <td className="px-1 py-1"><Num value={m.labor || 0} step="0.01" prefix="$" onChange={(v) => updateMaterial(k, i, { labor: v })} /></td>
                            <td className="px-1 py-1"><Num value={m.equip || 0} step="0.01" prefix="$" onChange={(v) => updateMaterial(k, i, { equip: v })} /></td>
                            <td className="px-1"><button onClick={() => removeMaterial(k, i)} aria-label="Delete material" className="p-1 rounded text-slate-600 hover:text-rose-300 hover:bg-rose-900/40 opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 size={13} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button onClick={() => addMaterial(k)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-4 py-2 hover:bg-slate-800/50 w-full"><Plus size={13} /> Add material</button>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        );})}

        <button onClick={addAssembly} className="flex items-center justify-center gap-1.5 text-sm text-slate-300 border border-dashed border-slate-700 rounded-lg py-3 hover:border-brand hover:text-brand"><Plus size={16} /> Add assembly</button>
        <p className="text-xs text-slate-500">Switch location tabs for market-specific books. Use <b className="text-slate-400">Research</b> to AI-update prices for a city (reasoning model). Export/import JSON or CSV per location.</p>
      </div>
      {researchOpen && <PriceResearchModal onClose={() => setResearchOpen(false)} />}
      {tradeResearchOpen && <TradeResearchModal mode="pricebook" onClose={() => setTradeResearchOpen(false)} />}
    </div>
  );
}

function Setting({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-slate-400">{label}{hint && <span className="text-slate-600"> · {hint}</span>}</span>
      {children}
    </label>
  );
}

function Num({ value, onChange, step = "1", prefix = "", suffix = "" }) {
  return (
    <div className="flex items-center gap-0.5 justify-end">
      {prefix && <span className="text-slate-500 text-xs">{prefix}</span>}
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-14 bg-transparent text-right text-slate-200 tabular-nums focus:outline-none focus:bg-slate-950 rounded px-1 py-0.5" />
      {suffix && <span className="text-slate-500 text-xs">{suffix}</span>}
    </div>
  );
}
