// ---------------------------------------------------------------------------
// Assembly catalog + material-explosion engine.
//
// Cost model (standard estimating structure — see RSMeans / CSI MasterFormat):
//   bare cost   = material + labor + equipment (what the installer pays)
//   incl O&P    = bare  x (1 + overhead% + profit%)      (what you charge)
//   localized   = incl O&P x locationFactor              (city cost index /100)
// Waste is applied to MATERIAL quantity only. Every number here is an editable
// NW-Ohio estimate — swap in your own priced book via the Price Book page.
//
// geom: how the layer is traced -> "area" (SF) | "linear" (LF) | "count" (EA)
// per: quantity of this material per 1 measured unit of the assembly
// cost = material $/unit · labor = labor $/unit · equip = equipment $/unit
// div: CSI MasterFormat division for organizing the estimate
// ---------------------------------------------------------------------------

const m = (name, per, waste, u, cost, labor = 0, equip = 0) => ({ name, per, waste, u, cost, labor, equip });

export const ASSEMBLIES = {
  // --- Div 03 Concrete ------------------------------------------------------
  slab: {
    name: 'Slab on Grade 4"', unit: "SF", geom: "area", div: "03 Concrete",
    materials: [
      m('4" concrete, 4000 psi (mat + place)', 1, 0.05, "SF", 2.05, 1.45, 0.35),
      m("6x6 WWF + 10-mil vapor barrier", 1, 0.1, "SF", 0.95, 0.45),
      m("Fine grade + control joints", 1, 0, "SF", 0.15, 0.55),
    ],
  },
  footing: {
    name: "Continuous Footing", unit: "LF", geom: "linear", div: "03 Concrete",
    materials: [
      m("Concrete 4000 psi (form + place)", 0.6, 0.05, "CF", 6.5, 4.2, 0.5),
      m("(3) #5 rebar continuous", 3, 0.05, "LF", 0.95, 0.55),
      m("Form + strip", 1, 0, "LF", 1.1, 3.4),
    ],
  },
  foundwall: {
    name: 'Foundation Wall 8"', unit: "LF", geom: "linear", div: "03 Concrete",
    materials: [
      m("8\" cast wall (form/pour/strip)", 1, 0.05, "LF", 22, 26, 4),
      m("Rebar + waterproofing", 1, 0.05, "LF", 6, 5),
    ],
  },

  // --- Div 04 Masonry -------------------------------------------------------
  brick: {
    name: "Thin Brick Veneer", unit: "SF", geom: "area", div: "04 Masonry",
    materials: [
      m("Endicott thin brick", 1, 0.1, "SF", 8.0, 3.6),
      m("Lath + scratch/setting bed", 1, 0.05, "SF", 1.2, 1.5),
      m("Mortar + ties + sealer", 1, 0.05, "SF", 0.55, 0.4),
    ],
  },
  cmu: {
    name: 'CMU 8" Wall', unit: "SF", geom: "area", div: "04 Masonry",
    materials: [
      m('8" CMU block', 1.13, 0.05, "ea", 2.35, 3.4, 0.15),
      m("Mortar + grout + reinf", 1, 0.05, "SF", 0.85, 1.1),
    ],
  },

  // --- Div 05 Metals --------------------------------------------------------
  joists: {
    name: "Bar Joists + Metal Deck", unit: "SF", geom: "area", div: "05 Metals",
    materials: [
      m("Open-web joists", 1, 0.02, "SF", 3.2, 1.4, 0.6),
      m("1.5\" B metal roof deck", 1, 0.05, "SF", 2.1, 0.9, 0.3),
    ],
  },

  // --- Div 07 Thermal & Moisture --------------------------------------------
  eifs: {
    name: "EIFS", unit: "SF", geom: "area", div: "07 Thermal & Moisture",
    materials: [m("EIFS board + base/mesh/finish", 1, 0.1, "SF", 3.4, 2.9)],
  },
  eifsband: {
    name: "EIFS Control-Joint Band", unit: "LF", geom: "linear", div: "07 Thermal & Moisture",
    materials: [m("Backer rod + sealant", 1, 0.05, "LF", 0.9, 0.9)],
  },
  roofing: {
    name: "PVC Roof (Duro-Last)", unit: "SF", geom: "area", div: "07 Thermal & Moisture",
    materials: [
      m("PVC membrane + adhesive", 1, 0.1, "SF", 2.2, 1.8, 0.2),
      m("R-30 polyiso + coverboard", 1, 0.08, "SF", 2.9, 1.1),
    ],
  },

  // --- Div 08 Openings ------------------------------------------------------
  doors: {
    name: "HM Door + Frame + Hardware", unit: "EA", geom: "count", div: "08 Openings",
    materials: [
      m("HM door + frame", 1, 0, "ea", 780, 220),
      m("Hardware set + install", 1, 0, "ea", 340, 180),
    ],
  },
  windows: {
    name: "Window Unit", unit: "EA", geom: "count", div: "08 Openings",
    materials: [m("Window + flashing + install", 1, 0, "ea", 420, 180, 0)],
  },
  storefront: {
    name: "Aluminum Storefront + Glazing", unit: "SF", geom: "area", div: "08 Openings",
    materials: [m("Alum. framing + 1\" IGU + install", 1, 0.05, "SF", 42, 24, 1.5)],
  },

  // --- Div 09 Finishes ------------------------------------------------------
  drywall: {
    name: "Drywall Partition (metal stud, 2 sides)", unit: "LF", geom: "linear", div: "09 Finishes",
    materials: [
      m('5/8" Type X — 4x12 sheet', 0.5, 0.1, "sheet", 18, 0),
      m("3-5/8\" metal stud, 12'", 0.9, 0.1, "ea", 9.5, 0),
      m("Track + framing labor", 2, 0.08, "LF", 0.8, 6.5),
      m("Tape/mud/finish labor", 1, 0, "LF", 0.9, 7.5),
    ],
  },
  paint: {
    name: "Paint — Walls (2 coats)", unit: "SF", geom: "area", div: "09 Finishes",
    materials: [m("Primer + 2 coats", 1, 0.05, "SF", 0.35, 0.75)],
  },
  act: {
    name: "Acoustic Ceiling (ACT)", unit: "SF", geom: "area", div: "09 Finishes",
    materials: [m("Grid + tile + install", 1, 0.05, "SF", 1.8, 1.6)],
  },
  flooring: {
    name: "Sealed Concrete / Epoxy Floor", unit: "SF", geom: "area", div: "09 Finishes",
    materials: [m("Prep + seal/epoxy coat", 1, 0.05, "SF", 1.1, 1.4, 0.2)],
  },

  // --- Div 22 Plumbing ------------------------------------------------------
  fixtures: {
    name: "Restroom Fixture / Accessory", unit: "EA", geom: "count", div: "22 Plumbing",
    materials: [m("Fixture + rough-in + set", 1, 0, "ea", 240, 520)],
  },

  // --- Div 23 HVAC ----------------------------------------------------------
  rtu: {
    name: "Rooftop Unit (RTU) + Curb", unit: "EA", geom: "count", div: "23 HVAC",
    materials: [
      m("Packaged RTU (5-ton)", 1, 0, "ea", 7800, 1200, 650),
      m("Curb + rig + startup", 1, 0, "ea", 900, 1400, 400),
    ],
  },

  // --- Div 32 Exterior Improvements (fencing, site walls) -------------------
  woodfence: {
    name: "Wood Privacy Fence 6'", unit: "LF", geom: "linear", div: "32 Exterior Improvements",
    materials: [
      m("Cedar pickets + rails", 1, 0.08, "LF", 14, 0, 0),
      m("4x4 posts + concrete", 0.13, 0.05, "post", 22, 0, 0), // ~1 post / 8 LF
      m("Set posts + hang panels (labor)", 1, 0, "LF", 0, 16, 0),
    ],
  },
  chainlink: {
    name: "Chain-link Fence 6'", unit: "LF", geom: "linear", div: "32 Exterior Improvements",
    materials: [
      m("Mesh + top rail + posts", 1, 0.05, "LF", 8.5, 0, 0),
      m("Set posts + stretch (labor)", 1, 0, "LF", 0, 7.5, 0),
    ],
  },
  fencegate: {
    name: "Fence Gate + Hardware", unit: "EA", geom: "count", div: "32 Exterior Improvements",
    materials: [m("Gate frame + hardware + hang", 1, 0, "ea", 190, 140, 0)],
  },
  sitewall: {
    name: "Site / Retaining Wall (CMU)", unit: "LF", geom: "linear", div: "32 Exterior Improvements",
    materials: [
      m("Footing + CMU + cap", 1, 0.05, "LF", 34, 42, 3),
      m("Reinf + grout + waterproof", 1, 0.05, "LF", 9, 6, 0),
    ],
  },

  // --- Div 26 Electrical ----------------------------------------------------
  lighting: {
    name: "Light Fixture (LED)", unit: "EA", geom: "count", div: "26 Electrical",
    materials: [m("Fixture + whip + install", 1, 0, "ea", 165, 120)],
  },
  device: {
    name: "Receptacle / Device", unit: "EA", geom: "count", div: "26 Electrical",
    materials: [m("Device + box + wire + install", 1, 0, "ea", 22, 85)],
  },
};

