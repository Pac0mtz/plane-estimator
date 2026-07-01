import { Upload, Download, RotateCcw } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { useRef } from "react";

export default function Header({ onExport }) {
  const { ppf, ppfNote, loadImage, resetDemo } = useStore();
  const fileRef = useRef(null);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => loadImage(rd.result, img);
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
    e.target.value = "";
  };

  return (
    <header className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-950 text-slate-100">
      <div className="w-7 h-7 rounded flex items-center justify-center font-black text-sm"
        style={{ background: "linear-gradient(135deg,#0a2540,#2f7fd1)" }}>P</div>
      <div className="font-bold tracking-tight">Plan Forge <span className="text-slate-400 font-normal">· Takeoff</span></div>
      <div className="ml-2 text-xs px-2 py-1 rounded bg-slate-800 text-slate-300">
        Scale:{" "}
        {ppf ? <b className="text-emerald-400">{ppf.toFixed(2)} px/ft</b> : <b className="text-amber-400">not set</b>}{" "}
        <span className="text-slate-500">({ppfNote})</span>
      </div>
      <div className="flex-1" />
      <button onClick={resetDemo} title="Reset to demo plan"
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700">
        <RotateCcw size={14} /> Demo
      </button>
      <button onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700">
        <Upload size={14} /> Upload plan
      </button>
      <button onClick={onExport}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-brand hover:bg-brand2">
        <Download size={14} /> Export
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </header>
  );
}
