import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ASSEMBLIES } from "../lib/assemblies.js";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();

// demo shell plan (~33' x 72' at 8 px/ft), echoes Chipotle #6277
export const DEMO = { w: 820, h: 680, ppf: 8 };
const DEMO_PAGE = { type: "demo", w: DEMO.w, h: DEMO.h, thumb: null, loaded: true };

const START_LAYERS = [
  { id: "l1", name: "Thin Brick", color: "#e0533d", asm: "brick", visible: true },
  { id: "l2", name: "EIFS", color: "#3d7fe0", asm: "eifs", visible: true },
  { id: "l3", name: "Drywall Partitions", color: "#2fae6a", asm: "drywall", visible: true },
  { id: "l4", name: "Slab on Grade", color: "#e0a63d", asm: "slab", visible: true },
  { id: "l5", name: "Doors", color: "#9b6ee0", asm: "doors", visible: true },
];

// The takeoff data that belongs to a project (persistable; images excluded).
const freshTakeoff = () => ({
  layers: START_LAYERS.map((l) => ({ ...l })),
  traces: [],
  ppf: DEMO.ppf,
  ppfNote: "demo scale",
});

// deep clone the built-in catalog so the Price Book is independently editable
const clonePriceBook = () => JSON.parse(JSON.stringify(ASSEMBLIES));

