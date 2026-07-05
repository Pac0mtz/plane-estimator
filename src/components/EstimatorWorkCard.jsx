import { Trash2, ArrowRight, Pencil } from "lucide-react";

const statusTone = {
  active: "bg-blue-900/50 text-blue-300",
  bidding: "bg-amber-900/50 text-amber-300",
  won: "bg-emerald-900/50 text-emerald-300",
  archived: "bg-slate-800 text-slate-400",
};

/** Document-shell card for one estimator work / project on the Plan Estimator page. */
export default function EstimatorWorkCard({
  title,
  meta,
  status = "active",
  onOpen,
  onEdit,
  onDelete,
}) {
  return (
    <article
      className="bg-card text-card-foreground border border-border/50 transition-all duration-200 document-shell-outer-card shadow-none hover:shadow-none rounded-[var(--radius,0.5rem)] overflow-hidden flex flex-col min-h-0 cursor-pointer hover:border-primary/40"
      onClick={onOpen}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 min-w-0">
        <h3 className="flex-1 text-sm font-semibold truncate min-w-0">{title}</h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize shrink-0 ${statusTone[status] || statusTone.active}`}>
          {status}
        </span>
        <button
          type="button"
          title="Delete"
          onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          className="shrink-0 p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-950/40"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <p className="text-[11px] text-muted-foreground">{meta}</p>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onOpen}
            className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded bg-brand hover:bg-brand2 font-medium text-white"
          >
            Open <ArrowRight size={13} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="Edit"
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
