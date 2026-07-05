// IndexedDB storage for uploaded plan files (PDF / image). Too large for
// localStorage; keeps the original file so we can re-open it after refresh.
const DB_NAME = "planforge";
const DB_VERSION = 1;
const STORE = "plan-files";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode) {
  return openDb().then((db) => {
    const t = db.transaction(STORE, mode);
    return { store: t.objectStore(STORE), done: new Promise((res, rej) => {
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    }) };
  });
}

/** @returns {Promise<{ blob: Blob, name: string, type: string, savedAt: string } | null>} */
export async function loadPlanFile(projectId) {
  if (!projectId) return null;
  try {
    const { store, done } = await tx(STORE, "readonly");
    const rec = await new Promise((res, rej) => {
      const r = store.get(projectId);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
    await done;
    return rec;
  } catch {
    return null;
  }
}

export async function hasPlanFile(projectId) {
  return !!(await loadPlanFile(projectId));
}

/** @param {File | Blob} file */
export async function savePlanFile(projectId, file, name = file.name || "plan.pdf") {
  if (!projectId || !file) return;
  const blob = file instanceof Blob ? file : new Blob([file]);
  const rec = {
    blob,
    name: name || "plan",
    type: blob.type || "application/octet-stream",
    savedAt: new Date().toISOString(),
  };
  const { store, done } = await tx(STORE, "readwrite");
  await new Promise((res, rej) => {
    const r = store.put(rec, projectId);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
  await done;
}

export async function deletePlanFile(projectId) {
  if (!projectId) return;
  try {
    const { store, done } = await tx(STORE, "readwrite");
    await new Promise((res, rej) => {
      const r = store.delete(projectId);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    await done;
  } catch { /* ignore */ }
}

export function toFile(rec) {
  if (!rec?.blob) return null;
  return new File([rec.blob], rec.name || "plan", { type: rec.type || "application/octet-stream" });
}

/** Strip blob URLs before persisting page metadata on the project record. */
export function serializePlan(state) {
  if (!state.planKind || state.pages?.every((p) => p.type === "empty")) return null;
  return {
    kind: state.planKind,
    fileName: state.planFileName || null,
    pages: (state.pages || []).map(({ href, ...p }) => ({ ...p, loaded: false })),
    sheetIndex: state.sheetIndex || [],
    activePage: state.activePage || 0,
    vectors: state.vectors || {},
  };
}
