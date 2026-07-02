import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ASSEMBLIES, DEFAULT_BOOK_META } from "../lib/assemblies.js";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();

// demo shell plan (~33' x 72' at 8 px/ft), echoes Chipotle #6277
export const DEMO = { w: 820, h: 680, ppf: 8 };
const DEMO_PAGE = { type: "demo", w: DEMO.w, h: DEMO.h, thumb: null, loaded: true };
// a project with no plan uploaded yet shows an upload prompt, not the demo
const EMPTY_PAGE = { type: "empty", w: DEMO.w, h: DEMO.h, thumb: null, loaded: true };

// distinct colors auto-assigned to new layers (walls/areas each get their own)
export const PALETTE = [
  "#e0533d", "#3d7fe0", "#2fae6a", "#e0a63d", "#9b6ee0", "#22d3ee",
  "#f472b6", "#a3e635", "#fb923c", "#38bdf8", "#c084fc", "#f87171", "#34d399", "#facc15",
];

const START_LAYERS = [
  { id: "l1", name: "Thin Brick", color: "#e0533d", asm: "brick", visible: true },
  { id: "l2", name: "EIFS", color: "#3d7fe0", asm: "eifs", visible: true },
  { id: "l3", name: "Drywall Partitions", color: "#2fae6a", asm: "drywall", visible: true },
  { id: "l4", name: "Slab on Grade", color: "#e0a63d", asm: "slab", visible: true },
  { id: "l5", name: "Doors", color: "#9b6ee0", asm: "doors", visible: true },
];

