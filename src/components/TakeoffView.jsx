import { useMemo, useState, useEffect } from "react";
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
import MobileTakeoffDock from "./MobileTakeoffDock.jsx";
import { PanelToggle, CollapsedRail } from "./PanelToggle.jsx";
import { useStore } from "../store/useStore.js";
import { ASSEMBLIES, explode } from "../lib/assemblies.js";
import { traceQty } from "../lib/geometry.js";

function AnalysisPanel({ rollup, grand, onExport, onCollapse, className = "" }) {
  return (
    <div className={`shrink-0 border-l border-slate-800/80 bg-slate-950/95 backdrop-blur-sm flex flex-col overflow-y-auto relative takeoff-chrome ${className}`}>
      <div className="sticky top-0 z-20 flex items-center gap-2 px-2 py-1.5 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
        <PanelToggle onClick={onCollapse} expanded side="right" title="Collapse analysis panel" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Analysis</span>
      </div>
      <AiReviewPanel />
      <LayersPanel rollup={rollup} />
      <LayerDetails rollup={rollup} />
      <MaterialsPanel rollup={rollup} grand={grand} onGenerateProposal={onExport} />
    </div>
  );
}

export default function TakeoffView() {
  const { layers, traces, ppf, priceBook } = useStore();
  const pricingSettings = useStore((s) => s.pricingSettings());
  const [exportOpen, setExportOpen] = useState(false);
  const assistantOpen = useStore((s) => s.assistantOpen);
  const setAssistantOpen = useStore((s) => s.setAssistantOpen);
  const toggleAssistant = useStore((s) => s.toggleAssistant);
  const { showTools, showAnalysis, toggleTools, toggleAnalysis } = useStore();
  const activeProjectId = useStore((s) => s.activeProjectId);
  const planRestoring = useStore((s) => s.planRestoring);

  useEffect(() => {
    const id = setInterval(() => useStore.getState().saveActiveProject(), 15000);
    return () => clearInterval(id);
  }, [activeProjectId]);

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
  const openExport = () => setExportOpen(true);

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-900 text-slate-100">
      <Header onExport={openExport} hideProjectInfo
        assistantOpen={assistantOpen} onToggleAssistant={toggleAssistant} />

      <div className="flex-1 flex flex-col min-h-0 ring-1 ring-inset ring-slate-800/50">
        <div className="flex-1 flex min-h-0 relative">
          {/* Desktop tools rail */}
          <div className="hidden md:block shrink-0">
            {showTools ? (
              <Toolbar collapsed={false} onToggleCollapse={toggleTools} />
            ) : (
              <Toolbar collapsed onToggleCollapse={toggleTools} />
            )}
          </div>

          {/* Mobile tools drawer */}
          {showTools && (
            <>
              <button
                type="button"
                aria-label="Close tools"
                className="md:hidden absolute inset-0 z-40 bg-black/50"
                onClick={toggleTools}
              />
              <div className="md:hidden absolute left-0 top-0 bottom-0 z-50 w-[min(100%,14rem)] max-w-[88vw] shadow-2xl overflow-y-auto border-r border-slate-800 bg-slate-950">
                <Toolbar collapsed={false} onToggleCollapse={toggleTools} />
              </div>
            </>
          )}

          <DropZone className="flex-1 min-w-0 min-h-0">
            <PlanCanvas />
            {planRestoring && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/70 text-slate-200 text-sm">
                Restoring saved plan…
              </div>
            )}
          </DropZone>

          {/* Desktop analysis panel */}
          {showAnalysis && (
            <AnalysisPanel
              rollup={rollup}
              grand={grand}
              onExport={openExport}
              onCollapse={toggleAnalysis}
              className="hidden md:flex w-64 lg:w-72 xl:w-80 2xl:w-96"
            />
          )}
          {!showAnalysis && !assistantOpen && (
            <CollapsedRail onClick={toggleAnalysis} side="right" title="Expand analysis panel" className="hidden md:flex" />
          )}

          {/* Mobile analysis sheet */}
          {showAnalysis && (
            <>
              <button
                type="button"
                aria-label="Close analysis"
                className="md:hidden absolute inset-0 z-40 bg-black/50"
                onClick={toggleAnalysis}
              />
              <AnalysisPanel
                rollup={rollup}
                grand={grand}
                onExport={openExport}
                onCollapse={toggleAnalysis}
                className="md:hidden absolute inset-x-0 top-0 bottom-0 z-50 w-full border-l-0 border-t border-slate-800 bg-slate-950"
              />
            </>
          )}

          {assistantOpen && <AssistantPanel onClose={() => setAssistantOpen(false)} className="max-md:absolute max-md:inset-0 max-md:z-[55]" />}
        </div>

        <MobileTakeoffDock />
      </div>

      <PageRail />
      {exportOpen && <ExportModal rollup={rollup} grand={grand} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
