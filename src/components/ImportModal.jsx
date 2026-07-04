import { useState, useMemo } from "react";
import {
  X, FileText, Loader2, ChevronLeft, ChevronRight, Hammer, Layers2,
  Ruler, MessageSquareText, CheckCircle2,
} from "lucide-react";
import { useStore, START_LAYERS } from "../store/useStore.js";
import { ASSEMBLIES } from "../lib/assemblies.js";
import { commitPdfImport, cancelPdfImport } from "../lib/importPlan.js";

const STAGES = [
  { key: "reading", label: "Reading file" },
  { key: "loading", label: "Loading document" },
  { key: "thumbnails", label: "Building page previews" },
];

// Full-screen import flow: load PDF → preview sheets + detected trades → confirm.
export default function ImportModal() {
  const preview = useStore((s) => s.importPreview);
  const importProgress = useStore((s) => s.importProgress);
  const patch = useStore((s) => s.patchImportPreview);
  const [committing, setCommitting] = useState(false);

  if (!preview) return null;

  const onCancel = () => {
    if (committing) return;
    cancelPdfImport(useStore.getState());
  };

  const onCommit = async () => {
    setCommitting(true);
    await commitPdfImport(useStore.getState());
    setCommitting(false);
  };

  if (preview.phase === "loading") {
    return <LoadingView preview={preview} onCancel={onCancel} />;
  }

  if (committing || importProgress?.stage === "rendering") {
    return <CommittingView fileName={preview.fileName} onCancel={null} />;
  }

  return (
    <PreviewView
      preview={preview}
      patch={patch}
      onCancel={onCancel}
      onCommit={onCommit}
    />
  );
}

