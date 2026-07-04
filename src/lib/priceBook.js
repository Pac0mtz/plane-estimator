// ---------------------------------------------------------------------------
// Price-book portability. Export the whole editable catalog as JSON (round-trips
// the full structure — the backup/share format) or CSV (spreadsheet editing),
// and import either format back in.
// ---------------------------------------------------------------------------
import { download } from "./exportCsv.js";

export function exportPriceBookJson(priceBook) {
  const json = JSON.stringify(priceBook, null, 2);
  download("planforge-pricebook.json", json, "application/json");
}

export function exportPriceBookCsv(priceBook) {
  const rows = [["division", "assembly_key", "assembly", "geom", "unit", "material", "per", "waste_pct", "material_cost", "labor_cost", "equip_cost", "material_unit"]];
  for (const [key, a] of Object.entries(priceBook)) {
    a.materials.forEach((m) => rows.push([a.div || "", key, a.name, a.geom, a.unit, m.name, m.per, Math.round((m.waste || 0) * 100), m.cost, m.labor || 0, m.equip || 0, m.u]));
  }
  const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(",")).join("\n");
  download("planforge-pricebook.csv", csv, "text/csv");
}

// Minimal RFC-style CSV parser (quoted fields, escaped quotes).
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || (c === "\r" && text[i + 1] === "\n")) {
      row.push(cell); rows.push(row); row = []; cell = "";
      if (c === "\r") i++;
    } else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim()));
}

const COL = {
  division: ["division", "div"],
  assembly_key: ["assembly_key", "key", "assemblykey"],
  assembly: ["assembly", "assembly_name", "name"],
  geom: ["geom", "geometry"],
  unit: ["unit"],
  material: ["material", "material_name"],
  per: ["per"],
  waste_pct: ["waste_pct", "waste", "waste%"],
  material_cost: ["material_cost", "cost", "mat_cost"],
  labor_cost: ["labor_cost", "labor"],
  equip_cost: ["equip_cost", "equip", "equipment_cost"],
  material_unit: ["material_unit", "u", "unit_u"],
};

function colIndex(header, aliases) {
  for (const a of aliases) {
    const i = header.indexOf(a);
    if (i >= 0) return i;
  }
  return -1;
}

function num(v, fallback = 0) {
  const n = parseFloat(String(v ?? "").replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

// Parse CSV exported from this app (or matching column layout) into a price book.
export function parsePriceBookCsv(text) {
  const rows = parseCsvRows(text.trim());
  if (rows.length < 2) throw new Error("CSV has no data rows.");

  const header = rows[0].map((h) => String(h).trim().toLowerCase());
  const ix = {};
  for (const [field, aliases] of Object.entries(COL)) {
    ix[field] = colIndex(header, aliases);
  }
  if (ix.assembly_key < 0) throw new Error('CSV needs an "assembly_key" column (export from Plan Forge to get the template).');

  const book = {};
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const get = (i) => (i >= 0 ? String(cells[i] ?? "").trim() : "");
    const key = get(ix.assembly_key);
    if (!key) continue;

    if (!book[key]) {
      const geom = get(ix.geom) || "area";
      book[key] = {
        name: get(ix.assembly) || key,
        geom: ["area", "linear", "count"].includes(geom) ? geom : "area",
        unit: get(ix.unit) || (geom === "linear" ? "LF" : geom === "count" ? "EA" : "SF"),
        div: get(ix.division) || "",
        materials: [],
      };
    }

    const wasteRaw = get(ix.waste_pct);
    const waste = wasteRaw.includes("%") || num(wasteRaw) > 1 ? num(wasteRaw) / 100 : num(wasteRaw);

    book[key].materials.push({
      name: get(ix.material) || "Material",
      per: num(get(ix.per), 1),
      waste,
      cost: num(get(ix.material_cost)),
      labor: num(get(ix.labor_cost)),
      equip: num(get(ix.equip_cost)),
      u: get(ix.material_unit) || book[key].unit,
    });
  }

  if (!Object.keys(book).length) throw new Error("No assemblies found in CSV.");
  for (const a of Object.values(book)) {
    if (!a.materials.length) throw new Error(`Assembly "${a.name}" has no materials.`);
  }
  return book;
}

// Parse an uploaded JSON or CSV price book; returns the object or throws.
export async function parsePriceBookFile(file) {
  const text = await file.text();
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || (name.endsWith(".txt") && text.includes(","))) {
    return parsePriceBookCsv(text);
  }
  if (name.endsWith(".json") || text.trimStart().startsWith("{")) {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("Not a price-book JSON object.");
    return obj;
  }
  // sniff: header row from our export
  if (/^division\s*,/i.test(text.trim())) return parsePriceBookCsv(text);
  throw new Error("Unsupported file — upload JSON or CSV.");
}
