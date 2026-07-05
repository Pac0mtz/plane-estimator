import { Trash2, ArrowRight, Pencil, Building2, MapPin } from "lucide-react";

const statusTone = {
  active: "bg-blue-900/50 text-blue-300",
  bidding: "bg-amber-900/50 text-amber-300",
  won: "bg-emerald-900/50 text-emerald-300",
  archived: "bg-slate-800 text-slate-400",
};

export default function EstimatorWorkCard({
  title,
  subtitle,
  address,
  meta,
  status = "active",
  onOpen,
  onEdit,
  onDelete,
}) {
  return (
    <article
      className="group desk-card bg-card text-card-foreground border border-border/50 transition-all duration-200 document-shell-outer-card rounded-[var(--radius,0.5rem)] overflow-hidden flex flex-col min-h-0 cursor-pointer hover:border-primary/50 active:scale-[0.99] md:active:scale-100"
      onClick={onOpen}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 min-w-0">
        <h3 className="flex-1 text-sm lg:text-[15px] font-semibold truncate min-w-0">{title}</h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize shrink-0 ${statusTone[status] || statusTone.active}`}>
          {status}
        </span>
        <button
          type="button"
          title="Delete"
          onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          className="touch-target md:touch-target-none opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 flex items-center justify-center p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-950/40 transition-opacity"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        {subtitle && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
            <Building2 size={13} className="shrink-0 opacity-70" />
            <span className="truncate">{subtitle}</span>
          </div>
        )}
        {address && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
            <MapPin size={13} className="shrink-0 opacity-70" />
            <span className="truncate">{address}</span>
          </div>
        )}
        <p className="text-[11px] lg:text-xs text-muted-foreground leading-snug mt-auto">{meta}</p>
        <div className="flex items-center gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onOpen}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 md:py-1.5 rounded-md bg-brand hover:bg-brand2 font-medium text-white min-h-10 md:min-h-8 shadow-sm"
          >
            Open takeoff <ArrowRight size={13} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="Edit"
            className="touch-target md:touch-target-none md:h-8 md:w-8 flex items-center justify-center p-2 md:p-0 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
