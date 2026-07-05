import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Stage, Layer, Image as KImage, Rect, Line, Circle, Text, Group } from "react-konva";
import { useStore } from "../store/useStore.js";
import { ASSEMBLIES } from "../lib/assemblies.js";
import { traceQty, centroid, flatPts } from "../lib/geometry.js";
import { runAssistant } from "../lib/planAssistant.js";
import { importPlanFile, ACCEPT } from "../lib/importPlan.js";
import { extractPageVectors } from "../lib/pdf.js";
import { polylineLengthPx, buildRunIndex, nearestSegment, growRun, snapPoint } from "../lib/vector.js";
import { floodRoom } from "../lib/floodArea.js";
import { Maximize, UploadCloud, Eye, EyeOff, Trash2, Ban, Copy, Check, Undo2, X, RotateCcw } from "lucide-react";
import HoverCard from "./HoverCard.jsx";
import CanvasSearch from "./CanvasSearch.jsx";
import SheetLoadOverlay from "./SheetLoadOverlay.jsx";

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

const HI_GREEN = "#22c55e";
const HI_GREEN_BRIGHT = "#4ade80";

function traceStroke(color, sel, hot, excluded) {
  if (excluded) return "#94a3b8";
  if (hot) return HI_GREEN_BRIGHT;
  if (sel) return HI_GREEN;
  return color;
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
  const [snapHit, setSnapHit] = useState(null); // full wall run currently under the cursor (snap tool)
  const [snapPt, setSnapPt] = useState(null); // snap-to-content target for drawing tools
  const [roomBusy, setRoomBusy] = useState(false);
  const [toast, setToast] = useState(null); // transient status message over the canvas
  const pageVectors = s.vectors[activePage] || null;
  // segment index for growing a whole collinear wall run from one click
  const runIndex = useMemo(() => (pageVectors ? buildRunIndex(pageVectors) : null), [pageVectors]);
  const say = (msg) => { setToast(msg); clearTimeout(say._t); say._t = setTimeout(() => setToast(null), 3200); };

  // tools that read the plan's real geometry
  const wantsVectors = tool === "snap" || tool === "draw" || tool === "rect" || tool === "calibrate" || tool === "measure";
  useEffect(() => {
    if (!wantsVectors || bg.type !== "img" || pageVectors) return;
    let cancelled = false;
    s.setVectorsBusy(true);
    extractPageVectors(activePage)
      .then(({ polylines }) => { if (!cancelled) s.setVectors(activePage, polylines); })
      .catch(() => { if (!cancelled) s.setVectors(activePage, []); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsVectors, bg.type, activePage, pageVectors]);

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

  // dev/test hook: drive the canvas view + snap hover deterministically (React
  // owns the Stage transform, so imperative Konva calls get snapped back)
  useEffect(() => {
    window.__planView = {
      set: setView, get: () => view, size, fit,
      // exactly the snap-tool hover path, minus the pointer: world coords in,
      // the same grown run the user would see out (and shown on canvas)
      snapProbe: (x, y, tol = 12 / view.scale) => {
        if (!runIndex) return null;
        const seed = nearestSegment(runIndex, { x, y }, tol);
        if (!seed) { setSnapHit(null); return null; }
        const pts = growRun(runIndex, seed);
        const hit = { pts, lenPx: polylineLengthPx(pts) };
        setSnapHit(hit);
        return { pts: pts.length, lenPx: Math.round(hit.lenPx), ft: ppf ? Math.round((hit.lenPx / ppf) * 10) / 10 : null };
      },
    };
    return () => { delete window.__planView; };
  }, [view, size, runIndex, ppf]);

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
    // room tool: flood-fill the enclosed region around the click (Dynamic
    // Fill / SingleClick mechanism) and drop it as an exact area trace
    if (tool === "room") {
      if (bg.type !== "img" || !imgEl) { say("Open an uploaded plan page first."); return; }
      if (roomBusy) return;
      setRoomBusy(true);
      // yield a frame so the busy cursor shows before the fill work
      setTimeout(() => {
        try {
          const res = floodRoom(imgEl, bg.w, bg.h, p);
          if (res.pts) {
            const before = useStore.getState().traces.length;
            s.addAreaTrace(res.pts);
            if (useStore.getState().traces.length === before) {
              say("No area layer to put this on — add one (e.g. Slab, Flooring) and click again.");
            } else {
              setFlash(centroid(res.pts)); setTimeout(() => setFlash(null), 1200);
            }
          } else if (res.leaked) {
            say("Region isn't enclosed — the fill escaped through an opening. Draw the area manually or trace a boundary first.");
          } else {
            say("No room found at that point — click inside an enclosed space.");
          }
        } catch (err) {
          say(err.message);
        } finally {
          setRoomBusy(false);
        }
      }, 30);
      return;
    }
    // drawing tools snap to the plan's real geometry (endpoint > midpoint > edge)
    const snapped = snapPt || (runIndex ? snapPoint(runIndex, p, 10 * inv) : null);
    s.addPoint(snapped ? { x: snapped.x, y: snapped.y } : { x: p.x, y: p.y });
  };

  const onDragEnd = (e) => {
    if (e.target === stageRef.current) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
  };

  const needsHover = (tool === "rect" && draft.length) || (tool === "measure" && measure && !measure.b) || (tool === "calibrate" && calib.length === 1);
  const drawSnapTool = tool === "draw" || tool === "rect" || tool === "calibrate" || tool === "measure";
  const onMove = () => {
    if (tool === "snap") {
      const p = stageRef.current.getRelativePointerPosition();
      const seed = runIndex ? nearestSegment(runIndex, p, 12 * inv) : null;
      if (!seed) { if (snapHit) setSnapHit(null); return; }
      const pts = growRun(runIndex, seed); // extend along the whole collinear run
      setSnapHit({ pts, lenPx: polylineLengthPx(pts) });
      return;
    }
    // snap-to-content indicator for the drawing tools
    if (drawSnapTool && runIndex) {
      const p = stageRef.current.getRelativePointerPosition();
      setSnapPt(snapPoint(runIndex, p, 10 * inv));
    } else if (snapPt) setSnapPt(null);
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
    if (!a || !b) return "";
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    return ppf ? `${(d / ppf).toFixed(2)} ft` : `${Math.round(d)} px`;
  };

  const [hovered, setHovered] = useState(null); // { kind, obj, sx, sy } transient
  const [pinned, setPinned] = useState(null); // clicked item — persistent card
  const [flash, setFlash] = useState(null); // plan-coord point pulsed after a search hit
  const hoverTimer = useRef();
  const dragHistoryPushed = useRef(false);

  useEffect(() => {
    if (tool === "calibrate" || tool === "measure") {
      setPinned(null);
      setHovered(null);
    }
  }, [tool]);
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
  const canvasMinimal = tool === "calibrate" || tool === "measure";

  const confirmDetection = (label, layer, qty) => {
    const addr = project?.address ? ` in ${project.address}` : "";
    runAssistant(`Review this takeoff detection on the current sheet: "${label}" mapped to the ${layer} layer, ~${qty}. Is that classification and rough quantity reasonable? Note a typical unit material cost for it${addr}.`, { image: true });
  };

  return (
    <div ref={wrapRef} className="takeoff-canvas flex-1 min-w-0 overflow-hidden relative">
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
        style={{ cursor: tool === "pan" ? "grab" : tool === "select" ? "default" : roomBusy ? "progress" : "crosshair" }}
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
            const stroke = traceStroke(color, sel, hot, excluded);
            const glow = hot || sel;
            const handleFill = hot ? HI_GREEN_BRIGHT : sel ? HI_GREEN : "#fff";
            const handleStroke = hot || sel ? "#14532d" : stroke;

            // vertex handles: drag to move, double-click to remove the point.
            // Dense machine-made traces (flood fills, snapped runs) would drown
            // in handles — draw those small, and skip midpoints entirely.
            const minPts = tr.type === "area" ? 3 : 2;
            const dense = tr.pts.length > 20;
            const handles = sel && tool === "select" && tr.type !== "count" ? tr.pts.map((pt, vi) => (
              <Circle key={"h" + vi} x={pt.x} y={pt.y} radius={(dense ? 3 : 6) * inv} fill={handleFill} stroke={handleStroke} strokeWidth={(dense ? 1.25 : 2) * inv}
                draggable
                onDragStart={() => { if (!dragHistoryPushed.current) { s.pushHistory(); dragHistoryPushed.current = true; } }}
                onDragEnd={() => { dragHistoryPushed.current = false; }}
                onDragMove={(e) => { e.cancelBubble = true; const np = tr.pts.map((q, qi) => (qi === vi ? { x: e.target.x(), y: e.target.y() } : q)); s.updateTracePts(tr.id, np); }}
                onDblClick={(e) => { e.cancelBubble = true; if (tr.pts.length > minPts) { s.pushHistory(); s.updateTracePts(tr.id, tr.pts.filter((_, qi) => qi !== vi)); } }} />
            )) : null;
            // midpoint handles: click to insert a vertex there (then drag it)
            const midCount = dense ? 0 : tr.type === "area" ? tr.pts.length : tr.pts.length - 1;
            const midHandles = sel && tool === "select" && tr.type !== "count" ? Array.from({ length: midCount }, (_, vi) => {
              const a = tr.pts[vi], b = tr.pts[(vi + 1) % tr.pts.length];
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
              return (
                <Circle key={"mh" + vi} x={mx} y={my} radius={4 * inv} fill={hot || sel ? "#14532d" : "#0f172a"} stroke={handleStroke} strokeWidth={1.5 * inv} opacity={0.9}
                  onClick={(e) => { e.cancelBubble = true; s.pushHistory(); const np = [...tr.pts]; np.splice(vi + 1, 0, { x: mx, y: my }); s.updateTracePts(tr.id, np); }}
                  onTap={(e) => { e.cancelBubble = true; s.pushHistory(); const np = [...tr.pts]; np.splice(vi + 1, 0, { x: mx, y: my }); s.updateTracePts(tr.id, np); }} />
              );
            }) : null;

            const showChip = !canvasMinimal && (labelsOn || emph);
            if (tr.type === "area") {
              const c = centroid(tr.pts);
              const label = isExZone ? "EXCLUDED" : excluded ? "excluded" : `${traceQty(tr, ppf).toFixed(0)} SF`;
              return (
                <Group key={tr.id} {...hp}>
                  <Line points={flatPts(tr.pts)} closed fill={hexToRgba(stroke, excluded ? 0.14 : hot ? 0.38 : sel ? 0.32 : 0.28)}
                    stroke={stroke} strokeWidth={(hot ? 3.5 : emph ? 3 : 2) * inv} dash={dash}
                    shadowColor={glow ? (hot ? HI_GREEN_BRIGHT : HI_GREEN) : undefined} shadowBlur={glow ? (hot ? 10 : 6) * inv : 0} shadowOpacity={0.9} />
                  {showChip && <Chip x={c.x} y={c.y} color={hot ? HI_GREEN_BRIGHT : sel ? HI_GREEN : color} inv={inv} text={label} center />}
                  {midHandles}
                  {handles}
                </Group>
              );
            }
            if (tr.type === "linear") {
              const mid = tr.pts[Math.floor(tr.pts.length / 2)];
              return (
                <Group key={tr.id} {...hp}>
                  <Line points={flatPts(tr.pts)} stroke={stroke} strokeWidth={(hot ? 7 : emph ? 6 : 4) * inv}
                    lineCap="round" lineJoin="round" hitStrokeWidth={14 * inv} dash={dash}
                    shadowColor={glow ? (hot ? HI_GREEN_BRIGHT : HI_GREEN) : undefined} shadowBlur={glow ? (hot ? 12 : 8) * inv : 0} shadowOpacity={0.9} />
                  {showChip && <Chip x={mid.x} y={mid.y} color={hot ? HI_GREEN_BRIGHT : sel ? HI_GREEN : color} inv={inv} text={excluded ? "excluded" : `${traceQty(tr, ppf).toFixed(1)} LF`} center />}
                  {midHandles}
                  {handles}
                </Group>
              );
            }
            const p = tr.pts[0];
            return (
              <Group key={tr.id} {...hp}>
                <Pin x={p.x} y={p.y} color={hot ? HI_GREEN_BRIGHT : sel ? HI_GREEN : color} inv={inv} hot={emph} />
                <HitDot x={p.x} y={p.y} inv={inv} draggable={sel && tool === "select"}
                  onDragStart={() => { if (!dragHistoryPushed.current) { s.pushHistory(); dragHistoryPushed.current = true; } }}
                  onDragEnd={() => { dragHistoryPushed.current = false; }}
                  onDragMove={(e) => s.updateTracePts(tr.id, [{ x: e.target.x(), y: e.target.y() }])} />
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
              : sg.vector
                ? (sg.element || sg.layerName || "")
                : `${sg.element || sg.layerName || "AI"} · ${Math.round((sg.confidence || 0) * 100)}%`;
            const pinIt = (e) => { e.cancelBubble = true; setPinned({ kind: "suggestion", obj: sg, ...screenPos(e) }); };
            const hp = { onClick: pinIt, onTap: pinIt, listening: true, ...hoverProps("suggestion", sg) };
            const showChip = !canvasMinimal && (hot || labelsOn);
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

          {/* snap tool: NOTHING is drawn until you hover an actual line — then
              only that one line lights up with its endpoints + exact length.
              (No faint "soup" of every line, which read as useless clutter.) */}
          {tool === "snap" && snapHit && (() => {
            const mid = snapHit.pts[Math.floor(snapHit.pts.length / 2)];
            const lenPx = snapHit.lenPx || polylineLengthPx(snapHit.pts);
            const txt = ppf ? `${(lenPx / ppf).toFixed(1)} ft` : `${Math.round(lenPx)} px · set scale`;
            const ends = [snapHit.pts[0], snapHit.pts[snapHit.pts.length - 1]];
            return (
              <Group listening={false}>
                <Line points={flatPts(snapHit.pts)} closed={snapHit.closed} stroke={HI_GREEN_BRIGHT} strokeWidth={4 * inv}
                  lineCap="round" lineJoin="round" shadowColor={HI_GREEN} shadowBlur={10 * inv} shadowOpacity={0.95} />
                {ends.map((p, i) => (
                  <Circle key={i} x={p.x} y={p.y} radius={4 * inv} fill={HI_GREEN_BRIGHT} stroke="#14532d" strokeWidth={1.5 * inv} />
                ))}
                <Chip x={mid.x} y={mid.y} color={HI_GREEN} inv={inv} text={txt} center />
              </Group>
            );
          })()}

          {/* snap-to-content indicator: the drawing click will land HERE */}
          {drawSnapTool && snapPt && (
            <Group listening={false}>
              <Circle x={snapPt.x} y={snapPt.y} radius={6 * inv} stroke="#22d3ee" strokeWidth={2 * inv} />
              <Circle x={snapPt.x} y={snapPt.y} radius={1.6 * inv} fill="#22d3ee" />
            </Group>
          )}

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
          {tool === "measure" && measure?.a && (
            <DimLine
              a={measure.a}
              b={measure.b || hover}
              inv={inv}
              color="#22d3ee"
              accent="#0891b2"
              draft={!measure.b}
              label={measure.b || hover ? measFeet(measure.a, measure.b || hover) : null}
            />
          )}

          {/* calibration — rubber-band while placing 2nd point */}
          {tool === "calibrate" && calib.length > 0 && (
            <DimLine
              a={calib[0]}
              b={calib.length === 2 ? calib[1] : hover}
              inv={inv}
              color="#fbbf24"
              accent="#f59e0b"
              draft={calib.length < 2}
            />
          )}
        </Layer>
      </Stage>

      {toast && (
        <div className="canvas-toast absolute top-14 left-1/2 -translate-x-1/2 z-50 max-w-md px-4 py-2.5 rounded-xl bg-slate-950/95 border border-amber-700/50 text-sm text-amber-100 shadow-xl backdrop-blur-sm">
          {toast}
        </div>
      )}

      {tool === "measure" && (
        <MeasureToolHud measure={measure} hover={hover} ppf={ppf} measFeet={measFeet} />
      )}

      {tool === "calibrate" && calib.length < 2 && (
        <div className="absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 z-20 pointer-events-none max-md:bottom-[5.5rem]">
          <div className="px-3 py-1.5 rounded-full bg-slate-950/75 border border-amber-800/40 text-[11px] text-amber-200/90 shadow-md backdrop-blur-sm">
            {calib.length === 0 ? "Click the first point on a known distance" : "Click the second point — use the toolbar to enter feet"}
          </div>
        </div>
      )}

      {/* quick actions on the selected trace — Exclude / Duplicate / Delete
          right where you're working, instead of hunting through panels */}
      {(() => {
        if (tool !== "select") return null;
        const tr = pageTraces.find((t) => t.id === selId);
        if (!tr) return null;
        let minY = Infinity, minX = Infinity, maxX = -Infinity;
        for (const p of tr.pts) { if (p.y < minY) minY = p.y; if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; }
        const sx = view.x + ((minX + maxX) / 2) * view.scale;
        const sy = view.y + minY * view.scale;
        const left = Math.max(8, Math.min(size.w - 150, sx - 70));
        const top = Math.max(8, sy - 46);
        const QA = ({ icon: I, label, tone, onClick }) => (
          <button onClick={onClick} title={label} aria-label={label}
            className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-700 ${tone || "text-slate-200"}`}>
            <I size={15} />
          </button>
        );
        return (
          <div className="absolute z-40 flex items-center gap-0.5 rounded-lg bg-slate-900/95 border border-slate-700 p-0.5 shadow-xl"
            style={{ left, top }}>
            <QA icon={tr.excluded ? RotateCcw : Ban} label={tr.excluded ? "Include in takeoff" : "Exclude from takeoff"}
              tone={tr.excluded ? "text-emerald-300" : "text-amber-300"} onClick={() => s.toggleExclude(tr.id)} />
            <QA icon={Copy} label="Duplicate" onClick={() => s.duplicateTrace(tr.id)} />
            <QA icon={Trash2} label="Delete (⌫)" tone="text-rose-300" onClick={() => { s.setSel(tr.id); s.deleteSel(); setPinned(null); }} />
            <div className="w-px h-5 bg-slate-700" />
            <QA icon={X} label="Deselect (Esc)" tone="text-slate-400" onClick={() => { s.setSel(null); setPinned(null); }} />
          </div>
        );
      })()}

      {/* quick actions while drawing — Finish / Undo / Cancel at the pen tip */}
      {(tool === "draw" || tool === "exclude") && draft.length > 0 && (() => {
        const last = draft[draft.length - 1];
        const sx = view.x + last.x * view.scale, sy = view.y + last.y * view.scale;
        const left = Math.max(8, Math.min(size.w - 140, sx + 14));
        const top = Math.max(8, Math.min(size.h - 44, sy + 14));
        const need = tool === "exclude" || s.activeGeom() === "area" ? 3 : 2;
        const ok = draft.length >= need;
        return (
          <div className="absolute z-40 flex items-center gap-0.5 rounded-lg bg-slate-900/95 border border-slate-700 p-0.5 shadow-xl" style={{ left, top }}>
            <button onClick={s.finishDraft} disabled={!ok} title={ok ? "Finish (Enter)" : `Need ${need} points`}
              className={`h-8 px-2.5 flex items-center gap-1 rounded-md text-[12px] font-medium ${ok ? "bg-emerald-700 hover:bg-emerald-600 text-white" : "text-slate-600"}`}>
              <Check size={14} /> Finish
            </button>
            <button onClick={s.undoPoint} title="Undo point" aria-label="Undo point" className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-700 text-slate-200"><Undo2 size={14} /></button>
            <button onClick={() => s.setTool(tool)} title="Cancel (Esc)" aria-label="Cancel draft" className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-700 text-slate-400"><X size={14} /></button>
          </div>
        );
      })()}
      {roomBusy && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-3 py-2 rounded-lg bg-slate-900/95 border border-slate-700 text-[12px] text-cyan-300 shadow-lg">
          Filling room…
        </div>
      )}

      {bg.type === "empty" && <UploadPrompt traceCount={traces.length} />}

      <SheetLoadOverlay />

      {bg.type !== "empty" && !canvasMinimal && (
        <CanvasSearch traces={pageTraces} suggestions={suggestions} layerName={layerName} qtyText={qtyText} onLocate={locate} />
      )}

      {(() => {
        if (canvasMinimal) return null;
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
      <div className="upload-prompt-card text-center max-w-sm rounded-2xl border border-slate-700/60 bg-slate-950/80 backdrop-blur-md p-8 shadow-2xl shadow-black/40">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-brand/25 to-brand/5 flex items-center justify-center text-brand mb-4 ring-1 ring-brand/20 import-file-icon">
          <UploadCloud size={28} />
        </div>
        <div className="text-slate-100 font-semibold text-lg">Upload a plan to start</div>
        <div className="text-sm text-slate-400 mt-2 leading-relaxed">PDF plan set or image. Drag &amp; drop onto the canvas, or use the button below.</div>
        <button onClick={() => ref.current?.click()} className="desk-btn-primary mt-5 inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg font-medium">
          <UploadCloud size={16} /> Upload plan
        </button>
        {traceCount > 0 && <div className="text-xs text-emerald-400/90 mt-4">{traceCount} saved trace{traceCount === 1 ? "" : "s"} — reload with the plan after refresh.</div>}
        <input ref={ref} type="file" accept={ACCEPT} className="hidden" onChange={onFile} />
      </div>
    </div>
  );
}

function ZoomControls({ onFit, onIn, onOut, pct, labelsOn, onToggleLabels }) {
  return (
    <div className="canvas-zoom-dock absolute bottom-4 left-4 max-md:bottom-3 max-md:left-3 z-30 flex items-center gap-0.5 p-1 touch-manipulation">
      <button onClick={onOut} aria-label="Zoom out" className="w-9 h-9 md:w-8 md:h-8 flex items-center justify-center rounded-lg text-slate-200 text-lg leading-none font-light">−</button>
      <button onClick={onFit} aria-label="Reset zoom" title="Click to fit (F)" className="px-2.5 h-9 md:h-8 rounded-lg hover:bg-slate-800/90 text-slate-300 text-xs font-medium tabular-nums min-w-[3.25rem]">{pct}%</button>
      <button onClick={onIn} aria-label="Zoom in" className="w-9 h-9 md:w-8 md:h-8 flex items-center justify-center rounded-lg text-slate-200 text-lg leading-none font-light">+</button>
      <div className="w-px h-6 bg-slate-700/80 mx-0.5" />
      <button onClick={onFit} aria-label="Fit page to screen" title="Fit to screen (F)" className="w-9 h-9 md:w-8 md:h-8 flex items-center justify-center rounded-lg text-slate-200 hover:text-brand"><Maximize size={15} /></button>
      <button onClick={onToggleLabels} aria-label="Toggle labels" title={labelsOn ? "Hide quantity labels" : "Show quantity labels"}
        className={`w-9 h-9 md:w-8 md:h-8 flex items-center justify-center rounded-lg transition-colors ${labelsOn ? "text-brand bg-brand/10" : "text-slate-500 hover:text-slate-300"}`}>
        {labelsOn ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>
    </div>
  );
}

// Architectural-style dimension line with endpoint ticks, drag rubber-band,
// and anchored point markers. Used by Quick ruler + Calibrate.
function DimLine({ a, b, inv, color, accent, draft, label }) {
  if (!a || !b) {
    if (a) return <Endpoint x={a.x} y={a.y} inv={inv} color={color} accent={accent} fixed />;
    return null;
  }
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return <Endpoint x={a.x} y={a.y} inv={inv} color={color} accent={accent} fixed />;

  const nx = -dy / len, ny = dx / len;
  const tick = 9 * inv;
  const tickA = [a.x + nx * tick, a.y + ny * tick, a.x - nx * tick, a.y - ny * tick];
  const tickB = [b.x + nx * tick, b.y + ny * tick, b.x - nx * tick, b.y - ny * tick];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const c = accent || color;

  return (
    <Group listening={false}>
      <Line points={[a.x, a.y, b.x, b.y]} stroke={c} strokeWidth={7 * inv} opacity={draft ? 0.12 : 0.18} lineCap="round" />
      <Line points={[a.x, a.y, b.x, b.y]} stroke={color} strokeWidth={2.5 * inv}
        dash={draft ? [10 * inv, 6 * inv] : undefined} lineCap="round"
        shadowColor={c} shadowBlur={draft ? 10 * inv : 5 * inv} shadowOpacity={0.55} />
      <Line points={tickA} stroke={color} strokeWidth={2.5 * inv} lineCap="round" />
      <Line points={tickB} stroke={color} strokeWidth={2.5 * inv} lineCap="round" />
      <Endpoint x={a.x} y={a.y} inv={inv} color={color} accent={accent} fixed />
      <Endpoint x={b.x} y={b.y} inv={inv} color={color} accent={accent} draft={draft} />
      {label && <Chip x={mid.x} y={mid.y - 16 * inv} text={label} color={c} inv={inv} center />}
    </Group>
  );
}

// Fixed anchor = filled square + crosshair; draft end = open ring + crosshair.
function Endpoint({ x, y, inv, color, accent, fixed, draft }) {
  const r = (fixed ? 5 : 6) * inv;
  const c = accent || color;
  const arm = 10 * inv;
  return (
    <Group listening={false}>
      <Line points={[x - arm, y, x + arm, y]} stroke={color} strokeWidth={1.25 * inv} opacity={0.85} />
      <Line points={[x, y - arm, x, y + arm]} stroke={color} strokeWidth={1.25 * inv} opacity={0.85} />
      {fixed ? (
        <>
          <Rect x={x - r} y={y - r} width={r * 2} height={r * 2} fill={c} stroke="#fff" strokeWidth={2 * inv}
            shadowColor="#000" shadowBlur={4 * inv} shadowOpacity={0.35} />
          <Circle x={x} y={y} radius={1.8 * inv} fill="#fff" />
        </>
      ) : (
        <>
          <Circle x={x} y={y} radius={r} stroke={color} strokeWidth={2.5 * inv}
            dash={draft ? [4 * inv, 3 * inv] : undefined} fill={draft ? hexToRgba(color, 0.15) : c} />
          <Circle x={x} y={y} radius={1.8 * inv} fill="#fff" />
        </>
      )}
    </Group>
  );
}

// Compact bottom strip for Quick ruler — calibrate uses the toolbar panel only.
function MeasureToolHud({ measure, hover, ppf, measFeet }) {
  const isMeasure = tool === "measure";
  const border = "border-cyan-700/50";
  const text = "text-cyan-200";

  let step = "", live = null;
  if (!measure?.a) step = "Click the first point";
  else if (!measure.b) {
    step = "Click the second point";
    if (hover) live = measFeet(measure.a, hover);
  } else {
    step = "Esc to exit · click for a new line";
    live = measFeet(measure.a, measure.b);
  }

  return (
    <div className="absolute bottom-[4.5rem] left-4 max-md:bottom-[5.5rem] max-md:left-3 z-20 pointer-events-none">
      <div className={`flex flex-col gap-0.5 px-3 py-2 rounded-xl bg-slate-950/80 border ${border} shadow-lg backdrop-blur-sm max-w-[14rem]`}>
        {live && <div className={`text-base font-bold tabular-nums ${text}`}>{live}</div>}
        <div className="text-[10px] text-slate-400 leading-snug">{step}</div>
        {!ppf && measure?.a && !measure.b && (
          <div className="text-[9px] text-slate-500">Set scale for feet</div>
        )}
      </div>
    </div>
  );
}

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
function HitDot({ x, y, inv, draggable, onDragStart, onDragEnd, onDragMove, hp }) {
  return <Circle x={x} y={y} radius={22 * inv} fill="transparent" draggable={draggable}
    onDragStart={onDragStart} onDragEnd={onDragEnd} onDragMove={onDragMove} {...hp} />;
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
