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
import { PanelToggle, CollapsedRail } from "./PanelToggle.jsx";
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
            <div className="sticky top-0 z-20 flex items-center gap-2 px-2 py-1.5 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
              <PanelToggle onClick={toggleAnalysis} expanded side="right" title="Collapse analysis panel" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Analysis</span>
            </div>
            <AiReviewPanel />
            <LayersPanel rollup={rollup} />
            <LayerDetails rollup={rollup} />
            <MaterialsPanel rollup={rollup} grand={grand} onGenerateProposal={() => setExportOpen(true)} />
          </div>
        ) : !assistantOpen ? (
          <CollapsedRail onClick={toggleAnalysis} side="right" title="Expand analysis panel" />
        ) : null}

        {assistantOpen && <AssistantPanel onClose={() => setAssistantOpen(false)} />}
      </div>
      <PageRail />
      {exportOpen && <ExportModal rollup={rollup} grand={grand} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
