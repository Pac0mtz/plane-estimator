import { Check, Trash2, Sparkles, X } from "lucide-react";

// Properties card for a detection or trace. Hovering shows it as a quick peek;
// clicking the shape PINS it (solid, closeable) so you can use the buttons.
export default function HoverCard({ kind, obj, sx, sy, wrapW, wrapH, layerName, qty, pinned, onKeep, onDismiss, onClose, onAccept, onDelete, onConfirm }) {
  const isSug = kind === "suggestion";
  const title = isSug ? obj.element || obj.layerName : layerName;
  const color = isSug ? obj.color : undefined;
  const typeLabel = obj.type === "area" ? "Area" : obj.type === "linear" ? "Wall / linear" : "Count";
  const flipX = sx > (wrapW || 9999) - 250;
  const flipY = sy > (wrapH || 9999) - 190;
  const style = { left: flipX ? Math.max(8, sx - 236) : sx + 14, top: flipY ? Math.max(8, sy - 176) : sy + 12 };

  return (
    <div style={style} onMouseEnter={pinned ? undefined : onKeep} onMouseLeave={pinned ? undefined : onDismiss}
      className="absolute z-40 w-56 rounded-lg border border-slate-600 bg-slate-900 p-2.5 text-xs shadow-2xl ring-1 ring-black/40">
      <div className="flex items-center gap-1.5 mb-1.5">
        {color && <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />}
        <span className="font-semibold text-slate-100 truncate flex-1">{title}</span>
        {isSug && <span className="text-[10px] text-violet-300 shrink-0">AI {Math.round((obj.confidence || 0) * 100)}%</span>}
        {pinned && <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-200 shrink-0"><X size={13} /></button>}
      </div>
      <div className="flex items-center gap-2 text-slate-300 mb-1">
        <span className="px-1.5 py-0.5 rounded bg-slate-800">{typeLabel}</span>
        <span className="text-emerald-400 font-semibold">{qty}</span>
      </div>
      {isSug && <div className="text-slate-400">{layerName} layer</div>}
      {isSug && obj.note && <div className="text-slate-500 mt-0.5 leading-snug">{obj.note}</div>}

      <div className="flex gap-1 mt-2">
        {onAccept && <button onClick={onAccept} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white"><Check size={12} /> Accept</button>}
        {onDelete && <button onClick={onDelete} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300"><Trash2 size={12} /></button>}
        <button onClick={onConfirm} title="Ask AI to review this" className="flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-violet-700 hover:bg-violet-600 text-white"><Sparkles size={12} /> Review</button>
      </div>
    </div>
  );
}
