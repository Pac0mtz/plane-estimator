// ---------------------------------------------------------------------------
// Click-inside-a-room area takeoff — the mechanism the industry standardized
// on (Bluebeam "Dynamic Fill", PlanSwift "SingleClick"): a region-growing fill
// over the RENDERED drawing, bounded by its ink lines, converted to a polygon.
// Vendor docs confirm the shape: boundaries come from rendered stroke content
// (line-weight aware), small gaps are bridged by dilating the ink, big
// openings are the user's job to cap, and the filled region becomes an
// area/perimeter measurement.
//
// Pipeline: crop a window around the click from the full-res plan image →
// downscale → binarize (ink = dark) → dilate ink to bridge hairline gaps →
// BFS flood from the click → if the fill escapes the window, grow the window
// and retry (a genuinely open region eventually reports leaked:true) → trace
// the region boundary (Moore neighbor walk) → simplify (RDP) → plan coords.
// ---------------------------------------------------------------------------

const WORK_MAX = 1200; // working raster cap (px per side) — keeps BFS fast
const INK_LUMA = 200; // pixel darker than this is a boundary line
const BRIDGE = 2; // dilate ink by this many working px (bridges AA-thin gaps)

function luma(d, i) {
  return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
}

// Binary ink mask of an image-window, downscaled by f. White page -> 0, line -> 1.
function inkMask(img, win, f) {
  const w = Math.max(2, Math.round(win.w * f));
  const h = Math.max(2, Math.round(win.h * f));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, win.x, win.y, win.w, win.h, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const m = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < m.length; p++, i += 4) m[p] = luma(d, i) < INK_LUMA ? 1 : 0;
  return { m, w, h };
}

function dilate(src, w, h, r) {
  if (!r) return src;
  let cur = src;
  for (let it = 0; it < r; it++) {
    const out = new Uint8Array(cur);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (cur[row + x]) continue;
        if ((x > 0 && cur[row + x - 1]) || (x < w - 1 && cur[row + x + 1]) ||
            (y > 0 && cur[row - w + x]) || (y < h - 1 && cur[row + w + x])) out[row + x] = 1;
      }
    }
    cur = out;
  }
  return cur;
}

// BFS flood from (sx,sy) over free (non-ink) pixels. Returns the filled mask
// and whether it touched the window border (i.e. the region isn't enclosed
// within this window).
function flood(ink, w, h, sx, sy) {
  const fill = new Uint8Array(w * h);
  const qx = new Int32Array(w * h), qy = new Int32Array(w * h);
  let head = 0, tail = 0, touched = false, count = 0;
  const push = (x, y) => { const i = y * w + x; if (!fill[i] && !ink[i]) { fill[i] = 1; qx[tail] = x; qy[tail] = y; tail++; } };
  push(sx, sy);
  while (head < tail) {
    const x = qx[head], y = qy[head]; head++; count++;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touched = true;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  return { fill, touched, count };
}

// Moore-neighbor boundary trace of the filled region (outer contour).
function traceBoundary(fill, w, h) {
  let sx = -1, sy = -1;
  outer: for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (fill[y * w + x]) { sx = x; sy = y; break outer; }
  }
  if (sx < 0) return [];
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && fill[y * w + x];
  const pts = [];
  let cx = sx, cy = sy, dir = 6; // came from below-ish; start scanning up
  const maxSteps = w * h;
  for (let step = 0; step < maxSteps; step++) {
    pts.push([cx, cy]);
    let found = -1;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8; // start 90° CCW from the arrival direction
      const nx = cx + dirs[d][0], ny = cy + dirs[d][1];
      if (at(nx, ny)) { found = d; cx = nx; cy = ny; break; }
    }
    if (found < 0) break; // isolated pixel
    dir = found;
    if (cx === sx && cy === sy && pts.length > 2) break;
  }
  return pts;
}

// Ramer–Douglas–Peucker simplification.
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const d2seg = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    if (!l2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let mi = -1, md = eps;
    for (let i = a + 1; i < b; i++) { const d = d2seg(pts[i], pts[a], pts[b]); if (d > md) { md = d; mi = i; } }
    if (mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// exported for headless tests (pure logic — no DOM)
export const _internals = { dilate, flood, traceBoundary, rdp };

export function polygonAreaPx2(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

// Main entry. img: the plan HTMLImageElement at full resolution (bg.w × bg.h);
// pt: click in plan coords. Returns { pts:[{x,y}…] } or { leaked:true } when
// the clicked region isn't enclosed (open door/gap out of the drawn lines).
export function floodRoom(img, bgW, bgH, pt, { startWin = 1600, maxWin = 6400, bridge = BRIDGE } = {}) {
  for (let winSize = startWin; ; winSize *= 2) {
    const half = winSize / 2;
    const win = {
      x: Math.max(0, Math.round(pt.x - half)),
      y: Math.max(0, Math.round(pt.y - half)),
    };
    win.w = Math.min(bgW - win.x, winSize);
    win.h = Math.min(bgH - win.y, winSize);
    const coversAll = win.x === 0 && win.y === 0 && win.w >= bgW && win.h >= bgH;

    const f = Math.min(1, WORK_MAX / Math.max(win.w, win.h));
    const { m, w, h } = inkMask(img, win, f);
    const ink = dilate(m, w, h, bridge);

    // click position in working px — nudge to a free pixel if it landed on ink
    let sx = Math.round((pt.x - win.x) * f), sy = Math.round((pt.y - win.y) * f);
    sx = Math.max(1, Math.min(w - 2, sx)); sy = Math.max(1, Math.min(h - 2, sy));
    if (ink[sy * w + sx]) {
      let done = false;
      for (let r = 1; r <= 8 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) {
        const nx = sx + dx, ny = sy + dy;
        if (nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1 && !ink[ny * w + nx]) { sx = nx; sy = ny; done = true; }
      }
      if (!done) return { leaked: false, empty: true };
    }

    const { fill, touched, count } = flood(ink, w, h, sx, sy);
    if (touched && !coversAll && winSize < maxWin) continue; // room bigger than window — grow and retry
    if (touched) return { leaked: true }; // genuinely unenclosed

    if (count < 25) return { empty: true }; // clicked into a sliver — not a room
    const contour = rdp(traceBoundary(fill, w, h), 1.6);
    const pts = contour.map(([x, y]) => ({ x: win.x + x / f, y: win.y + y / f }));
    if (pts.length < 3) return { empty: true };
    return { pts };
  }
}
