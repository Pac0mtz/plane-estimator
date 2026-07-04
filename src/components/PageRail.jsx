import { useStore } from "../store/useStore.js";
import { renderThumb } from "../lib/pdf.js";
import { maybeAutoScale, loadPageIfNeeded } from "../lib/importPlan.js";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Loader2, Search, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Layers, GripHorizontal } from "lucide-react";

const SHEETS_H_KEY = "plan-forge-sheets-h";
const MIN_H = 112;
const MAX_H = 480;
const DEFAULT_H = 168;
const CONTROLS_H = 34;
const LABELS_H = 36;
const THUMB_CACHE = new Map();

function loadSheetsH() {
  try {
    const n = parseInt(localStorage.getItem(SHEETS_H_KEY), 10);
    if (n >= MIN_H && n <= MAX_H) return n;
  } catch { /* ignore */ }
  return DEFAULT_H;
}

// Max thumbnail height from panel height — images fill this, not empty flex space.
function stripThumbH(panelH) {
  return Math.max(56, panelH - CONTROLS_H - 6 - LABELS_H - 14);
}

function thumbSize(page, maxH) {
  const ar = page.w && page.h ? page.w / page.h : 4 / 3;
  const h = maxH;
  const w = Math.round(h * ar);
  return { w, h, ar };
}

