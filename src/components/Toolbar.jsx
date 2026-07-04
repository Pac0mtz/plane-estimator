import { useRef, useEffect, useState } from "react";
import {
  MousePointer2, Hand, Ruler, Square, Minus, Hash, Undo2, Check, Trash2, X, RectangleHorizontal, MoveDiagonal, ScanLine, Loader2, Ban, Magnet, PaintBucket,
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
      const fromNote = /scale/i.test(s.ppfNote || "");
      if (res.ppf && s.ppf && fromNote && Math.abs(res.ppf - s.ppf) / s.ppf > 0.12) {
        // the printed scale note is exact arithmetic (note × dpi) — never let a
        // lower-confidence dimension pairing silently override it
        s.setDims(res);
        setDimMsg(`Dimensions suggest ${res.ppf.toFixed(1)} px/ft but the printed scale note gives ${s.ppf.toFixed(1)} — keeping the note.`);
      } else if (res.ppf) {
        s.setPpf(res.ppf, `dimensions (${res.samples.length})`);
        s.setDims(res);
        setDimMsg(`Scale set from ${res.samples.length} printed dimensions.`);
      } else {
        s.setDims(null);
        setDimMsg(s.ppf && fromNote
          ? `No reliable dimension lines on this sheet — keeping the printed scale note (${s.ppf.toFixed(1)} px/ft).`
          : "No readable dimensions here (needs a vector PDF with dimension strings like 40'-0\"). Use Calibrate.");
      }
    } catch (err) {
      setDimMsg(err.message);
    } finally {
      setDimBusy(false);
    }
  };

  const runDetectScale = async () => {
    if (s.bg.type !== "img" || !s.bg.href) { setDimMsg("Open an uploaded plan page first — the demo has a fixed scale."); return; }
    setScaleBusy(true); setDimMsg("");
    try {
      const { paperInchesPerFoot, scaleNote, a, b, feet } = await detectScale({ imageDataUrl: s.bg.href, bg: s.bg });
      const dpi = s.pages[s.activePage]?.dpi; // pixels per paper inch (PDF pages only)
      if (paperInchesPerFoot > 0 && dpi) {
        // exact: 1 foot = paperInchesPerFoot paper inches = that × dpi pixels
        s.setPpf(dpi * paperInchesPerFoot, `AI scale ${scaleNote || ""}`.trim());
        setDimMsg(`Scale set from the printed note ${scaleNote || ""}.`);
      } else if (a && b && feet > 0) {
        s.setScaleFromPoints(a, b, feet, "AI dimension");
        setDimMsg("Scale set from a printed dimension line.");
      } else if (paperInchesPerFoot > 0) {
        setDimMsg(`Read scale note "${scaleNote}", but this image has unknown DPI — calibrate two points, or import the PDF instead.`);
      } else {
        setDimMsg("No reliable scale note found on this sheet — use Calibrate.");
      }
    } catch (err) {
      setDimMsg(err.message);
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
      const map = { v: "select", h: "pan", c: "calibrate", d: "draw", r: "rect", m: "measure", x: "exclude", s: "snap", a: "room" };
      if (map[k]) { e.preventDefault(); s.setTool(map[k]); }
      else if (e.key === "Escape") s.setTool("select");
      else if (e.key === "Enter" && s.tool === "draw") s.finishDraft();
      else if ((e.key === "Delete" || e.key === "Backspace") && s.selId) { e.preventDefault(); s.deleteSel(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s]);

  const activeLayer = s.activeLayer();

  return (
    <div className="w-44 xl:w-48 shrink-0 border-r border-slate-800 bg-slate-950 p-2 flex flex-col gap-2 overflow-y-auto">
      <Group title="Navigate">
        <Btn ic={<MousePointer2 size={15} />} label="Select" hotkey="v" on={s.tool === "select"} onClick={() => s.setTool("select")} />
        <Btn ic={<Hand size={15} />} label="Pan" hotkey="h" on={s.tool === "pan"} onClick={() => s.setTool("pan")} />
      </Group>

      <Group title="Scale & measure">
        <button onClick={runReadDimensions} disabled={dimBusy} aria-label="Read printed dimensions to calibrate"
          title="Read the sheet's printed dimensions (40'-0'' …) and set scale exactly — vector PDFs only"
          className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-md bg-teal-700 hover:bg-teal-600 text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-teal-400 outline-none">
          {dimBusy ? <Loader2 size={15} className="animate-spin" /> : <Ruler size={15} />}
          <span className="flex-1 text-left">{dimBusy ? "Reading…" : "Read dimensions"}</span>
        </button>
        <button onClick={runDetectScale} disabled={scaleBusy} aria-label="Detect scale with AI"
          title={hasKey() ? "Read the scale note with AI and auto-calibrate" : "Detect scale (needs OpenAI key)"}
          className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-md bg-violet-800/80 hover:bg-violet-700 text-violet-100 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-violet-400 outline-none">
          {scaleBusy ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
          <span className="flex-1 text-left">{scaleBusy ? "Reading…" : "AI scale note"}</span>
        </button>
        {dimMsg && <div className="text-[10px] text-slate-400 px-1 leading-snug">{dimMsg}</div>}
        <Btn ic={<Ruler size={15} />} label="Calibrate" hotkey="c" on={s.tool === "calibrate"} onClick={() => s.setTool("calibrate")} />
        <Btn ic={<MoveDiagonal size={15} />} label="Quick ruler" hotkey="m" on={s.tool === "measure"} onClick={() => s.setTool("measure")} />
        {s.tool === "measure" && <Hint>Click two points to measure. {!s.ppf && "Set scale first for feet."}</Hint>}
        {s.tool === "calibrate" && <Calibrator />}
      </Group>

      <Group title="Smart takeoff">
        <Btn ic={<Magnet size={15} />} label="Measure wall" hotkey="s" accent on={s.tool === "snap"} onClick={() => s.setTool("snap")} />
        {s.tool === "snap" && (
          <Hint>{s.vectorsBusy ? "Reading real geometry…" : (s.vectors[s.activePage]?.length
            ? <><b className="text-slate-300">Hover a wall</b> — the run highlights with its length. Click to take it off.</>
            : "No vector geometry here (scanned page). Trace manually instead.")}</Hint>
        )}
        <Btn ic={<PaintBucket size={15} />} label="Room area" hotkey="a" accent on={s.tool === "room"} onClick={() => s.setTool("room")} />
        {s.tool === "room" && (
          <Hint><b className="text-slate-300">Click inside a room</b> — it fills to the walls and lands as exact SF. Open rooms won't enclose; trace those manually.</Hint>
        )}
      </Group>

      <Group title="Draw">
        <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-md bg-slate-950/70 border border-slate-800" title="New traces land on this layer">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: activeLayer?.color || "#64748b" }} />
          <span className="text-[10px] text-slate-400 truncate">onto <b className="text-slate-200">{activeLayer?.name || "no layer"}</b></span>
        </div>
        <Btn ic={geomIcon} label={geomLabel[geom]} hotkey="d" on={s.tool === "draw"} accent onClick={() => s.setTool("draw")} />
        <Btn ic={<RectangleHorizontal size={15} />} label="Rectangle" hotkey="r" disabled={geom !== "area"} on={s.tool === "rect"} onClick={() => s.setTool("rect")} />
        <Btn ic={<Ban size={15} />} label="Exclude area" hotkey="x" on={s.tool === "exclude"} onClick={() => s.setTool("exclude")} />
        {s.tool === "exclude" && <Hint>Draw an area to leave OUT of the takeoff, then Finish.</Hint>}
        {s.tool === "rect" && <Hint>Click two opposite corners.</Hint>}
        {((s.tool === "draw" && geom !== "count") || s.tool === "exclude") && (
          <div className="flex gap-1">
            <button onClick={s.undoPoint} aria-label="Undo last point" className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-md bg-slate-800 hover:bg-slate-700"><Undo2 size={13} />Undo</button>
            <button onClick={s.finishDraft} aria-label="Finish shape" className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600"><Check size={13} />Finish</button>
          </div>
        )}
      </Group>

      <Group title="Actions">
        <Btn ic={<Trash2 size={14} />} label="Delete" hotkey="⌫" disabled={!s.selId} onClick={s.deleteSel} />
        <button onClick={s.clearAll} aria-label="Clear all on this page" className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-md bg-slate-800 hover:bg-rose-900/60 text-rose-300 focus-visible:ring-2 focus-visible:ring-rose-500 outline-none">
          <X size={14} /> Clear all
        </button>
      </Group>

      <div className="mt-auto pt-2 text-[10px] leading-snug text-slate-600">
        <b className="text-slate-500">Keys:</b> V·H·C·M·D·R·X·S·A tools · Esc cancel · Enter finish · dbl-click a handle removes it.
      </div>
    </div>
  );
}

const Group = ({ title, children }) => (
  <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-1.5 flex flex-col gap-1">
    <div className="text-[9px] font-semibold tracking-[0.14em] text-slate-500 uppercase px-1 pb-0.5">{title}</div>
    {children}
  </div>
);

const Hint = ({ children }) => (
  <div className="text-[10px] text-slate-500 px-1 leading-snug">{children}</div>
);

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

