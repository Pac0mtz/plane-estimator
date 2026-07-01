import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, X, FileText, Trash2, ClipboardList, Hammer } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { renderPage } from "../lib/pdf.js";
import { askAssistant, QUICK_ACTIONS } from "../lib/planAssistant.js";
import { hasKey } from "../lib/aiDetect.js";

export default function AssistantPanel({ onClose }) {
  const s = useStore();
  const { pages, activePage, sheetIndex, chat, chatBusy, planSummary, pushChat, setChatBusy, clearChat, setPage, setPageImage } = s;
  const active = pages[activePage];
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [chat, chatBusy]);

  const knownNos = new Set(pages.map((p) => p.sheetNo).filter(Boolean));

  const jumpToSheet = async (no) => {
    const i = pages.findIndex((p) => p.sheetNo === no);
    if (i < 0) return;
    setPage(i);
    if (!pages[i].loaded) { try { setPageImage(i, await renderPage(i)); } catch { /* */ } }
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
    <div className="w-80 shrink-0 border-l border-slate-800 bg-slate-950 flex flex-col">
      <div className="flex items-center gap-2 px-3 h-11 border-b border-slate-800">
        <Sparkles size={16} className="text-violet-400" />
        <span className="font-semibold text-sm">Plan assistant</span>
        <div className="flex-1" />
        {chat.length > 0 && <button onClick={clearChat} title="Clear chat" className="text-slate-500 hover:text-slate-200"><Trash2 size={14} /></button>}
        <button onClick={onClose} title="Close" className="text-slate-500 hover:text-slate-200"><X size={16} /></button>
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

// Pinned card summarizing the plan set + trades detected on import.
function PlanOverview({ data, knownNos, onJump }) {
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
            </div>
            <div className="flex flex-col gap-2">
              {data.trades.map((t, i) => (
                <div key={i} className="rounded bg-slate-900/70 border border-slate-800 p-2">
                  <div className="text-slate-100 font-medium text-[13px]">{t.trade}</div>
                  {t.scope && <div className="text-slate-400 text-[11px] mb-1">{t.scope}</div>}
                  <div className="flex flex-wrap gap-1">
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
              ))}
            </div>
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
