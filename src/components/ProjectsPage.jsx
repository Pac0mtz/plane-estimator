import { useState } from "react";
import { Plus, FolderKanban, Pencil, Trash2, ArrowRight, X, Building2 } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { ASSEMBLIES } from "../lib/assemblies.js";
import { isFieldTaskProEmbed, shouldShowAddress, projectCardTitle } from "../lib/embed.js";

// trades offered when scoping a new project (assembly keys from the price book)
const TRADE_OPTIONS = ["slab", "footing", "brick", "cmu", "eifs", "roofing", "drywall", "storefront", "doors", "windows", "woodfence", "chainlink", "fencegate", "sitewall", "act", "paint", "flooring", "lighting", "device", "fixtures", "rtu"];
const DEFAULT_TRADES = ["brick", "eifs", "drywall", "slab", "doors"];

const STATUSES = ["active", "bidding", "won", "archived"];
const statusTone = {
  active: "bg-blue-900/50 text-blue-300",
  bidding: "bg-amber-900/50 text-amber-300",
  won: "bg-emerald-900/50 text-emerald-300",
  archived: "bg-slate-800 text-slate-400",
};

function traceCount(project) {
  return project.takeoff?.traces?.length || 0;
}

export default function ProjectsPage() {
  const embedded = isFieldTaskProEmbed();
  const { projects, clients, addProject, updateProject, deleteProject, openProject } = useStore();
  const [editing, setEditing] = useState(null); // project object or {} for new

  const clientName = (id) => clients.find((c) => c.id === id)?.name || "No client";

  return (
    <div className={`flex-1 overflow-y-auto ${embedded ? "p-0" : "p-4 md:p-6"}`}>
      {!embedded && (
      <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-5 max-w-5xl mx-auto w-full">
        <FolderKanban className="text-brand shrink-0" />
        <h1 className="text-lg md:text-xl font-bold">Projects</h1>
        <div className="flex-1" />
        <button onClick={() => setEditing({})}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded bg-brand hover:bg-brand2 font-medium">
          <Plus size={16} /> New project
        </button>
      </div>
      )}

      <div className={`${embedded ? "w-full" : "max-w-5xl mx-auto w-full"}`}>
        {projects.length === 0 ? (
          <Empty onNew={() => setEditing({})} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => {
              const title = projectCardTitle(p);
              return (
              <div
                key={p.id}
                className="bg-card text-card-foreground border border-border/50 transition-all duration-200 document-shell-outer-card shadow-none hover:shadow-none rounded-[var(--radius,0.5rem)] overflow-hidden cursor-pointer hover:border-primary/40 flex flex-col min-h-0"
                onClick={() => openProject(p.id)}
              >
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="flex-1 min-w-0">
                      {title && (
                        <div className="font-semibold text-sm truncate">{title}</div>
                      )}
                      <div className={`text-xs text-muted-foreground flex items-center gap-1 truncate ${title ? "mt-0.5" : ""}`}>
                        <Building2 size={12} className="shrink-0" /> {clientName(p.clientId)}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize shrink-0 ${statusTone[p.status] || statusTone.active}`}>{p.status}</span>
                  </div>
                  {shouldShowAddress(p) && (
                    <div className="text-xs text-muted-foreground truncate">{p.address}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    {traceCount(p)} trace{traceCount(p) === 1 ? "" : "s"} · updated {new Date(p.updatedAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openProject(p.id)}
                      className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded bg-brand hover:bg-brand2 font-medium text-white">
                      Open <ArrowRight size={13} />
                    </button>
                    <button onClick={() => setEditing(p)} title="Edit" className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"><Pencil size={14} /></button>
                    <button onClick={() => confirm(`Delete “${p.name}”?`) && deleteProject(p.id)} title="Delete" className="p-1.5 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );})}
          </div>
        )}
      </div>

      {editing && (
        <ProjectForm project={editing} clients={clients}
          onCancel={() => setEditing(null)}
          onSave={(data) => {
            if (editing.id) updateProject(editing.id, data);
            else { const id = addProject(data); openProject(id); }
            setEditing(null);
          }} />
      )}
    </div>
  );
}

function Empty({ onNew }) {
  return (
    <div className="border border-dashed border-border/50 rounded-[var(--radius,0.5rem)] p-12 text-center bg-card/30">
      <FolderKanban className="mx-auto text-slate-600 mb-3" size={36} />
      <div className="text-slate-300 font-medium">No projects yet</div>
      <div className="text-sm text-slate-500 mb-4">Create a project to start a takeoff and price it out.</div>
      <button onClick={onNew} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded bg-brand hover:bg-brand2 font-medium">
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onCancel}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-3">
          <b>{project.id ? "Edit project" : "New project"}</b>
          <div className="flex-1" />
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <Field label="Project name">
            <input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} className="input" placeholder="e.g. Chipotle #6277 shell" />
          </Field>
          <Field label="Client">
            <select value={f.clientId} onChange={(e) => set("clientId", e.target.value)} className="input">
              <option value="">— none —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name || "(unnamed)"}</option>)}
            </select>
          </Field>
          <Field label="Address">
            <input value={f.address} onChange={(e) => set("address", e.target.value)} className="input" placeholder="Site address" />
          </Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => set("status", e.target.value)} className="input capitalize">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          {!project.id && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-400">Trades to include <span className="text-slate-600">({trades.length})</span></span>
              <div className="grid grid-cols-2 gap-1 max-h-44 overflow-y-auto pr-1">
                {TRADE_OPTIONS.map((t) => (
                  <label key={t} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded cursor-pointer ${trades.includes(t) ? "bg-slate-800 text-slate-100" : "bg-slate-950 text-slate-400 hover:bg-slate-800"}`}>
                    <input type="checkbox" checked={trades.includes(t)} onChange={() => toggleTrade(t)} className="accent-brand" />
                    <span className="truncate">{ASSEMBLIES[t]?.name || t}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700">Cancel</button>
          <button onClick={() => onSave({ ...f, name: f.name.trim() || "Untitled project", clientId: f.clientId || null, ...(project.id ? {} : { trades }) })}
            className="text-sm px-3 py-1.5 rounded bg-brand hover:bg-brand2 font-medium">Save</button>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs text-slate-400">{label}</span>
    {children}
  </label>
);
