// ---------------------------------------------------------------------------
// Branded proposal / takeoff PDF via jsPDF. Same rollup shape as the CSV, laid
// out as a client-ready line-item estimate — the piece that feeds Bid Studio.
// ---------------------------------------------------------------------------
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const money = (n) => "$" + Math.round(n).toLocaleString();
const NAVY = [10, 37, 64];
const BRAND = [47, 127, 209];

export function exportProposalPdf({ rollup, grand, project, client, title, preparedBy, notes, pricing = {} }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;

  // header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 92, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(preparedBy || "Plan Forge", M, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(180, 205, 235);
  doc.text(title || "Material takeoff proposal", M, 60);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString(), W - M, 42, { align: "right" });

  // project + client block
  let y = 124;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(project?.name || "Untitled project", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  y += 16;
  if (project?.address) { doc.text(project.address, M, y); y += 14; }
  if (client) {
    const line = [client.name, client.company].filter(Boolean).join(" · ");
    if (line) { doc.text(`Prepared for: ${line}`, M, y); y += 14; }
    const contact = [client.email, client.phone].filter(Boolean).join("  ·  ");
    if (contact) { doc.text(contact, M, y); y += 14; }
  }

  // trade rollup table
  autoTable(doc, {
    startY: y + 8,
    head: [["Trade", "Assembly", "Qty", "Unit", "Material cost"]],
    body: rollup
      .filter((r) => r.qty > 0)
      .map((r) => [
        r.layer.name,
        r.asm.name,
        r.qty.toFixed(r.asm.unit === "EA" ? 0 : 1),
        r.asm.unit,
        money(r.cost),
      ]),
    foot: [["", "", "", "Total material", money(grand)]],
    theme: "striped",
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
    columnStyles: { 2: { halign: "right" }, 4: { halign: "right" } },
    margin: { left: M, right: M },
  });

  // per-trade material breakdown
  const priced = rollup.filter((r) => r.qty > 0 && r.materials.length);
  if (priced.length) {
    let yy = doc.lastAutoTable.finalY + 26;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text("Material breakdown", M, yy);
    yy += 6;
    priced.forEach((r) => {
      autoTable(doc, {
        startY: yy + 8,
        head: [[r.layer.name + " — " + r.asm.name, "Qty", "Unit", "Unit $", "Ext"]],
        body: r.materials.map((m) => [
          m.name,
          m.mqty.toFixed(m.u === "sheet" || m.u === "ea" ? 0 : 1),
          m.u,
          "$" + m.cost.toFixed(2),
          money(m.ext),
        ]),
        theme: "grid",
        headStyles: { fillColor: [230, 235, 240], textColor: NAVY, fontStyle: "bold" },
        styles: { fontSize: 8 },
        columnStyles: { 1: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
        margin: { left: M, right: M },
      });
      yy = doc.lastAutoTable.finalY;
    });
  }

  // notes / terms
  if (notes && notes.trim()) {
    let ny = (doc.lastAutoTable?.finalY || 300) + 24;
    if (ny > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); ny = 60; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...NAVY);
    doc.text("Notes & terms", M, ny);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    doc.text(doc.splitTextToSize(notes.trim(), W - 2 * M), M, ny + 16);
  }

  // footer note
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const onp = (pricing.overheadPct || 0) + (pricing.profitPct || 0);
  const loc = pricing.location || "Local market";
  const factor = pricing.locationFactor ?? 1;
  doc.text(`Material + labor + equipment · +${onp}% O&P · ${loc} ×${factor.toFixed(2)} — verify against supplier quotes`, M, doc.internal.pageSize.getHeight() - 28);

  const safe = (project?.name || "takeoff").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`planforge-${safe}.pdf`);
}
