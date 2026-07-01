import { FolderKanban, Users, PencilRuler, BookOpen, ChevronLeft } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { useState, useEffect } from "react";

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
  const [open, setOpen] = useState(typeof window === "undefined" || window.innerWidth >= 1100);

  // auto-collapse to an icon rail when the window gets narrow (the takeoff needs
  // the width for its canvas); still user-toggleable between resizes.
  useEffect(() => {
    let wide = window.innerWidth >= 1100;
    const onResize = () => {
      const nowWide = window.innerWidth >= 1100;
      if (nowWide !== wide) { wide = nowWide; setOpen(nowWide); }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const counts = { projects: projects.length, clients: clients.length };

  return (
    <nav className={`${open ? "w-52" : "w-14"} shrink-0 border-r border-slate-800 bg-slate-950 flex flex-col transition-all duration-200`}>
      <div className="flex items-center gap-2 px-3 h-12 border-b border-slate-800">
        <div className="w-7 h-7 rounded flex items-center justify-center font-black text-sm shrink-0"
          style={{ background: "linear-gradient(135deg,#0a2540,#2f7fd1)" }}>P</div>
        {open && <span className="font-bold tracking-tight text-slate-100 truncate">Plan Forge</span>}
        <button onClick={() => setOpen((v) => !v)} className="ml-auto text-slate-500 hover:text-slate-200">
          <ChevronLeft size={16} className={open ? "" : "rotate-180"} />
        </button>
      </div>

      <div className="flex-1 p-2 flex flex-col gap-1">
        {NAV.map(({ key, label, icon: Icon }) => {
          const on = view === key;
          return (
            <button key={key} onClick={() => setView(key)} title={label}
              className={`flex items-center gap-2.5 rounded px-2.5 py-2 text-sm transition-colors ${
                on ? "bg-brand text-white" : "text-slate-300 hover:bg-slate-800"
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
