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
      ? `Page ${p.page} of ${p.total}`
      : p.stage === "loading" && p.total
      ? `${p.pct}%`
      : "";

  const progressPct = (() => {
    if (p.stage === "thumbnails" && p.total) {
      const stageBase = 66;
      const stageSpan = 34;
      return stageBase + (p.page / p.total) * stageSpan;
    }
    if (p.stage === "loading" && p.total) return 20 + (p.pct / 100) * 46;
    if (activeIdx >= 0) return [12, 35, 66][activeIdx] ?? 10;
    return 8;
  })();

  return (
    <Overlay onClose={onCancel} size="sm">
      <div className="import-panel w-full rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 p-6 lg:p-7 text-slate-100 shadow-2xl shadow-black/40 ring-1 ring-white/5">
        <ImportFileHeader fileName={preview.fileName} subtitle="Reading plan set locally — nothing leaves your browser." />

        <div className="mt-6 mb-5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 tabular-nums">
            <span>Import progress</span>
            <span className="text-slate-300 font-medium">{Math.round(progressPct)}%</span>
          </div>
          <div className="import-progress-bar">
            <div className="import-progress-fill" style={{ width: `${progressPct}%` }} />
            <div className="import-progress-shimmer" />
          </div>
        </div>

        <ol className="flex flex-col gap-2">
          {STAGES.map((s, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <li
                key={s.key}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`import-step flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  done ? "import-step-done bg-emerald-950/25 border border-emerald-900/30" :
                  active ? "import-step-active bg-slate-800/60 border border-brand/30" :
                  "border border-transparent opacity-60"
                }`}
              >
                <span className={`import-step-dot flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${
                  done ? "bg-emerald-500/20 text-emerald-400" :
                  active ? "bg-brand/20 text-brand" :
                  "bg-slate-800 text-slate-600"
                }`}>
                  {done ? (
                    <CheckCircle2 size={16} className="import-step-check" strokeWidth={2.5} />
                  ) : active ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-600" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${done ? "text-emerald-300" : active ? "text-slate-100" : "text-slate-500"}`}>
                    {s.label}
                  </div>
                  {active && detail && (
                    <div className="text-xs text-brand/90 mt-0.5 tabular-nums animate-pulse">{detail}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onCancel}
            className="text-sm px-4 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function CommittingView({ fileName }) {
  return (
    <Overlay size="sm">
      <div className="import-panel w-full rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 p-8 text-slate-100 shadow-2xl shadow-black/40 ring-1 ring-white/5 text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-brand/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand animate-spin" />
          <div className="absolute inset-2 rounded-xl bg-brand/15 flex items-center justify-center import-file-icon">
            <FileText size={24} className="text-brand" />
          </div>
        </div>
        <div className="font-semibold text-base">Importing {fileName}</div>
        <div className="text-sm text-slate-400 mt-1.5">Rendering first sheet and setting up layers…</div>
        <div className="import-progress-bar mt-5 max-w-[200px] mx-auto">
          <div className="import-progress-fill w-[65%]" />
          <div className="import-progress-shimmer" />
        </div>
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
    <Overlay onClose={onCancel} size="lg">
      <div className="import-panel bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col text-slate-100 shadow-2xl shadow-black/40 ring-1 ring-white/5" onClick={(e) => e.stopPropagation()}>
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

function ImportFileHeader({ fileName, subtitle }) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="import-file-icon w-12 h-12 rounded-xl bg-gradient-to-br from-brand/25 to-brand/5 text-brand flex items-center justify-center shrink-0 ring-1 ring-brand/20 shadow-inner">
        <FileText size={22} strokeWidth={2} />
      </div>
      <div className="min-w-0 pt-0.5">
        <div className="font-semibold text-[15px] truncate leading-tight">{fileName}</div>
        {subtitle && <div className="text-xs text-slate-400 mt-1 leading-relaxed">{subtitle}</div>}
      </div>
    </div>
  );
}

function Overlay({ children, onClose, size = "sm" }) {
  const maxW = size === "lg" ? "max-w-4xl" : "max-w-md";
  return (
    <div
      className="import-overlay fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6"
      onClick={onClose || undefined}
    >
      <div className={`w-full ${maxW} max-h-[92dvh] overflow-y-auto sm:mx-auto`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
