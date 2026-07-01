// ---------------------------------------------------------------------------
// AI pre-seed adapter: a plan-page image -> candidate takeoff traces that the
// estimator confirms before they price out. This is ASSISTIVE, not automatic:
// vision models are good at counting symbols, reading schedules, and rough
// area/line suggestions — not pixel-accurate billing geometry. Every result
// lands in the review panel with a confidence score for a human to accept.
//
// Provider: OpenAI vision (gpt-4o). The real call is written but gated on an
// API key. With no key we return deterministic MOCK detections so the whole
// confirm->price flow is demonstrable today.
//
// SECURITY: a browser-held OpenAI key is visible to anyone using the app —
// fine for local/dev only. Before shipping, move openaiDetect() behind a
// serverless proxy (e.g. a Vercel function) and call that instead. That is a
// one-function swap; nothing else here changes.
// ---------------------------------------------------------------------------

const KEY_LS = "planforge-openai-key";

export function getKey() {
  return (
    (typeof localStorage !== "undefined" && localStorage.getItem(KEY_LS)) ||
    import.meta.env?.VITE_OPENAI_KEY ||
    ""
  );
}
export function setKey(k) {
  if (k) localStorage.setItem(KEY_LS, k);
  else localStorage.removeItem(KEY_LS);
}
export function hasKey() {
  return !!getKey();
}

// Map an assembly key -> the first layer using it (suggestions target a layer).
function layerForAsm(layers, asm) {
  return layers.find((l) => l.asm === asm) || null;
}

let _n = 0;
const sid = () => `sg${(_n++).toString(36)}${Date.now().toString(36).slice(-3)}`;

function suggestion(layer, type, pts, confidence, note) {
  return { id: sid(), layerId: layer.id, layerName: layer.name, color: layer.color, asm: layer.asm, type, pts, confidence, note, element: arguments[5] || note };
}

// --- MOCK detector -----------------------------------------------------------
// Returns raw detections (asm + geometry). The store maps each to a layer,
// creating one with its own colour when the assembly has no layer yet. Includes
// several wall types so they land on distinct, differently-coloured layers.
function mockDetect({ bg }) {
  const demo = bg.type === "demo";
  const box = demo
    ? { x: 250, y: 40, w: 264, h: 576 }
    : { x: 0.31 * bg.w, y: 0.07 * bg.h, w: 0.32 * bg.w, h: 0.83 * bg.h };
  const X = (f) => Math.round(box.x + f * box.w);
  const Y = (f) => Math.round(box.y + f * box.h);
  const det = (asm, type, pts, confidence, element) => ({ asm, type, pts, confidence, element, note: element });
  return [
    det("slab", "area", [{ x: X(0.03), y: Y(0.02) }, { x: X(0.97), y: Y(0.02) }, { x: X(0.97), y: Y(0.98) }, { x: X(0.03), y: Y(0.98) }], 0.82, "Slab-on-grade footprint"),
    det("brick", "linear", [{ x: X(0), y: Y(0) }, { x: X(1), y: Y(0) }], 0.64, "Exterior wall — brick veneer"),
    det("eifs", "linear", [{ x: X(1), y: Y(0) }, { x: X(1), y: Y(1) }], 0.6, "Exterior wall — EIFS"),
    det("drywall", "linear", [{ x: X(0), y: Y(0.74) }, { x: X(1), y: Y(0.74) }], 0.74, "Interior partition wall"),
    det("storefront", "linear", [{ x: X(0), y: Y(1) }, { x: X(0.55), y: Y(1) }], 0.57, "Storefront glazing"),
    det("doors", "count", [{ x: X(0.5), y: Y(0.99) }], 0.9, "Entry door"),
    det("doors", "count", [{ x: X(0.75), y: Y(0.86) }], 0.68, "Storage door"),
  ];
}

// --- OpenAI detector (real; runs only when a key is present) -----------------
const SYSTEM = `You are a construction estimator's takeoff assistant. Look at this floor plan / elevation and detect the physical elements an estimator quantifies. Return STRICT JSON only.

Detect and classify EACH element. Map it to one of these assembly keys (asm) — walls go to the material they're built of, so different wall types land on different layers:
- doors -> each door leaf (type "count", one point per door). element e.g. "Entry door".
- drywall -> interior partition walls (type "linear", polyline along the wall). element "Interior partition".
- brick -> thin-brick/masonry veneer wall runs (type "linear"). element "Exterior wall — brick".
- cmu -> concrete masonry unit walls (type "linear"). element "CMU wall".
- eifs -> EIFS wall runs/areas (linear or area). element "Exterior wall — EIFS".
- storefront -> aluminum storefront / glazing runs (type "linear" or area). element "Storefront".
- slab -> floor/slab footprint (type "area", polygon of the interior). element "Slab on grade".
- roofing -> roof area (type "area"). element "Roof".
- woodfence -> wood / privacy fence runs (type "linear" along the fence). element "Wood privacy fence".
- chainlink -> chain-link fence runs (type "linear"). element "Chain-link fence".
- fencegate -> each gate (type "count", one point per gate). element "Gate".
- sitewall -> site / retaining / screen walls outside the building (type "linear"). element "Site wall".

Return { "detections": [ { "asm": "...", "type": "area|linear|count", "element": "short human label", "points": [[x,y],...], "confidence": 0..1, "note": "why / what you see" } ] }.
Coordinates are NORMALIZED 0..1 (x = fraction of width, y = fraction of height). area polygon needs >=3 points; linear polyline >=2 points; count = one point per item.
Trace walls along their real run so linear feet are accurate. Detect ALL doors you can see. Only include what is actually visible; set lower confidence when unsure. Do not invent elements.`;

