import { useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import Toolbar from "./components/Toolbar.jsx";
import PlanCanvas from "./components/PlanCanvas.jsx";
import LayersPanel from "./components/LayersPanel.jsx";
import MaterialsPanel from "./components/MaterialsPanel.jsx";
import ExportModal from "./components/ExportModal.jsx";
import { useStore } from "./store/useStore.js";
import { ASSEMBLIES, explode } from "./lib/assemblies.js";
import { traceQty } from "./lib/geometry.js";

export default function App() {
  const { layers, traces, ppf } = useStore();
  const [exportOpen, setExportOpen] = useState(false);

  const rollup = useMemo(() => {
    return layers.map((l) => {
      const tl = traces.filter((t) => t.layer === l.id);
      const qty = tl.reduce((s, t) => s + traceQty(t, ppf), 0);
      const asm = ASSEMBLIES[l.asm];
      const { materials, cost } = explode(l.asm, qty);
      return { layer: l, asm, count: tl.length, qty, materials, cost };
    });
  }, [layers, traces, ppf]);

  const grand = rollup.reduce((s, r) => s + r.cost, 0);

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 text-slate-100 font-sans">
      <Header onExport={() => setExportOpen(true)} />
      <div className="flex-1 flex min-h-0">
        <Toolbar />
        <PlanCanvas />
        <div className="w-72 shrink-0 border-l border-slate-800 bg-slate-950 flex flex-col overflow-y-auto">
          <LayersPanel rollup={rollup} />
          <MaterialsPanel rollup={rollup} grand={grand} />
        </div>
      </div>
      {exportOpen && <ExportModal rollup={rollup} grand={grand} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
