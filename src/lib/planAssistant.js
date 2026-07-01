// ---------------------------------------------------------------------------
// AI plan assistant. Answers an estimator's questions about the open plan set:
// summarizes the current sheet, recommends which sheets to pull for a trade,
// reads schedules/notes, and "looks at" the drawing (vision) when asked.
//
// Context handed to the model: the full sheet index (so it can point you at the
// right pages) + the current sheet's extracted text + optionally its rendered
// image. Uses the same OpenAI key as AI detect; falls back to an error if none.
// ---------------------------------------------------------------------------
import { getKey } from "./aiDetect.js";
import { toDataUrl } from "./pdf.js";
import { useStore } from "../store/useStore.js";

const SYSTEM = `You are a plan assistant for a construction estimator working a set of drawings.
- Be concise and practical — you're helping someone do a material takeoff and bid.
- Cite specific sheets in square brackets like [A101] or [S501] so they become clickable links.
- When asked what to look at for a scope/trade, list the exact sheets (number + why).
- When asked to summarize the current sheet, give: what it is, key scope items, any quantities/schedules/dimensions you can read, and which trades it affects.
- If something isn't in the provided text or image, say so briefly rather than guessing.`;

const QUICK = [
  { label: "Summarize this sheet", q: "Summarize the current sheet for takeoff.", image: true },
  { label: "Sheets for concrete", q: "Which sheets do I need for the concrete / slab / foundation takeoff, and what's on each?" },
  { label: "Find all schedules", q: "List every schedule sheet in this set (door, finish, equipment, HVAC, plumbing, electrical) with its sheet number." },
  { label: "Read this drawing", q: "Read the current drawing and tell me what quantities I can take off from it.", image: true },
];
export const QUICK_ACTIONS = QUICK;

// Extract clickable sheet references (e.g. A101) from an answer.
export function refsIn(text, knownNos) {
  const set = new Set();
  const re = /\[?\b([A-Z]{1,2}\d{2,4}[A-Z]?)\b\]?/g;
  let m;
  while ((m = re.exec(text))) if (knownNos.has(m[1].toUpperCase())) set.add(m[1].toUpperCase());
  return [...set];
}

// Auto-analysis run on import: detect every trade present and write a project
// summary. Text-only (fast, cheap) — driven by the sheet index + page text.
export async function generatePlanSummary({ sheetIndex = [], pagesText = [] }) {
  const key = getKey();
  if (!key) throw new Error("no key");

  const idx = sheetIndex.map((s) => `${s.no}  ${s.title}`).join("\n") || "(no index)";
  const text = pagesText.filter(Boolean).join("\n---\n").slice(0, 14000);

  const sys = `You are a construction estimator's assistant analyzing a drawing set. Return STRICT JSON only:
{ "summary": "2-4 sentence overview: building type, size, and scope of work",
  "trades": [ { "trade": "estimator trade name", "asm": "best-match key or null", "sheets": ["A101","S101"], "scope": "one short line" } ] }
Detect EVERY trade actually represented in the sheet index / text — e.g. Sitework, Concrete, Masonry, Thin brick / veneer, EIFS, Structural steel, Rough carpentry, Drywall & framing, Roofing, Doors & hardware, Storefront / glazing, Finishes, FF&E, Fire protection, Plumbing, HVAC, Electrical. Do not invent trades that aren't in the set. Cite the specific sheets for each trade.
For "asm", pick the single best matching takeoff assembly key from this list (or null if none fits): slab, footing, foundwall, brick, cmu, joists, eifs, roofing, doors, storefront, drywall, paint, act, flooring, fixtures, rtu, lighting, device, woodfence, chainlink, fencegate, sitewall.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `SHEET INDEX (${sheetIndex.length}):\n${idx}\n\nSHEET TEXT (truncated):\n${text}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  return { summary: parsed.summary || "", trades: Array.isArray(parsed.trades) ? parsed.trades : [] };
}

// One-shot: push a question into the assistant chat, open the panel, and run
// the model. Shared by the chat input and the canvas hover "Ask AI" action.
export async function runAssistant(question, { image = false } = {}) {
  const st = useStore.getState();
  st.setAssistantOpen(true);
  const history = st.chat;
  st.pushChat({ role: "user", content: question });
  st.setChatBusy(true);
  try {
    const active = st.pages[st.activePage];
    const imageUrl = image && active?.loaded ? active.href : null;
    const answer = await askAssistant({ question, history, sheetIndex: st.sheetIndex, activeSheet: active, imageUrl });
    useStore.getState().pushChat({ role: "assistant", content: answer });
  } catch (err) {
    useStore.getState().pushChat({ role: "assistant", content: "⚠️ " + err.message, error: true });
  } finally {
    useStore.getState().setChatBusy(false);
  }
}

export async function askAssistant({ question, history = [], sheetIndex = [], activeSheet, imageUrl }) {
  const key = getKey();
  if (!key) throw new Error("Add an OpenAI key (AI detect panel → key icon) to use the assistant.");

  const idx = sheetIndex.slice(0, 160).map((s) => `${s.no}  ${s.title}`).join("\n") || "(no sheet index parsed)";
  const cur = activeSheet
    ? `CURRENT SHEET: ${activeSheet.sheetNo || "?"} — ${activeSheet.title || ""}\nTEXT:\n${(activeSheet.text || "").slice(0, 7000) || "(no text layer — it may be a drawing image)"}`
    : "CURRENT SHEET: (none open)";

  const content = [{ type: "text", text: `SHEET INDEX (${sheetIndex.length} sheets):\n${idx}\n\n${cur}\n\nQUESTION: ${question}` }];
  if (imageUrl) {
    try { content.push({ type: "image_url", image_url: { url: await toDataUrl(imageUrl) } }); } catch { /* skip image */ }
  }

  const messages = [
    { role: "system", content: SYSTEM },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.2 }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "(no answer)";
}
