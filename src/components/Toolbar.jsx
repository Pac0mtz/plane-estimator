import { useRef, useEffect, useState } from "react";
import {
  MousePointer2, Hand, Ruler, Square, Minus, Hash, Undo2, Redo2, Check, Trash2, X, RectangleHorizontal,
  MoveDiagonal, ScanLine, Loader2, Ban, Magnet, PaintBucket, Scale, Maximize, Copy, Sparkles,
  ScanSearch, ChevronDown, CircleDot,
} from "lucide-react";
import { PanelToggle } from "./PanelToggle.jsx";
import { useStore } from "../store/useStore.js";
import { geomLabel } from "../lib/assemblies.js";
import { detectScale, detectTakeoff, hasKey } from "../lib/aiDetect.js";
import { extractPageText, extractPageVectors } from "../lib/pdf.js";
import { calibrateFromDimensions } from "../lib/dimensions.js";
import { detectRuns } from "../lib/detectRuns.js";

const TOOL_NAMES = {
  select: "Select", pan: "Pan", calibrate: "Calibrate", measure: "Quick ruler",
  snap: "Measure wall", room: "Room area", draw: "Draw", rect: "Rectangle", exclude: "Exclude",
};

function Btn({ ic, label, hotkey, on, accent, onClick, disabled, sub }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-pressed={on} aria-label={label}
      title={hotkey ? `${label} (${hotkey.toUpperCase()})` : label}
      className={`flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg transition-all duration-150 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-brand outline-none ${
        on ? (accent ? "bg-brand text-white toolbar-btn-active" : "bg-slate-700 text-white ring-1 ring-slate-600") : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
      }`}>
      {ic}
      <span className="flex-1 text-left min-w-0">
        <span className="block truncate">{label}</span>
        {sub && <span className="block text-[9px] text-slate-500 truncate font-normal">{sub}</span>}
      </span>
      {hotkey && <kbd className={`text-[9px] px-1 rounded shrink-0 ${on ? "bg-white/20" : "bg-slate-900 text-slate-500"}`}>{hotkey.toUpperCase()}</kbd>}
    </button>
  );
}

function IconBtn({ ic, label, hotkey, on, accent, onClick, disabled, busy, dot }) {
  return (
    <button onClick={onClick} disabled={disabled || busy} aria-pressed={on} aria-label={label}
      title={hotkey ? `${label} (${hotkey.toUpperCase()})` : label}
      className={`toolbar-icon-btn relative w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-brand outline-none ${
        on ? (accent ? "bg-brand text-white toolbar-btn-active" : "bg-slate-700 text-white") : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
      }`}>
      {busy ? <Loader2 size={16} className="animate-spin" /> : ic}
      {dot && !busy && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-brand ring-1 ring-slate-950" />}
    </button>
  );
}

function RailDivider() {
  return <div className="h-px bg-slate-800 mx-1 shrink-0" />;
}

function ScaleChip({ ppf, note }) {
  const ok = ppf > 0;
  return (
    <div className={`rounded-lg border px-2 py-1.5 flex items-center gap-2 ${ok ? "border-emerald-800/50 bg-emerald-950/30" : "border-amber-800/40 bg-amber-950/20"}`}>
      <Scale size={13} className={ok ? "text-emerald-400 shrink-0" : "text-amber-400 shrink-0"} />
      <div className="min-w-0 flex-1">
        <div className={`text-[10px] font-semibold tabular-nums ${ok ? "text-emerald-200" : "text-amber-200"}`}>
          {ok ? `${ppf.toFixed(1)} px/ft` : "Scale not set"}
        </div>
        {note && ok && <div className="text-[9px] text-slate-500 truncate">{note}</div>}
      </div>
    </div>
  );
}

function StatusBanner({ msg, tone = "neutral" }) {
  if (!msg) return null;
  const tones = {
    neutral: "text-slate-400 border-slate-800 bg-slate-950/60",
    ok: "text-emerald-300/90 border-emerald-900/40 bg-emerald-950/25",
    warn: "text-amber-300/90 border-amber-900/40 bg-amber-950/25",
    err: "text-rose-300/90 border-rose-900/40 bg-rose-950/25",
  };
  return (
    <div className={`text-[10px] leading-snug px-2 py-1.5 rounded-md border ${tones[tone] || tones.neutral}`}>
      {msg}
    </div>
  );
}

function LayerPicker({ layers, activeId, setActive }) {
  const active = layers.find((l) => l.id === activeId);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-left">
        <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-slate-700" style={{ background: active?.color || "#64748b" }} />
        <span className="text-[10px] text-slate-300 truncate flex-1">{active?.name || "No layer"}</span>
        <ChevronDown size={12} className={`text-slate-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1 max-h-40 overflow-y-auto">
          {layers.map((l) => (
            <button key={l.id} type="button" onClick={() => { setActive(l.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-[10px] hover:bg-slate-800 ${l.id === activeId ? "text-white bg-slate-800/80" : "text-slate-300"}`}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.color }} />
              <span className="truncate">{l.name}</span>
              {l.auto && <Sparkles size={10} className="text-violet-400 ml-auto shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GeomBadge({ geom }) {
  const labels = { area: "Area (SF)", linear: "Linear (LF)", count: "Count (EA)" };
  const icons = { area: Square, linear: Minus, count: Hash };
  const Icon = icons[geom] || Square;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-950/50 border border-slate-800/80 text-[9px] text-slate-400">
      <Icon size={11} className="text-brand shrink-0" />
      <span>Mode: <b className="text-slate-300">{labels[geom]}</b></span>
    </div>
  );
}

