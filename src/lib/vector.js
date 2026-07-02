// ---------------------------------------------------------------------------
// Vector geometry extraction — the "real data" path.
//
// A vector PDF (exported from CAD/Revit/Bluebeam, not scanned) stores the plan
// as actual line segments and paths with exact coordinates. pdf.js exposes them
// via page.getOperatorList(): a stream of moveTo/lineTo/curveTo/rectangle ops
// under an evolving transform matrix. We walk that stream and flatten it into
// polylines in the SAME device-pixel space the plan image is rendered at, so a
// polyline lines up exactly with what the estimator sees.
//
// With real geometry a trace can SNAP to an actual wall/fence line instead of
// being eyeballed — exact linear feet, no drift off the sheet.
// ---------------------------------------------------------------------------
import * as pdfjs from "pdfjs-dist";

const { OPS, Util } = pdfjs;

// sample a cubic bezier into a few straight hops (plenty for takeoff snapping)
function flattenCubic(x0, y0, x1, y1, x2, y2, x3, y3, emit, steps = 6) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
    const y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
    emit(x, y);
  }
}

// Flatten a pdf.js operator list into device-space polylines.
// viewportTransform is page.getViewport({scale}).transform — maps PDF user
// space to the rendered pixel space. Returns [{ pts:[{x,y}...], closed }].
export function opListToPolylines(opList, viewportTransform) {
  const out = [];
  let ctm = viewportTransform.slice();
  const stack = [];
  let pending = []; // device-space subpaths built for the current path
  let cur = null;

  const dev = (x, y) => { const p = Util.applyTransform([x, y], ctm); return { x: p[0], y: p[1] }; };
  const startSub = (x, y) => { cur = { pts: [dev(x, y)], closed: false }; pending.push(cur); };
  const lineTo = (x, y) => { if (!cur) startSub(x, y); else cur.pts.push(dev(x, y)); };
  const flush = () => { for (const s of pending) if (s.pts.length >= 2) out.push(s); pending = []; cur = null; };

  const fns = opList.fnArray, argsArr = opList.argsArray;
  for (let i = 0; i < fns.length; i++) {
    const fn = fns[i];
    const args = argsArr[i];
    switch (fn) {
      case OPS.save: stack.push(ctm.slice()); break;
      case OPS.restore: if (stack.length) ctm = stack.pop(); break;
      case OPS.transform: ctm = Util.transform(ctm, args); break;
      case OPS.constructPath: {
        const ops = args[0], co = args[1];
        let k = 0, cx = 0, cy = 0;
        for (const op of ops) {
          switch (op) {
            case OPS.moveTo: cx = co[k++]; cy = co[k++]; startSub(cx, cy); break;
            case OPS.lineTo: cx = co[k++]; cy = co[k++]; lineTo(cx, cy); break;
            case OPS.curveTo: {
              const x1 = co[k++], y1 = co[k++], x2 = co[k++], y2 = co[k++], x3 = co[k++], y3 = co[k++];
              flattenCubic(cx, cy, x1, y1, x2, y2, x3, y3, lineTo); cx = x3; cy = y3; break;
            }
            case OPS.curveTo2: {
              const x2 = co[k++], y2 = co[k++], x3 = co[k++], y3 = co[k++];
              flattenCubic(cx, cy, cx, cy, x2, y2, x3, y3, lineTo); cx = x3; cy = y3; break;
            }
            case OPS.curveTo3: {
              const x1 = co[k++], y1 = co[k++], x3 = co[k++], y3 = co[k++];
              flattenCubic(cx, cy, x1, y1, x3, y3, x3, y3, lineTo); cx = x3; cy = y3; break;
            }
            case OPS.rectangle: {
              const x = co[k++], y = co[k++], w = co[k++], h = co[k++];
              startSub(x, y); lineTo(x + w, y); lineTo(x + w, y + h); lineTo(x, y + h);
              if (cur) { cur.pts.push(dev(x, y)); cur.closed = true; }
              break;
            }
            case OPS.closePath:
              if (cur && cur.pts.length) { cur.pts.push(cur.pts[0]); cur.closed = true; }
              break;
            default: break;
          }
        }
        break;
      }
      // any paint / clip / end op terminates the current path
      case OPS.stroke: case OPS.closeStroke:
      case OPS.fill: case OPS.eoFill:
      case OPS.fillStroke: case OPS.eoFillStroke:
      case OPS.closeFillStroke: case OPS.closeEOFillStroke:
      case OPS.endPath:
        flush(); break;
      default: break;
    }
  }
  flush();
  return out;
}

export function polylineLengthPx(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}

function bboxDiag(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }
  return Math.hypot(maxX - minX, maxY - minY);
}

// Drop the noise (text glyphs, tick marks) so hover picks real building lines.
// Keep polylines with meaningful extent; give each a stable id + length.
export function usefulPolylines(polys, minLenPx = 14) {
  const kept = [];
  for (let i = 0; i < polys.length; i++) {
    const p = polys[i];
    if (p.pts.length < 2) continue;
    const len = polylineLengthPx(p.pts);
    if (len < minLenPx || bboxDiag(p.pts) < minLenPx) continue;
    kept.push({ id: "v" + i, pts: p.pts, closed: p.closed, lenPx: len });
  }
  return kept;
}

function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// Nearest polyline to a plan-space point, within maxDist px. Returns the whole
// run so a click snaps to the full wall/fence line, not a single segment.
export function nearestPolyline(polys, pt, maxDist = 12) {
  let best = null, bestD = maxDist;
  for (const poly of polys) {
    for (let i = 1; i < poly.pts.length; i++) {
      const d = distToSegment(pt, poly.pts[i - 1], poly.pts[i]);
      if (d < bestD) { bestD = d; best = poly; }
    }
  }
  return best;
}
