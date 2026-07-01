import { useStore } from "../store/useStore.js";
import { renderPage } from "../lib/pdf.js";
import { useState } from "react";
import { Loader2 } from "lucide-react";

// Vertical thumbnail rail for multi-page plan sets. Navigating to a page that
// hasn't been rendered at full-res triggers an on-demand render (lazy), so a
// large PDF only holds the pages you actually open.
export default function PageRail() {
  const { pages, activePage, setPage, setPageImage } = useStore();
  const [loading, setLoading] = useState(null);

  if (pages.length <= 1) return null;

  const go = async (i) => {
    if (i === activePage) return;
    setPage(i);
    if (!pages[i].loaded) {
      setLoading(i);
      try {
        const p = await renderPage(i);
        setPageImage(i, p);
      } catch {
        /* leave unloaded; canvas shows blank */
      } finally {
        setLoading(null);
      }
    }
  };

  return (
    <div className="w-24 shrink-0 border-r border-slate-800 bg-slate-950 overflow-y-auto p-1.5 flex flex-col gap-1.5">
      <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-1 pt-1">
        {pages.length} pages
      </div>
      {pages.map((p, i) => (
        <button key={i} onClick={() => go(i)}
          className={`relative rounded border overflow-hidden ${
            i === activePage ? "border-brand ring-1 ring-brand" : "border-slate-700 hover:border-slate-500"
          }`}>
          {p.thumb ? (
            <img src={p.thumb} alt={`Page ${i + 1}`} className="w-full block bg-white" />
          ) : (
            <div className="w-full h-24 bg-slate-800" />
          )}
          <span className="absolute bottom-0 right-0 text-[9px] px-1 bg-slate-900/80 text-slate-300 rounded-tl">
            {i + 1}
          </span>
          {loading === i && (
            <span className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
              <Loader2 size={16} className="animate-spin text-brand" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
