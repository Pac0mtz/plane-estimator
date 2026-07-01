import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { importPlanFile } from "../lib/importPlan.js";

// Wraps the canvas so an estimator can drag a PDF or image straight onto it.
export default function DropZone({ children }) {
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
    <div className="relative flex-1 flex min-w-0"
      onDragEnter={(e) => { e.preventDefault(); depth.current++; setOver(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { depth.current--; if (depth.current <= 0) setOver(false); }}
      onDrop={onDrop}>
      {children}
      {over && (
        <div className="absolute inset-2 z-40 rounded-xl bg-brand/10 border-2 border-dashed border-brand flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-3 rounded-xl bg-slate-900/95 px-6 py-4 text-slate-100 shadow-xl">
            <UploadCloud className="text-brand" />
            <div>
              <div className="font-semibold">Drop to import</div>
              <div className="text-xs text-slate-400">PDF plan set or image · CAD → export to PDF first</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