// Horizontal sheet strip in the footer — scrolls sideways so it never
// eats canvas width. Drag the top edge to resize; thumbnails scale to fill.
export default function PageRail() {
  const { pages, activePage, setPage, removePage, showSheets, toggleSheets } = useStore();
  const [loading, setLoading] = useState(null);
  const [q, setQ] = useState("");
  const [disc, setDisc] = useState("all");
  const [panelH, setPanelH] = useState(loadSheetsH);
  const scrollRef = useRef(null);
  const activeRef = useRef(null);
  const dragRef = useRef(null);
  const maxThumbH = stripThumbH(panelH);

  const disciplines = useMemo(() => {
    const seen = new Map();
    pages.forEach((p) => { if (p.discipline) seen.set(p.discipline.code, p.discipline); });
    return [...seen.values()];
  }, [pages]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pages
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => disc === "all" || p.discipline?.code === disc)
      .filter(({ p, i }) =>
        !needle ||
        `${p.sheetNo || ""} ${p.title || ""}`.toLowerCase().includes(needle) ||
        (p.text || "").toLowerCase().includes(needle) ||
        `sheet ${i + 1}`.includes(needle)
      );
  }, [pages, q, disc]);

  const cur = pages[activePage];

  const go = useCallback(async (i) => {
    if (i < 0 || i >= pages.length) return;
    setPage(i);
    const pg = pages[i];
    if (!pg?.loaded) {
      setLoading(i);
      try { await loadPageIfNeeded(i); maybeAutoScale(); } catch { /* leave blank */ }
      finally { setLoading(null); }
    } else {
      maybeAutoScale();
    }
  }, [pages, setPage]);

  useEffect(() => {
    if (!showSheets || !activeRef.current) return;
    activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activePage, showSheets, filtered.length, maxThumbH]);

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "PageDown" || (e.key === "ArrowRight" && e.shiftKey)) { e.preventDefault(); go(activePage + 1); }
      if (e.key === "PageUp" || (e.key === "ArrowLeft" && e.shiftKey)) { e.preventDefault(); go(activePage - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePage, go]);

  const setHeight = useCallback((h) => {
    const next = Math.max(MIN_H, Math.min(MAX_H, Math.round(h)));
    setPanelH(next);
    try { localStorage.setItem(SHEETS_H_KEY, String(next)); } catch { /* ignore */ }
  }, []);

  const onResizeStart = (e) => {
    e.preventDefault();
    dragRef.current = { y: e.clientY, h: panelH };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizeMove = (e) => {
    if (!dragRef.current) return;
    const dy = dragRef.current.y - e.clientY;
    setHeight(dragRef.current.h + dy);
  };

  const onResizeEnd = () => { dragRef.current = null; };

  if (pages.length <= 1) return null;

  const prev = () => go(activePage - 1);
  const next = () => go(activePage + 1);

  if (!showSheets) {
    return (
      <div className="shrink-0 border-t border-slate-800 bg-slate-950 flex items-center gap-2 px-2 h-9">
        <button onClick={toggleSheets} title="Show sheet strip"
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 px-1.5 py-1 rounded hover:bg-slate-800">
          <Layers size={13} />
          <span className="font-semibold text-slate-300">Sheets</span>
          <span className="text-slate-500">{activePage + 1}/{pages.length}</span>
          <ChevronUp size={13} className="text-slate-500" />
        </button>
        <div className="h-4 w-px bg-slate-800" />
        <button onClick={prev} disabled={activePage <= 0} aria-label="Previous sheet"
          className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300"><ChevronLeft size={15} /></button>
        <div className="min-w-0 flex-1 text-center">
          <span className="text-xs font-medium text-slate-200">{cur?.sheetNo || `Sheet ${activePage + 1}`}</span>
          {cur?.title && <span className="hidden sm:inline text-[11px] text-slate-500 ml-1.5 truncate">· {cur.title}</span>}
        </div>
        <button onClick={next} disabled={activePage >= pages.length - 1} aria-label="Next sheet"
          className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300"><ChevronRight size={15} /></button>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-slate-800 bg-slate-950 flex flex-col relative" style={{ height: panelH }}>
      <div role="separator" aria-label="Resize sheet strip" title="Drag to resize · double-click to reset"
        onPointerDown={onResizeStart} onPointerMove={onResizeMove} onPointerUp={onResizeEnd} onPointerCancel={onResizeEnd}
        onDoubleClick={() => setHeight(DEFAULT_H)}
        className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-10 flex items-center justify-center group hover:bg-brand/20 active:bg-brand/30">
        <GripHorizontal size={14} className="text-slate-600 group-hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-800/80 shrink-0 mt-1">
        <button onClick={toggleSheets} title="Collapse sheet strip"
          className="flex items-center gap-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase shrink-0 hover:text-slate-300 px-1 py-0.5 rounded hover:bg-slate-800">
          <Layers size={12} /> Sheets · {pages.length}
          <ChevronDown size={12} className="ml-0.5" />
        </button>

        <div className="relative flex-1 max-w-xs min-w-[120px]">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
            className="w-full pl-7 pr-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-[11px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand" />
        </div>

        {disciplines.length > 1 && (
          <div className="hidden md:flex items-center gap-1 shrink-0">
            <DiscChip on={disc === "all"} onClick={() => setDisc("all")}>All</DiscChip>
            {disciplines.map((d) => (
              <DiscChip key={d.code} on={disc === d.code} color={d.color} onClick={() => setDisc(d.code)}>{d.code}</DiscChip>
            ))}
          </div>
        )}

        <div className="flex items-center gap-0.5 shrink-0 ml-auto">
          <button onClick={prev} disabled={activePage <= 0} aria-label="Previous sheet"
            className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-400"><ChevronLeft size={14} /></button>
          <span className="text-[10px] text-slate-500 tabular-nums min-w-[3rem] text-center">{activePage + 1} / {pages.length}</span>
          <button onClick={next} disabled={activePage >= pages.length - 1} aria-label="Next sheet"
            className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-400"><ChevronRight size={14} /></button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden px-2 py-1.5 scroll-smooth min-h-0 flex items-end"
        style={{ scrollbarWidth: "thin" }}>
        <div className="flex gap-2 w-max items-end">
          {filtered.map(({ p, i }) => {
            const active = i === activePage;
            const { w: tw, h: th } = thumbSize(p, maxThumbH);
            const labelFs = th >= 120 ? "text-[11px]" : "text-[10px]";
            const subFs = th >= 120 ? "text-[10px]" : "text-[9px]";
            return (
              <div key={i} ref={active ? activeRef : null}
                className={`group relative shrink-0 rounded-lg border transition-colors ${
                  active ? "border-brand bg-slate-800 ring-1 ring-brand/60" : "border-slate-700/80 bg-slate-900 hover:border-slate-600 hover:bg-slate-800/80"
                }`}>
                <button onClick={() => go(i)} className="flex flex-col items-start text-left p-1.5" title={p.title || p.sheetNo || `Sheet ${i + 1}`}>
                  <div className="relative rounded overflow-hidden bg-white border border-slate-700/50 shrink-0" style={{ width: tw, height: th }}>
                    <SheetThumb page={p} index={i} width={tw} height={th} />
                    {loading === i && (
                      <span className="absolute inset-0 flex items-center justify-center bg-slate-900/70">
                        <Loader2 size={16} className="animate-spin text-brand" />
                      </span>
                    )}
                    {p.discipline && (
                      <span className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full ring-1 ring-black/20" style={{ background: p.discipline.color }} />
                    )}
                  </div>
                  <div className="mt-1 px-0.5 min-w-0" style={{ maxWidth: tw }}>
                    <div className={`${labelFs} font-semibold truncate ${active ? "text-brand" : "text-slate-200"}`}>
                      {p.sheetNo || `#${i + 1}`}
                    </div>
                    {p.title && <div className={`${subFs} text-slate-500 truncate leading-tight mt-0.5`}>{p.title}</div>}
                  </div>
                </button>
                {pages.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(`Remove sheet ${p.sheetNo || i + 1}?`)) removePage(i); }}
                    aria-label={`Remove sheet ${p.sheetNo || i + 1}`}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded bg-slate-900/90 text-slate-500 hover:text-rose-300 opacity-0 group-hover:opacity-100 focus:opacity-100">
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="flex items-center px-4 text-[11px] text-slate-500">No sheets match.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Picks the sharpest available source and re-renders from the PDF when the
// strip is enlarged beyond the import thumb resolution.
function SheetThumb({ page, index, width, height }) {
  const wantPx = Math.max(width, height, 256);
  const [src, setSrc] = useState(page.thumb);

  useEffect(() => {
    if (page.loaded && page.href) {
      setSrc(page.href);
      return;
    }
    const key = `${index}@${wantPx}`;
    const cached = THUMB_CACHE.get(key);
    if (cached) {
      setSrc(cached);
      return;
    }
    if (wantPx <= 280 && page.thumb) {
      setSrc(page.thumb);
      return;
    }
    let cancelled = false;
    renderThumb(index, wantPx)
      .then((url) => {
        if (cancelled) return;
        THUMB_CACHE.set(key, url);
        setSrc(url);
      })
      .catch(() => { if (!cancelled && page.thumb) setSrc(page.thumb); });
    return () => { cancelled = true; };
  }, [page.thumb, page.href, page.loaded, index, wantPx]);

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="block bg-white"
      style={{ width, height, objectFit: "contain" }}
    />
  );
}

function DiscChip({ on, color, children, onClick }) {
  return (
    <button onClick={onClick}
      className={`text-[10px] px-1.5 py-0.5 rounded ${on ? "bg-brand text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
      style={on && color ? { background: color, color: "#0a1420" } : undefined}>
      {children}
    </button>
  );
}
