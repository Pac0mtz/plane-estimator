import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

const base =
  "flex items-center justify-center rounded-md border border-slate-600 bg-slate-800 text-slate-200 shadow-md hover:bg-slate-700 hover:border-slate-500 hover:text-white focus-visible:ring-2 focus-visible:ring-brand outline-none transition-colors";

/** Visible collapse / expand control for side panels and rails. */
export function PanelToggle({ onClick, expanded, side = "left", axis = "horizontal", size = "md", title, className = "" }) {
  const dim = size === "sm" ? "w-6 h-6" : "w-7 h-7";
  const icon = size === "sm" ? 14 : 16;
  const Icon =
    axis === "vertical"
      ? expanded
        ? ChevronDown
        : ChevronUp
      : side === "left"
        ? expanded
          ? ChevronLeft
          : ChevronRight
        : expanded
          ? ChevronRight
          : ChevronLeft;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      title={title}
      className={`${base} ${dim} ${className}`}
    >
      <Icon size={icon} />
    </button>
  );
}

/** Narrow vertical strip shown when a right-side panel is collapsed. */
export function CollapsedRail({ onClick, side = "right", title, children, className = "" }) {
  const border = side === "right" ? "border-l" : "border-r";
  return (
    <div className={`w-8 shrink-0 ${border} border-slate-800 bg-slate-950 flex flex-col items-center py-2 gap-2 ${className}`}>
      <PanelToggle onClick={onClick} expanded={false} side={side} size="sm" title={title} />
      {children}
    </div>
  );
}
