import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import MobileNav from "./components/MobileNav.jsx";
import ProjectsPage from "./components/ProjectsPage.jsx";
import PlanEstimatorPage from "./components/PlanEstimatorPage.jsx";
import ClientsPage from "./components/ClientsPage.jsx";
import PriceBookPage from "./components/PriceBookPage.jsx";
import TakeoffView from "./components/TakeoffView.jsx";
import ImportModal from "./components/ImportModal.jsx";
import { useStore } from "./store/useStore.js";
import { restorePlanForProject } from "./lib/restorePlan.js";
import { initFromNeon } from "./lib/neonSync.js";
import { isFieldTaskProEmbed } from "./lib/embed.js";
import { bootPlanEstimatorEmbed } from "./lib/planEstimatorEmbed.js";

export default function App() {
  const view = useStore((s) => s.view);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const dbStatus = useStore((s) => s.dbStatus);
  const [booted, setBooted] = useState(false);
  const onPlanEstimator = isFieldTaskProEmbed();

  useEffect(() => bootPlanEstimatorEmbed(), [onPlanEstimator]);

  useEffect(() => {
    const boot = async () => {
      await initFromNeon(useStore.getState, useStore.setState);
      setBooted(true);
    };
    if (useStore.persist.hasHydrated()) boot();
    else useStore.persist.onFinishHydration(boot);
  }, []);

  useEffect(() => {
    const save = () => useStore.getState().saveActiveProject();
    window.addEventListener("beforeunload", save);
    return () => window.removeEventListener("beforeunload", save);
  }, []);

  useEffect(() => {
    if (!booted) return;
    if (view === "takeoff" && activeProjectId) restorePlanForProject();
  }, [booted, view, activeProjectId]);

  const showDbBanner = dbStatus === "syncing" || dbStatus === "error";

  return (
    <div className="plan-estimator-root w-full h-full flex flex-col md:flex-row bg-slate-900 text-slate-100 font-sans">
      {!onPlanEstimator && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 pb-[calc(3.25rem+env(safe-area-inset-bottom))] md:pb-0">
        {showDbBanner && (
          <div className={`shrink-0 px-3 py-1.5 text-xs border-b ${
            dbStatus === "error"
              ? "bg-rose-950/80 text-rose-200 border-rose-900"
              : "bg-slate-900 text-slate-400 border-slate-800"
          }`}>
            {dbStatus === "syncing" && "Syncing…"}
            {dbStatus === "error" && "Sync error — using local cache on this device."}
          </div>
        )}
        {!booted ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
        ) : (
          <>
            {view === "projects" && (onPlanEstimator ? <PlanEstimatorPage /> : <ProjectsPage />)}
            {!onPlanEstimator && view === "clients" && <ClientsPage />}
            {!onPlanEstimator && view === "pricebook" && <PriceBookPage />}
            {view === "takeoff" && <TakeoffView />}
          </>
        )}
        <ImportModal />
      </div>
      {!onPlanEstimator && <MobileNav />}
    </div>
  );
}
