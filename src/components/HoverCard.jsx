import { Check, Trash2, Sparkles } from "lucide-react";

// Floating properties card shown when hovering a detection or trace on the
// canvas. Lets the estimator confirm/accept, delete, or ask the AI to review.
export default function HoverCard({ kind, obj, sx, sy, wrapW, layerName, qty, onKeep, onDismiss, onAccept, onDelete, onConfirm }) {
  const isSug = kind === "suggestion";
  const title = isSug ? obj.element || obj.layerName : layerName;
  const color = isSug ? obj.color : undefined;
  const typeLabel = obj.type === "area" ? "Area" : obj.type === "linear" ? "Wall / linear" : "Count";
  // flip to the left if near the right edge
  const flip = sx > wrapW - 250;
  const style = { left: flip ? sx - 236 : sx + 14, top: sy + 12 };

  return (
    <div style={style} onMouseEnter={onKeep} onMouseLeave={onDismiss}
      className="absolute z-40 w-56 rounded-lg border border-slate-700 bg-slate-900/97 p-2.5 text-xs shadow-2xl">
      <div className="flex items-center gap-1.5 mb-1">
        {color && <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />}
        <span className="font-semibold text-slate-100 truncate flex-1">{title}</span>
        {isSug && <span className="text-[10px] text-violet-300">AI {Math.round((obj.confidence || 0) * 100)}%</span>}
      </div>
      <div className="flex items-center gap-2 text-slate-400 mb-1">
        <span className="px-1.5 py-0.5 rounded bg-slate-800">{typeLabel}</span>
        <span className="text-emerald-400 font-medium">{qty}</span>
      </div>
      {isSug && <div className="text-slate-300">{layerName} layer</div>}
      {isSug && obj.note && <div className="text-slate-500 mt-0.5 leading-snug">{obj.note}</div>}

      <div className="flex gap-1 mt-2">
        {onAccept && <button onClick={onAccept} className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white"><Check size={12} /> Accept</button>}
        {onDelete && <button onClick={onDelete} className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300"><Trash2 size={12} /></button>}
        <button onClick={onConfirm} title="Ask AI to review this" className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-violet-700 hover:bg-violet-600 text-white"><Sparkles size={12} /> Review</button>
      </div>
    </div>
  );
}
