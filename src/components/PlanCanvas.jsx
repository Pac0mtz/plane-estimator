import { useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Image as KImage, Rect, Line, Circle, Text, Group } from "react-konva";
import { useStore } from "../store/useStore.js";
import { ASSEMBLIES } from "../lib/assemblies.js";
import { traceQty, centroid, flatPts } from "../lib/geometry.js";

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export default function PlanCanvas() {
  const s = useStore();
  const { bg, imgEl, ppf, tool, layers, traces, draft, calib, activeId, selId } = s;

  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });

  // measure container
  useEffect(() => {
    const measure = () => {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // fit plan to view whenever the background or container changes
  const fit = useCallback(() => {
    const scale = Math.min(size.w / bg.w, size.h / bg.h) * 0.92;
    setView({ scale, x: (size.w - bg.w * scale) / 2, y: (size.h - bg.h * scale) / 2 });
  }, [size.w, size.h, bg.w, bg.h]);

  useEffect(() => { fit(); }, [fit, bg.type, bg.href]);

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
      if (e.target === e.target.getStage()) s.setSel(null);
      return;
    }
    const p = stageRef.current.getRelativePointerPosition();
    s.addPoint({ x: p.x, y: p.y });
  };

  const onDragEnd = (e) => {
    if (e.target === stageRef.current) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
  };

  return (
    <div ref={wrapRef} className="flex-1 min-w-0 bg-slate-800 overflow-hidden">
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
        onDragEnd={onDragEnd}
        style={{ cursor: tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair" }}
      >
        <Layer listening={false}>
          {bg.type === "img" && imgEl ? (
            <KImage image={imgEl} width={bg.w} height={bg.h} />
          ) : (
            <DemoPlan />
          )}
        </Layer>

        <Layer>
          {traces.map((tr) => {
            const L = layers.find((l) => l.id === tr.layer);
            if (!L || !L.visible) return null;
            const sel = tr.id === selId;
            const listening = tool === "select";
            const pick = (e) => { if (tool === "select") { e.cancelBubble = true; s.setSel(tr.id); } };

            if (tr.type === "area") {
              const c = centroid(tr.pts);
              return (
                <Group key={tr.id} onClick={pick} onTap={pick} listening={listening}>
                  <Line points={flatPts(tr.pts)} closed fill={hexToRgba(L.color, sel ? 0.5 : 0.28)}
                    stroke={L.color} strokeWidth={(sel ? 3 : 2) * inv} />
                  <Label x={c.x} y={c.y} color={L.color} inv={inv} text={`${traceQty(tr, ppf).toFixed(0)} SF`} center />
                </Group>
              );
            }
            if (tr.type === "linear") {
              const mid = tr.pts[Math.floor(tr.pts.length / 2)];
              return (
                <Group key={tr.id} onClick={pick} onTap={pick} listening={listening}>
                  <Line points={flatPts(tr.pts)} stroke={L.color} strokeWidth={(sel ? 6 : 4) * inv}
                    lineCap="round" lineJoin="round"
                    hitStrokeWidth={14 * inv} />
                  <Label x={mid.x} y={mid.y} color={L.color} inv={inv} text={`${traceQty(tr, ppf).toFixed(1)} LF`} />
                </Group>
              );
            }
            const p = tr.pts[0];
            return (
              <Circle key={tr.id} x={p.x} y={p.y} radius={(sel ? 9 : 7) * inv} fill={L.color}
                stroke="#fff" strokeWidth={2 * inv} onClick={pick} onTap={pick} listening={listening} />
            );
          })}

          {/* draft in progress */}
          {draft.length > 0 && (
            <Group listening={false}>
              {ASSEMBLIES[layers.find((l) => l.id === activeId).asm].geom === "area" ? (
                <Line points={flatPts(draft)} closed fill={hexToRgba(activeColor, 0.2)} stroke={activeColor} strokeWidth={2 * inv} dash={[6 * inv, 4 * inv]} />
              ) : (
                <Line points={flatPts(draft)} stroke={activeColor} strokeWidth={3 * inv} dash={[6 * inv, 4 * inv]} />
              )}
              {draft.map((p, i) => (
                <Circle key={i} x={p.x} y={p.y} radius={4 * inv} fill="#fff" stroke={activeColor} strokeWidth={2 * inv} />
              ))}
            </Group>
          )}

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
    </div>
  );
}

function Label({ x, y, text, color, inv, center }) {
  const fontSize = 13 * inv;
  const w = text.length * 8 * inv;
  return (
    <Text
      x={center ? x - w / 2 : x + 6 * inv}
      y={center ? y - fontSize / 2 : y - 16 * inv}
      text={text}
      fontSize={fontSize}
      fontStyle="bold"
      fill={color}
      stroke="#fff"
      strokeWidth={3 * inv}
      fillAfterStrokeEnabled
      listening={false}
    />
  );
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
