import { Wrench, BarChart3, Sparkles, Layers } from "lucide-react";
import { useStore } from "../store/useStore.js";

function DockBtn({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[2.75rem] text-[10px] font-medium transition-colors ${
        active ? "text-brand bg-brand/10" : "text-slate-400 hover:text-slate-200"
      }`}>
      <Icon size={18} strokeWidth={active ? 2.25 : 2} />
      <span>{label}</span>
    </button>
  );
}

/** Quick panel toggles on takeoff — sits above the sheet strip on phones. */
export default function MobileTakeoffDock() {
  const {
    showTools, showAnalysis, showSheets, toggleTools, toggleAnalysis, toggleSheets,
    assistantOpen, setAssistantOpen,
  } = useStore();

  const openTools = () => {
    const s = useStore.getState();
    if (s.assistantOpen) s.setAssistantOpen(false);
    if (s.showAnalysis) s.toggleAnalysis();
    s.toggleTools();
  };

  const openAnalysis = () => {
    const s = useStore.getState();
    if (s.assistantOpen) s.setAssistantOpen(false);
    if (s.showTools) s.toggleTools();
    s.toggleAnalysis();
  };

  const openAssistant = () => {
    const s = useStore.getState();
    if (s.showTools) s.toggleTools();
    if (s.showAnalysis) s.toggleAnalysis();
    s.toggleAssistant();
  };

  return (
    <div
      className="md:hidden shrink-0 flex items-stretch border-t border-slate-800 bg-slate-950/95 backdrop-blur-sm"
      aria-label="Takeoff panels">
      <DockBtn icon={Wrench} label="Tools" active={showTools} onClick={openTools} />
      <DockBtn icon={BarChart3} label="Analysis" active={showAnalysis} onClick={openAnalysis} />
      <DockBtn icon={Layers} label="Sheets" active={showSheets} onClick={toggleSheets} />
      <DockBtn icon={Sparkles} label="AI" active={assistantOpen} onClick={openAssistant} />
    </div>
  );
}
