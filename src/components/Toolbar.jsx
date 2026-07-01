import { useRef } from "react";
import {
  MousePointer2, Hand, Ruler, Square, Minus, Hash, Undo2, Check, Trash2, X,
} from "lucide-react";
import { useStore } from "../store/useStore.js";
import { geomLabel } from "../lib/assemblies.js";

function Btn({ ic, label, on, accent, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-2 text-xs px-2.5 py-2 rounded transition-colors disabled:opacity-40 ${
        on ? (accent ? "bg-brand text-white" : "bg-slate-700 text-white") : "bg-slate-800 text-slate-300 hover:bg-slate-700"
      }`}>
      {ic}{label}
    </button>
  );
}

export default function Toolbar() {
  const s = useStore();
  const geom = s.activeGeom();
  const geomIcon = geom === "area" ? <Square size={15} /> : geom === "linear" ? <Minus size={15} /> : <Hash size={15} />;

  return (
    <div className="w-44 shrink-0 border-r border-slate-800 bg-slate-950 p-2.5 flex flex-col gap-1.5 overflow-y-auto">
      <Label>Tools</Label>
      <Btn ic={<MousePointer2 size={15} />} label="Select" on={s.tool === "select"} onClick={() => s.setTool("select")} />
      <Btn ic={<Hand size={15} />} label="Pan" on={s.tool === "pan"} onClick={() => s.setTool("pan")} />
      <Btn ic={<Ruler size={15} />} label="Calibrate" on={s.tool === "calibrate"} onClick={() => s.setTool("calibrate")} />
      <Btn ic={geomIcon} label={geomLabel[geom]} on={s.tool === "draw"} accent onClick={() => s.setTool("draw")} />

      {s.tool === "draw" && geom !== "count" && (
        <div className="flex gap-1.5">
          <button onClick={s.undoPoint} className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded bg-slate-800 hover:bg-slate-700"><Undo2 size={13} />Undo</button>
          <button onClick={s.finishDraft} className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded bg-emerald-700 hover:bg-emerald-600"><Check size={13} />Finish</button>
        </div>
      )}

      {s.tool === "calibrate" && <Calibrator />}

      <div className="h-px bg-slate-800 my-1.5" />
      <Label>Actions</Label>
      <Btn ic={<Trash2 size={14} />} label="Delete selected" disabled={!s.selId} onClick={s.deleteSel} />
      <button onClick={s.clearAll} className="flex items-center gap-2 text-xs px-2.5 py-2 rounded bg-slate-800 hover:bg-rose-900/60 text-rose-300">
        <X size={14} /> Clear all
      </button>

      <div className="mt-auto pt-3 text-[10px] leading-snug text-slate-500">
        Pick a layer → <b className="text-slate-300">Draw</b> → click vertices → <b className="text-slate-300">Finish</b>.
        Scroll to zoom, <b className="text-slate-300">Pan</b> to move. In <b className="text-slate-300">Select</b>, tap a shape to delete it.
      </div>
    </div>
  );
}

function Calibrator() {
  const { calib, setScaleFromCalib } = useStore();
  const inputRef = useRef(null);
  return (
    <div className="mt-1 p-2 rounded bg-slate-800 text-[11px] leading-relaxed">
      {calib.length < 2 ? (
        <span className="text-slate-300">Click 2 points a known distance apart ({calib.length}/2).</span>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-slate-300">Distance between points:</span>
          <div className="flex gap-1">
            <input ref={inputRef} inputMode="decimal" placeholder="ft"
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-100" />
            <button onClick={() => setScaleFromCalib(parseFloat(inputRef.current?.value))}
              className="px-2 py-1 rounded bg-brand hover:bg-brand2 text-white">Set</button>
          </div>
        </div>
      )}
    </div>
  );
}

const Label = ({ children }) => (
  <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-1">{children}</div>
);