// The takeoff data that belongs to a project (persistable; images excluded).
// `trades` (assembly keys) lets the estimator scope which layers a project
// starts with; falls back to the default trade set.
const freshTakeoff = (trades) => ({
  layers:
    trades && trades.length
      ? trades.map((asm, i) => ({ id: "l" + i + Math.random().toString(36).slice(2, 6), name: (ASSEMBLIES[asm]?.name || asm), color: PALETTE[i % PALETTE.length], asm, visible: true }))
      : START_LAYERS.map((l) => ({ ...l })),
  traces: [],
  ppf: null,
  ppfNote: "not set — calibrate",
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
      bookMeta: { ...DEFAULT_BOOK_META }, // location factor + overhead/profit
      setBookMeta: (patch) => set((s) => ({ bookMeta: { ...s.bookMeta, ...patch } })),
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
          takeoff: freshTakeoff(data.trades),
          ...data,
        };
        delete p.trades;
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
          ppf: t.ppf ?? null,
          ppfNote: t.ppfNote || "not set — calibrate",
          // images can't persist — open to an upload prompt; import the plan
          pages: [EMPTY_PAGE],
          pageImgs: {},
          activePage: 0,
          bg: { type: "empty", w: DEMO.w, h: DEMO.h },
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
      addMaterial: (asmKey) =>
        set((s) => {
          const asm = s.priceBook[asmKey];
          const u = asm.geom === "linear" ? "LF" : asm.geom === "count" ? "ea" : "SF";
          return { priceBook: { ...s.priceBook, [asmKey]: { ...asm, materials: [...asm.materials, { name: "New material", per: 1, waste: 0, u, cost: 0 }] } } };
        }),
      removeMaterial: (asmKey, idx) =>
        set((s) => ({ priceBook: { ...s.priceBook, [asmKey]: { ...s.priceBook[asmKey], materials: s.priceBook[asmKey].materials.filter((_, i) => i !== idx) } } })),
      addAssembly: () =>
        set((s) => {
          const key = "custom" + uid();
          return { priceBook: { ...s.priceBook, [key]: { name: "New assembly", unit: "SF", geom: "area", materials: [{ name: "New material", per: 1, waste: 0, u: "SF", cost: 0 }] } } };
        }),
      removeAssembly: (asmKey) =>
        set((s) => {
          const pb = { ...s.priceBook };
          delete pb[asmKey];
          return { priceBook: pb };
        }),
      importPriceBook: (obj) => {
        // validate: object of { name, unit, geom, materials:[] }
        if (!obj || typeof obj !== "object") return false;
        const clean = {};
        for (const [k, v] of Object.entries(obj)) {
          if (v && Array.isArray(v.materials) && v.name) clean[k] = v;
        }
        if (!Object.keys(clean).length) return false;
        set({ priceBook: clean });
        return true;
      },
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
      sheetIndex: [], // [{ no, title, discipline }] parsed from the plan set

      // AI plan assistant chat (per open plan set; not persisted)
      chat: [],
      chatBusy: false,
      assistantOpen: false,
      planSummary: null, // { busy, summary, trades:[{trade,sheets,scope}], note, error }
      pushChat: (msg) => set((s) => ({ chat: [...s.chat, msg] })),
      setChatBusy: (chatBusy) => set({ chatBusy }),
      clearChat: () => set({ chat: [] }),
      setAssistantOpen: (assistantOpen) => set({ assistantOpen }),
      toggleAssistant: () => set((s) => ({ assistantOpen: !s.assistantOpen })),

      // collapsible takeoff panels
      showTools: true,
      showAnalysis: true,
      toggleTools: () => set((s) => ({ showTools: !s.showTools })),
      toggleAnalysis: () => set((s) => ({ showAnalysis: !s.showAnalysis })),
      setPlanSummary: (planSummary) => set({ planSummary }),

      tool: "select", // select | pan | calibrate | draw | rect | measure
      activeId: "l1",
      selId: null,
      measure: null, // { a, b } non-destructive ruler in world coords

      layers: START_LAYERS.map((l) => ({ ...l })),
      traces: [],
      draft: [],
      calib: [],

      suggestions: [],
      aiBusy: false,
      aiError: null,

      // printed dimensions read off the sheet (for the "Read dimensions"
      // auto-calibrate). { ppf, samples:[{x,y,feet,str}], all } or null.
      dims: null,
      setDims: (dims) => set({ dims }),

      // real vector geometry pulled from the PDF (page index -> polylines).
      // Powers the snap-to-line tool. Ephemeral (re-extracted per session).
      vectors: {},
      vectorsBusy: false,
      setVectors: (page, polylines) => set((s) => ({ vectors: { ...s.vectors, [page]: polylines }, vectorsBusy: false })),
      setVectorsBusy: (vectorsBusy) => set({ vectorsBusy }),

      // click a real line -> create a linear trace snapped to that exact
      // geometry on the active layer, so it prices out with precise LF.
      addSnappedTrace: (pts) =>
        set((s) => {
          if (!pts || pts.length < 2) return {};
          const clamped = pts.map((p) => ({ x: Math.max(0, Math.min(s.bg.w, p.x)), y: Math.max(0, Math.min(s.bg.h, p.y)) }));
          return { traces: [...s.traces, { id: uid(), layer: s.activeId, page: s.activePage, type: "linear", pts: clamped, snapped: true }] };
        }),

      setTool: (tool) => set({ tool, draft: [], calib: [], measure: null }),
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
        // constrain every point to the plan bounds so nothing lands off-sheet
        p = { x: Math.max(0, Math.min(s.bg.w, p.x)), y: Math.max(0, Math.min(s.bg.h, p.y)) };
        if (s.tool === "measure") {
          set({ measure: !s.measure || s.measure.b ? { a: p } : { a: s.measure.a, b: p } });
          return;
        }
        if (s.tool === "calibrate") {
          set({ calib: s.calib.length >= 2 ? [p] : [...s.calib, p] });
          return;
        }
        if (s.tool === "exclude") { set({ draft: [...s.draft, p] }); return; }
        if (s.tool === "rect") {
          if (!s.draft.length) { set({ draft: [p] }); return; }
          const a = s.draft[0];
          const pts = [a, { x: p.x, y: a.y }, p, { x: a.x, y: p.y }];
          set({ traces: [...s.traces, { id: uid(), layer: s.activeId, page: s.activePage, type: "area", pts }], draft: [] });
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
          if (s.tool === "exclude") {
            if (s.draft.length >= 3)
              return { traces: [...s.traces, { id: uid(), layer: null, page: s.activePage, type: "area", excluded: true, pts: s.draft }], draft: [] };
            return { draft: [] };
          }
          const g = ASSEMBLIES[s.layers.find((l) => l.id === s.activeId).asm].geom;
          const base = { id: uid(), layer: s.activeId, page: s.activePage };
          if (g === "area" && s.draft.length >= 3)
            return { traces: [...s.traces, { ...base, type: "area", pts: s.draft }], draft: [] };
          if (g === "linear" && s.draft.length >= 2)
            return { traces: [...s.traces, { ...base, type: "linear", pts: s.draft }], draft: [] };
          return { draft: [] };
        }),

      // mark a trace in/out of scope (excluded traces never count in the rollup)
      toggleExclude: (id) =>
        set((s) => ({ traces: s.traces.map((t) => (t.id === id ? { ...t, excluded: !t.excluded } : t)) })),
      // move a trace's vertices (edit detected areas) — clamped to plan bounds
      updateTracePts: (id, pts) =>
        set((s) => {
          const cl = pts.map((p) => ({ x: Math.max(0, Math.min(s.bg.w, p.x)), y: Math.max(0, Math.min(s.bg.h, p.y)) }));
          return { traces: s.traces.map((t) => (t.id === id ? { ...t, pts: cl } : t)) };
        }),

      // snap any existing traces onto the plan (used when an image loads, so a
      // trace made on a differently-sized render can't float off the sheet)
      clampTracesTo: (w, h) =>
        set((s) => ({ traces: s.traces.map((t) => ({ ...t, pts: (t.pts || []).map((p) => ({ x: Math.max(0, Math.min(w, p.x)), y: Math.max(0, Math.min(h, p.y)) })) })) })),

      deleteSel: () => set((s) => ({ traces: s.traces.filter((t) => t.id !== s.selId), selId: null })),

      clearAll: () =>
        set((s) => ({ traces: s.traces.filter((t) => (t.page ?? 0) !== s.activePage), draft: [], selId: null })),

      toggleLayer: (id) =>
        set((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)) })),

      // ---- layer CRUD ----
      nextColor: () => {
        const used = new Set(get().layers.map((l) => l.color));
        return PALETTE.find((c) => !used.has(c)) || PALETTE[get().layers.length % PALETTE.length];
      },
      addLayer: (data = {}) => {
        const id = "l" + uid();
        const asm = data.asm || "slab";
        const def = get().priceBook[asm] || ASSEMBLIES[asm];
        const layer = { id, name: data.name || def?.name || "New layer", color: data.color || get().nextColor(), asm, visible: true };
        set((s) => ({ layers: [...s.layers, layer], activeId: id }));
        return id;
      },
      updateLayer: (id, patch) =>
        set((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      removeLayer: (id) =>
        set((s) => {
          const layers = s.layers.filter((l) => l.id !== id);
          return {
            layers,
            traces: s.traces.filter((t) => t.layer !== id),
            activeId: s.activeId === id ? layers[0]?.id || null : s.activeId,
          };
        }),

      // create layers for a set of assembly keys (from the import trade picker),
      // skipping any that already have a layer. Returns count added.
      addLayersForAsms: (asms) => {
        let added = 0;
        set((s) => {
          const layers = [...s.layers];
          const used = new Set(layers.map((l) => l.color));
          for (const asm of asms) {
            const def = s.priceBook[asm] || ASSEMBLIES[asm];
            if (!def || layers.some((l) => l.asm === asm)) continue;
            const color = PALETTE.find((c) => !used.has(c)) || PALETTE[layers.length % PALETTE.length];
            used.add(color);
            layers.push({ id: "l" + uid(), name: def.name, color, asm, visible: true });
            added++;
          }
          return { layers };
        });
        return added;
      },

      // AI detect -> ensure a layer per detected assembly (create if missing),
      // then build the suggestions that reference those layers.
      ingestDetections: (dets) =>
        set((s) => {
          const layers = [...s.layers];
          const used = new Set(layers.map((l) => l.color));
          const suggestions = [];
          for (const d of dets) {
            const def = s.priceBook[d.asm] || ASSEMBLIES[d.asm];
            if (!def) continue;
            let layer = layers.find((l) => l.asm === d.asm);
            if (!layer) {
              const color = PALETTE.find((c) => !used.has(c)) || PALETTE[layers.length % PALETTE.length];
              used.add(color);
              layer = { id: "l" + uid(), name: def.name, color, asm: d.asm, visible: true, auto: true };
              layers.push(layer);
            }
            suggestions.push({
              id: uid(), layerId: layer.id, layerName: layer.name, color: layer.color, asm: d.asm,
              type: d.type, pts: d.pts, confidence: d.confidence, note: d.note, element: d.element || d.note,
              sample: !!d.sample,
            });
          }
          return { layers, suggestions, aiBusy: false, aiError: null };
        }),

      // Vector "Detect walls": map real closed regions + long runs into the same
      // suggestion pipeline (accept/reject/canvas all reuse it). Exact geometry,
      // so confidence is 1 and the label carries the measured LF / SF.
      ingestVectorRuns: ({ regions, runs }) =>
        set((s) => {
          const layers = [...s.layers];
          const geomOf = (l) => ASSEMBLIES[l.asm]?.geom;
          const ensure = (geom, name, asm) => {
            let l = layers.find((x) => geomOf(x) === geom);
            if (!l) {
              const used = new Set(layers.map((x) => x.color));
              const color = PALETTE.find((c) => !used.has(c)) || PALETTE[layers.length % PALETTE.length];
              l = { id: "l" + uid(), name, color, asm, visible: true, auto: true };
              layers.push(l);
            }
            return l;
          };
          const areaL = layers.find((x) => x.asm === "slab") || ensure("area", 'Slab on Grade 4"', "slab");
          const lineL = layers.find((x) => x.asm === "woodfence" || x.asm === "drywall") || ensure("linear", "Wall / fence run", "drywall");
          const ppf = s.ppf;
          const sf = (a) => (ppf ? `${(a / (ppf * ppf)).toFixed(0)} SF` : "region · set scale");
          const lf = (len) => (ppf ? `${(len / ppf).toFixed(1)} ft` : "line · set scale");
          const mk = (c, type, layer, label) => ({
            id: uid(), layerId: layer.id, layerName: layer.name, color: layer.color, asm: layer.asm,
            type, pts: c.pts, confidence: 1, vector: true, element: label, note: label,
          });
          const suggestions = [
            ...(regions || []).map((r) => mk(r, "area", areaL, sf(r.area))),
            ...(runs || []).map((r) => mk(r, "linear", lineL, lf(r.len))),
          ];
          return { layers, suggestions, aiBusy: false, aiError: null };
        }),

      setScaleFromCalib: (feet) =>
        set((s) => {
          if (s.calib.length !== 2 || !(feet > 0)) return {};
          const dx = s.calib[0].x - s.calib[1].x;
          const dy = s.calib[0].y - s.calib[1].y;
          return { ppf: Math.hypot(dx, dy) / feet, ppfNote: "calibrated", calib: [], tool: "select" };
        }),

      // set pixels-per-foot directly (e.g. from a scale note × page DPI)
      setPpf: (ppf, note = "AI scale") => set(() => (ppf > 0 ? { ppf, ppfNote: note, calib: [], tool: "select" } : {})),
      scaleReading: false, // auto-scale in progress (header indicator)
      setScaleReading: (scaleReading) => set({ scaleReading }),

      // set scale from two plan-coord points a known distance apart (AI scale)
      setScaleFromPoints: (a, b, feet, note = "AI scale") =>
        set(() => {
          if (!(feet > 0)) return {};
          return { ppf: Math.hypot(a.x - b.x, a.y - b.y) / feet, ppfNote: note, calib: [], tool: "select" };
        }),

      // search-to-locate: a plan-coord point the canvas centers + flashes on
      focusTarget: null,
      setFocusTarget: (focusTarget) => set({ focusTarget }),

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

      loadPdf: (thumbs, sheetIndex = []) =>
        set({
          pages: thumbs.map((t) => ({
            type: "img", w: t.w, h: t.h, dpi: t.dpi, thumb: t.thumb, loaded: false,
            text: t.text || "", sheetNo: t.sheetNo || null, title: t.title || "", discipline: t.discipline || null,
          })),
          sheetIndex,
          pageImgs: {},
          activePage: 0,
          bg: { type: "img", w: thumbs[0].w, h: thumbs[0].h },
          imgEl: null,
          draft: [],
          selId: null,
          suggestions: [],
          chat: [],
          planSummary: null,
          vectors: {}, // drop the previous plan's cached geometry / dimensions
          dims: null,
          ppf: null,
          ppfNote: "not set — calibrate",
          tool: "calibrate",
        }),

      // the currently-open sheet's parsed metadata + text (for the assistant)
      activeSheet: () => {
        const s = get();
        return s.pages[s.activePage] || null;
      },

      setPageImage: (i, { href, w, h, dpi, img }) =>
        set((s) => {
          const pages = s.pages.map((p, idx) => (idx === i ? { ...p, href, w, h, dpi, loaded: true } : p));
          const pageImgs = { ...s.pageImgs, [i]: img };
          const patch = { pages, pageImgs };
          if (i === s.activePage) {
            patch.bg = { type: "img", href, w, h };
            patch.imgEl = img;
            // snap this page's traces onto the freshly-loaded sheet so a trace
            // made against a smaller/placeholder render can't float off-sheet
            patch.traces = s.traces.map((t) =>
              (t.page ?? 0) === i
                ? { ...t, pts: (t.pts || []).map((p) => ({ x: Math.max(0, Math.min(w, p.x)), y: Math.max(0, Math.min(h, p.y)) })) }
                : t
            );
          }
          return patch;
        }),

      // remove an imported page (sheet). Renumbers pageImgs + trace page indices
      // so remaining sheets stay consistent; drops traces on the deleted page.
      removePage: (i) =>
        set((s) => {
          if (s.pages.length <= 1) return {};
          const pages = s.pages.filter((_, idx) => idx !== i);
          const pageImgs = {};
          Object.entries(s.pageImgs).forEach(([k, v]) => { const ki = +k; if (ki === i) return; pageImgs[ki > i ? ki - 1 : ki] = v; });
          const traces = s.traces.filter((t) => (t.page ?? 0) !== i).map((t) => ((t.page ?? 0) > i ? { ...t, page: t.page - 1 } : t));
          let activePage = s.activePage;
          if (activePage === i) activePage = Math.min(i, pages.length - 1);
          else if (activePage > i) activePage -= 1;
          const pg = pages[activePage];
          return {
            pages, pageImgs, traces, activePage,
            bg: pg.type === "demo" ? { type: "demo", w: pg.w, h: pg.h } : { type: "img", href: pg.href, w: pg.w, h: pg.h },
            imgEl: pageImgs[activePage] || null,
            selId: null, suggestions: [], draft: [],
          };
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
      version: 4,
      // v<3 (pre labor/equipment model) rebuilds the book; v3->4 MERGES any new
      // built-in assemblies (fencing, windows) in without wiping price edits.
      migrate: (state, ver) => {
        if (ver < 3) {
          state.priceBook = clonePriceBook();
          state.bookMeta = { ...DEFAULT_BOOK_META };
        } else if (ver < 4) {
          const base = clonePriceBook();
          const pb = { ...(state.priceBook || {}) };
          for (const k of Object.keys(base)) if (!pb[k]) pb[k] = base[k];
          state.priceBook = pb;
        }
        return state;
      },
      // on reload a project is active but its plan image is gone (not persisted);
      // open it to the upload prompt instead of the demo backdrop.
      onRehydrateStorage: () => (state) => {
        if (state && state.activeProjectId) {
          state.bg = { type: "empty", w: DEMO.w, h: DEMO.h };
          state.pages = [EMPTY_PAGE];
          state.pageImgs = {};
          state.imgEl = null;
        }
      },
      // vectors + records persist; rendered images (single or PDF pages) do not.
      partialize: (s) => ({
        view: s.view,
        clients: s.clients,
        projects: s.projects,
        activeProjectId: s.activeProjectId,
        priceBook: s.priceBook,
        bookMeta: s.bookMeta,
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

// dev aid: reach the store from the console / preview harness for smoke tests
if (typeof window !== "undefined") window.useStore = useStore;
