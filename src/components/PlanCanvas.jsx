import { useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Image as KImage, Rect, Line, Circle, Text, Group } from "react-konva";
import { useStore } from "../store/useStore.js";
import { ASSEMBLIES } from "../lib/assemblies.js";
import { traceQty, centroid, flatPts } from "../lib/geometry.js";
import { runAssistant } from "../lib/planAssistant.js";
import { importPlanFile, ACCEPT } from "../lib/importPlan.js";
import { extractPageVectors } from "../lib/pdf.js";
import { nearestPolyline, polylineLengthPx } from "../lib/vector.js";
import { Maximize, UploadCloud, Eye, EyeOff } from "lucide-react";
import HoverCard from "./HoverCard.jsx";
import CanvasSearch from "./CanvasSearch.jsx";

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// readable text colour for a coloured chip background (dark ink on light fills)
function textOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const L = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return L > 150 ? "#0f172a" : "#ffffff";
}

// confidence -> traffic-light colour for the little badge dot on AI suggestions
function confColor(c) {
  const v = c || 0;
  return v >= 0.8 ? "#22c55e" : v >= 0.5 ? "#f59e0b" : "#ef4444";
}

export default function PlanCanvas() {
  const s = useStore();
  const { bg, imgEl, ppf, tool, layers, traces, draft, calib, measure, activeId, selId, activePage, suggestions } = s;
  // traces are pinned to the plan image; don't draw them on the empty upload
  // state (no backdrop) where they'd float at the wrong scale.
  const pageTraces = bg.type === "empty" ? [] : traces.filter((t) => (t.page ?? 0) === activePage);

  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [hover, setHover] = useState(null); // world-space cursor for rubber-band previews
  const [labelsOn, setLabelsOn] = useState(true); // show all quantity/AI chips vs. keep the sheet clean
  const [snapHit, setSnapHit] = useState(null); // vector polyline currently under the cursor (snap tool)
  const pageVectors = s.vectors[activePage] || null;

  // Snap tool: pull the page's real vector geometry once, lazily. Only for
  // vector PDFs (image bg) — scanned pages come back empty.
  useEffect(() => {
    if (tool !== "snap" || bg.type !== "img" || pageVectors) return;
    let cancelled = false;
    s.setVectorsBusy(true);
    extractPageVectors(activePage)
      .then(({ polylines }) => { if (!cancelled) s.setVectors(activePage, polylines); })
      .catch(() => { if (!cancelled) s.setVectors(activePage, []); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, bg.type, activePage, pageVectors]);

  // measure container — a ResizeObserver catches layout changes (collapsing a
  // side panel, toggling the sidebar) that don't fire a window resize event,
  // so the stage always fills the space and re-fits.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.round(s.w) === Math.round(r.width) && Math.round(s.h) === Math.round(r.height) ? s : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // fit plan to view whenever the background or container changes
  const fit = useCallback(() => {
    const scale = Math.min(size.w / bg.w, size.h / bg.h) * 0.92;
    setView({ scale, x: (size.w - bg.w * scale) / 2, y: (size.h - bg.h * scale) / 2 });
  }, [size.w, size.h, bg.w, bg.h]);

  useEffect(() => { fit(); }, [fit, bg.type, bg.href]);

  // keyboard: F or 0 fits the page to the viewport
  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if ((e.key === "f" || e.key === "0") && !e.metaKey && !e.ctrlKey) { e.preventDefault(); fit(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fit]);

  const activeColor = layers.find((l) => l.id === activeId)?.color || "#2f7fd1";
  const inv = 1 / view.scale; // keep strokes/text constant on screen

  const onWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const old = view.scale;
    const pointer = stage.getPointerPosition();
    const mousePt = { x: (pointer.x - view.x) / old, y: (pointer.y - view.y) / old };
    const dir = e.evt.deltaY > 0 ? -1 : 1;
    const scale = Math.max(0.05, Math.min(20, old * (dir > 0 ? 1.12 : 1 / 1.12)));
    setView({ scale, x: pointer.x - mousePt.x * scale, y: pointer.y - mousePt.y * scale });
  };

  const onClick = (e) => {
    if (tool === "pan") return;
    // in select mode, empty-space click clears selection
    if (tool === "select") {
      if (e.target === e.target.getStage()) { s.setSel(null); setPinned(null); }
      return;
    }
    // snap tool: a click drops a linear trace matching the exact vector line
    if (tool === "snap") {
      if (snapHit) {
        s.addSnappedTrace(snapHit.pts);
        const c = centroid(snapHit.pts);
        setFlash(c); setTimeout(() => setFlash(null), 1200);
      }
      return;
    }
    const p = stageRef.current.getRelativePointerPosition();
    s.addPoint({ x: p.x, y: p.y });
  };

  const onDragEnd = (e) => {
    if (e.target === stageRef.current) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
  };

  const needsHover = (tool === "rect" && draft.length) || (tool === "measure" && measure && !measure.b) || (tool === "calibrate" && calib.length === 1);
  const onMove = () => {
    if (tool === "snap") {
      const p = stageRef.current.getRelativePointerPosition();
      setSnapHit(nearestPolyline(pageVectors || [], p, 12 * inv) || null);
      return;
    }
    if (!needsHover) { if (hover) setHover(null); return; }
    const p = stageRef.current.getRelativePointerPosition();
    setHover({ x: p.x, y: p.y });
  };

  // zoom around the viewport centre (used by the on-canvas +/- buttons)
  const zoomBy = (f) => {
    const c = { x: size.w / 2, y: size.h / 2 };
    const old = view.scale;
    const mp = { x: (c.x - view.x) / old, y: (c.y - view.y) / old };
    const scale = Math.max(0.05, Math.min(20, old * f));
    setView({ scale, x: c.x - mp.x * scale, y: c.y - mp.y * scale });
  };

  const measFeet = (a, b) => {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    return ppf ? `${(d / ppf).toFixed(1)} ft` : `${Math.round(d)} px`;
  };

  // ---- hover inspect + search-to-locate ----
  const [hovered, setHovered] = useState(null); // { kind, obj, sx, sy } transient
  const [pinned, setPinned] = useState(null); // clicked item — persistent card
  const [flash, setFlash] = useState(null); // plan-coord point pulsed after a search hit
  const hoverTimer = useRef();
  const screenPos = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    return { sx: (e.evt?.clientX ?? 0) - r.left, sy: (e.evt?.clientY ?? 0) - r.top };
  };
  const hoverProps = (kind, obj) => ({
    onMouseEnter: (e) => { clearTimeout(hoverTimer.current); const { sx, sy } = screenPos(e); setHovered({ kind, obj, sx, sy }); },
    onMouseMove: (e) => { const { sx, sy } = screenPos(e); setHovered((h) => (h && h.obj === obj ? { ...h, sx, sy } : h)); },
    onMouseLeave: () => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setHovered(null), 180); },
  });
  const isHot = (id) => hovered?.obj?.id === id;

  const centerOn = (pt, scale) => {
    const sc = scale || Math.max(view.scale, 1.4);
    setView({ scale: sc, x: size.w / 2 - pt.x * sc, y: size.h / 2 - pt.y * sc });
  };
  // search hit -> centre + flash
  const locate = (pt) => { centerOn(pt); setFlash({ x: pt.x, y: pt.y }); setTimeout(() => setFlash(null), 1600); };

  // fields for the hover card / search (labels + quantities + centroids)
  const unitOf = (t) => (t === "area" ? "SF" : t === "linear" ? "LF" : "EA");
  const qtyText = (o) => {
    const q = traceQty({ type: o.type, pts: o.pts }, ppf);
    return ppf ? `${q.toFixed(o.type === "count" ? 0 : 1)} ${unitOf(o.type)}` : `${o.pts.length} pt${o.pts.length === 1 ? "" : "s"} · set scale`;
  };
  const layerName = (id) => layers.find((l) => l.id === id)?.name || "";
  const project = s.activeProject();

  const confirmDetection = (label, layer, qty) => {
    const addr = project?.address ? ` in ${project.address}` : "";
    runAssistant(`Review this takeoff detection on the current sheet: "${label}" mapped to the ${layer} layer, ~${qty}. Is that classification and rough quantity reasonable? Note a typical unit material cost for it${addr}.`, { image: true });
  };

  return (
    <div ref={wrapRef} className="flex-1 min-w-0 bg-slate-800 overflow-hidden relative">
      <ZoomControls onFit={fit} onIn={() => zoomBy(1.25)} onOut={() => zoomBy(1 / 1.25)} pct={Math.round(view.scale * 100)}
        labelsOn={labelsOn} onToggleLabels={() => setLabelsOn((v) => !v)} />
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        draggable={tool === "pan"}
        onWheel={onWheel}
        onClick={onClick}
        onTap={onClick}
        onMouseMove={onMove}
        onDragEnd={onDragEnd}
        style={{ cursor: tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair" }}
      >
        <Layer listening={false}>
          {bg.type === "img" && imgEl ? (
            <KImage image={imgEl} width={bg.w} height={bg.h} />
          ) : bg.type === "demo" ? (
            <DemoPlan />
          ) : null}
        </Layer>

        <Layer>
          {pageTraces.map((tr) => {
            const L = layers.find((l) => l.id === tr.layer);
            const isExZone = !tr.layer && tr.excluded; // standalone exclusion region
            if (!isExZone && (!L || !L.visible)) return null;
            const sel = tr.id === selId;
            const hot = isHot(tr.id);
            const emph = sel || hot;
            const excluded = tr.excluded;
            const color = isExZone ? "#ef4444" : excluded ? "#94a3b8" : L.color;
            const pick = (e) => { if (tool === "select") { e.cancelBubble = true; s.setSel(tr.id); setPinned({ kind: "trace", obj: tr, ...screenPos(e) }); } };
            const hp = { onClick: pick, onTap: pick, listening: true, ...hoverProps("trace", tr) };
            const dash = excluded ? [10 * inv, 6 * inv] : undefined;

            const handles = sel && tool === "select" && tr.type !== "count" ? tr.pts.map((pt, vi) => (
              <Circle key={"h" + vi} x={pt.x} y={pt.y} radius={6 * inv} fill="#fff" stroke={color} strokeWidth={2 * inv}
                draggable onDragMove={(e) => { e.cancelBubble = true; const np = tr.pts.map((q, qi) => (qi === vi ? { x: e.target.x(), y: e.target.y() } : q)); s.updateTracePts(tr.id, np); }} />
            )) : null;

            const showChip = labelsOn || emph;
            if (tr.type === "area") {
              const c = centroid(tr.pts);
              const label = isExZone ? "EXCLUDED" : excluded ? "excluded" : `${traceQty(tr, ppf).toFixed(0)} SF`;
              return (
                <Group key={tr.id}>
                  <Group {...hp}>
                    <Line points={flatPts(tr.pts)} closed fill={hexToRgba(color, excluded ? 0.14 : emph ? 0.5 : 0.28)}
                      stroke={hot ? "#fff" : color} strokeWidth={(emph ? 3 : 2) * inv} dash={dash} />
                    {showChip && <Chip x={c.x} y={c.y} color={color} inv={inv} text={label} center />}
                  </Group>
                  {handles}
                </Group>
              );
            }
            if (tr.type === "linear") {
              const mid = tr.pts[Math.floor(tr.pts.length / 2)];
              return (
                <Group key={tr.id}>
                  <Group {...hp}>
                    <Line points={flatPts(tr.pts)} stroke={hot ? "#fff" : color} strokeWidth={(emph ? 6 : 4) * inv}
                      lineCap="round" lineJoin="round" hitStrokeWidth={14 * inv} dash={dash} />
                    {showChip && <Chip x={mid.x} y={mid.y} color={color} inv={inv} text={excluded ? "excluded" : `${traceQty(tr, ppf).toFixed(1)} LF`} center />}
                  </Group>
                  {handles}
                </Group>
              );
            }
            const p = tr.pts[0];
            return (
              <Group key={tr.id}>
                <Pin x={p.x} y={p.y} color={color} inv={inv} hot={emph} />
                <HitDot x={p.x} y={p.y} inv={inv} draggable={sel && tool === "select"}
                  onDragMove={(e) => s.updateTracePts(tr.id, [{ x: e.target.x(), y: e.target.y() }])} hp={hp} />
              </Group>
            );
          })}

          {/* draft in progress */}
          {draft.length > 0 && (() => {
            const dc = tool === "exclude" ? "#ef4444" : activeColor;
            const asArea = tool === "exclude" || ASSEMBLIES[layers.find((l) => l.id === activeId).asm].geom === "area";
            return (
              <Group listening={false}>
                {asArea ? (
                  <Line points={flatPts(draft)} closed fill={hexToRgba(dc, 0.2)} stroke={dc} strokeWidth={2 * inv} dash={[6 * inv, 4 * inv]} />
                ) : (
                  <Line points={flatPts(draft)} stroke={dc} strokeWidth={3 * inv} dash={[6 * inv, 4 * inv]} />
                )}
                {draft.map((p, i) => (
                  <Circle key={i} x={p.x} y={p.y} radius={4 * inv} fill="#fff" stroke={dc} strokeWidth={2 * inv} />
                ))}
              </Group>
            );
          })()}

          {/* AI suggestions — ghost candidates a human confirms before pricing.
              Kept visually distinct from confirmed traces (dashed outline / open
              teardrop pin) and DELIBERATELY uncluttered: colour = trade (matches
              the legend), a small traffic-light dot = confidence, and the element
              name only appears on hover or when Labels is on. This is how count-
              heavy tools keep a dense sheet readable. */}
          {suggestions.map((sg) => {
            const c = sg.type === "area" ? centroid(sg.pts) : sg.pts[Math.floor(sg.pts.length / 2)] || sg.pts[0];
            const hot = isHot(sg.id);
            const cc = confColor(sg.confidence);
            const label = sg.sample
              ? `SAMPLE · ${sg.element || sg.layerName || "AI"}`
              : `${sg.element || sg.layerName || "AI"} · ${Math.round((sg.confidence || 0) * 100)}%`;
            const pinIt = (e) => { e.cancelBubble = true; setPinned({ kind: "suggestion", obj: sg, ...screenPos(e) }); };
            const hp = { onClick: pinIt, onTap: pinIt, listening: true, ...hoverProps("suggestion", sg) };
            const showChip = hot || labelsOn;
            return (
              <Group key={sg.id}>
                <Group {...hp}>
                  {sg.type === "area" && (
                    <Line points={flatPts(sg.pts)} closed fill={hexToRgba(sg.color, hot ? 0.32 : 0.16)} stroke={hot ? "#fff" : sg.color}
                      strokeWidth={(hot ? 3 : 2) * inv} dash={[10 * inv, 6 * inv]} />
                  )}
                  {sg.type === "linear" && (
                    <Line points={flatPts(sg.pts)} stroke={hot ? "#fff" : sg.color} strokeWidth={(hot ? 6 : 4) * inv}
                      dash={[10 * inv, 6 * inv]} lineCap="round" hitStrokeWidth={16 * inv} />
                  )}
                  {sg.type === "count" ? (
                    <>
                      <Pin x={sg.pts[0].x} y={sg.pts[0].y} color={sg.color} inv={inv} hot={hot} ghost />
                      <HitDot x={sg.pts[0].x} y={sg.pts[0].y} inv={inv} hp={{}} />
                    </>
                  ) : (
                    // confidence badge for area/linear (pins carry their own look)
                    <Circle x={c.x} y={c.y} radius={4.5 * inv} fill={cc} stroke="#fff" strokeWidth={1.5 * inv} />
                  )}
                </Group>
                {showChip && <Chip x={c.x} y={sg.type === "count" ? c.y - 26 * inv : c.y} color={sg.color} inv={inv} text={label} center dot={cc} />}
              </Group>
            );
          })}

          {/* real vector geometry (snap tool) — the plan's actual lines, faint,
              with the one under the cursor lit up + its exact length */}
          {tool === "snap" && (pageVectors || []).map((poly) => {
            const on = snapHit?.id === poly.id;
            return (
              <Line key={poly.id} points={flatPts(poly.pts)} closed={poly.closed}
                stroke={on ? "#22d3ee" : "#38bdf8"} strokeWidth={(on ? 3 : 0.6) * inv}
                opacity={on ? 1 : 0.3} listening={false} lineCap="round" lineJoin="round" />
            );
          })}
          {tool === "snap" && snapHit && (() => {
            const mid = snapHit.pts[Math.floor(snapHit.pts.length / 2)];
            const lenPx = snapHit.lenPx || polylineLengthPx(snapHit.pts);
            const txt = ppf ? `${(lenPx / ppf).toFixed(1)} ft` : `${Math.round(lenPx)} px · set scale`;
            return <Chip x={mid.x} y={mid.y} color="#0891b2" inv={inv} text={txt} center />;
          })()}

          {/* search-hit flash marker */}
          {flash && (
            <Circle x={flash.x} y={flash.y} radius={16 * inv} stroke="#facc15" strokeWidth={3 * inv} listening={false} />
          )}

          {/* rectangle rubber-band preview */}
          {tool === "rect" && draft.length === 1 && hover && (
            <Line points={[draft[0].x, draft[0].y, hover.x, draft[0].y, hover.x, hover.y, draft[0].x, hover.y]}
              closed fill={hexToRgba(activeColor, 0.2)} stroke={activeColor} strokeWidth={2 * inv} dash={[6 * inv, 4 * inv]} listening={false} />
          )}

          {/* measure (ruler) — non-destructive */}
          {measure && (measure.b || hover) && (() => {
            const end = measure.b || hover;
            const mid = { x: (measure.a.x + end.x) / 2, y: (measure.a.y + end.y) / 2 };
            return (
              <Group listening={false}>
                <Line points={[measure.a.x, measure.a.y, end.x, end.y]} stroke="#22d3ee" strokeWidth={2 * inv} dash={[8 * inv, 4 * inv]} />
                <Circle x={measure.a.x} y={measure.a.y} radius={4 * inv} fill="#22d3ee" />
                <Circle x={end.x} y={end.y} radius={4 * inv} fill="#22d3ee" />
                <Label x={mid.x} y={mid.y} color="#22d3ee" inv={inv} text={measFeet(measure.a, end)} center />
              </Group>
            );
          })()}

          {/* calibration */}
          {calib.length > 0 && (
            <Group listening={false}>
              {calib.length === 2 && (
                <Line points={flatPts(calib)} stroke="#f59e0b" strokeWidth={2 * inv} dash={[6 * inv, 4 * inv]} />
              )}
              {calib.map((p, i) => (
                <Circle key={i} x={p.x} y={p.y} radius={5 * inv} fill="#f59e0b" stroke="#fff" strokeWidth={2 * inv} />
              ))}
            </Group>
          )}
        </Layer>
      </Stage>

      {bg.type === "empty" && <UploadPrompt traceCount={traces.length} />}

      {bg.type !== "empty" && <CanvasSearch traces={pageTraces} suggestions={suggestions} layerName={layerName} qtyText={qtyText} onLocate={locate} />}

      {(() => {
        const card = pinned || hovered;
        if (!card) return null;
        const isPinned = !!pinned;
        const clear = () => { setPinned(null); setHovered(null); };
        return (
          <HoverCard
            kind={card.kind} obj={card.obj} sx={card.sx} sy={card.sy} wrapW={size.w} wrapH={size.h} pinned={isPinned}
            layerName={card.kind === "trace" ? layerName(card.obj.layer) : card.obj.layerName}
            qty={qtyText(card.obj)}
            onKeep={() => clearTimeout(hoverTimer.current)}
            onDismiss={() => setHovered(null)}
            onClose={clear}
            onAccept={card.kind === "suggestion" ? () => { s.acceptSuggestion(card.obj.id); clear(); } : null}
            onExclude={card.kind === "trace" ? () => { s.toggleExclude(card.obj.id); clear(); } : null}
            onDelete={card.kind === "trace" ? () => { s.setSel(card.obj.id); s.deleteSel(); clear(); } : null}
            onConfirm={() => confirmDetection(card.kind === "suggestion" ? card.obj.element : layerName(card.obj.layer), card.kind === "suggestion" ? card.obj.layerName : layerName(card.obj.layer), qtyText(card.obj))}
          />
        );
      })()}
    </div>
  );
}

// Shown on a project's canvas before any plan has been imported.
function UploadPrompt({ traceCount }) {
  const ref = useRef(null);
  const onFile = async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await importPlanFile(f, useStore.getState()); };
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
      <div className="text-center max-w-xs">
        <div className="mx-auto w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center text-brand mb-3"><UploadCloud size={26} /></div>
        <div className="text-slate-200 font-semibold">Upload a plan to start</div>
        <div className="text-sm text-slate-500 mt-1">PDF plan set or image. Drag &amp; drop onto the canvas, or</div>
        <button onClick={() => ref.current?.click()} className="mt-3 inline-flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-lg bg-brand hover:bg-brand2 text-white font-medium">
          <UploadCloud size={15} /> Upload plan
        </button>
        {traceCount > 0 && <div className="text-[11px] text-amber-400/90 mt-3">You have {traceCount} saved trace{traceCount === 1 ? "" : "s"} — re-upload the same plan to see them.</div>}
        <input ref={ref} type="file" accept={ACCEPT} className="hidden" onChange={onFile} />
      </div>
    </div>
  );
}