export const useStore = create(
  persist(
    (set, get) => ({
      // ------------------------------------------------------------------ app
      view: "projects", // projects | clients | takeoff | pricebook
      clients: [],
      projects: [],
      activeProjectId: null,
      priceBook: clonePriceBook(),
      importProgress: null, // { stage, page, total, pct } while a PDF imports

      setView: (view) => {
        get().saveActiveProject();
        set({ view });
      },

      // ---------------------------------------------------------------- clients
      addClient: (data) => {
        const c = { id: uid(), name: "", company: "", email: "", phone: "", ...data };
        set((s) => ({ clients: [...s.clients, c] }));
        return c.id;
      },
      updateClient: (id, patch) =>
        set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      deleteClient: (id) =>
        set((s) => ({
          clients: s.clients.filter((c) => c.id !== id),
          projects: s.projects.map((p) => (p.clientId === id ? { ...p, clientId: null } : p)),
        })),

      // --------------------------------------------------------------- projects
      addProject: (data) => {
        const p = {
          id: uid(),
          name: "Untitled project",
          clientId: null,
          address: "",
          status: "active",
          createdAt: now(),
          updatedAt: now(),
          takeoff: freshTakeoff(),
          ...data,
        };
        set((s) => ({ projects: [...s.projects, p] }));
        return p.id;
      },
      updateProject: (id, patch) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now() } : p)) })),
      deleteProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
        })),

      // write the live takeoff working-set back into its project record
      saveActiveProject: () =>
        set((s) => {
          if (!s.activeProjectId) return {};
          return {
            projects: s.projects.map((p) =>
              p.id === s.activeProjectId
                ? { ...p, updatedAt: now(), takeoff: { layers: s.layers, traces: s.traces, ppf: s.ppf, ppfNote: s.ppfNote } }
                : p
            ),
          };
        }),

      // load a project's takeoff into the live working-set and open the canvas
      openProject: (id) => {
        get().saveActiveProject();
        const p = get().projects.find((x) => x.id === id);
        if (!p) return;
        const t = p.takeoff || freshTakeoff();
        set({
          activeProjectId: id,
          view: "takeoff",
          layers: t.layers?.length ? t.layers : START_LAYERS.map((l) => ({ ...l })),
          traces: t.traces || [],
          ppf: t.ppf ?? DEMO.ppf,
          ppfNote: t.ppfNote || "demo scale",
          // images can't persist — start on the demo backdrop; re-upload the plan
          pages: [DEMO_PAGE],
          pageImgs: {},
          activePage: 0,
          bg: { type: "demo", w: DEMO.w, h: DEMO.h },
          imgEl: null,
          tool: "select",
          activeId: t.layers?.[0]?.id || "l1",
          selId: null,
          draft: [],
          calib: [],
          suggestions: [],
        });
      },

      activeProject: () => get().projects.find((p) => p.id === get().activeProjectId) || null,
      clientOf: (project) => get().clients.find((c) => c.id === project?.clientId) || null,

      // -------------------------------------------------------------- price book
      updateMaterial: (asmKey, idx, patch) =>
        set((s) => {
          const pb = { ...s.priceBook };
          const asm = { ...pb[asmKey], materials: pb[asmKey].materials.map((m, i) => (i === idx ? { ...m, ...patch } : m)) };
          pb[asmKey] = asm;
          return { priceBook: pb };
        }),
      updateAssembly: (asmKey, patch) =>
        set((s) => ({ priceBook: { ...s.priceBook, [asmKey]: { ...s.priceBook[asmKey], ...patch } } })),
      resetPriceBook: () => set({ priceBook: clonePriceBook() }),

      // --------------------------------------------------------- import progress
      setImportProgress: (importProgress) => set({ importProgress }),

      // =============================== TAKEOFF (live working-set) ===============
      bg: { type: "demo", w: DEMO.w, h: DEMO.h },
      imgEl: null,
      ppf: DEMO.ppf,
      ppfNote: "demo scale",

      pages: [DEMO_PAGE],
      pageImgs: {},
      activePage: 0,

      tool: "select",
      activeId: "l1",
      selId: null,

      layers: START_LAYERS.map((l) => ({ ...l })),
      traces: [],
      draft: [],
      calib: [],

      suggestions: [],
      aiBusy: false,
      aiError: null,

      setTool: (tool) => set({ tool, draft: [], calib: [] }),
      setActive: (activeId) => set({ activeId, draft: [] }),
      setSel: (selId) => set({ selId }),

      activeLayer: () => get().layers.find((l) => l.id === get().activeId),
      activeGeom: () => {
        const l = get().layers.find((x) => x.id === get().activeId);
        return ASSEMBLIES[l.asm].geom;
      },
      pageTraces: () => get().traces.filter((t) => (t.page ?? 0) === get().activePage),

      addPoint: (p) => {
        const s = get();
        if (s.tool === "calibrate") {
          set({ calib: s.calib.length >= 2 ? [p] : [...s.calib, p] });
          return;
        }
        if (s.tool !== "draw") return;
        if (s.activeGeom() === "count") {
          set({ traces: [...s.traces, { id: uid(), layer: s.activeId, page: s.activePage, type: "count", pts: [p] }] });
        } else {
          set({ draft: [...s.draft, p] });
        }
      },

      undoPoint: () => set((s) => ({ draft: s.draft.slice(0, -1) })),

      finishDraft: () =>
        set((s) => {
          const g = ASSEMBLIES[s.layers.find((l) => l.id === s.activeId).asm].geom;
          const base = { id: uid(), layer: s.activeId, page: s.activePage };
          if (g === "area" && s.draft.length >= 3)
            return { traces: [...s.traces, { ...base, type: "area", pts: s.draft }], draft: [] };
          if (g === "linear" && s.draft.length >= 2)
            return { traces: [...s.traces, { ...base, type: "linear", pts: s.draft }], draft: [] };
          return { draft: [] };
        }),

      deleteSel: () => set((s) => ({ traces: s.traces.filter((t) => t.id !== s.selId), selId: null })),

      clearAll: () =>
        set((s) => ({ traces: s.traces.filter((t) => (t.page ?? 0) !== s.activePage), draft: [], selId: null })),

      toggleLayer: (id) =>
        set((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)) })),

      setScaleFromCalib: (feet) =>
        set((s) => {
          if (s.calib.length !== 2 || !(feet > 0)) return {};
          const dx = s.calib[0].x - s.calib[1].x;
          const dy = s.calib[0].y - s.calib[1].y;
          return { ppf: Math.hypot(dx, dy) / feet, ppfNote: "calibrated", calib: [], tool: "select" };
        }),

      loadImage: (href, imgEl) =>
        set({
          pages: [{ type: "img", href, w: imgEl.naturalWidth, h: imgEl.naturalHeight, loaded: true }],
          pageImgs: { 0: imgEl },
          activePage: 0,
          bg: { type: "img", href, w: imgEl.naturalWidth, h: imgEl.naturalHeight },
          imgEl,
          draft: [],
          selId: null,
          suggestions: [],
          ppf: null,
          ppfNote: "not set — calibrate",
          tool: "calibrate",
        }),

      loadPdf: (thumbs) =>
        set({
          pages: thumbs.map((t) => ({ type: "img", w: t.w, h: t.h, dpi: t.dpi, thumb: t.thumb, loaded: false })),
          pageImgs: {},
          activePage: 0,
          bg: { type: "img", w: thumbs[0].w, h: thumbs[0].h },
          imgEl: null,
          draft: [],
          selId: null,
          suggestions: [],
          ppf: null,
          ppfNote: "not set — calibrate",
          tool: "calibrate",
        }),

      setPageImage: (i, { href, w, h, dpi, img }) =>
        set((s) => {
          const pages = s.pages.map((p, idx) => (idx === i ? { ...p, href, w, h, dpi, loaded: true } : p));
          const pageImgs = { ...s.pageImgs, [i]: img };
          const patch = { pages, pageImgs };
          if (i === s.activePage) {
            patch.bg = { type: "img", href, w, h };
            patch.imgEl = img;
          }
          return patch;
        }),

      setPage: (i) =>
        set((s) => {
          const pg = s.pages[i];
          if (!pg) return {};
          return {
            activePage: i,
            bg: pg.type === "demo" ? { type: "demo", w: pg.w, h: pg.h } : { type: "img", href: pg.href, w: pg.w, h: pg.h },
            imgEl: s.pageImgs[i] || null,
            draft: [],
            calib: [],
            selId: null,
            suggestions: [],
          };
        }),

      setAiBusy: (aiBusy) => set({ aiBusy, aiError: aiBusy ? null : get().aiError }),
      setAiError: (aiError) => set({ aiError, aiBusy: false }),
      setSuggestions: (suggestions) => set({ suggestions, aiBusy: false, aiError: null }),
      clearSuggestions: () => set({ suggestions: [] }),

      acceptSuggestion: (id) =>
        set((s) => {
          const sg = s.suggestions.find((x) => x.id === id);
          if (!sg) return {};
          return {
            traces: [...s.traces, { id: uid(), layer: sg.layerId, page: s.activePage, type: sg.type, pts: sg.pts }],
            suggestions: s.suggestions.filter((x) => x.id !== id),
          };
        }),
      rejectSuggestion: (id) => set((s) => ({ suggestions: s.suggestions.filter((x) => x.id !== id) })),
      acceptAllSuggestions: () =>
        set((s) => ({
          traces: [
            ...s.traces,
            ...s.suggestions.map((sg) => ({ id: uid(), layer: sg.layerId, page: s.activePage, type: sg.type, pts: sg.pts })),
          ],
          suggestions: [],
        })),

      resetDemo: () =>
        set({
          pages: [DEMO_PAGE],
          pageImgs: {},
          activePage: 0,
          bg: { type: "demo", w: DEMO.w, h: DEMO.h },
          imgEl: null,
          ppf: DEMO.ppf,
          ppfNote: "demo scale",
          traces: (get().traces || []).filter((t) => false), // clear traces on the demo backdrop
          draft: [],
          selId: null,
          suggestions: [],
          tool: "select",
        }),
    }),
    {
      name: "plan-forge-v1",
      // vectors + records persist; rendered images (single or PDF pages) do not.
      partialize: (s) => ({
        view: s.view,
        clients: s.clients,
        projects: s.projects,
        activeProjectId: s.activeProjectId,
        priceBook: s.priceBook,
        // live working-set so a refresh keeps the current takeoff
        layers: s.layers,
        activeId: s.activeId,
        traces: s.traces,
        ppf: s.ppf,
        ppfNote: s.ppfNote,
      }),
    }
  )
);
