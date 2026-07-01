export function buildCsv(rollup, grand) {
  const rows = [
    ["Trade", "Assembly", "Qty", "Unit", "Material", "MatQty", "MatUnit", "UnitCost", "Extended"],
  ];
  rollup.forEach((r) =>
    r.materials.forEach((m) =>
      rows.push([
        r.layer.name,
        r.asm.name,
        r.qty.toFixed(1),
        r.asm.unit,
        m.name,
        m.mqty.toFixed(1),
        m.u,
        m.cost,
        Math.round(m.ext),
      ])
    )
  );
  rows.push([]);
  rows.push(["", "", "", "", "", "", "", "TOTAL MATERIAL", Math.round(grand)]);
  return rows.map((r) => r.join(",")).join("\n");
}

export function download(filename, text) {
  const blob = new Blob([text], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
