import { useRef, useEffect, useState } from "react";
import {
  MousePointer2, Hand, Ruler, Square, Minus, Hash, Undo2, Check, Trash2, X, RectangleHorizontal, MoveDiagonal, ScanLine, Loader2, Ban, Magnet,
} from "lucide-react";
import { useStore } from "../store/useStore.js";
import { geomLabel } from "../lib/assemblies.js";
import { detectScale, hasKey } from "../lib/aiDetect.js";
import { extractPageText, extractPageVectors } from "../lib/pdf.js";
import { calibrateFromDimensions } from "../lib/dimensions.js";

function Btn({ ic, label, hotkey, on, accent, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-pressed={on} aria-label={label} title={hotkey ? `${label} (${hotkey.toUpperCase()})` : label}
      className={`flex items-center gap-2 text-xs px-2.5 py-2 rounded transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-brand outline-none ${
        on ? (accent ? "bg-brand text-white" : "bg-slate-700 text-white") : "bg-slate-800 text-slate-300 hover:bg-slate-700"
      }`}>
      {ic}<span className="flex-1 text-left">{label}</span>
      {hotkey && <kbd className={`text-[9px] px-1 rounded ${on ? "bg-white/20" : "bg-slate-900 text-slate-500"}`}>{hotkey.toUpperCase()}</kbd>}
    </button>
  );
}