// Overhead+Profit + location factor applied to bare costs.
function factorOf(settings = {}) {
  const onp = 1 + ((settings.overheadPct || 0) + (settings.profitPct || 0)) / 100;
  return onp * (settings.locationFactor || 1);
}

// explode a measured quantity into priced materials (bare + O&P + location).
// `catalog` lets the editable Price Book override the built-in ASSEMBLIES.
export function explode(assemblyKey, qty, catalog = ASSEMBLIES, settings = {}) {
  const asm = (catalog && catalog[assemblyKey]) || ASSEMBLIES[assemblyKey];
  if (!asm) return { materials: [], cost: 0, bare: 0 };
  const factor = factorOf(settings);
  const materials = asm.materials.map((mm) => {
    const base = qty * mm.per;
    const mqty = base * (1 + (mm.waste || 0));
    const matExt = mqty * (mm.cost || 0);
    const laborExt = base * (mm.labor || 0);
    const equipExt = base * (mm.equip || 0);
    const bare = matExt + laborExt + equipExt;
    return { ...mm, mqty, matExt, laborExt, equipExt, bare, ext: bare * factor };
  });
  const bare = materials.reduce((s, x) => s + x.bare, 0);
  return { materials, cost: materials.reduce((s, x) => s + x.ext, 0), bare };
}

// bare $/unit for a single assembly (used by the Price Book "≈ $/unit" chip)
export function unitBare(asm) {
  return asm.materials.reduce((s, x) => s + x.per * (1 + (x.waste || 0)) * (x.cost || 0) + x.per * ((x.labor || 0) + (x.equip || 0)), 0);
}

export const geomLabel = { area: "Draw area", linear: "Draw line", count: "Drop counts" };

// default estimating settings — editable in the Price Book
export const DEFAULT_BOOK_META = { location: "NW Ohio (Toledo)", locationFactor: 0.94, overheadPct: 10, profitPct: 8 };