export default function Toolbar({ collapsed = false, onToggleCollapse }) {
  const s = useStore();
  const geom = s.activeGeom();
  const geomIcon = geom === "area" ? <Square size={15} /> : geom === "linear" ? <Minus size={15} /> : <Hash size={15} />;
  const [scaleBusy, setScaleBusy] = useState(false);
  const [dimBusy, setDimBusy] = useState(false);
  const [vectorBusy, setVectorBusy] = useState(false);
  const [status, setStatus] = useState({ msg: "", tone: "neutral" });
  const setMsg = (msg, tone = "neutral") => setStatus({ msg, tone });

  const selTrace = s.selId ? s.traces.find((t) => t.id === s.selId) : null;
  const suggestionCount = s.suggestions?.length || 0;
  const canUndo = useStore((st) => st.historyPast.length > 0);
  const canRedo = useStore((st) => st.historyFuture.length > 0);
  const activeLayer = s.activeLayer();
  const fitPage = () => window.__planView?.fit?.();

  const runReadDimensions = async () => {
    if (s.bg.type !== "img") { setMsg("Open an uploaded PDF page first.", "warn"); return; }
    setDimBusy(true); setMsg("");
    try {
      const { items } = await extractPageText(s.activePage);
      const polylines = s.vectors[s.activePage] || (await extractPageVectors(s.activePage)).polylines;
      if (!s.vectors[s.activePage]) s.setVectors(s.activePage, polylines);
      const res = calibrateFromDimensions(items, polylines);
      const fromNote = /scale/i.test(s.ppfNote || "");
      if (res.ppf && s.ppf && fromNote && Math.abs(res.ppf - s.ppf) / s.ppf > 0.12) {
        s.setDims(res);
        setMsg(`Dimensions suggest ${res.ppf.toFixed(1)} px/ft but the printed scale note gives ${s.ppf.toFixed(1)} — keeping the note.`, "warn");
      } else if (res.ppf) {
        s.setPpf(res.ppf, `dimensions (${res.samples.length})`);
        s.setDims(res);
        setMsg(`Scale set from ${res.samples.length} printed dimensions.`, "ok");
      } else {
        s.setDims(null);
        setMsg(s.ppf && fromNote
          ? `No reliable dimension lines — keeping scale note (${s.ppf.toFixed(1)} px/ft).`
          : "No readable dimensions (needs vector PDF). Use Calibrate.", "warn");
      }
    } catch (err) {
      setMsg(err.message, "err");
    } finally {
      setDimBusy(false);
    }
  };

  const runDetectScale = async () => {
    if (s.bg.type !== "img" || !s.bg.href) { setMsg("Open an uploaded plan page first.", "warn"); return; }
    setScaleBusy(true); setMsg("");
    try {
      const { paperInchesPerFoot, scaleNote, a, b, feet } = await detectScale({ imageDataUrl: s.bg.href, bg: s.bg });
      const dpi = s.pages[s.activePage]?.dpi;
      if (paperInchesPerFoot > 0 && dpi) {
        s.setPpf(dpi * paperInchesPerFoot, `AI scale ${scaleNote || ""}`.trim());
        setMsg(`Scale set from the printed note ${scaleNote || ""}.`, "ok");
      } else if (a && b && feet > 0) {
        s.setScaleFromPoints(a, b, feet, "AI dimension");
        setMsg("Scale set from a printed dimension line.", "ok");
      } else if (paperInchesPerFoot > 0) {
        setMsg(`Read "${scaleNote}" but DPI unknown — calibrate two points or import the PDF.`, "warn");
      } else {
        setMsg("No reliable scale note — use Calibrate.", "warn");
      }
    } catch (err) {
      setMsg(err.message, "err");
    } finally {
      setScaleBusy(false);
    }
  };

  const runVectorDetect = async () => {
    if (s.bg.type !== "img") { setMsg("Upload a plan page first.", "warn"); return; }
    setVectorBusy(true); setMsg("");
    try {
      let polylines = s.vectors[s.activePage];
      if (!polylines) {
        s.setVectorsBusy(true);
        polylines = (await extractPageVectors(s.activePage)).polylines;
        s.setVectors(s.activePage, polylines);
      }
      if (!polylines?.length) {
        setMsg("No vector geometry on this page — try AI pre-seed or trace manually.", "warn");
        return;
      }
      const { items } = await extractPageText(s.activePage).catch(() => ({ items: [] }));
      const dimSamples = (items || []).map((it) => ({ x: it.x, y: it.y }));
      const { regions, runs } = detectRuns(polylines, s.bg, { textItems: items || [], dimSamples });
      s.ingestVectorRuns({ regions, runs });
      const n = regions.length + runs.length;
      setMsg(n
        ? `Found ${regions.length} area${regions.length !== 1 ? "s" : ""} and ${runs.length} run${runs.length !== 1 ? "s" : ""} — confirm in Analysis.`
        : "No significant regions or wall runs on this sheet.", n ? "ok" : "warn");
    } catch (err) {
      setMsg(err.message, "err");
    } finally {
      setVectorBusy(false);
    }
  };

  const runAiDetect = async () => {
    if (s.bg.type !== "img" || !s.bg.href) { setMsg("Open a plan page first.", "warn"); return; }
    s.setAiBusy(true); setMsg("");
    try {
      const dets = await detectTakeoff({ imageDataUrl: s.bg.href, bg: s.bg });
      s.ingestDetections(dets);
      setMsg(`${dets.length} candidate${dets.length !== 1 ? "s" : ""} ready — review in Analysis panel.`, "ok");
    } catch (err) {
      s.setAiError(err.message);
      setMsg(err.message, "err");
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const map = { v: "select", h: "pan", c: "calibrate", d: "draw", r: "rect", m: "measure", x: "exclude", s: "snap", a: "room", f: "__fit" };
      if (map[k]) {
        e.preventDefault();
        if (map[k] === "__fit") fitPage();
        else s.setTool(map[k]);
      } else if (e.key === "Escape") s.setTool("select");
      else if (e.key === "Enter" && s.tool === "draw") s.finishDraft();
      else if ((e.key === "Delete" || e.key === "Backspace") && s.selId) { e.preventDefault(); s.deleteSel(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s]);

  if (collapsed) {
    return (
      <div className="w-11 shrink-0 border-r border-slate-800/80 bg-slate-950/95 backdrop-blur-sm py-2 px-1 flex flex-col items-center gap-1 overflow-y-auto takeoff-chrome">
        <PanelToggle onClick={onToggleCollapse} expanded={false} side="left" title="Expand tools panel" />
        <RailDivider />
        <IconBtn ic={<MousePointer2 size={16} />} label="Select" hotkey="v" on={s.tool === "select"} onClick={() => s.setTool("select")} dot={s.tool === "select"} />
        <IconBtn ic={<Hand size={16} />} label="Pan" hotkey="h" on={s.tool === "pan"} onClick={() => s.setTool("pan")} />
        <IconBtn ic={<Maximize size={15} />} label="Fit page" hotkey="f" onClick={fitPage} />
        <RailDivider />
        <IconBtn ic={<Ruler size={16} />} label="Read dimensions" onClick={runReadDimensions} busy={dimBusy} accent />
        <IconBtn ic={<ScanLine size={16} />} label="AI scale note" onClick={runDetectScale} busy={scaleBusy} accent />
        <IconBtn ic={<Scale size={16} />} label="Calibrate" hotkey="c" on={s.tool === "calibrate"} accent onClick={() => s.setTool("calibrate")} />
        <IconBtn ic={<MoveDiagonal size={16} />} label="Quick ruler" hotkey="m" on={s.tool === "measure"} accent onClick={() => s.setTool("measure")} />
        <RailDivider />
        <IconBtn ic={<ScanSearch size={16} />} label="Detect geometry" onClick={runVectorDetect} busy={vectorBusy} accent />
        <IconBtn ic={<Sparkles size={16} />} label="AI pre-seed" onClick={runAiDetect} busy={s.aiBusy} accent dot={suggestionCount > 0} />
        <RailDivider />
        <IconBtn ic={<Magnet size={16} />} label="Measure wall" hotkey="s" on={s.tool === "snap"} accent onClick={() => s.setTool("snap")} />
        <IconBtn ic={<PaintBucket size={16} />} label="Room area" hotkey="a" on={s.tool === "room"} accent onClick={() => s.setTool("room")} />
        <RailDivider />
        <IconBtn ic={geomIcon} label={geomLabel[geom]} hotkey="d" on={s.tool === "draw"} accent onClick={() => s.setTool("draw")} />
        <IconBtn ic={<RectangleHorizontal size={16} />} label="Rectangle" hotkey="r" disabled={geom !== "area"} on={s.tool === "rect"} onClick={() => s.setTool("rect")} />
        <IconBtn ic={<Ban size={16} />} label="Exclude area" hotkey="x" on={s.tool === "exclude"} onClick={() => s.setTool("exclude")} />
        <RailDivider />
        <IconBtn ic={<Undo2 size={15} />} label="Undo" hotkey="⌘Z" disabled={!canUndo} onClick={s.undo} />
        <IconBtn ic={<Redo2 size={15} />} label="Redo" hotkey="⇧⌘Z" disabled={!canRedo} onClick={s.redo} />
        <RailDivider />
        {selTrace && (
          <>
            <IconBtn ic={<Copy size={15} />} label="Duplicate" onClick={() => s.duplicateTrace(selTrace.id)} />
            <IconBtn ic={<Ban size={15} />} label={selTrace.excluded ? "Include" : "Exclude"} onClick={() => s.toggleExclude(selTrace.id)} accent={selTrace.excluded} />
          </>
        )}
        <IconBtn ic={<Trash2 size={15} />} label="Delete" hotkey="⌫" disabled={!s.selId} onClick={s.deleteSel} />
        <IconBtn ic={<X size={16} />} label="Clear all on page" onClick={s.clearAll} />
        <div className="mt-auto pt-1 shrink-0 flex flex-col items-center gap-1">
          <span className="block w-9 h-2 rounded-full ring-1 ring-slate-700" style={{ background: activeLayer?.color || "#64748b" }} title={activeLayer?.name || "No layer"} />
          {s.ppf > 0 && <CircleDot size={10} className="text-emerald-500" title={`${s.ppf.toFixed(1)} px/ft`} />}
        </div>
      </div>
    );
  }

  return (
    <div className="w-52 xl:w-56 shrink-0 border-r border-slate-800/80 bg-slate-950/95 backdrop-blur-sm p-2 flex flex-col gap-2 overflow-y-auto overflow-x-hidden min-w-0 takeoff-chrome">
      {onToggleCollapse && (
        <div className="flex items-center gap-2 pb-1 border-b border-slate-800/80 mb-0.5 shrink-0">
          <PanelToggle onClick={onToggleCollapse} expanded side="left" title="Collapse tools panel" size="sm" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tools</span>
        </div>
      )}

      <ScaleChip ppf={s.ppf} note={s.ppfNote} />

      <div className="flex items-center gap-1.5 px-1 py-0.5 shrink-0">
        <span className="text-[9px] uppercase tracking-wider text-slate-600 shrink-0">Active</span>
        <span className="text-[10px] font-medium text-brand truncate">{TOOL_NAMES[s.tool] || s.tool}</span>
      </div>

      {s.tool === "calibrate" && <CalibratePanel ppf={s.ppf} />}
      {s.tool === "measure" && <MeasurePanel measure={s.measure} ppf={s.ppf} />}

      {status.msg && s.tool !== "calibrate" && <StatusBanner msg={status.msg} tone={status.tone} />}

      <Group title="Navigate">
        <Btn ic={<MousePointer2 size={15} />} label="Select" hotkey="v" on={s.tool === "select"} onClick={() => s.setTool("select")} />
        <Btn ic={<Hand size={15} />} label="Pan" hotkey="h" on={s.tool === "pan"} onClick={() => s.setTool("pan")} />
        <Btn ic={<Maximize size={15} />} label="Fit page" hotkey="f" onClick={fitPage} />
      </Group>

      <Group title="Scale & measure">
        <button onClick={runReadDimensions} disabled={dimBusy} aria-label="Read printed dimensions to calibrate"
          title="Read the sheet's printed dimensions and set scale exactly — vector PDFs only"
          className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg bg-teal-800/80 hover:bg-teal-700 text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-teal-400 outline-none transition-colors">
          {dimBusy ? <Loader2 size={15} className="animate-spin" /> : <Ruler size={15} />}
          <span className="flex-1 text-left">{dimBusy ? "Reading…" : "Read dimensions"}</span>
        </button>
        <button onClick={runDetectScale} disabled={scaleBusy} aria-label="Detect scale with AI"
          title={hasKey() ? "Read the scale note with AI and auto-calibrate" : "Detect scale (needs OpenAI key)"}
          className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg bg-violet-800/70 hover:bg-violet-700 text-violet-100 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-violet-400 outline-none transition-colors">
          {scaleBusy ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
          <span className="flex-1 text-left">{scaleBusy ? "Reading…" : "AI scale note"}</span>
        </button>
        <Btn ic={<Scale size={15} />} label="Calibrate" hotkey="c" accent on={s.tool === "calibrate"} onClick={() => s.setTool("calibrate")} />
        <Btn ic={<MoveDiagonal size={15} />} label="Quick ruler" hotkey="m" accent on={s.tool === "measure"} onClick={() => s.setTool("measure")} />
      </Group>

      <Group title="Auto-detect">
        <button onClick={runVectorDetect} disabled={vectorBusy} aria-label="Detect walls and regions from vector geometry"
          title="Read real PDF geometry — exact areas and wall runs for you to confirm"
          className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg bg-emerald-800/70 hover:bg-emerald-700 text-emerald-50 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-emerald-400 outline-none transition-colors">
          {vectorBusy ? <Loader2 size={15} className="animate-spin" /> : <ScanSearch size={15} />}
          <span className="flex-1 text-left">{vectorBusy ? "Scanning…" : "Detect geometry"}</span>
        </button>
        <button onClick={runAiDetect} disabled={s.aiBusy} aria-label="AI pre-seed takeoff candidates"
          title={hasKey() ? "Vision pre-seed — confirm each before pricing" : "Demo on built-in plan; real plans need OpenAI key"}
          className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg bg-violet-900/60 hover:bg-violet-800/80 text-violet-100 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-violet-400 outline-none transition-colors">
          {s.aiBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          <span className="flex-1 text-left">
            {s.aiBusy ? "Detecting…" : "AI pre-seed"}
            {suggestionCount > 0 && !s.aiBusy && <span className="text-violet-300/70"> · {suggestionCount}</span>}
          </span>
        </button>
        <Hint>Detections land in the Analysis panel — accept or reject before they price.</Hint>
      </Group>

      <Group title="Smart takeoff">
        <Btn ic={<Magnet size={15} />} label="Measure wall" hotkey="s" accent on={s.tool === "snap"} onClick={() => s.setTool("snap")} />
        {s.tool === "snap" && (
          <Hint>{s.vectorsBusy ? "Reading real geometry…" : (s.vectors[s.activePage]?.length
            ? <><b className="text-slate-300">Hover a wall</b> — click to take off the full run.</>
            : "No vector geometry (scanned page). Trace manually.")}</Hint>
        )}
        <Btn ic={<PaintBucket size={15} />} label="Room area" hotkey="a" accent on={s.tool === "room"} onClick={() => s.setTool("room")} />
        {s.tool === "room" && (
          <Hint><b className="text-slate-300">Click inside a room</b> — fills to walls as exact SF.</Hint>
        )}
      </Group>

      <Group title="Draw">
        <LayerPicker layers={s.layers} activeId={s.activeId} setActive={s.setActive} />
        <GeomBadge geom={geom} />
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
        <div className="flex gap-1">
          <button onClick={s.undo} disabled={!canUndo} aria-label="Undo" title="Undo (⌘Z)"
            className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-brand outline-none">
            <Undo2 size={14} /> Undo
          </button>
          <button onClick={s.redo} disabled={!canRedo} aria-label="Redo" title="Redo (⇧⌘Z)"
            className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-brand outline-none">
            <Redo2 size={14} /> Redo
          </button>
        </div>
        {selTrace && (
          <>
            <Btn ic={<Copy size={14} />} label="Duplicate trace" onClick={() => s.duplicateTrace(selTrace.id)} />
            <Btn ic={<Ban size={14} />} label={selTrace.excluded ? "Include in takeoff" : "Exclude from takeoff"}
              on={selTrace.excluded} accent={selTrace.excluded}
              onClick={() => s.toggleExclude(selTrace.id)}
              sub={selTrace.excluded ? "Currently excluded" : undefined} />
          </>
        )}
        <Btn ic={<Trash2 size={14} />} label="Delete selected" hotkey="⌫" disabled={!s.selId} onClick={s.deleteSel} />
        <button onClick={s.clearAll} aria-label="Clear all on this page"
          className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg bg-slate-800/80 hover:bg-rose-900/50 text-rose-300 focus-visible:ring-2 focus-visible:ring-rose-500 outline-none transition-colors">
          <X size={14} /> Clear page traces
        </button>
      </Group>

      <div className="mt-auto pt-2 text-[10px] leading-snug text-slate-600 border-t border-slate-800/60">
        <b className="text-slate-500">Keys:</b> V·H·F·C·M·D·R·X·S·A · ⌘Z undo · Esc cancel · Enter finish
      </div>
    </div>
  );
}

const Group = ({ title, children }) => (
  <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-1.5 flex flex-col gap-1 min-w-0 shrink-0">
    <div className="text-[9px] font-semibold tracking-[0.14em] text-slate-500 uppercase px-1 pb-0.5">{title}</div>
    {children}
  </div>
);

const Hint = ({ children }) => (
  <div className="text-[10px] text-slate-500 px-1 leading-snug">{children}</div>
);

function MeasurePanel({ measure, ppf }) {
  const step = !measure?.a ? 1 : !measure?.b ? 2 : 3;
  return (
    <div className="rounded-lg border border-cyan-800/50 bg-cyan-950/20 p-2 flex flex-col gap-2 min-w-0 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <MoveDiagonal size={13} className="text-cyan-400 shrink-0" />
        <span className="text-[11px] font-semibold text-cyan-100">Quick ruler</span>
      </div>
      <StepDots steps={["Point A", "Point B", "Done"]} current={step} tone="cyan" />
      <p className="text-[10px] text-slate-400 leading-snug">
        {step === 1 && "Click the start of a distance on the plan."}
        {step === 2 && "Click the end — a live line follows your cursor."}
        {step === 3 && "Locked. Click again for a new line, or press Esc."}
        {!ppf && step < 3 && " Set scale first for feet."}
      </p>
    </div>
  );
}

function CalibratePanel({ ppf }) {
  const { calib, setScaleFromCalib } = useStore();
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const [feet, setFeet] = useState("");
  const step = calib.length === 0 ? 1 : calib.length === 1 ? 2 : 3;
  const pxLen = calib.length === 2
    ? Math.round(Math.hypot(calib[0].x - calib[1].x, calib[0].y - calib[1].y))
    : null;
  const feetNum = parseFloat(feet);

  useEffect(() => {
    if (calib.length === 2) {
      inputRef.current?.focus();
      panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    if (calib.length < 2) setFeet("");
  }, [calib.length]);

  const apply = () => setScaleFromCalib(feetNum);

  return (
    <div ref={panelRef} className="rounded-lg border border-amber-700/50 bg-amber-950/25 p-2 flex flex-col gap-2 min-w-0 shrink-0 shadow-sm shadow-amber-950/20">
      <div className="flex items-center gap-2 min-w-0">
        <Scale size={13} className="text-amber-400 shrink-0" />
        <span className="text-[11px] font-semibold text-amber-100">Calibrate scale</span>
      </div>

      <StepDots steps={["Point A", "Point B", "Feet"]} current={step} tone="amber" />

      {calib.length < 2 ? (
        <p className="text-[10px] text-slate-400 leading-snug">
          {calib.length === 0
            ? "Click one end of a known distance on the plan."
            : "Click the other end — yellow ticks show on the canvas."}
        </p>
      ) : (
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center justify-between gap-2 rounded-md bg-slate-950/70 border border-amber-800/35 px-2.5 py-2 min-w-0">
            <span className="text-[10px] text-slate-400 shrink-0">Line on sheet</span>
            <span className="font-mono font-semibold text-amber-200 tabular-nums text-sm shrink-0">{pxLen} px</span>
          </div>

          <label htmlFor="calib-feet" className="text-[10px] font-medium text-slate-300">Real distance (feet)</label>
          <div className="relative min-w-0 w-full">
            <input
              id="calib-feet"
              ref={inputRef}
              inputMode="decimal"
              placeholder="e.g. 40"
              aria-label="Known distance in feet"
              value={feet}
              onChange={(e) => setFeet(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && feetNum > 0 && apply()}
              className="w-full min-w-0 box-border px-2.5 py-2 pr-7 rounded-md bg-slate-950 border border-amber-700/50 text-slate-100 text-sm font-mono focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 pointer-events-none">ft</span>
          </div>

          <button
            type="button"
            onClick={apply}
            disabled={!(feetNum > 0)}
            className="w-full py-2 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
          >
            Set scale
          </button>

          {pxLen > 0 && feetNum > 0 && (
            <div className="text-[10px] text-emerald-400/90 tabular-nums text-center">
              → {(pxLen / feetNum).toFixed(2)} px/ft
            </div>
          )}
          {ppf > 0 && (
            <p className="text-[9px] text-slate-500 leading-snug text-center">
              Replaces current {ppf.toFixed(1)} px/ft
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StepDots({ steps, current, tone }) {
  const activeRing = tone === "cyan" ? "border-cyan-500 bg-cyan-950/60 text-cyan-200" : "border-amber-500 bg-amber-950/60 text-amber-200";
  const doneRing = tone === "cyan" ? "border-cyan-800/60 bg-cyan-950/30 text-cyan-400" : "border-amber-800/60 bg-amber-950/30 text-amber-400";
  const idleRing = "border-slate-800 bg-slate-900/50 text-slate-500";

  return (
    <div className="grid grid-cols-3 gap-1 min-w-0">
      {steps.map((label, i) => {
        const n = i + 1;
        const st = n < current ? "done" : n === current ? "active" : "idle";
        const ring = st === "active" ? activeRing : st === "done" ? doneRing : idleRing;
        return (
          <div key={label} className={`rounded-md border px-1 py-1.5 text-center min-w-0 ${ring}`}>
            <div className="text-[10px] font-bold leading-none">{st === "done" ? "✓" : n}</div>
            <div className={`text-[8px] leading-tight mt-0.5 truncate ${st === "active" ? "font-medium" : ""}`}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}
