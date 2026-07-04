import { useState } from "react";
import { X, Sparkles, Loader2, MapPin } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { researchPriceBook } from "../lib/priceResearch.js";
import { hasKey } from "../lib/aiDetect.js";

export default function PriceResearchModal({ onClose }) {
  const { priceBook, activeLocation, applyResearchedBook } = useStore();
  const loc = activeLocation();
  const [location, setLocation] = useState(loc?.name || "");
  const [applyLocation, setApplyLocation] = useState(true);
  const [useReasoning, setUseReasoning] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  const run = async () => {
    if (!location.trim()) { setError("Enter a location."); return; }
    setBusy(true); setError(""); setPreview(null);
    try {
      const result = await researchPriceBook({
        priceBook,
        location: location.trim(),
        locationFactor: loc?.locationFactor ?? 1,
        applyLocationAdjust: applyLocation,
        useReasoning,
      });
      setPreview(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!preview) return;
    applyResearchedBook(preview.book, {
      name: location.trim(),
      locationFactor: applyLocation && preview.suggestedFactor ? preview.suggestedFactor : loc?.locationFactor,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
          <Sparkles size={18} className="text-violet-400" />
          <b className="flex-1">Research prices with AI</b>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {!hasKey() && (
            <div className="text-sm text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2">
              Add an OpenAI key in the takeoff AI panel (key icon) first.
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin size={12} /> Market / city</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Chicago, IL"
              className="input" />
          </label>

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={applyLocation} onChange={(e) => setApplyLocation(e.target.checked)} className="accent-brand mt-1" />
            <span>
              <span className="text-slate-200">Apply location-based pricing</span>
              <span className="block text-[11px] text-slate-500">Adjust bare costs and suggest a city cost index for this metro.</span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={useReasoning} onChange={(e) => setUseReasoning(e.target.checked)} className="accent-violet-500 mt-1" />
            <span>
              <span className="text-slate-200">Use reasoning model</span>
              <span className="block text-[11px] text-slate-500">Slower, more accurate — o3-mini (falls back to gpt-4o if unavailable).</span>
            </span>
          </label>

          {error && <div className="text-sm text-rose-300">{error}</div>}

          {preview && (
            <div className="rounded-lg border border-violet-800/50 bg-violet-950/20 p-3 text-sm">
              <p className="text-slate-200 leading-relaxed mb-2">{preview.summary}</p>
              <div className="text-xs text-slate-400 space-y-1">
                <div><b className="text-slate-300">{preview.updateCount}</b> material lines updated</div>
                {preview.suggestedFactor && applyLocation && (
                  <div>Suggested location factor: <b className="text-emerald-400">{preview.suggestedFactor.toFixed(2)}</b></div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={run} disabled={busy || !hasKey()}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-50 font-medium text-sm">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Researching…</> : <><Sparkles size={16} /> Run research</>}
            </button>
            {preview && (
              <button onClick={apply} className="flex-1 py-2 rounded-lg bg-brand hover:bg-brand2 font-medium text-sm">
                Apply to {loc?.name || "location"}
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500">Updates the active location tab only. Review in the price book before bidding — AI estimates are a starting point.</p>
        </div>
      </div>
    </div>
  );
}
