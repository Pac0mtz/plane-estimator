import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ASSEMBLIES } from "../lib/assemblies.js";

const uid = () => Math.random().toString(36).slice(2, 9);

// demo shell plan (~33' x 72' at 8 px/ft), echoes Chipotle #6277
export const DEMO = { w: 820, h: 680, ppf: 8 };

const START_LAYERS = [
  { id: "l1", name: "Thin Brick", color: "#e0533d", asm: "brick", visible: true },
  { id: "l2", name: "EIFS", color: "#3d7fe0", asm: "eifs", visible: true },
  { id: "l3", name: "Drywall Partitions", color: "#2fae6a", asm: "drywall", visible: true },
  { id: "l4", name: "Slab on Grade", color: "#e0a63d", asm: "slab", visible: true },
  { id: "l5", name: "Doors", color: "#9b6ee0", asm: "doors", visible: true },
];

export const useStore = create(
  persist(
    (set, get) => ({
      // background
      bg: { type: "demo", w: DEMO.w, h: DEMO.h },
      imgEl: null, // live HTMLImageElement (not persisted)
      ppf: DEMO.ppf,
      ppfNote: "demo scale",

      // interaction
      tool: "select", // select | pan | calibrate | draw
      activeId: "l1",
      selId: null,

      // data
      layers: START_LAYERS,
      traces: [],
      draft: [],
      calib: [],

      // ---- actions ----
      setTool: (tool) => set({ tool, draft: [], calib: [] }),
      setActive: (activeId) => set({ activeId, draft: [] }),
      setSel: (selId) => set({ selId }),

      activeLayer: () => get().layers.find((l) => l.id === get().activeId),
      activeGeom: () => {
        const l = get().layers.find((x) => x.id === get().activeId);
        return ASSEMBLIES[l.asm].geom;
      },

      addPoint: (p) => {
        const s = get();
        if (s.tool === "calibrate") {
          set({ calib: s.calib.length >= 2 ? [p] : [...s.calib, p] });
          return;
        }
        if (s.tool !== "draw") return;
        if (s.activeGeom() === "count") {
          set({ traces: [...s.traces, { id: uid(), layer: s.activeId, type: "count", pts: [p] }] });
        } else {
          set({ draft: [...s.draft, p] });
        }
      },

      undoPoint: () => set((s) => ({ draft: s.draft.slice(0, -1) })),

      finishDraft: () =>
        set((s) => {
          const g = ASSEMBLIES[s.layers.find((l) => l.id === s.activeId).asm].geom;
          if (g === "area" && s.draft.length >= 3)
            return { traces: [...s.traces, { id: uid(), layer: s.activeId, type: "area", pts: s.draft }], draft: [] };
          if (g === "linear" && s.draft.length >= 2)
            return { traces: [...s.traces, { id: uid(), layer: s.activeId, type: "linear", pts: s.draft }], draft: [] };
          return { draft: [] };
        }),

      deleteSel: () =>
        set((s) => ({ traces: s.traces.filter((t) => t.id !== s.selId), selId: null })),

      clearAll: () => set({ traces: [], draft: [], selId: null }),

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
          bg: { type: "img", href, w: imgEl.naturalWidth, h: imgEl.naturalHeight },
          imgEl,
          traces: [],
          draft: [],
          selId: null,
          ppf: null,
          ppfNote: "not set — calibrate",
          tool: "calibrate",
        }),

      resetDemo: () =>
        set({ bg: { type: "demo", w: DEMO.w, h: DEMO.h }, imgEl: null, ppf: DEMO.ppf, ppfNote: "demo scale", traces: [], draft: [], selId: null, tool: "select" }),
    }),
    {
      name: "plan-forge-v1",
      // persist scope/quantities but never the (large) uploaded image element
      partialize: (s) => ({
        bg: s.bg.type === "demo" ? s.bg : { type: "demo", w: DEMO.w, h: DEMO.h },
        ppf: s.bg.type === "demo" ? s.ppf : DEMO.ppf,
        ppfNote: s.bg.type === "demo" ? s.ppfNote : "demo scale",
        layers: s.layers,
        traces: s.bg.type === "demo" ? s.traces : [],
        activeId: s.activeId,
      }),
    }
  )
);
