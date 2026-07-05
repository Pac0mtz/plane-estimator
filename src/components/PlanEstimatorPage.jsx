import { useMemo, useState } from "react";
import { Plus, Search, X, Ruler } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { ASSEMBLIES } from "../lib/assemblies.js";
import { cleanProjectTitle, isFieldTaskProEmbed } from "../lib/embed.js";
import EstimatorWorkCard from "./EstimatorWorkCard.jsx";
import PageShell from "./PageShell.jsx";

const TRADE_OPTIONS = ["slab", "footing", "brick", "cmu", "eifs", "roofing", "drywall", "storefront", "doors", "windows", "woodfence", "chainlink", "fencegate", "sitewall", "act", "paint", "flooring", "lighting", "device", "fixtures", "rtu"];
const DEFAULT_TRADES = ["brick", "eifs", "drywall", "slab", "doors"];
const STATUSES = ["active", "bidding", "won", "archived"];

function traces(project) {
  return project.takeoff?.traces?.length || 0;
}

function cardTitle(project, clientName) {
  const client = clientName(project.clientId);
  if (client && client !== "No client") return client;
  return cleanProjectTitle(project.name);
}

function matchesSearch(project, clientName, q) {
  if (!q) return true;
  const hay = [project.name, project.address, clientName(project.clientId)].join(" ").toLowerCase();
  return hay.includes(q);
}

export default function PlanEstimatorPage() {
  const embedded = isFieldTaskProEmbed();
  const { projects, clients, addProject, updateProject, deleteProject, openProject } = useStore();
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const clientName = (id) => clients.find((c) => c.id === id)?.name || "No client";
  const q = query.trim().toLowerCase();

  const visible = useMemo(
    () => projects.filter((p) => matchesSearch(p, clientName, q)),
    [projects, clients, q],
  );

  const totalTraces = useMemo(() => projects.reduce((n, p) => n + traces(p), 0), [projects]);
  const activeCount = useMemo(() => projects.filter((p) => p.status === "active" || p.status === "bidding").length, [projects]);

  const toolbar = (
    <>
      <div className="relative flex-1 min-w-[200px] lg:w-72 xl:w-80">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search estimator work…"
          className="input pl-9 w-full h-10 lg:h-9"
        />
      </div>
      {!embedded && (
        <button
          type="button"
          onClick={() => setEditing({})}
          className="desk-btn-primary flex items-center justify-center gap-1.5 text-sm px-4 h-10 lg:h-9 rounded-md font-medium w-full sm:w-auto shrink-0"
        >
          <Plus size={16} /> New estimator work
        </button>
      )}
    </>
  );

  const grid = (
    <>
      {projects.length === 0 ? (
        <Empty onNew={() => setEditing({})} />
      ) : visible.length === 0 ? (
        <div className="text-sm text-slate-400 py-12 text-center rounded-lg border border-dashed border-slate-800 bg-slate-950/40">
          No matches for “{query}”.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((p) => (
            <EstimatorWorkCard
              key={p.id}
              title={cardTitle(p, clientName)}
              meta={`${traces(p)} trace${traces(p) === 1 ? "" : "s"} · updated ${new Date(p.updatedAt).toLocaleDateString()}`}
              status={p.status}
              onOpen={() => openProject(p.id)}
              onEdit={() => setEditing(p)}
              onDelete={() => confirm(`Delete “${cardTitle(p, clientName)}”?`) && deleteProject(p.id)}
            />
          ))}
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="flex-1 flex flex-col min-h-0 w-full overflow-y-auto overscroll-contain px-1 lg:px-0">
        <div className="hidden lg:flex items-center gap-3 mb-4">{toolbar}</div>
        <div className="lg:hidden relative w-full mb-3">{toolbar}</div>
        {grid}
        {editing && <ProjectForm project={editing} clients={clients} onCancel={() => setEditing(null)} onSave={save(editing, addProject, updateProject, openProject, setEditing)} />}
      </div>
    );
  }

  return (
    <PageShell
      title="Plan Estimator"
      icon={Ruler}
      subtitle="Open an estimate, upload plans, trace takeoffs, and export proposals."
      stats={projects.length ? [
        { label: "Estimator work", value: projects.length },
        { label: "Active / bidding", value: activeCount },
        { label: "Total traces", value: totalTraces },
        { label: "Clients", value: clients.length },
      ] : []}
      toolbar={toolbar}
    >
      {grid}
      {editing && <ProjectForm project={editing} clients={clients} onCancel={() => setEditing(null)} onSave={save(editing, addProject, updateProject, openProject, setEditing)} />}
    </PageShell>
  );
}

