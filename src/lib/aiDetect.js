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
  return { id: sid(), layerId: layer.id, layerName: layer.name, color: layer.color, asm: layer.asm, type, pts, confidence, note };
}

// --- MOCK detector -----------------------------------------------------------
// Produces plausible candidates positioned relative to the page dimensions so
// it works on the demo shell OR any uploaded page. Deterministic.
function mockDetect({ bg, layers }) {
  // Anchor to the demo shell (drawn at x0=250,y0=40,w=264,h=576 in an 820x680
  // plan) so demo detections land ON the building. For real uploads we don't
  // know the geometry, so place candidates as fractions of the page.
  const demo = bg.type === "demo";
  const box = demo
    ? { x: 250, y: 40, w: 264, h: 576 }
    : { x: 0.31 * bg.w, y: 0.07 * bg.h, w: 0.32 * bg.w, h: 0.83 * bg.h };
  const X = (f) => Math.round(box.x + f * box.w);
  const Y = (f) => Math.round(box.y + f * box.h);
  const out = [];

  const slab = layerForAsm(layers, "slab");
  if (slab)
    out.push(
      suggestion(slab, "area",
        [
          { x: X(0.03), y: Y(0.02) },
          { x: X(0.97), y: Y(0.02) },
          { x: X(0.97), y: Y(0.98) },
          { x: X(0.03), y: Y(0.98) },
        ],
        0.82, "Building footprint (slab)")
    );

  const brick = layerForAsm(layers, "brick");
  if (brick)
    out.push(suggestion(brick, "linear", [{ x: X(0), y: Y(0) }, { x: X(1), y: Y(0) }], 0.61, "Front elevation brick band"));

  const dry = layerForAsm(layers, "drywall");
  if (dry)
    out.push(suggestion(dry, "linear", [{ x: X(0), y: Y(0.74) }, { x: X(1), y: Y(0.74) }], 0.74, "Interior partition wall"));

  const doors = layerForAsm(layers, "doors");
  if (doors) {
    out.push(suggestion(doors, "count", [{ x: X(0.5), y: Y(0.99) }], 0.9, "Entry door"));
    out.push(suggestion(doors, "count", [{ x: X(0.75), y: Y(0.86) }], 0.68, "Storage door"));
  }
  return out;
}

// --- OpenAI detector (real; runs only when a key is present) -----------------
const SYSTEM = `You are a construction takeoff assistant. Given a floor-plan or elevation image, detect regions relevant to these trades and return STRICT JSON.
Return { "detections": [ { "asm": "<one of: brick|eifs|slab|drywall|doors>", "type": "area|linear|count", "points": [[x,y],...], "confidence": 0..1, "note": "short" } ] }.
Coordinates are NORMALIZED 0..1 relative to image width (x) and height (y). area = polygon (>=3 pts), linear = polyline (>=2 pts), count = single point per item. Only include what you can actually see. Do not invent scale or dimensions.`;

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

async function openaiDetect({ imageDataUrl, bg, layers, key }) {
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
      const layer = layerForAsm(layers, d.asm);
      if (!layer || !Array.isArray(d.points)) return null;
      const pts = d.points.map(([x, y]) => ({ x: x * W, y: y * H }));
      const type = ["area", "linear", "count"].includes(d.type) ? d.type : "count";
      if (type === "area" && pts.length < 3) return null;
      if (type === "linear" && pts.length < 2) return null;
      return suggestion(layer, type, type === "count" ? [pts[0]] : pts, d.confidence ?? 0.5, d.note || "");
    })
    .filter(Boolean);
}

// Public entry point.
export async function detectTakeoff({ imageDataUrl, bg, layers }) {
  const key = getKey();
  if (key && imageDataUrl) return openaiDetect({ imageDataUrl, bg, layers, key });
  // demo mode: brief delay so the UI shows its working state
  await new Promise((r) => setTimeout(r, 500));
  return mockDetect({ bg, layers });
}
