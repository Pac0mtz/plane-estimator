import Sidebar from "./components/Sidebar.jsx";
import ProjectsPage from "./components/ProjectsPage.jsx";
import ClientsPage from "./components/ClientsPage.jsx";
import PriceBookPage from "./components/PriceBookPage.jsx";
import TakeoffView from "./components/TakeoffView.jsx";
import ImportModal from "./components/ImportModal.jsx";
import { useStore } from "./store/useStore.js";

export default function App() {
  const view = useStore((s) => s.view);

  return (
    <div className="w-full h-full flex bg-slate-900 text-slate-100 font-sans">
      <Sidebar />
      {view === "projects" && <ProjectsPage />}
      {view === "clients" && <ClientsPage />}
      {view === "pricebook" && <PriceBookPage />}
      {view === "takeoff" && <TakeoffView />}
      <ImportModal />
    </div>
  );
}
