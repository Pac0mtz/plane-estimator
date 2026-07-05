import { FolderKanban, Users, PencilRuler, BookOpen } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { useState, useEffect } from "react";
import { PanelToggle } from "./PanelToggle.jsx";

const NAV = [
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "clients", label: "Clients", icon: Users },
  { key: "takeoff", label: "Takeoff", icon: PencilRuler },
  { key: "pricebook", label: "Price book", icon: BookOpen },
];

// Persistent app navigation. Collapsible to an icon rail on smaller screens.
export default function Sidebar() {
  const { view, setView, projects, clients } = useStore();
  const active = useStore((s) => s.activeProject());
  const [open, setOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1280 : true
  );

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1100) setOpen(false);
      else if (window.innerWidth >= 1280) setOpen(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const counts = { projects: projects.length, clients: clients.length };

  return (
    <nav className={`hidden md:flex ${open ? "w-56 lg:w-60" : "w-14"} shrink-0 border-r border-slate-800/80 bg-slate-950 flex-col transition-all duration-200`}>
      <div className={`flex items-center ${open ? "gap-2.5 px-3" : "justify-center px-1"} h-14 border-b border-slate-800/80`}>
        {open && (
          <>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0 shadow-sm"
              style={{ background: "linear-gradient(135deg,#0a2540,#2f7fd1)" }}>P</div>
            <span className="font-bold tracking-tight text-slate-100 truncate flex-1 min-w-0 text-[15px]">Plan Forge</span>
          </>
        )}
        <PanelToggle
          onClick={() => setOpen((v) => !v)}
          expanded={open}
          side="left"
          size="sm"
          title={open ? "Collapse navigation" : "Expand navigation"}
          className={open ? "ml-auto shrink-0" : "shrink-0"}
        />
      </div>

      <div className="flex-1 p-2 flex flex-col gap-1">
        {NAV.map(({ key, label, icon: Icon }) => {
          const on = view === key;
          return (
            <button key={key} onClick={() => setView(key)} title={label}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                on ? "bg-brand text-white shadow-sm" : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-100"
              }`}>
              <Icon size={17} className="shrink-0" />
              {open && <span className="flex-1 text-left">{label}</span>}
              {open && counts[key] > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${on ? "bg-white/20" : "bg-slate-800 text-slate-400"}`}>{counts[key]}</span>
              )}
            </button>
          );
        })}
      </div>

      {open && (
        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500">
          {active ? (
            <>
              <div className="text-slate-400 uppercase tracking-wider text-[9px] mb-0.5">Active project</div>
              <div className="text-slate-200 truncate">{active.name}</div>
            </>
          ) : (
            <span>No project open</span>
          )}
        </div>
      )}
    </nav>
  );
}
