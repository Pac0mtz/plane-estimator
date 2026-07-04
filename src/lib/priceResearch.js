// ---------------------------------------------------------------------------
// AI price research — uses a reasoning model to suggest bare-cost updates for
// a metro market. Returns structured patches applied to the active location book.
// ---------------------------------------------------------------------------
import { getKey } from "./aiDetect.js";

const REASONING_MODEL = "o3-mini";
const STANDARD_MODEL = "gpt-4o";

function catalogSummary(priceBook, limit = 50) {
  return Object.entries(priceBook)
    .slice(0, limit)
    .map(([key, a]) => ({
      key,
      name: a.name,
      div: a.div || "",
      unit: a.unit,
      geom: a.geom,
      materials: a.materials.map((m, i) => ({
        i,
        name: m.name,
        per: m.per,
        waste_pct: Math.round((m.waste || 0) * 100),
        cost: m.cost,
        labor: m.labor || 0,
        equip: m.equip || 0,
        u: m.u,
      })),
    }));
}

function applyUpdates(book, updates = []) {
  const next = JSON.parse(JSON.stringify(book));
  let count = 0;
  for (const u of updates) {
    const asm = next[u.key];
    if (!asm || !asm.materials[u.materialIndex]) continue;
    const m = asm.materials[u.materialIndex];
    if (typeof u.cost === "number" && u.cost >= 0) m.cost = u.cost;
    if (typeof u.labor === "number" && u.labor >= 0) m.labor = u.labor;
    if (typeof u.equip === "number" && u.equip >= 0) m.equip = u.equip;
    count++;
  }
  return { book: next, count };
}

export async function researchPriceBook({
  priceBook,
  location,
  locationFactor = 1,
  applyLocationAdjust = true,
  useReasoning = true,
}) {
  const key = getKey();
  if (!key) throw new Error("Add an OpenAI key (AI detect panel → key icon) to research prices.");

  const catalog = catalogSummary(priceBook);
  const model = useReasoning ? REASONING_MODEL : STANDARD_MODEL;

  const sys = `You are a senior construction estimator updating a unit-price catalog for a specific US market.
Return STRICT JSON only:
{
  "summary": "2-4 sentences on market conditions and what you changed",
  "suggestedFactor": <number — RSMeans-style city cost index as decimal, e.g. 0.94 for below-national, 1.08 for high-cost metro>,
  "updates": [
    { "key": "<assembly_key>", "materialIndex": <0-based index>, "cost": <material $/unit>, "labor": <labor $/unit>, "equip": <equip $/unit>, "note": "short reason" }
  ]
}
Rules:
- Adjust bare material, labor, and equipment unit costs for the target location and current market (2025–2026).
- Include updates for every assembly you can reasonably price — at least one material line per assembly in the input.
- Keep assembly keys and materialIndex exactly as provided.
- suggestedFactor should reflect the metro's overall cost index (national avg = 1.0).
- Do not invent new assemblies or materials — only update existing lines.`;

  const user = `TARGET LOCATION: ${location}
CURRENT LOCATION FACTOR: ${locationFactor} (1.0 = national average)
APPLY LOCATION ADJUSTMENTS: ${applyLocationAdjust ? "yes — localize bare costs to this market" : "no — only refresh costs toward current national averages"}

CATALOG (${Object.keys(priceBook).length} assemblies, showing ${catalog.length}):
${JSON.stringify(catalog)}`;

  const call = async (m) => {
    const body = {
      model: m,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: useReasoning ? 1 : 0.2,
    };
    if (!useReasoning) body.response_format = { type: "json_object" };

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

  const { book, count } = applyUpdates(priceBook, parsed.updates);
  return {
    summary: parsed.summary || "Research complete.",
    suggestedFactor: typeof parsed.suggestedFactor === "number" ? parsed.suggestedFactor : null,
    updateCount: count,
    book,
    updates: parsed.updates || [],
  };
}
