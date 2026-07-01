import { useState } from "react";
import { Sparkles, Check, X, CheckCheck, KeyRound, AlertTriangle } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { ASSEMBLIES } from "../lib/assemblies.js";
import { hasKey, setKey } from "../lib/aiDetect.js";

const unitOf = (asm) => ASSEMBLIES[asm]?.unit || "";

// Estimator-confirms panel. AI drops candidate traces here; accepting one turns
// it into a real trace that flows into the pricing engine. Rejecting drops it.
export default function AiReviewPanel() {
  const { suggestions, aiError, acceptSuggestion, rejectSuggestion, acceptAllSuggestions, clearSuggestions } = useStore();
  const [showKey, setShowKey] = useState(false);
  const [keyVal, setKeyVal] = useState("");
  const [keyErr, setKeyErr] = useState("");

  const hasSuggestions = suggestions.length > 0;
  if (!hasSuggestions && !aiError && !showKey) {
    // compact affordance to configure the key / explain demo mode
    return (
      <div className="px-3 pt-3">
        <div className="rounded bg-slate-900 border border-slate-800 p-2.5 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 text-violet-300 font-semibold mb-1">
            <Sparkles size={13} /> AI pre-seed
          </div>
          {hasKey() ? (
            <>OpenAI vision connected. Hit <b className="text-slate-200">AI detect</b> to suggest traces on this page.{" "}
              <button onClick={() => setShowKey(true)} className="text-violet-300 underline">change key</button></>
          ) : (
            <>Running in <b className="text-slate-200">demo detection</b> mode. Hit <b className="text-slate-200">AI detect</b> to preview,
              or <button onClick={() => setShowKey(true)} className="text-violet-300 underline">add an OpenAI key</button> for real vision.</>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pt-3">
      <div className="rounded bg-slate-900 border border-violet-900/60 overflow-hidden">
        <div className="flex items-center gap-1.5 px-2.5 py-2 bg-violet-950/40 text-violet-200 text-xs font-semibold">
          <Sparkles size={13} /> AI suggestions
          <span className="text-slate-500 font-normal">{suggestions.length ? `(${suggestions.length})` : ""}</span>
          <div className="flex-1" />
          <button onClick={() => setShowKey((v) => !v)} title="OpenAI key" className="text-slate-400 hover:text-white">
            <KeyRound size={13} />
          </button>
        </div>

        {showKey && (
          <div className="p-2.5 border-b border-slate-800 bg-slate-950">
            <div className="text-[10px] text-amber-400 flex items-center gap-1 mb-1">
              <AlertTriangle size={11} /> Browser-stored key — dev use only.
            </div>
            <div className="flex gap-1">
              <input value={keyVal} onChange={(e) => setKeyVal(e.target.value)} type="password" placeholder="sk-…"
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} name="planforge-openai-key-nofill"
                className="flex-1 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-[11px] text-slate-100" />
              <button onClick={() => {
                  const k = keyVal.trim();
                  if (!k.startsWith("sk-")) { setKeyErr("That doesn't look like an OpenAI key (must start with \"sk-\"). Autofill may have replaced it."); return; }
                  setKey(k); setKeyErr(""); setShowKey(false);
                }}
                className="px-2 py-1 rounded bg-brand hover:bg-brand2 text-[11px] text-white">Save</button>
            </div>
            {keyErr && <div className="mt-1 text-[10px] text-rose-400">{keyErr}</div>}
            {hasKey() && <button onClick={() => { setKey(""); setKeyVal(""); setKeyErr(""); }} className="mt-1 text-[10px] text-slate-500 underline">clear stored key</button>}
          </div>
        )}

        {aiError && (
          <div className="p-2.5 text-[11px] text-rose-300 flex items-center gap-1.5">
            <AlertTriangle size={12} /> {aiError}
          </div>
        )}

        {hasSuggestions && (
          <>
            <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto">
              {suggestions.map((sg) => (
                <div key={sg.id} className="p-2 flex items-center gap-2 text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: sg.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-200 truncate">{sg.layerName} <span className="text-slate-500">· {sg.type}</span></div>
                    <div className="text-slate-500 truncate">{sg.note}</div>
                  </div>
                  <ConfidenceBadge c={sg.confidence} />
                  <button onClick={() => acceptSuggestion(sg.id)} title="Accept"
                    className="p-1 rounded bg-emerald-800/70 hover:bg-emerald-700 text-emerald-200"><Check size={13} /></button>
                  <button onClick={() => rejectSuggestion(sg.id)} title="Reject"
                    className="p-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300"><X size={13} /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 p-2 border-t border-slate-800">
              <button onClick={acceptAllSuggestions}
                className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white">
                <CheckCheck size={13} /> Accept all
              </button>
              <button onClick={clearSuggestions}
                className="flex items-center justify-center gap-1 text-[11px] px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">
                Dismiss
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ConfidenceBadge({ c }) {
  const pct = Math.round((c || 0) * 100);
  const tone = pct >= 80 ? "text-emerald-300" : pct >= 60 ? "text-amber-300" : "text-rose-300";
  return <span className={`shrink-0 tabular-nums ${tone}`}>{pct}%</span>;
}
