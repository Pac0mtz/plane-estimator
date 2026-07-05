// Client for the Plan Forge API (Neon Postgres on the server).

const BASE = import.meta.env.VITE_API_URL || "";

let _available = null;

export async function isApiAvailable() {
  if (_available !== null) return _available;
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    _available = r.ok && j.db === true;
  } catch {
    _available = false;
  }
  return _available;
}

export function resetApiCheck() {
  _available = null;
}

export async function pullWorkspace() {
  const r = await fetch(`${BASE}/api/workspace`);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.json();
}

export async function pushWorkspace(payload) {
  const r = await fetch(`${BASE}/api/workspace`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
}

export async function savePlanToApi(projectId, file, planMeta) {
  const r = await fetch(`${BASE}/api/plans/${encodeURIComponent(projectId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name || "plan"),
      "X-Plan-Kind": planMeta.kind,
      "X-Plan-Meta": encodeURIComponent(JSON.stringify(planMeta)),
    },
    body: file,
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
}

/** @returns {Promise<{ file: File, plan: object, fileName: string } | null>} */
export async function loadPlanFromApi(projectId) {
  const r = await fetch(`${BASE}/api/plans/${encodeURIComponent(projectId)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);

  const fileName = decodeURIComponent(r.headers.get("X-File-Name") || "plan");
  const kind = r.headers.get("X-Plan-Kind");
  const plan = JSON.parse(decodeURIComponent(r.headers.get("X-Plan-Meta") || "{}"));
  const blob = await r.blob();
  const type = kind === "pdf" ? "application/pdf" : blob.type || "image/png";
  const file = new File([blob], fileName, { type });
  return { file, plan, fileName };
}

export async function deletePlanFromApi(projectId) {
  await fetch(`${BASE}/api/plans/${encodeURIComponent(projectId)}`, { method: "DELETE" });
}

export async function deleteProjectFromApi(projectId) {
  await fetch(`${BASE}/api/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" });
}