// A blob object URL (how PDF pages are stored) can't be POSTed to OpenAI —
// convert to a base64 data URL first.
async function asDataUrl(url) {
  if (!url || url.startsWith("data:")) return url;
  const blob = await fetch(url).then((r) => r.blob());
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

async function openaiDetect({ imageDataUrl, bg, key }) {
  imageDataUrl = await asDataUrl(imageDataUrl);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Detect takeoff regions. Return JSON only." },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text().catch(() => "")}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  const W = bg.w, H = bg.h;
  return (parsed.detections || [])
    .map((d) => {
      if (!d.asm || !Array.isArray(d.points)) return null;
      const pts = d.points.map(([x, y]) => ({ x: x * W, y: y * H }));
      const type = ["area", "linear", "count"].includes(d.type) ? d.type : "count";
      if (type === "area" && pts.length < 3) return null;
      if (type === "linear" && pts.length < 2) return null;
      return { asm: d.asm, type, pts: type === "count" ? [pts[0]] : pts, confidence: d.confidence ?? 0.5, note: d.note || "", element: d.element || d.note || d.asm };
    })
    .filter(Boolean);
}

// --- AI scale detection ------------------------------------------------------
// Prefer READING the printed scale note (text — reliable), e.g. 1/4"=1'-0".
// Combined with the page's render DPI that gives an EXACT pixels-per-foot with
// no eyeballing. Falls back to a printed dimension line, then a scale bar.
export async function detectScale({ imageDataUrl, bg }) {
  const key = getKey();
  if (!key) throw new Error("Add an OpenAI key to auto-detect scale.");
  const url = await asDataUrl(imageDataUrl);
  const sys = `You read the SCALE of a construction drawing. Do these in order:
1. Find the printed SCALE NOTE (e.g. "SCALE: 1/4\\"=1'-0\\"", "3/16\\"=1'-0\\"", "1:48", "1/8\\"=1'-0\\""). Convert it to paperInchesPerFoot = inches on the PAPER that equal one real foot. Examples: 1/4"=1'-0" -> 0.25; 3/16"=1'-0" -> 0.1875; 1/8"=1'-0" -> 0.125; 1:48 -> 12/48 = 0.25; 1:96 -> 0.125. Put the exact note text in scaleNote.
2. ALSO, if you can, find one printed DIMENSION LINE: its two endpoints and the labeled real length in feet.
Return STRICT JSON: { "paperInchesPerFoot": <number or 0>, "scaleNote": "<text or empty>", "a":[x,y], "b":[x,y], "feet": <number or 0>, "confidence":0..1 }. a and b are normalized 0..1 endpoints. If nothing legible, return zeros.`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: [{ type: "text", text: "Read the scale. JSON only." }, { type: "image_url", image_url: { url } }] },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const p = JSON.parse((await res.json()).choices?.[0]?.message?.content || "{}");
  return {
    paperInchesPerFoot: p.paperInchesPerFoot > 0 ? p.paperInchesPerFoot : 0,
    scaleNote: p.scaleNote || "",
    a: Array.isArray(p.a) ? { x: p.a[0] * bg.w, y: p.a[1] * bg.h } : null,
    b: Array.isArray(p.b) ? { x: p.b[0] * bg.w, y: p.b[1] * bg.h } : null,
    feet: p.feet > 0 ? p.feet : 0,
    confidence: p.confidence ?? 0.5,
  };
}

// Public entry point — returns raw detections; the store maps them to layers.
//
// The MOCK detector is plan-agnostic (fixed positions), so it must ONLY run on
// the built-in demo plan. On a real uploaded plan we require a real key —
// otherwise every plan would show the same placeholder boxes ("same areas on a
// different plan"). No key on a real plan => a clear error, not fake data.
export async function detectTakeoff({ imageDataUrl, bg }) {
  const key = getKey();
  if (key && imageDataUrl) return openaiDetect({ imageDataUrl, bg, key });
  if (bg.type === "demo") {
    await new Promise((r) => setTimeout(r, 500)); // let the UI show its working state
    return mockDetect({ bg });
  }
  throw new Error("Add an OpenAI key (AI panel → key icon) to detect on a real plan. The demo detections only run on the built-in demo.");
}