export default function Toolbar() {
  const s = useStore();
  const geom = s.activeGeom();
  const geomIcon = geom === "area" ? <Square size={15} /> : geom === "linear" ? <Minus size={15} /> : <Hash size={15} />;
  const [scaleBusy, setScaleBusy] = useState(false);
  const [dimBusy, setDimBusy] = useState(false);
  const [dimMsg, setDimMsg] = useState("");

  // Read the sheet's printed dimensions and calibrate scale from them — the
  // accurate, vision-free path. Needs vector geometry (a real PDF, not a scan).
  const runReadDimensions = async () => {
    if (s.bg.type !== "img") { setDimMsg("Open an uploaded PDF page first."); return; }
    setDimBusy(true); setDimMsg("");
    try {
      const { items } = await extractPageText(s.activePage);
      const polylines = s.vectors[s.activePage] || (await extractPageVectors(s.activePage)).polylines;
      if (!s.vectors[s.activePage]) s.setVectors(s.activePage, polylines);
      const res = calibrateFromDimensions(items, polylines);
      if (res.ppf) {
        s.setPpf(res.ppf, `dimensions (${res.samples.length})`);
        s.setDims(res);
        setDimMsg(`Scale set from ${res.samples.length} printed dimensions.`);
      } else {
        s.setDims(null);
        setDimMsg("No readable dimensions here (needs a vector PDF with strings like 40'-0\"). Use Calibrate.");
      }
    } catch (err) {
      setDimMsg(err.message);
    } finally {
      setDimBusy(false);
    }
  };

  const runDetectScale = async () => {
    if (s.bg.type !== "img" || !s.bg.href) return alert("Open an uploaded plan page first — the demo has a fixed scale.");
    setScaleBusy(true);
    try {
      const { paperInchesPerFoot, scaleNote, a, b, feet } = await detectScale({ imageDataUrl: s.bg.href, bg: s.bg });
      const dpi = s.pages[s.activePage]?.dpi; // pixels per paper inch (PDF pages only)
      if (paperInchesPerFoot > 0 && dpi) {
        // exact: 1 foot = paperInchesPerFoot paper inches = that × dpi pixels
        s.setPpf(dpi * paperInchesPerFoot, `AI scale ${scaleNote || ""}`.trim());
      } else if (a && b && feet > 0) {
        s.setScaleFromPoints(a, b, feet, "AI dimension");
      } else if (paperInchesPerFoot > 0) {
        alert(`Read scale note "${scaleNote}", but this is an image (unknown DPI) so I can't compute pixels-per-foot from it. Calibrate two points, or import the PDF instead.`);
      } else {
        alert("No reliable scale found on this sheet — use Calibrate.");
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setScaleBusy(false);
    }
  };

  // keyboard shortcuts (ignored while typing in a field)
  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const map = { v: "select", h: "pan", c: "calibrate", d: "draw", r: "rect", m: "measure", x: "exclude", s: "snap" };
      if (map[k]) { e.preventDefault(); s.setTool(map[k]); }
      else if (e.key === "Escape") s.setTool("select");
      else if (e.key === "Enter" && s.tool === "draw") s.finishDraft();
      else if ((e.key === "Delete" || e.key === "Backspace") && s.selId) { e.preventDefault(); s.deleteSel(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s]);

  return (
    <div className="w-40 xl:w-44 shrink-0 border-r border-slate-800 bg-slate-950 p-2.5 flex flex-col gap-1.5 overflow-y-auto">
      <Label>Navigate</Label>
      <Btn ic={<MousePointer2 size={15} />} label="Select" hotkey="v" on={s.tool === "select"} onClick={() => s.setTool("select")} />
      <Btn ic={<Hand size={15} />} label="Pan" hotkey="h" on={s.tool === "pan"} onClick={() => s.setTool("pan")} />

      <Label>Measure</Label>
      <button onClick={runDetectScale} disabled={scaleBusy} aria-label="Detect scale with AI"
        title={hasKey() ? "Read the scale bar / note and auto-calibrate" : "Detect scale (needs OpenAI key)"}
        className="flex items-center gap-2 text-xs px-2.5 py-2 rounded bg-violet-700 hover:bg-violet-600 text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-violet-400 outline-none">
        {scaleBusy ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
        <span className="flex-1 text-left">{scaleBusy ? "Reading…" : "Detect scale"}</span>
      </button>
      <button onClick={runReadDimensions} disabled={dimBusy} aria-label="Read printed dimensions to calibrate"
        title="Read the sheet's printed dimensions (40'-0'' …) and set scale exactly — vector PDFs only"
        className="flex items-center gap-2 text-xs px-2.5 py-2 rounded bg-teal-700 hover:bg-teal-600 text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-teal-400 outline-none">
        {dimBusy ? <Loader2 size={15} className="animate-spin" /> : <Ruler size={15} />}
        <span className="flex-1 text-left">{dimBusy ? "Reading…" : "Read dimensions"}</span>
      </button>
      {dimMsg && <div className="text-[10px] text-slate-400 px-1 leading-snug">{dimMsg}</div>}
      <Btn ic={<Ruler size={15} />} label="Calibrate" hotkey="c" on={s.tool === "calibrate"} onClick={() => s.setTool("calibrate")} />
      <Btn ic={<MoveDiagonal size={15} />} label="Measure" hotkey="m" on={s.tool === "measure"} onClick={() => s.setTool("measure")} />

      <Label>Draw</Label>
      <Btn ic={geomIcon} label={geomLabel[geom]} hotkey="d" on={s.tool === "draw"} accent onClick={() => s.setTool("draw")} />
      <Btn ic={<RectangleHorizontal size={15} />} label="Rectangle" hotkey="r" disabled={geom !== "area"} on={s.tool === "rect"} onClick={() => s.setTool("rect")} />
      <Btn ic={<Ban size={15} />} label="Exclude area" hotkey="x" on={s.tool === "exclude"} onClick={() => s.setTool("exclude")} />

      <Label>Snap (vector plans)</Label>
      <Btn ic={<Magnet size={15} />} label="Snap line" hotkey="s" accent on={s.tool === "snap"} onClick={() => s.setTool("snap")} />
      {s.tool === "snap" && (
        <div className="text-[10px] text-slate-500 px-1 leading-snug">
          {s.vectorsBusy ? "Reading real geometry…" : (s.vectors[s.activePage]?.length
            ? <>Hover a real line — it highlights. Click to trace it exactly onto <b className="text-slate-300">{s.activeLayer()?.name}</b>.</>
            : "No vector geometry on this sheet (scanned or image). Trace manually instead.")}
        </div>
      )}

      {((s.tool === "draw" && geom !== "count") || s.tool === "exclude") && (
        <div className="flex gap-1.5">
          <button onClick={s.undoPoint} aria-label="Undo last point" className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded bg-slate-800 hover:bg-slate-700"><Undo2 size={13} />Undo</button>
          <button onClick={s.finishDraft} aria-label="Finish shape" className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded bg-emerald-700 hover:bg-emerald-600"><Check size={13} />Finish</button>
        </div>
      )}
      {s.tool === "exclude" && <div className="text-[10px] text-slate-500 px-1">Draw an area to leave OUT of the takeoff, then Finish.</div>}
      {s.tool === "rect" && <div className="text-[10px] text-slate-500 px-1">Click two opposite corners.</div>}
      {s.tool === "measure" && <div className="text-[10px] text-slate-500 px-1">Click two points to measure. {!s.ppf && "Calibrate first for feet."}</div>}
      {s.tool === "calibrate" && <Calibrator />}

      <div className="h-px bg-slate-800 my-1" />
      <Label>Actions</Label>
      <Btn ic={<Trash2 size={14} />} label="Delete" hotkey="⌫" disabled={!s.selId} onClick={s.deleteSel} />
      <button onClick={s.clearAll} aria-label="Clear all on this page" className="flex items-center gap-2 text-xs px-2.5 py-2 rounded bg-slate-800 hover:bg-rose-900/60 text-rose-300 focus-visible:ring-2 focus-visible:ring-rose-500 outline-none">
        <X size={14} /> Clear all
      </button>

      <div className="mt-auto pt-3 text-[10px] leading-snug text-slate-500">
        <b className="text-slate-400">Shortcuts:</b> V select · H pan · C calibrate · M measure · D draw · R rectangle · Esc cancel · Enter finish.
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
            <input ref={inputRef} inputMode="decimal" placeholder="ft" aria-label="Known distance in feet"
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
  <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-1 pt-1">{children}</div>
);
