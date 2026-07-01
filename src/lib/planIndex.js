// ---------------------------------------------------------------------------
// Construction-document intelligence: classify sheets by discipline, parse the
// drawing/sheet index off the cover pages, and detect each page's own sheet
// number + title. Powers the sheet navigator and gives the AI assistant the
// structured context it needs ("which sheets cover concrete?").
// ---------------------------------------------------------------------------

// Sheet-number prefix -> discipline. Ordered longest-prefix-first for matching.
export const DISCIPLINES = [
  { code: "G", label: "General", color: "#94a3b8" },
  { code: "SP", label: "Site", color: "#84cc16" },
  { code: "C", label: "Civil", color: "#84cc16" },
  { code: "L", label: "Landscape", color: "#22c55e" },
  { code: "A", label: "Architectural", color: "#3d7fe0" },
  { code: "S", label: "Structural", color: "#f59e0b" },
  { code: "M", label: "Mechanical", color: "#ec4899" },
  { code: "P", label: "Plumbing", color: "#06b6d4" },
  { code: "FP", label: "Fire protection", color: "#ef4444" },
  { code: "FS", label: "Fire", color: "#ef4444" },
  { code: "E", label: "Electrical", color: "#eab308" },
  { code: "T", label: "Telecom", color: "#a855f7" },
  { code: "K", label: "Kitchen", color: "#f97316" },
  { code: "Q", label: "Equipment", color: "#f97316" },
];

const PREFIXES = DISCIPLINES.map((d) => d.code).sort((a, b) => b.length - a.length);

// A valid sheet number: 1-2 letter discipline prefix + 2-4 digits + optional letter.
const SHEET_RE = /\b([A-Z]{1,2})(\d{2,4}[A-Z]?)\b/g;

export function disciplineOf(sheetNo) {
  if (!sheetNo) return { code: "?", label: "Other", color: "#64748b" };
  const up = sheetNo.toUpperCase();
  const pre = PREFIXES.find((p) => up.startsWith(p));
  return DISCIPLINES.find((d) => d.code === pre) || { code: up[0], label: "Other", color: "#64748b" };
}

const isSheetNo = (t) => /^[A-Z]{1,2}\d{2,4}[A-Z]?$/.test(t) && disciplineOf(t).code !== "?";
const isTitleWord = (w) => /^[A-Za-z][A-Za-z&/'.-]{1,}$/.test(w); // a real word, not a number/symbol

// Parse the drawing index into { NO -> title }. getTextContent joins the whole
// page into one run (title blocks + legends + notes), so titles are noisy: we
// drop leading non-words, stop at a stray number, and — since a sheet number
// can appear several times on the cover — keep the cleanest (shortest real)
// title across occurrences.
export function parseSheetIndex(text) {
  const map = new Map();
  const wc = new Map(); // word count of the chosen title (prefer fewer = real title)
  const tokens = text.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const no = tokens[i].toUpperCase();
    if (!isSheetNo(no)) continue;
    let j = i + 1;
    while (j < tokens.length && !isTitleWord(tokens[j]) && !isSheetNo(tokens[j])) j++; // skip leading junk
    const words = [];
    for (; j < tokens.length && words.length < 6; j++) {
      if (isSheetNo(tokens[j])) break;
      if (words.length && /^\d/.test(tokens[j])) break; // number mid-title = next entry bleeding in
      words.push(tokens[j]);
    }
    const title = words.join(" ").replace(/[^A-Za-z0-9 &.\-/'"]/g, "").trim();
    const n = title.split(" ").filter((w) => /[A-Za-z]/.test(w)).length;
    if (n < 1 || title.length < 4) continue;
    if (!map.has(no) || n < wc.get(no)) { map.set(no, title); wc.set(no, n); }
  }
  return map;
}

// Detect a page's OWN sheet number: require that the sheet's number AND its
// title both appear on the page (title block). Requiring the title match avoids
// false hits from stray cross-references (e.g. the cover listing every sheet).
export function detectSheet(pageText, index) {
  if (!pageText) return null;
  const upper = pageText.toUpperCase();
  let best = null;
  for (const [no, title] of index) {
    if (!upper.includes(no)) continue;
    const titleHead = title.split(" ").slice(0, 2).join(" ");
    const score = upper.includes(title) ? 3 : upper.includes(titleHead) ? 2 : 0;
    if (score >= 2 && (!best || score > best.score)) best = { no, title, score };
  }
  return best ? { no: best.no, title: best.title } : null;
}

// Fallback: the most frequent KNOWN (indexed) sheet number on the page. Limiting
// to indexed numbers avoids picking up detail-callout bubbles or grid labels.
export function guessSheetNo(pageText, index) {
  if (!pageText) return null;
  const known = index instanceof Map ? index : null;
  const counts = new Map();
  let m;
  SHEET_RE.lastIndex = 0;
  while ((m = SHEET_RE.exec(pageText))) {
    const no = (m[1] + m[2]).toUpperCase();
    if (disciplineOf(no).code === "?") continue;
    if (known && !known.has(no)) continue;
    counts.set(no, (counts.get(no) || 0) + 1);
  }
  let top = null;
  for (const [no, c] of counts) if (!top || c > top.c) top = { no, c };
  return top?.no || null;
}