function save(editing, addProject, updateProject, openProject, setEditing) {
  return (data) => {
    if (editing.id) updateProject(editing.id, data);
    else {
      const id = addProject(data);
      openProject(id);
    }
    setEditing(null);
  };
}

function Empty({ onNew }) {
  return (
    <div className="desk-card border border-dashed border-slate-700/80 rounded-xl p-8 lg:p-12 text-center bg-slate-950/40">
      <div className="text-slate-200 font-medium text-base lg:text-lg mb-1">No estimator work yet</div>
      <div className="text-sm text-slate-500 mb-5 max-w-md mx-auto">Create an estimate, upload a plan set, and start tracing quantities.</div>
      <button type="button" onClick={onNew} className="desk-btn-primary inline-flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-md font-medium">
        <Plus size={16} /> New estimator work
      </button>
    </div>
  );
}

function ProjectForm({ project, clients, onCancel, onSave }) {
  const [f, setF] = useState({
    name: cleanProjectTitle(project.name) || "",
    clientId: project.clientId || "",
    address: project.address || "",
    status: project.status || "active",
  });
  const [trades, setTrades] = useState(DEFAULT_TRADES);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleTrade = (t) => setTrades((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] p-0 sm:p-6" onClick={onCancel}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-t-xl sm:rounded-xl w-full max-w-lg max-h-[min(92dvh,720px)] overflow-y-auto p-5 lg:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center mb-4 sticky top-0 bg-slate-900 pb-2 -mt-1 pt-1 z-10">
          <b className="text-base lg:text-lg">{project.id ? "Edit estimator work" : "New estimator work"}</b>
          <div className="flex-1" />
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white touch-target flex items-center justify-center rounded-md hover:bg-slate-800"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
          <Field label="Name" className="lg:col-span-2">
            <input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} className="input h-10" placeholder="e.g. Shell build-out" />
          </Field>
          <Field label="Client">
            <select value={f.clientId} onChange={(e) => set("clientId", e.target.value)} className="input h-10">
              <option value="">— none —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name || "(unnamed)"}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => set("status", e.target.value)} className="input h-10 capitalize">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Address" className="lg:col-span-2">
            <input value={f.address} onChange={(e) => set("address", e.target.value)} className="input h-10" placeholder="Site address" />
          </Field>
        </div>
        {!project.id && (
          <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Trades to include ({trades.length})</span>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {TRADE_OPTIONS.map((t) => (
                <label key={t} className={`flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-md cursor-pointer ${trades.includes(t) ? "bg-slate-800 text-slate-100 ring-1 ring-brand/30" : "bg-slate-950 text-slate-400 hover:bg-slate-800/80"}`}>
                  <input type="checkbox" checked={trades.includes(t)} onChange={() => toggleTrade(t)} className="accent-brand shrink-0" />
                  <span className="truncate">{ASSEMBLIES[t]?.name || t}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-5 pt-4 border-t border-slate-800">
          <button type="button" onClick={onCancel} className="text-sm px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 h-10">Cancel</button>
          <button
            type="button"
            onClick={() => onSave({ ...f, name: f.name.trim() || f.address?.trim() || "Untitled estimate", clientId: f.clientId || null, ...(project.id ? {} : { trades }) })}
            className="desk-btn-primary text-sm px-4 h-10 rounded-md font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      {children}
    </label>
  );
}