function ZoomControls({ onFit, onIn, onOut, pct, labelsOn, onToggleLabels }) {
  return (
    <div className="absolute bottom-3 left-3 z-30 flex items-center gap-1 rounded-lg bg-slate-900/90 border border-slate-700 p-1 shadow-lg">
      <button onClick={onOut} aria-label="Zoom out" className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-700 text-slate-200 text-lg leading-none">−</button>
      <button onClick={onFit} aria-label="Reset zoom" className="px-2 h-7 rounded hover:bg-slate-700 text-slate-300 text-xs tabular-nums min-w-[3rem]">{pct}%</button>
      <button onClick={onIn} aria-label="Zoom in" className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-700 text-slate-200 text-lg leading-none">+</button>
      <div className="w-px h-5 bg-slate-700 mx-0.5" />
      <button onClick={onFit} aria-label="Fit page to screen" title="Fit to screen (F)" className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-700 text-slate-200"><Maximize size={14} /></button>
      <button onClick={onToggleLabels} aria-label="Toggle labels" title={labelsOn ? "Hide labels — keep the sheet clean" : "Show all labels"}
        className={`w-7 h-7 flex items-center justify-center rounded hover:bg-slate-700 ${labelsOn ? "text-brand" : "text-slate-500"}`}>
        {labelsOn ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
    </div>
  );
}

// A solid rounded label chip — readable at any zoom, like the tool chips in
// Bluebeam/STACK. `dot` draws a small confidence badge on the left edge.
function Chip({ x, y, text, color, inv, center, dot }) {
  const fs = 12 * inv;
  const padX = 7 * inv, h = fs + 8 * inv;
  const w = text.length * 6.7 * inv + padX * 2 + (dot ? 10 * inv : 0);
  const bx = center ? x - w / 2 : x + 10 * inv;
  const by = center ? y - h / 2 : y - h - 4 * inv;
  const ink = textOn(color);
  return (
    <Group listening={false}>
      <Rect x={bx} y={by} width={w} height={h} cornerRadius={h / 2} fill={color}
        stroke="#0f172a" strokeWidth={0.75 * inv} shadowColor="#000" shadowBlur={5 * inv} shadowOpacity={0.4} />
      {dot && <Circle x={bx + padX + 2 * inv} y={by + h / 2} radius={3.2 * inv} fill={dot} stroke={ink} strokeWidth={0.75 * inv} />}
      <Text x={bx + (dot ? 12 * inv : 0)} y={by} width={w - (dot ? 12 * inv : 0)} height={h}
        align="center" verticalAlign="middle" text={text} fontSize={fs} fontStyle="bold" fill={ink} />
    </Group>
  );
}

// A map-style teardrop pin for COUNT items (doors, windows, gates, fixtures) —
// the convention count-heavy takeoff tools (Countfire, Bluebeam) use so each
// item reads as a distinct dropped marker. `ghost` = an unconfirmed AI guess.
function Pin({ x, y, color, inv, hot, ghost }) {
  const r = (hot ? 10 : 8) * inv;
  const cy = y - 2.4 * r; // head sits above the tip so the point marks the item
  return (
    <Group listening={false} opacity={ghost ? 0.9 : 1}>
      <Line points={[x - 0.6 * r, cy + r * 0.5, x, y, x + 0.6 * r, cy + r * 0.5]} closed
        fill={color} stroke={ghost ? color : "#fff"} strokeWidth={ghost ? 0 : 1.5 * inv} />
      <Circle x={x} y={cy} radius={r} fill={color} stroke="#fff" strokeWidth={2 * inv}
        dash={ghost ? [3.2 * inv, 2.4 * inv] : undefined}
        shadowColor="#000" shadowBlur={4 * inv} shadowOpacity={0.35} />
      <Circle x={x} y={cy} radius={r * 0.36} fill="#fff" />
    </Group>
  );
}

// Invisible hit target so a listening=false marker (Pin) is still hoverable /
// clickable / draggable. Sits over the pin tip.
function HitDot({ x, y, inv, draggable, onDragMove, hp }) {
  return <Circle x={x} y={y} radius={22 * inv} fill="transparent" draggable={draggable} onDragMove={onDragMove} {...hp} />;
}

/* demo shell plan (~33' x 72' at 8 px/ft) drawn with Konva shapes */
function DemoPlan() {
  const ppf = 8, W = 820, H = 680, x0 = 250, y0 = 40, w = 33 * ppf, h = 72 * ppf;
  const grid = [];
  for (let i = 0; i * 40 <= W; i++) grid.push(<Line key={"v" + i} points={[i * 40, 0, i * 40, H]} stroke="#eee" strokeWidth={1} />);
  for (let i = 0; i * 40 <= H; i++) grid.push(<Line key={"h" + i} points={[0, i * 40, W, i * 40]} stroke="#eee" strokeWidth={1} />);
  return (
    <Group>
      <Rect x={0} y={0} width={W} height={H} fill="#fbfbf9" />
      {grid}
      <Rect x={x0} y={y0} width={w} height={h} stroke="#333" strokeWidth={5} />
      <Line points={[x0, y0 + h - 150, x0 + w, y0 + h - 150]} stroke="#666" strokeWidth={3} />
      <Line points={[x0 + w * 0.5, y0 + h - 150, x0 + w * 0.5, y0 + h]} stroke="#666" strokeWidth={3} />
      <Line points={[x0 + w * 0.5, y0 + h - 80, x0 + w, y0 + h - 80]} stroke="#666" strokeWidth={3} />
      <Text x={x0} y={y0 + 110} width={w} align="center" text="DINING" fill="#bbb" fontSize={15} fontStyle="bold" />
      <Text x={x0} y={y0 + h - 210} width={w} align="center" text="KITCHEN" fill="#bbb" fontSize={15} fontStyle="bold" />
      <Text x={x0} y={y0 + h - 45} width={w * 0.5} align="center" text="REST" fill="#ccc" fontSize={11} />
      <Text x={x0 + w * 0.5} y={y0 + h - 115} width={w * 0.5} align="center" text="STOR" fill="#ccc" fontSize={11} />
      {/* scale bar 10 ft */}
      <Line points={[40, H - 30, 40 + 10 * ppf, H - 30]} stroke="#333" strokeWidth={2} />
      <Line points={[40, H - 34, 40, H - 26]} stroke="#333" strokeWidth={2} />
      <Line points={[40 + 10 * ppf, H - 34, 40 + 10 * ppf, H - 26]} stroke="#333" strokeWidth={2} />
      <Text x={20} y={H - 22} width={40 + 20 * ppf} align="left" text="        10 ft" fill="#666" fontSize={11} />
    </Group>
  );
}
