import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, FileText, Trash2, ClipboardList, Hammer, Layers2 } from "lucide-react";
import { PanelToggle } from "./PanelToggle.jsx";
import { useStore } from "../store/useStore.js";
import { maybeAutoScale, loadPageIfNeeded } from "../lib/importPlan.js";
import { hasKey } from "../lib/aiDetect.js";
import { askAssistant, QUICK_ACTIONS } from "../lib/planAssistant.js";

export default function AssistantPanel({ onClose, className = "" }) {
  const s = useStore();
  const { pages, activePage, sheetIndex, chat, chatBusy, planSummary, pushChat, setChatBusy, clearChat, setPage } = s;
  const active = pages[activePage];
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [chat, chatBusy]);

  const knownNos = new Set(pages.map((p) => p.sheetNo).filter(Boolean));

  const jumpToSheet = async (no) => {
    const i = pages.findIndex((p) => p.sheetNo === no);
    if (i < 0) return;
    setPage(i);
    if (!pages[i].loaded) await loadPageIfNeeded(i);
  };

  const send = async (question, withImage = false) => {
    if (!question.trim() || chatBusy) return;
    const history = [...chat];
    pushChat({ role: "user", content: question });
    setInput("");
    setChatBusy(true);
    try {
      const imageUrl = withImage && active?.loaded ? active.href : null;
      const answer = await askAssistant({ question, history, sheetIndex, activeSheet: active, imageUrl });
      pushChat({ role: "assistant", content: answer });
    } catch (err) {
      pushChat({ role: "assistant", content: "⚠️ " + err.message, error: true });
    } finally {
      setChatBusy(false);
    }
  };

  return (
    <div className={`w-full md:w-80 shrink-0 border-l border-slate-800 bg-slate-950 flex flex-col md:relative max-md:inset-0 max-md:border-l-0 ${className || "max-md:fixed max-md:z-[60]"}`}>
      <div className="flex items-center gap-2 px-2 h-11 border-b border-slate-800">
        <Sparkles size={16} className="text-violet-400 shrink-0" />
        <span className="font-semibold text-sm flex-1 min-w-0 truncate">Plan assistant</span>
        {chat.length > 0 && <button onClick={clearChat} title="Clear chat" className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800"><Trash2 size={14} /></button>}
        <PanelToggle onClick={onClose} expanded side="right" size="sm" title="Close assistant" />
      </div>

      {active?.sheetNo && (
        <div className="px-3 py-1.5 text-[11px] text-slate-400 border-b border-slate-800 flex items-center gap-1.5">
          <FileText size={12} /> Reading <b className="text-slate-200">{active.sheetNo}</b>
          {active.title && <span className="truncate">· {active.title}</span>}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {planSummary && <PlanOverview data={planSummary} knownNos={knownNos} onJump={jumpToSheet} />}
        {chat.length === 0 && !planSummary && (
          <div className="text-[13px] text-slate-400 leading-relaxed">
            {hasKey()
              ? <>Ask me about this plan set. I can summarize the open sheet, tell you which pages to pull for a trade, read schedules, or look at the drawing.</>
              : <>Add an OpenAI key (in the <b className="text-slate-200">AI pre-seed</b> panel → key icon) to chat about your plans.</>}
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i} className={m.role === "user" ? "self-end max-w-[85%]" : "self-start w-full"}>
            <div className={`rounded-lg px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
              m.role === "user" ? "bg-brand text-white" : m.error ? "bg-rose-950/60 text-rose-200" : "bg-slate-900 border border-slate-800 text-slate-200"
            }`}>
              {m.role === "assistant" && !m.error ? linkify(m.content, knownNos, jumpToSheet) : m.content}
            </div>
          </div>
        ))}
        {chatBusy && <div className="self-start flex items-center gap-2 text-slate-400 text-sm"><Loader2 size={14} className="animate-spin" /> Reading the plans…</div>}
      </div>

      <div className="p-2 border-t border-slate-800">
        <div className="flex flex-wrap gap-1 mb-2">
          {QUICK_ACTIONS.map((a) => (
            <button key={a.label} disabled={chatBusy} onClick={() => send(a.q, a.image)}
              className="text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50">
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask about these plans…" disabled={chatBusy}
            className="flex-1 px-2.5 py-2 rounded bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand" />
          <button onClick={() => send(input)} disabled={chatBusy || !input.trim()}
            className="px-2.5 rounded bg-brand hover:bg-brand2 disabled:opacity-40 text-white"><Send size={15} /></button>
        </div>
      </div>
    </div>
  );
}

// Pinned card summarizing the plan set + trades detected on import. Detected
// trades can be selected and turned into takeoff layers (skip the ones you
// don't want to bid).
function PlanOverview({ data, knownNos, onJump }) {
  const layers = useStore((s) => s.layers);
  const addLayersForAsms = useStore((s) => s.addLayersForAsms);
  const withAsm = (data.trades || []).filter((t) => t.asm);
  const [sel, setSel] = useState(null);
  const [added, setAdded] = useState(0);
  const chosen = sel ?? new Set(withAsm.filter((t) => !layers.some((l) => l.asm === t.asm)).map((t) => t.asm));
  const toggle = (asm) => { const n = new Set(chosen); n.has(asm) ? n.delete(asm) : n.add(asm); setSel(n); };
  const apply = () => { const n = addLayersForAsms([...chosen]); setAdded(n); };

  return (
    <div className="rounded-lg border border-violet-900/60 bg-violet-950/20 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-violet-950/40 text-violet-200 text-xs font-semibold">
        <ClipboardList size={13} /> Plan overview
      </div>
      <div className="p-3 text-[13px] leading-relaxed">
        {data.busy && <div className="flex items-center gap-2 text-slate-300"><Loader2 size={14} className="animate-spin" /> Detecting trades & summarizing…</div>}
        {data.note && <div className="text-slate-400">{data.note}</div>}
        {data.error && <div className="text-rose-300">⚠️ {data.error}</div>}
        {data.summary && <p className="text-slate-200 mb-3">{data.summary}</p>}
        {data.trades?.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              <Hammer size={12} /> Trades detected · {data.trades.length}
              <span className="ml-auto font-normal normal-case text-slate-500">check to include</span>
            </div>
            <div className="flex flex-col gap-2">
              {data.trades.map((t, i) => {
                const has = t.asm && layers.some((l) => l.asm === t.asm);
                return (
                  <div key={i} className="rounded bg-slate-900/70 border border-slate-800 p-2">
                    <div className="flex items-center gap-2">
                      {t.asm ? (
                        <input type="checkbox" checked={has || chosen.has(t.asm)} disabled={has} onChange={() => toggle(t.asm)} className="accent-violet-500" />
                      ) : <span className="w-3.5" />}
                      <div className="text-slate-100 font-medium text-[13px] flex-1">{t.trade}</div>
                      {has && <span className="text-[9px] px-1 rounded bg-emerald-900/50 text-emerald-300">layer ✓</span>}
                    </div>
                    {t.scope && <div className="text-slate-400 text-[11px] mb-1 ml-6">{t.scope}</div>}
                    <div className="flex flex-wrap gap-1 ml-6">
                      {(t.sheets || []).map((no) => {
                        const up = String(no).toUpperCase();
                        const known = knownNos.has(up);
                        return (
                          <button key={no} disabled={!known} onClick={() => onJump(up)}
                            className={`text-[10px] px-1.5 py-0.5 rounded ${known ? "bg-violet-900/50 text-violet-200 hover:bg-violet-800/60" : "bg-slate-800 text-slate-500"}`}>
                            {up}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {withAsm.length > 0 && (
              <button onClick={apply} disabled={chosen.size === 0}
                className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white font-medium">
                <Layers2 size={13} /> {added ? `Added ${added} layer${added === 1 ? "" : "s"}` : `Add ${chosen.size} selected trade${chosen.size === 1 ? "" : "s"} as layers`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Turn [A101] / A101 sheet references in assistant text into clickable jumps.
function linkify(text, knownNos, onJump) {
  const re = /\[?\b([A-Z]{1,2}\d{2,4}[A-Z]?)\b\]?/g;
  const out = [];
  let last = 0, m, k = 0;
  while ((m = re.exec(text))) {
    const no = m[1].toUpperCase();
    if (!knownNos.has(no)) continue;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <button key={k++} onClick={() => onJump(no)}
        className="text-violet-300 underline decoration-dotted hover:text-violet-200 font-medium">{no}</button>
    );
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}
