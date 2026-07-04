import { useRef, useEffect, useState } from "react";
import {
  MousePointer2, Hand, Ruler, Square, Minus, Hash, Undo2, Check, Trash2, X, RectangleHorizontal, MoveDiagonal, ScanLine, Loader2, Ban, Magnet, PaintBucket, PanelLeftOpen, ChevronLeft, Scale,
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

function IconBtn({ ic, label, hotkey, on, accent, onClick, disabled, busy }) {
  return (
    <button onClick={onClick} disabled={disabled || busy} aria-pressed={on} aria-label={label}
      title={hotkey ? `${label} (${hotkey.toUpperCase()})` : label}
      className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-brand outline-none ${
        on ? (accent ? "bg-brand text-white shadow-sm" : "bg-slate-700 text-white") : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
      }`}>
      {busy ? <Loader2 size={16} className="animate-spin" /> : ic}
    </button>
  );
}

function RailDivider() {
  return <div className="h-px bg-slate-800 mx-1 shrink-0" />;
}

export default function Toolbar({ collapsed = false, onToggleCollapse }) {
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

  if (collapsed) {
    return (
      <div className="w-11 shrink-0 border-r border-slate-800 bg-slate-950 py-1.5 px-1 flex flex-col items-center gap-1 overflow-y-auto">
        <button onClick={onToggleCollapse} aria-label="Expand tools panel" title="Expand tools panel"
          className="w-9 h-9 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 shrink-0">
          <PanelLeftOpen size={16} />
        </button>
        <RailDivider />
        <IconBtn ic={<MousePointer2 size={16} />} label="Select" hotkey="v" on={s.tool === "select"} onClick={() => s.setTool("select")} />
        <IconBtn ic={<Hand size={16} />} label="Pan" hotkey="h" on={s.tool === "pan"} onClick={() => s.setTool("pan")} />
        <RailDivider />
        <IconBtn ic={<Ruler size={16} />} label="Read dimensions" onClick={runReadDimensions} busy={dimBusy} accent />
        <IconBtn ic={<ScanLine size={16} />} label="AI scale note" onClick={runDetectScale} busy={scaleBusy} accent />
        <IconBtn ic={<Scale size={16} />} label="Calibrate" hotkey="c" on={s.tool === "calibrate"} accent onClick={() => s.setTool("calibrate")} />
        <IconBtn ic={<MoveDiagonal size={16} />} label="Quick ruler" hotkey="m" on={s.tool === "measure"} accent onClick={() => s.setTool("measure")} />
        <RailDivider />
        <IconBtn ic={<Magnet size={16} />} label="Measure wall" hotkey="s" on={s.tool === "snap"} accent onClick={() => s.setTool("snap")} />
        <IconBtn ic={<PaintBucket size={16} />} label="Room area" hotkey="a" on={s.tool === "room"} accent onClick={() => s.setTool("room")} />
        <RailDivider />
        <IconBtn ic={geomIcon} label={geomLabel[geom]} hotkey="d" on={s.tool === "draw"} accent onClick={() => s.setTool("draw")} />
        <IconBtn ic={<RectangleHorizontal size={16} />} label="Rectangle" hotkey="r" disabled={geom !== "area"} on={s.tool === "rect"} onClick={() => s.setTool("rect")} />
        <IconBtn ic={<Ban size={16} />} label="Exclude area" hotkey="x" on={s.tool === "exclude"} onClick={() => s.setTool("exclude")} />
        <RailDivider />
        <IconBtn ic={<Trash2 size={15} />} label="Delete" hotkey="⌫" disabled={!s.selId} onClick={s.deleteSel} />
        <IconBtn ic={<X size={16} />} label="Clear all on page" onClick={s.clearAll} />
        <div className="mt-auto pt-1 shrink-0" title={`Active layer: ${activeLayer?.name || "none"}`}>
          <span className="block w-9 h-2 rounded-full mx-auto ring-1 ring-slate-700" style={{ background: activeLayer?.color || "#64748b" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-44 xl:w-48 shrink-0 border-r border-slate-800 bg-slate-950 p-2 flex flex-col gap-2 overflow-y-auto relative">
      {onToggleCollapse && (
        <button onClick={onToggleCollapse} aria-label="Collapse tools panel" title="Collapse to icons"
          className="absolute top-1.5 right-1.5 z-10 p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-brand outline-none">
          <ChevronLeft size={14} />
        </button>
      )}
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
        <Btn ic={<Ruler size={15} />} label="Calibrate" hotkey="c" accent on={s.tool === "calibrate"} onClick={() => s.setTool("calibrate")} />
        <Btn ic={<MoveDiagonal size={15} />} label="Quick ruler" hotkey="m" accent on={s.tool === "measure"} onClick={() => s.setTool("measure")} />
        {s.tool === "measure" && <MeasureHint measure={s.measure} ppf={s.ppf} />}
        {s.tool === "calibrate" && <Calibrator ppf={s.ppf} />}
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

function MeasureHint({ measure, ppf }) {
  const step = !measure?.a ? 1 : !measure?.b ? 2 : 3;
  return (
    <ToolPanel tone="cyan">
      <StepBar steps={["Point A", "Point B", "Done"]} current={step} tone="cyan" />
      <p className="text-[10px] text-slate-400 leading-snug">
        {step === 1 && "Click the start of the distance on the plan."}
        {step === 2 && "Move to the end — a live dimension line follows your cursor. Click to lock."}
        {step === 3 && "Measurement locked. Click again for a new line, or press Esc."}
        {!ppf && step < 3 && " Scale not set — distance shows in pixels until you calibrate."}
      </p>
    </ToolPanel>
  );
}

function Calibrator({ ppf }) {
  const { calib, setScaleFromCalib } = useStore();
  const inputRef = useRef(null);
  const [feet, setFeet] = useState("");
  const step = calib.length === 0 ? 1 : calib.length === 1 ? 2 : 3;
  const pxLen = calib.length === 2
    ? Math.round(Math.hypot(calib[0].x - calib[1].x, calib[0].y - calib[1].y))
    : null;
  const feetNum = parseFloat(feet);

  useEffect(() => {
    if (calib.length === 2) inputRef.current?.focus();
    if (calib.length < 2) setFeet("");
  }, [calib.length]);

  const apply = () => setScaleFromCalib(feetNum);

  return (
    <ToolPanel tone="amber">
      <StepBar steps={["Point A", "Point B", "Distance"]} current={step} tone="amber" />
      {calib.length < 2 ? (
        <p className="text-[10px] text-slate-400 leading-snug">
          {calib.length === 0
            ? "Click one end of a known dimension on the plan (a wall, grid line, or dimension string)."
            : "Drag the line to the other end — endpoint ticks show on the canvas. Click to place point B."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Line on sheet</span>
            <span className="font-mono font-semibold text-amber-200 tabular-nums">{pxLen} px</span>
          </div>
          <label className="text-[10px] text-slate-400">Real distance between those points</label>
          <div className="flex gap-1.5">
            <input ref={inputRef} inputMode="decimal" placeholder="e.g. 40" aria-label="Known distance in feet"
              value={feet} onChange={(e) => setFeet(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              className="flex-1 px-2.5 py-1.5 rounded-md bg-slate-950 border border-amber-700/50 text-slate-100 text-sm font-mono focus:outline-none focus:border-amber-500" />
            <span className="self-center text-[10px] text-slate-500 shrink-0">ft</span>
            <button onClick={apply} disabled={!(feetNum > 0)}
              className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold shrink-0">
              Set scale
            </button>
          </div>
          {pxLen > 0 && feetNum > 0 && (
            <div className="text-[10px] text-emerald-400/90 tabular-nums">
              → {(pxLen / feetNum).toFixed(2)} px/ft
            </div>
          )}
          {ppf && <p className="text-[10px] text-slate-500">Current scale: {ppf.toFixed(1)} px/ft — this will replace it.</p>}
        </div>
      )}
    </ToolPanel>
  );
}

function ToolPanel({ tone, children }) {
  const border = tone === "cyan" ? "border-cyan-800/60" : "border-amber-800/60";
  const bg = tone === "cyan" ? "bg-cyan-950/30" : "bg-amber-950/30";
  return <div className={`mt-0.5 p-2.5 rounded-lg border ${border} ${bg} flex flex-col gap-2`}>{children}</div>;
}

function StepBar({ steps, current, tone }) {
  const active = tone === "cyan" ? "bg-cyan-500 text-slate-950" : "bg-amber-500 text-slate-950";
  const done = tone === "cyan" ? "bg-cyan-900/60 text-cyan-300" : "bg-amber-900/60 text-amber-300";
  const idle = "bg-slate-800 text-slate-500";
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => {
        const n = i + 1;
        const st = n < current ? "done" : n === current ? "active" : "idle";
        return (
          <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${st === "active" ? active : st === "done" ? done : idle}`}>
              {st === "done" ? "✓" : n}
            </div>
            <span className={`text-[9px] truncate ${st === "active" ? "text-slate-200 font-medium" : "text-slate-500"}`}>{s}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-px min-w-[4px] ${n < current ? (tone === "cyan" ? "bg-cyan-700" : "bg-amber-700") : "bg-slate-700"}`} />}
          </div>
        );
      })}
    </div>
  );
}