function LoadingView({ preview, onCancel }) {
  const p = preview.progress || {};
  const activeIdx = STAGES.findIndex((s) => s.key === p.stage);
  const detail =
    p.stage === "thumbnails" && p.total
      ? `page ${p.page} of ${p.total}`
      : p.stage === "loading" && p.total
      ? `${p.pct}%`
      : "";

  return (
    <Overlay onClose={onCancel}>
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <Header fileName={preview.fileName} subtitle="Reading plan set — nothing leaves your browser." />
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-4 mt-4">
          <div className="h-full bg-brand transition-all duration-200"
            style={{ width: `${p.stage === "thumbnails" || p.stage === "loading" ? p.pct : activeIdx >= 0 ? 35 : 10}%` }} />
        </div>
        <ul className="flex flex-col gap-1.5">
          {STAGES.map((s, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <li key={s.key} className={`flex items-center gap-2 text-sm ${done ? "text-emerald-400" : active ? "text-slate-100" : "text-slate-600"}`}>
                {active ? <Loader2 size={14} className="animate-spin" /> : <span className={`w-3.5 h-3.5 rounded-full inline-block ${done ? "bg-emerald-500" : "bg-slate-700"}`} />}
                <span className="flex-1">{s.label}</span>
                {active && detail && <span className="text-xs text-slate-400 tabular-nums">{detail}</span>}
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex justify-end">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">Cancel</button>
        </div>
      </div>
    </Overlay>
  );
}

function CommittingView({ fileName }) {
  return (
    <Overlay>
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl text-center">
        <Loader2 size={28} className="animate-spin text-brand mx-auto mb-3" />
        <div className="font-semibold">Importing {fileName}</div>
        <div className="text-xs text-slate-400 mt-1">Rendering first sheet and setting up layers…</div>
      </div>
    </Overlay>
  );
}

function PreviewView({ preview, patch, onCancel, onCommit }) {
  const { thumbs, sheetIndex, previewPage = 0, trades, tradesBusy, tradesNote, tradesError, summary, selectedAsms, options } = preview;
  const page = thumbs[previewPage];
  const [showAllSheets, setShowAllSheets] = useState(false);

  const toggleAsm = (asm) => {
    const next = selectedAsms.includes(asm) ? selectedAsms.filter((a) => a !== asm) : [...selectedAsms, asm];
    patch({ selectedAsms: next });
  };

  const setOpt = (key, val) => patch({ options: { ...options, [key]: val } });

  const manualTrades = useMemo(
    () => START_LAYERS.map((l) => ({ trade: l.name, asm: l.asm, scope: ASSEMBLIES[l.asm]?.div, sheets: [] })),
    []
  );

  const tradeList = trades?.length ? trades : !tradesBusy ? manualTrades : [];
  const withAsm = tradeList.filter((t) => t.asm);
  const visibleSheets = showAllSheets ? sheetIndex : sheetIndex.slice(0, 10);

  return (
    <Overlay onClose={onCancel}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col text-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
          <FileText size={18} className="text-brand" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">Import plan set</div>
            <div className="text-xs text-slate-400 truncate">{preview.fileName} · {thumbs.length} sheet{thumbs.length === 1 ? "" : "s"}</div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white p-1" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid lg:grid-cols-2 gap-4 min-h-0">
          {/* left — sheet preview */}
          <div className="flex flex-col gap-3 min-h-0">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sheet preview</div>
            <div className="relative rounded-lg border border-slate-800 bg-slate-950 overflow-hidden flex-1 min-h-[200px] flex items-center justify-center">
              {page?.thumb ? (
                <img src={page.thumb} alt="" className="max-w-full max-h-[320px] object-contain" />
              ) : (
                <div className="text-slate-500 text-sm">No preview</div>
              )}
              {thumbs.length > 1 && (
                <>
                  <button disabled={previewPage <= 0} onClick={() => patch({ previewPage: previewPage - 1 })}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-900/90 border border-slate-700 disabled:opacity-30 hover:bg-slate-800">
                    <ChevronLeft size={16} />
                  </button>
                  <button disabled={previewPage >= thumbs.length - 1} onClick={() => patch({ previewPage: previewPage + 1 })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-900/90 border border-slate-700 disabled:opacity-30 hover:bg-slate-800">
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>
            <div className="text-sm">
              {page?.sheetNo ? (
                <><b className="text-slate-100">{page.sheetNo}</b>{page.title && <span className="text-slate-400"> · {page.title}</span>}</>
              ) : (
                <span className="text-slate-400">Sheet {previewPage + 1} of {thumbs.length}</span>
              )}
              {page?.dpi && <span className="text-slate-500 text-xs ml-2">~{page.dpi} dpi</span>}
            </div>

            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <div className="px-3 py-2 bg-slate-950 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                Sheet index · {sheetIndex.length || thumbs.length}
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-800/80">
                {visibleSheets.length === 0 && (
                  <div className="p-2 text-[11px] text-slate-500">No sheet numbers parsed — all pages will import.</div>
                )}
                {visibleSheets.map((s) => (
                  <div key={s.no} className="px-3 py-1.5 text-xs flex gap-2">
                    <span className="font-medium text-brand shrink-0">{s.no}</span>
                    <span className="text-slate-400 truncate">{s.title || s.discipline?.label}</span>
                  </div>
                ))}
                {sheetIndex.length > 10 && !showAllSheets && (
                  <button onClick={() => setShowAllSheets(true)} className="w-full px-3 py-1.5 text-[11px] text-brand hover:bg-slate-800/50">
                    Show all {sheetIndex.length} sheets…
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* right — trades + options */}
          <div className="flex flex-col gap-3 min-h-0">
            {summary && <p className="text-[13px] text-slate-300 leading-relaxed rounded-lg bg-slate-950 border border-slate-800 p-3">{summary}</p>}

            <div className="rounded-lg border border-slate-800 overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border-b border-slate-800 text-xs font-semibold text-slate-300">
                <Hammer size={13} className="text-violet-400" />
                Trades to include
                <span className="ml-auto font-normal text-slate-500">uncheck to skip</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 min-h-[120px]">
                {tradesBusy && (
                  <div className="flex items-center gap-2 text-sm text-slate-400 p-2">
                    <Loader2 size={14} className="animate-spin" /> Detecting trades…
                  </div>
                )}
                {tradesNote && !tradesBusy && <div className="text-[11px] text-slate-500 px-1">{tradesNote}</div>}
                {tradesError && <div className="text-[11px] text-rose-300 px-1">⚠️ {tradesError}</div>}
                {tradeList.map((t, i) => {
                  if (!t.asm) {
                    return (
                      <div key={i} className="rounded bg-slate-950 border border-slate-800 p-2 opacity-70">
                        <div className="text-sm font-medium">{t.trade}</div>
                        {t.scope && <div className="text-[11px] text-slate-500">{t.scope}</div>}
                      </div>
                    );
                  }
                  const on = selectedAsms.includes(t.asm);
                  return (
                    <label key={t.asm + i} className={`flex gap-2 rounded border p-2 cursor-pointer transition-colors ${on ? "border-violet-800/60 bg-violet-950/20" : "border-slate-800 bg-slate-950 opacity-60"}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleAsm(t.asm)} className="accent-violet-500 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{t.trade}</div>
                        {t.scope && <div className="text-[11px] text-slate-400">{t.scope}</div>}
                        {t.sheets?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {t.sheets.slice(0, 6).map((no) => (
                              <span key={no} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{no}</span>
                            ))}
                            {t.sheets.length > 6 && <span className="text-[10px] text-slate-500">+{t.sheets.length - 6}</span>}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
                {!tradesBusy && withAsm.length === 0 && (
                  <div className="text-[11px] text-slate-500 p-2">No trades detected — pick assemblies above or import with default layers.</div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 p-3 flex flex-col gap-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Import options</div>
              <Option checked={options.replaceLayers} onChange={(v) => setOpt("replaceLayers", v)} icon={Layers2}
                label="Create takeoff layers from selected trades"
                hint="Replaces current layers with one per checked trade" />
              <Option checked={options.autoScale} onChange={(v) => setOpt("autoScale", v)} icon={Ruler}
                label="Auto-detect scale from scale note"
                hint="Reads the printed scale on the first sheet with one" />
              <Option checked={options.openAssistant} onChange={(v) => setOpt("openAssistant", v)} icon={MessageSquareText}
                label="Open plan assistant with overview"
                hint="Shows the project summary after import" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-800 bg-slate-950 shrink-0">
          <div className="text-sm text-slate-400">
            <b className="text-slate-200">{thumbs.length}</b> sheet{thumbs.length === 1 ? "" : "s"} · <b className="text-violet-300">{selectedAsms.length}</b> trade{selectedAsms.length === 1 ? "" : "s"} selected
          </div>
          <div className="flex-1" />
          <button onClick={onCancel} className="text-sm px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200">Cancel</button>
          <button onClick={onCommit} disabled={options.replaceLayers && selectedAsms.length === 0}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded bg-brand hover:bg-brand2 font-medium disabled:opacity-50 text-white">
            <CheckCircle2 size={15} /> Import {thumbs.length} sheet{thumbs.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function Option({ checked, onChange, icon: Icon, label, hint }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-brand mt-0.5" />
      <Icon size={14} className="text-slate-500 shrink-0 mt-0.5" />
      <div>
        <div className="text-slate-200">{label}</div>
        {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
      </div>
    </label>
  );
}

function Header({ fileName, subtitle }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-brand/20 text-brand flex items-center justify-center">
        <FileText size={20} />
      </div>
      <div className="min-w-0">
        <div className="font-semibold truncate">{fileName}</div>
        {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
      </div>
    </div>
  );
}

function Overlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={onClose || undefined}>
      {children}
    </div>
  );
}
