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

// Parse the drawing index into { NO -> title }. getTextContent joins the whole
// page into one run with no line breaks, so we tokenize: a sheet-number token
// starts a title that runs until the next sheet number (or ~7 words).
export function parseSheetIndex(text) {
  const map = new Map();
  const tokens = text.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const no = tokens[i].toUpperCase();
    if (!isSheetNo(no) || map.has(no)) continue;
    const words = [];
    for (let j = i + 1; j < tokens.length && words.length < 7; j++) {
      if (isSheetNo(tokens[j])) break;
      words.push(tokens[j]);
    }
    const title = words.join(" ").replace(/[^A-Za-z0-9 &.\-/'"]/g, "").trim();
    if (title.length >= 3) map.set(no, title);
  }
  return map;
}

// Detect a page's OWN sheet number: the sheet whose number AND title both appear
// on the page (title block), preferring a match from the known index.
export function detectSheet(pageText, index) {
  if (!pageText) return null;
  const upper = pageText.toUpperCase();
  let best = null;
  for (const [no, title] of index) {
    const hasNo = upper.includes(no);
    if (!hasNo) continue;
    // strong signal: the sheet's title (first words) is printed on the page
    const titleHead = title.split(" ").slice(0, 2).join(" ");
    const score = (upper.includes(title) ? 3 : upper.includes(titleHead) ? 2 : 0) + 1;
    if (!best || score > best.score) best = { no, title, score };
  }
  return best ? { no: best.no, title: best.title } : null;
}

// Fallback: pull the most likely sheet number straight from page text.
export function guessSheetNo(pageText) {
  if (!pageText) return null;
  const counts = new Map();
  let m;
  SHEET_RE.lastIndex = 0;
  while ((m = SHEET_RE.exec(pageText))) {
    const no = (m[1] + m[2]).toUpperCase();
    if (disciplineOf(no).code === "?") continue;
    counts.set(no, (counts.get(no) || 0) + 1);
  }
  let top = null;
  for (const [no, c] of counts) if (!top || c > top.c) top = { no, c };
  return top?.no || null;
}
