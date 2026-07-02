// ---------------------------------------------------------------------------
// Read the plan's PRINTED dimensions to calibrate scale exactly — no eyeballing
// a scale bar, no vision guess. Architectural sheets label real lengths right
// on the drawing (40'-0", 18'-0", 4' 6"). Each dimension string sits on its
// dimension line, whose pixel length we already know from the vector geometry.
// length_px / feet = pixels-per-foot. Every correct dimension gives the SAME
// ratio, so we take the dominant cluster — robust to a few bad pairings.
// ---------------------------------------------------------------------------

// Parse a feet[-inches] dimension string -> feet (number) or null.
// Handles 40'-0"  40' 0"  40'0"  40'  4' 6"  24.5'  (straight or curly marks).
export function parseFeet(str) {
  const m = str.match(/(\d+(?:\.\d+)?)\s*['’]\s*[-\s]?\s*(\d+(?:\.\d+)?)?\s*(?:["”]|in\b)?/);
  if (!m) return null;
  const ft = parseFloat(m[1]);
  const inch = m[2] != null ? parseFloat(m[2]) : 0;
  const feet = (ft || 0) + (inch || 0) / 12;
  return feet > 0.5 ? feet : null; // ignore sub-6" noise
}

// Break polylines into candidate dimension-line segments (midpoint + length).
function segments(polys, minLen = 18) {
  const segs = [];
  for (const p of polys) {
    for (let i = 1; i < p.pts.length; i++) {
      const a = p.pts[i - 1], b = p.pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len >= minLen) segs.push({ mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, len });
    }
  }
  return segs;
}

// Pair each printed dimension with the nearest line and derive pixels-per-foot.
// Returns { ppf, samples:[{x,y,feet,ppf,str}], all } — samples are the winning
// cluster (what actually set the scale). ppf is null if nothing reliable.
export function calibrateFromDimensions(items, polys, { maxDist = 90 } = {}) {
  const segs = segments(polys);
  if (!segs.length) return { ppf: null, samples: [], all: 0 };

  const cand = [];
  for (const it of items) {
    const feet = parseFeet(it.str);
    if (!feet) continue;
    // the dimension line is the segment whose midpoint is nearest the text
    let best = null, bd = maxDist;
    for (const s of segs) {
      const d = Math.hypot(s.mx - it.x, s.my - it.y);
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) continue;
    const ppf = best.len / feet;
    if (ppf > 4 && ppf < 400) cand.push({ x: it.x, y: it.y, feet, ppf, str: it.str.trim() });
  }
  if (!cand.length) return { ppf: null, samples: [], all: 0 };

  // dominant cluster: the ppf value with the most neighbours within 8%
  let winner = [];
  for (const c of cand) {
    const set = cand.filter((t) => Math.abs(t.ppf - c.ppf) / c.ppf < 0.08);
    if (set.length > winner.length) winner = set;
  }
  const ppf = winner.reduce((a, b) => a + b.ppf, 0) / winner.length;
  return { ppf, samples: winner, all: cand.length };
}
