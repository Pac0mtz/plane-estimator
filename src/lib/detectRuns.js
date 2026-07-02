// ---------------------------------------------------------------------------
// Vector-based takeoff detection — the honest replacement for vision "detect".
//
// Instead of asking a model to guess boxes, we read the plan's ACTUAL line
// geometry (from vector.js) and surface the significant pieces:
//   • regions  — large closed polygons (slab / footprint / fenced area) → SF
//   • runs     — long open polylines (wall / fence lines)              → LF
// Every candidate is real geometry, so its length/area is exact. The estimator
// accepts the ones that matter and drops noise (dimension lines, tables…).
// ---------------------------------------------------------------------------

function annotate(p) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, len = 0, area2 = 0;
  const pts = p.pts;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i];
    if (q.x < minX) minX = q.x; if (q.y < minY) minY = q.y;
    if (q.x > maxX) maxX = q.x; if (q.y > maxY) maxY = q.y;
    if (i) len += Math.hypot(q.x - pts[i - 1].x, q.y - pts[i - 1].y);
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  const bw = maxX - minX, bh = maxY - minY;
  return { pts, closed: p.closed, len, area: Math.abs(area2) / 2, bw, bh, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

// dimSamples (optional): positions of parsed dimension strings — used to drop
// dimension lines (a run whose midpoint hugs a dimension label isn't a wall).
export function detectRuns(polys, bg, { dimSamples = [], maxRegions = 6, maxRuns = 12 } = {}) {
  if (!polys || !polys.length) return { regions: [], runs: [] };
  const pageArea = bg.w * bg.h;
  const ann = polys.map(annotate)
    // drop the sheet border (bbox ≈ whole page)
    .filter((a) => !(a.bw > 0.92 * bg.w && a.bh > 0.92 * bg.h));

  // dedup near-identical polylines (double-drawn wall lines, redraws): keep the longest
  ann.sort((a, b) => b.len - a.len);
  const kept = [];
  for (const a of ann) {
    if (kept.some((k) => Math.abs(k.cx - a.cx) < 8 && Math.abs(k.cy - a.cy) < 8 && Math.abs(k.bw - a.bw) < 14 && Math.abs(k.bh - a.bh) < 14)) continue;
    kept.push(a);
  }

  const nearDim = (a) => dimSamples.some((d) => Math.hypot(d.x - a.cx, d.y - a.cy) < 40);

  const regions = kept
    .filter((a) => a.closed && a.area > 0.004 * pageArea)
    .sort((a, b) => b.area - a.area)
    .slice(0, maxRegions);
  const regionSet = new Set(regions);

  const runs = kept
    .filter((a) => !regionSet.has(a) && a.len > 120 && !nearDim(a))
    .sort((a, b) => b.len - a.len)
    .slice(0, maxRuns);

  return { regions, runs };
}
