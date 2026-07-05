/** True when Plan Forge runs inside Field Task Pro at /plan-estimator */
export function isFieldTaskProEmbed() {
  if (typeof window === "undefined") return false;
  return window.location.pathname.includes("plan-estimator");
}

/** Strip Field Task Pro suffixes from project titles for display */
export function cleanProjectTitle(name) {
  return (name || "Untitled project")
    .replace(/\s*[—–-]\s*Estimator work\s*$/i, "")
    .replace(/\s*Estimator work\s*$/i, "")
    .trim() || "Untitled project";
}

export function shouldShowAddress(project) {
  if (isFieldTaskProEmbed()) return false;
  const addr = project.address?.trim();
  if (!addr) return false;
  const title = cleanProjectTitle(project.name).toLowerCase();
  const raw = (project.name || "").trim().toLowerCase();
  const a = addr.toLowerCase();
  return title !== a && raw !== a && !raw.includes(a) && !title.includes(a);
}

/** Primary label for a card — avoids repeating the address Field Task Pro already shows */
export function projectCardTitle(project) {
  const cleaned = cleanProjectTitle(project.name);
  const addr = project.address?.trim();
  if (!addr) return cleaned;
  const c = cleaned.toLowerCase();
  const a = addr.toLowerCase();
  if (c === a || c.includes(a) || a.includes(c)) return null;
  return cleaned;
}
