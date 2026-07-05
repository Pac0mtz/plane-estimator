import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { importPlanFile } from "../lib/importPlan.js";

// Wraps the canvas so an estimator can drag a PDF or image straight onto it.
export default function DropZone({ children, className = "" }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  const onDrop = async (e) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) await importPlanFile(f, useStore.getState());
  };

  return (
    <div className={`relative flex-1 flex min-w-0 ${className}`}
      onDragEnter={(e) => { e.preventDefault(); depth.current++; setOver(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { depth.current--; if (depth.current <= 0) setOver(false); }}
      onDrop={onDrop}>
      {children}
      {over && (
        <div className="drop-zone-active absolute inset-3 z-40 rounded-2xl bg-brand/10 border-2 border-dashed border-brand flex items-center justify-center pointer-events-none backdrop-blur-[2px]">
          <div className="upload-prompt-card flex items-center gap-4 rounded-2xl bg-slate-950/95 px-8 py-5 text-slate-100 shadow-2xl border border-brand/30 ring-1 ring-brand/20">
            <UploadCloud className="text-brand shrink-0" size={28} />
            <div>
              <div className="font-semibold text-base">Drop to import</div>
              <div className="text-sm text-slate-400 mt-0.5">PDF plan set or image · CAD → export to PDF first</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
