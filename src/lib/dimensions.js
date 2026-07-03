// ---------------------------------------------------------------------------
// Read the plan's PRINTED dimensions to calibrate scale exactly — no eyeballing
// a scale bar, no vision guess. Architectural sheets label real lengths right
// on the drawing (40'-0", 18'-0", 4' 6"). Each dimension string sits on its
// dimension line, whose pixel length we already know from the vector geometry.
// length_px / feet = pixels-per-foot. Every correct dimension gives the SAME
// ratio, so we take the dominant cluster — robust to a few bad pairings.
// ---------------------------------------------------------------------------

// Parse a feet[-inches] dimension string -> feet (number) or null.
// Handles 40'-0"  40' 0"  40'0"  40'  4' 6"  3' - 4 3/4"  24.5'.
export function parseFeet(str) {
  const m = str.match(/(\d+(?:\.\d+)?)\s*['’]\s*[-\s]*\s*(?:(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?)?\s*(?:["”]|in\b)?/);
  if (!m) return null;
  const ft = parseFloat(m[1]);
  let inch = m[2] != null ? parseFloat(m[2]) : 0;
  if (m[3] && m[4] && Number(m[4]) > 0) inch += Number(m[3]) / Number(m[4]); // 4 3/4"
  const feet = (ft || 0) + (inch || 0) / 12;
  return feet > 0.5 ? feet : null; // ignore sub-6" noise
}

// Break polylines into candidate dimension-line segments (endpoints + length).
function segments(polys, minLen = 18) {
  const segs = [];
  for (const p of polys) {
    for (let i = 1; i < p.pts.length; i++) {
      const a = p.pts[i - 1], b = p.pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len >= minLen) segs.push({ a, b, len });
    }
  }
  return segs;
}

// Pair each printed dimension with a line and derive pixels-per-foot.
// CRITICAL: pair by distance to the segment's MIDPOINT, not to the segment.
// A dimension string sits at the CENTER of its dimension line, so midpoint
// distance picks the full, centered line — and naturally rejects the two
// half-segments the line is often split into around the text gap (their
// midpoints sit far to the side). Point-to-segment pairing fails there: the
// halves are proportional to the true length, so they form a tight FAKE
// cluster that can outvote the real one (verified on the fence plan: fake
// 12 px/ft vs real 27.5).
// Needs >=3 distinct dimensions to agree so a bad pairing can never set the
// scale alone. Returns { ppf, samples, all } — ppf null if unreliable.
export function calibrateFromDimensions(items, polys, { maxDist = 90 } = {}) {
  const segs = segments(polys);
  if (!segs.length) return { ppf: null, samples: [], all: 0 };

  const cand = [];
  for (const it of items) {
    const feet = parseFeet(it.str);
    // small dims (door/casework, < 6 ft) are unreliable pairings: their
    // dimension line is SHORTER than the text itself, so nearest-midpoint
    // grabs a neighbouring tick and small dims cluster into a fake scale
    // (verified on a commercial sheet: fake 11.9 px/ft vs true 25.0).
    if (!feet || feet < 6) continue;
    let best = null, bd = maxDist;
    for (const s of segs) {
      const d = Math.hypot((s.a.x + s.b.x) / 2 - it.x, (s.a.y + s.b.y) / 2 - it.y);
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
  // count DISTINCT dimension strings (a string votes once), not raw pairings
  const distinct = new Set(winner.map((w) => `${Math.round(w.x)},${Math.round(w.y)}`));
  if (distinct.size < 3) return { ppf: null, samples: winner, all: cand.length };
  // one sample per string for the average, so a duplicated pairing can't skew it
  const byStr = new Map();
  for (const w of winner) { const k = `${Math.round(w.x)},${Math.round(w.y)}`; if (!byStr.has(k)) byStr.set(k, w); }
  const samples = [...byStr.values()];
  // feet-diversity gate: a REAL cluster holds different lengths that all imply
  // one px/ft. When strings pair with constant-size tick marks instead, a fake
  // cluster can only form among similar-valued strings (8'-0" ceiling tags…),
  // so its feet range is narrow. Require a real spread (verified: fake 4.6
  // cluster on a Revit sheet spans 7.5–8.7 ft; the real fence cluster 10.5–18).
  const fmin = Math.min(...samples.map((s) => s.feet));
  const fmax = Math.max(...samples.map((s) => s.feet));
  if (fmax / fmin < 1.4) return { ppf: null, samples, all: cand.length };
  const ppf = samples.reduce((a, b) => a + b.ppf, 0) / samples.length;
  return { ppf, samples, all: cand.length };
}
