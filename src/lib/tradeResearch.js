// ---------------------------------------------------------------------------
// AI trade / scope research — search a specialty scope (e.g. "asbestos removal")
// and return related takeoff trades with material lines to add to the price book.
// ---------------------------------------------------------------------------
import { getKey } from "./aiDetect.js";
import { ASSEMBLIES } from "./assemblies.js";

const REASONING_MODEL = "o3-mini";
const STANDARD_MODEL = "gpt-4o";

function catalogKeys(priceBook = {}) {
  const keys = new Set([...Object.keys(ASSEMBLIES), ...Object.keys(priceBook)]);
  return [...keys].map((key) => {
    const a = priceBook[key] || ASSEMBLIES[key];
    return { key, name: a?.name, div: a?.div, unit: a?.unit, geom: a?.geom };
  });
}

function normalizeTrade(t) {
  const geom = ["area", "linear", "count"].includes(t.geom) ? t.geom : "area";
  const unit = t.unit || (geom === "linear" ? "LF" : geom === "count" ? "EA" : "SF");
  return {
    name: String(t.name || t.trade || "New trade").trim(),
    scope: String(t.scope || "").trim(),
    geom,
    unit,
    div: String(t.div || "Specialty").trim(),
    existingAsm: t.existingAsm && typeof t.existingAsm === "string" ? t.existingAsm : null,
    materials: (Array.isArray(t.materials) ? t.materials : []).map((m) => ({
      name: String(m.name || "Material").trim(),
      per: typeof m.per === "number" ? m.per : 1,
      waste: typeof m.waste === "number" ? m.waste : 0,
      u: m.u || unit,
      cost: typeof m.cost === "number" ? m.cost : 0,
      labor: typeof m.labor === "number" ? m.labor : 0,
      equip: typeof m.equip === "number" ? m.equip : 0,
    })),
  };
}

export async function researchTradeScope({ query, priceBook = {}, useReasoning = false }) {
  const key = getKey();
  if (!key) throw new Error("Add an OpenAI key (AI panel) to research trades.");

  const catalog = catalogKeys(priceBook);
  const model = useReasoning ? REASONING_MODEL : STANDARD_MODEL;

  const sys = `You are a senior construction estimator building a takeoff scope breakdown.
Return STRICT JSON only:
{
  "summary": "2-3 sentences on the scope and what an estimator should trace",
  "trades": [
    {
      "name": "Short trade / assembly name for a takeoff layer",
      "scope": "One line — what to measure on the plans",
      "geom": "area | linear | count",
      "unit": "SF | LF | EA",
      "div": "CSI-style division label",
      "existingAsm": "<catalog key if a built-in assembly fits, else null>",
      "materials": [
        { "name": "material or labor line", "per": 1, "waste": 0, "u": "SF|LF|EA|CF|ea", "cost": 0, "labor": 0, "equip": 0 }
      ]
    }
  ]
}
Rules:
- Break the searched scope into 4–12 distinct takeoff items an estimator would bid separately (materials, removals, prep, disposal, etc.).
- Each trade needs at least 2 material/labor lines with realistic placeholder unit costs (bare $/unit, US market 2025–2026).
- geom/unit must match how the item is measured (pipe wrap = linear/LF, floor tile = area/SF, fixtures = count/EA).
- existingAsm only when a catalog assembly is a close fit; otherwise null and provide full materials.
- Do not repeat the same trade twice. Be specific (e.g. "ACM pipe insulation" not just "insulation").`;

  const user = `SEARCH SCOPE: ${query}

CATALOG (use existingAsm key when applicable, else null):
${JSON.stringify(catalog.slice(0, 40))}`;

  const call = async (m) => {
    const body = {
      model: m,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: useReasoning ? 1 : 0.2,
    };
    if (!m.startsWith("o3")) body.response_format = { type: "json_object" };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "{}";
    return JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
  };

  let parsed;
  try {
    parsed = await call(model);
  } catch (err) {
    if (!useReasoning) throw err;
    parsed = await call(STANDARD_MODEL);
  }

  const trades = (Array.isArray(parsed.trades) ? parsed.trades : [])
    .map(normalizeTrade)
    .filter((t) => t.name);

  return {
    summary: parsed.summary || "",
    trades,
  };
}
