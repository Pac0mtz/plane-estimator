// ---------------------------------------------------------------------------
// Assembly catalog + material explosion engine.
// Each assembly maps a traced quantity (SF / LF / EA) into a bill of materials.
// Costs are NW Ohio material-only (swap in your 481-item price book here).
// geom: how the layer is traced -> "area" (SF) | "linear" (LF) | "count" (EA)
// materials[].per: material qty per 1 unit of the assembly's measured quantity
// ---------------------------------------------------------------------------
export const ASSEMBLIES = {
  brick: {
    name: "Thin Brick Veneer",
    unit: "SF",
    geom: "area",
    materials: [
      { name: "Endicott thin brick", per: 1, waste: 0.1, u: "SF", cost: 11.5 },
      { name: "Lath + scratch/setting bed", per: 1, waste: 0.05, u: "SF", cost: 2.2 },
    ],
  },
  eifs: {
    name: "EIFS",
    unit: "SF",
    geom: "area",
    materials: [
      { name: "EIFS board + base/mesh/finish", per: 1, waste: 0.1, u: "SF", cost: 6.0 },
    ],
  },
  slab: {
    name: 'Slab on Grade 4"',
    unit: "SF",
    geom: "area",
    materials: [
      { name: '4" concrete (mat + place)', per: 1, waste: 0.05, u: "SF", cost: 2.6 },
      { name: "6x6 WWF + 10-mil vapor barrier", per: 1, waste: 0.1, u: "SF", cost: 1.0 },
    ],
  },
  roofing: {
    name: "PVC Roof (Duro-Last)",
    unit: "SF",
    geom: "area",
    materials: [
      { name: "PVC membrane + adhesive", per: 1, waste: 0.1, u: "SF", cost: 4.2 },
      { name: "R-49 polyiso + coverboard", per: 1, waste: 0.08, u: "SF", cost: 4.3 },
    ],
  },
  drywall: {
    name: "Drywall Partition (metal stud, 2 sides)",
    unit: "LF",
    geom: "linear",
    materials: [
      { name: '5/8" Type X — 4x12 sheet', per: 0.5, waste: 0.1, u: "sheet", cost: 18 },
      { name: "3-5/8\" metal stud, 12'", per: 0.9, waste: 0.1, u: "ea", cost: 9.5 },
      { name: "Track (top + bottom)", per: 2, waste: 0.08, u: "LF", cost: 0.8 },
      { name: "Compound / tape / screws", per: 1, waste: 0, u: "LF", cost: 0.9 },
    ],
  },
  eifsband: {
    name: "EIFS Control-Joint Band",
    unit: "LF",
    geom: "linear",
    materials: [{ name: "Backer rod + sealant", per: 1, waste: 0.05, u: "LF", cost: 1.6 }],
  },
  doors: {
    name: "HM Door + Frame + Hardware",
    unit: "EA",
    geom: "count",
    materials: [{ name: "HM door / frame / hardware", per: 1, waste: 0, u: "ea", cost: 1400 }],
  },
  fixtures: {
    name: "Restroom Fixture / Accessory",
    unit: "EA",
    geom: "count",
    materials: [{ name: "Fixture + blocking", per: 1, waste: 0, u: "ea", cost: 240 }],
  },
};

// explode a measured quantity into priced materials
export function explode(assemblyKey, qty) {
  const asm = ASSEMBLIES[assemblyKey];
  if (!asm) return { materials: [], cost: 0 };
  const materials = asm.materials.map((m) => {
    const mqty = qty * m.per * (1 + m.waste);
    return { ...m, mqty, ext: mqty * m.cost };
  });
  return { materials, cost: materials.reduce((s, m) => s + m.ext, 0) };
}

export const geomLabel = { area: "Draw area", linear: "Draw line", count: "Drop counts" };
