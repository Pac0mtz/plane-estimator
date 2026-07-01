import { useMemo, useState } from "react";
import Header from "./Header.jsx";
import Toolbar from "./Toolbar.jsx";
import PlanCanvas from "./PlanCanvas.jsx";
import PageRail from "./PageRail.jsx";
import LayersPanel from "./LayersPanel.jsx";
import MaterialsPanel from "./MaterialsPanel.jsx";
import AiReviewPanel from "./AiReviewPanel.jsx";
import ExportModal from "./ExportModal.jsx";
import { useStore } from "../store/useStore.js";
import { ASSEMBLIES, explode } from "../lib/assemblies.js";
import { traceQty } from "../lib/geometry.js";

export default function TakeoffView() {
  const { layers, traces, ppf, priceBook } = useStore();
  const active = useStore((s) => s.activeProject());
  const [exportOpen, setExportOpen] = useState(false);

  const rollup = useMemo(() => {
    return layers.map((l) => {
      const tl = traces.filter((t) => t.layer === l.id);
      const qty = tl.reduce((s, t) => s + traceQty(t, ppf), 0);
      const asm = priceBook[l.asm] || ASSEMBLIES[l.asm];
      const { materials, cost } = explode(l.asm, qty, priceBook);
      return { layer: l, asm, count: tl.length, qty, materials, cost };
    });
  }, [layers, traces, ppf, priceBook]);

  const grand = rollup.reduce((s, r) => s + r.cost, 0);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-900 text-slate-100">
      <Header onExport={() => setExportOpen(true)} projectName={active?.name} />
      <div className="flex-1 flex min-h-0">
        <Toolbar />
        <PageRail />
        <PlanCanvas />
        <div className="w-60 xl:w-72 shrink-0 border-l border-slate-800 bg-slate-950 flex flex-col overflow-y-auto">
          <AiReviewPanel />
          <LayersPanel rollup={rollup} />
          <MaterialsPanel rollup={rollup} grand={grand} />
        </div>
      </div>
      {exportOpen && <ExportModal rollup={rollup} grand={grand} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
