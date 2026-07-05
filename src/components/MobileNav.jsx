import { FolderKanban, Users, PencilRuler, BookOpen } from "lucide-react";
import { useStore } from "../store/useStore.js";

const NAV = [
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "clients", label: "Clients", icon: Users },
  { key: "takeoff", label: "Takeoff", icon: PencilRuler },
  { key: "pricebook", label: "Prices", icon: BookOpen },
];

/** Bottom tab bar — primary navigation on phones/tablets portrait. */
export default function MobileNav() {
  const { view, setView } = useStore();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-stretch justify-around bg-slate-950/95 border-t border-slate-800 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation">
      {NAV.map(({ key, label, icon: Icon }) => {
        const on = view === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            aria-current={on ? "page" : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.25rem] text-[10px] font-medium transition-colors ${
              on ? "text-brand" : "text-slate-500"
            }`}>
            <Icon size={20} strokeWidth={on ? 2.25 : 2} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
