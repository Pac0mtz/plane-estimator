// world-space (plan pixel) geometry helpers
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const polyLen = (pts) =>
  pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1], p) : 0), 0);

export const polyArea = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
};

export const centroid = (pts) => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

// quantity of a trace in its native unit, given pixels-per-foot
export const traceQty = (trace, ppf) => {
  if (!ppf) return 0;
  if (trace.type === "area") return polyArea(trace.pts) / (ppf * ppf);
  if (trace.type === "linear") return polyLen(trace.pts) / ppf;
  return trace.pts.length; // count
};

export const flatPts = (pts) => pts.flatMap((p) => [p.x, p.y]);
