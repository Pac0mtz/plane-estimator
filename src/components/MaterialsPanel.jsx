import { useStore } from "../store/useStore.js";

const money = (n) => "$" + Math.round(n).toLocaleString();
const money2 = (n) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MaterialsPanel({ rollup, grand }) {
  const { activeId, bookMeta } = useStore();
  const active = rollup.find((r) => r.layer.id === activeId);
  const onp = (bookMeta?.overheadPct || 0) + (bookMeta?.profitPct || 0);

  return (
    <>
      <div className="px-3 pb-3">
        <div className="text-xs font-semibold text-slate-400 mb-1.5">COST — {active.layer.name}</div>
        <div className="rounded bg-slate-900 border border-slate-800 divide-y divide-slate-800">
          {active.qty === 0 && (
            <div className="p-2.5 text-[11px] text-slate-500">Trace this layer to build its priced material list automatically.</div>
          )}
          {active.qty > 0 && active.materials.map((m, i) => (
            <div key={i} className="p-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-200">{m.name}</span>
                <span className="font-semibold text-slate-100">{money(m.ext)}</span>
              </div>
              <div className="text-slate-500">
                {m.mqty.toFixed(m.u === "sheet" || m.u === "ea" ? 0 : 1)} {m.u}
                {m.waste ? <span className="text-slate-600"> ({Math.round(m.waste * 100)}% waste)</span> : null}
              </div>
              <div className="flex gap-2 text-[10px] text-slate-500 mt-0.5">
                <span title="Material">M {money(m.matExt)}</span>
                {m.laborExt > 0 && <span title="Labor" className="text-sky-400/80">L {money(m.laborExt)}</span>}
                {m.equipExt > 0 && <span title="Equipment" className="text-amber-400/80">E {money(m.equipExt)}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto p-3 border-t border-slate-800 bg-slate-950 sticky bottom-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">TOTAL — INCL O&amp;P</span>
          <span className="text-2xl font-black text-emerald-400">{money(grand)}</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          Material + labor + equipment · +{onp}% O&amp;P · {bookMeta?.location} ×{(bookMeta?.locationFactor ?? 1).toFixed(2)}
        </div>
      </div>
    </>
  );
}
