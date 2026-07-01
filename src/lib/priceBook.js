// ---------------------------------------------------------------------------
// Price-book portability. Export the whole editable catalog as JSON (round-trips
// the full structure — the backup/share format) or CSV (spreadsheet editing),
// and import a JSON book back in. This is how you load your real 481-item book.
// ---------------------------------------------------------------------------
import { download } from "./exportCsv.js";

export function exportPriceBookJson(priceBook) {
  const json = JSON.stringify(priceBook, null, 2);
  download("planforge-pricebook.json", json, "application/json");
}

export function exportPriceBookCsv(priceBook) {
  const rows = [["assembly_key", "assembly", "geom", "unit", "material", "per", "waste_pct", "unit_cost", "material_unit"]];
  for (const [key, a] of Object.entries(priceBook)) {
    a.materials.forEach((m) => rows.push([key, a.name, a.geom, a.unit, m.name, m.per, Math.round(m.waste * 100), m.cost, m.u]));
  }
  const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(",")).join("\n");
  download("planforge-pricebook.csv", csv, "text/csv");
}

// Parse an uploaded JSON price book; returns the object or throws.
export async function parsePriceBookFile(file) {
  const text = await file.text();
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("Not a price-book JSON object.");
  return obj;
}
