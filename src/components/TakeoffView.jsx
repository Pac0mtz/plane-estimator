import { useMemo, useState } from "react";
import Header from "./Header.jsx";
import Toolbar from "./Toolbar.jsx";
import PlanCanvas from "./PlanCanvas.jsx";
import PageRail from "./PageRail.jsx";
import DropZone from "./DropZone.jsx";
import LayersPanel from "./LayersPanel.jsx";
import LayerDetails from "./LayerDetails.jsx";
import MaterialsPanel from "./MaterialsPanel.jsx";
import AiReviewPanel from "./AiReviewPanel.jsx";
import AssistantPanel from "./AssistantPanel.jsx";
import ExportModal from "./ExportModal.jsx";
import { PanelRightOpen, PanelRightClose } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { ASSEMBLIES, explode } from "../lib/assemblies.js";
import { traceQty } from "../lib/geometry.js";

export default function TakeoffView() {
  const { layers, traces, ppf, priceBook } = useStore();
  const pricingSettings = useStore((s) => s.pricingSettings());
  const active = useStore((s) => s.activeProject());
  const [exportOpen, setExportOpen] = useState(false);
  const assistantOpen = useStore((s) => s.assistantOpen);
  const setAssistantOpen = useStore((s) => s.setAssistantOpen);
  const toggleAssistant = useStore((s) => s.toggleAssistant);
  const { showTools, showAnalysis, toggleTools, toggleAnalysis } = useStore();

  const rollup = useMemo(() => {
    return layers.map((l) => {
      const tl = traces.filter((t) => t.layer === l.id && !t.excluded);
      const qty = tl.reduce((s, t) => s + traceQty(t, ppf), 0);
      const asm = priceBook[l.asm] || ASSEMBLIES[l.asm];
      const { materials, cost, bare } = explode(l.asm, qty, priceBook, pricingSettings);
      return { layer: l, asm, count: tl.length, qty, materials, cost, bare };
    });
  }, [layers, traces, ppf, priceBook, pricingSettings]);

  const grand = rollup.reduce((s, r) => s + r.cost, 0);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-900 text-slate-100">
      <Header onExport={() => setExportOpen(true)} projectName={active?.name}
        assistantOpen={assistantOpen} onToggleAssistant={toggleAssistant} />
      <div className="flex-1 flex min-h-0">
        {showTools ? (
          <Toolbar collapsed={false} onToggleCollapse={toggleTools} />
        ) : (
          <Toolbar collapsed onToggleCollapse={toggleTools} />
        )}

        <DropZone><PlanCanvas /></DropZone>

        {showAnalysis ? (
          <div className="w-60 xl:w-72 shrink-0 border-l border-slate-800 bg-slate-950 flex flex-col overflow-y-auto relative">
            <button onClick={toggleAnalysis} aria-label="Hide analysis panel" title="Hide panel"
              className="absolute top-1.5 right-1.5 z-10 p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-brand outline-none">
              <PanelRightClose size={14} />
            </button>
            <AiReviewPanel />
            <LayersPanel rollup={rollup} />
            <LayerDetails rollup={rollup} />
            <MaterialsPanel rollup={rollup} grand={grand} onGenerateProposal={() => setExportOpen(true)} />
          </div>
        ) : (
          <button onClick={toggleAnalysis} aria-label="Show analysis panel" title="Show panel"
            className="w-6 shrink-0 border-l border-slate-800 bg-slate-950 hover:bg-slate-900 flex items-center justify-center text-slate-500 hover:text-slate-200">
            <PanelRightOpen size={14} />
          </button>
        )}

        {assistantOpen && <AssistantPanel onClose={() => setAssistantOpen(false)} />}
      </div>
      <PageRail />
      {exportOpen && <ExportModal rollup={rollup} grand={grand} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
