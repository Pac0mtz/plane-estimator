import { useMemo, useState } from "react";
import { Plus, FolderKanban, X } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { ASSEMBLIES } from "../lib/assemblies.js";
import { isFieldTaskProEmbed, shouldShowAddress, projectCardTitle } from "../lib/embed.js";
import EstimatorWorkCard from "./EstimatorWorkCard.jsx";
import PageShell from "./PageShell.jsx";

const TRADE_OPTIONS = ["slab", "footing", "brick", "cmu", "eifs", "roofing", "drywall", "storefront", "doors", "windows", "woodfence", "chainlink", "fencegate", "sitewall", "act", "paint", "flooring", "lighting", "device", "fixtures", "rtu"];
const DEFAULT_TRADES = ["brick", "eifs", "drywall", "slab", "doors"];
const STATUSES = ["active", "bidding", "won", "archived"];

function traceCount(project) {
  return project.takeoff?.traces?.length || 0;
}

export default function ProjectsPage() {
  const embedded = isFieldTaskProEmbed();
  const { projects, clients, addProject, updateProject, deleteProject, openProject } = useStore();
  const [editing, setEditing] = useState(null);
  const clientName = (id) => clients.find((c) => c.id === id)?.name || "No client";

  const totalTraces = useMemo(() => projects.reduce((n, p) => n + traceCount(p), 0), [projects]);

  const grid = (
    <>
      {projects.length === 0 ? (
        <Empty onNew={() => setEditing({})} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {projects.map((p) => {
            const title = projectCardTitle(p);
            return (
              <EstimatorWorkCard
                key={p.id}
                title={title || clientName(p.clientId)}
                subtitle={title ? clientName(p.clientId) : undefined}
                address={shouldShowAddress(p) ? p.address : undefined}
                meta={`${traceCount(p)} trace${traceCount(p) === 1 ? "" : "s"} · updated ${new Date(p.updatedAt).toLocaleDateString()}`}
                status={p.status}
                onOpen={() => openProject(p.id)}
                onEdit={() => setEditing(p)}
                onDelete={() => confirm(`Delete “${p.name}”?`) && deleteProject(p.id)}
              />
            );
          })}
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="flex-1 overflow-y-auto overscroll-contain p-0 w-full">
        {grid}
        {editing && <ProjectForm project={editing} clients={clients} onCancel={() => setEditing(null)} onSave={onSave(editing, addProject, updateProject, openProject, setEditing)} />}
      </div>
    );
  }

  return (
    <PageShell
      title="Projects"
      icon={FolderKanban}
      subtitle="Manage jobs, attach clients, and open takeoffs."
      stats={projects.length ? [
        { label: "Projects", value: projects.length },
        { label: "Clients", value: clients.length },
        { label: "Total traces", value: totalTraces },
        { label: "Active", value: projects.filter((p) => p.status === "active").length },
      ] : []}
      toolbar={(
        <button
          onClick={() => setEditing({})}
          className="desk-btn-primary flex items-center gap-1.5 text-sm px-4 h-10 lg:h-9 rounded-md font-medium"
        >
          <Plus size={16} /> New project
        </button>
      )}
    >
      {grid}
      {editing && <ProjectForm project={editing} clients={clients} onCancel={() => setEditing(null)} onSave={onSave(editing, addProject, updateProject, openProject, setEditing)} />}
    </PageShell>
  );
}

function onSave(editing, addProject, updateProject, openProject, setEditing) {
  return (data) => {
    if (editing.id) updateProject(editing.id, data);
    else { const id = addProject(data); openProject(id); }
    setEditing(null);
  };
}

function Empty({ onNew }) {
  return (
    <div className="desk-card border border-dashed border-slate-700/80 rounded-xl p-8 lg:p-12 text-center bg-slate-950/40">
      <FolderKanban className="mx-auto text-slate-600 mb-3" size={36} />
      <div className="text-slate-200 font-medium text-base lg:text-lg">No projects yet</div>
      <div className="text-sm text-slate-500 mb-5">Create a project to start a takeoff and price it out.</div>
      <button onClick={onNew} className="desk-btn-primary inline-flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-md font-medium">
        <Plus size={16} /> New project
      </button>
    </div>
  );
}

function ProjectForm({ project, clients, onCancel, onSave }) {
  const [f, setF] = useState({
    name: project.name || "",
    clientId: project.clientId || "",
    address: project.address || "",
    status: project.status || "active",
  });
  const [trades, setTrades] = useState(DEFAULT_TRADES);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleTrade = (t) => setTrades((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-6" onClick={onCancel}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg p-5 lg:p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-4">
          <b className="text-base lg:text-lg">{project.id ? "Edit project" : "New project"}</b>
          <div className="flex-1" />
          <button onClick={onCancel} className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
          <Field label="Project name" className="lg:col-span-2">
            <input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} className="input h-10" placeholder="e.g. Chipotle #6277 shell" />
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
                  <input type="checkbox" checked={trades.includes(t)} onChange={() => toggleTrade(t)} className="accent-brand" />
                  <span className="truncate">{ASSEMBLIES[t]?.name || t}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-800">
          <button onClick={onCancel} className="text-sm px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 h-10">Cancel</button>
          <button onClick={() => onSave({ ...f, name: f.name.trim() || "Untitled project", clientId: f.clientId || null, ...(project.id ? {} : { trades }) })}
            className="desk-btn-primary text-sm px-4 h-10 rounded-md font-medium">Save</button>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children, className = "" }) => (
  <label className={`flex flex-col gap-1.5 ${className}`}>
    <span className="text-xs text-slate-400 font-medium">{label}</span>
    {children}
  </label>
);
