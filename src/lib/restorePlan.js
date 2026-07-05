// Re-open a saved plan — Neon API (primary) or IndexedDB (fallback).
import { openPdf, renderPage, closePdf } from "./pdf.js";
import { useStore } from "../store/useStore.js";
import { loadPlanFile, toFile, savePlanFile, serializePlan } from "./planStorage.js";
import { isApiAvailable, loadPlanFromApi, savePlanToApi } from "./neonApi.js";
import { pushProjectToNeon } from "./neonSync.js";

function sheetLabel(pg, index) {
  if (!pg) return `Sheet ${index + 1}`;
  const no = pg.sheetNo || `Sheet ${index + 1}`;
  return pg.title ? `${no} · ${pg.title}` : no;
}

async function resolvePlanBundle(projectId, project) {
  if (await isApiAvailable()) {
    try {
      const api = await loadPlanFromApi(projectId);
      if (api?.file && api.plan) return api;
    } catch (err) {
      console.warn("Neon plan load failed, trying local cache:", err);
    }
  }
  const plan = project?.takeoff?.plan;
  const file = toFile(await loadPlanFile(projectId));
  if (plan && file) return { file, plan, fileName: plan.fileName || file.name };
  return null;
}

async function applyPlanBundle(store, bundle, project) {
  const { file, plan, fileName } = bundle;
  const savedPpf = project.takeoff?.ppf ?? null;
  const savedNote = project.takeoff?.ppfNote || "not set — calibrate";

  if (plan.kind === "pdf") {
    closePdf();
    const { thumbs, sheetIndex } = await openPdf(file);
    store.loadPdf(thumbs, plan.sheetIndex?.length ? plan.sheetIndex : sheetIndex, fileName);
    store.set({
      planKind: "pdf",
      planFileName: fileName,
      vectors: plan.vectors || {},
      activePage: Math.min(plan.activePage || 0, thumbs.length - 1),
    });
    if (savedPpf) store.setPpf(savedPpf, savedNote);

    const page = Math.min(plan.activePage || 0, thumbs.length - 1);
    store.setPage(page);
    store.setPageLoad({ page, stage: "opening", pct: 0, label: sheetLabel(thumbs[page], page) });
    try {
      const rendered = await renderPage(page, {
        onProgress: ({ stage, pct }) => store.setPageLoad({ page, stage, pct, label: sheetLabel(thumbs[page], page) }),
      });
      store.setPageImage(page, rendered);
    } finally {
      store.setPageLoad(null);
    }
    return true;
  }

  if (plan.kind === "image") {
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    store.loadImage(url, img, fileName);
    if (savedPpf) store.setPpf(savedPpf, savedNote);
    return true;
  }
  return false;
}

export async function restorePlanForProject(store = useStore.getState()) {
  const projectId = store.activeProjectId;
  if (!projectId) return false;

  const project = store.projects.find((p) => p.id === projectId);
  const bundle = await resolvePlanBundle(projectId, project);
  if (!bundle) return false;

  store.setPlanRestoring(true);
  try {
    return await applyPlanBundle(store, bundle, project);
  } catch (err) {
    console.warn("Could not restore saved plan:", err);
    return false;
  } finally {
    store.setPlanRestoring(false);
  }
}

export async function persistUploadedPlan(store, file) {
  const projectId = store.activeProjectId;
  if (!projectId || !file) return;

  store.saveActiveProject();
  const planMeta = serializePlan(store);
  if (!planMeta) return;

  await savePlanFile(projectId, file, file.name);

  if (await isApiAvailable()) {
    try {
      await savePlanToApi(projectId, file, planMeta);
      const project = store.projects.find((p) => p.id === projectId);
      if (project) await pushProjectToNeon(project);
    } catch (err) {
      console.warn("Could not save plan to Neon:", err);
      store.set({ dbStatus: "error", dbError: err.message });
    }
  }
}
