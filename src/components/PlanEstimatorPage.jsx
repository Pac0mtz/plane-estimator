import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { ASSEMBLIES } from "../lib/assemblies.js";
import { cleanProjectTitle, isFieldTaskProEmbed } from "../lib/embed.js";
import EstimatorWorkCard from "./EstimatorWorkCard.jsx";

const TRADE_OPTIONS = ["slab", "footing", "brick", "cmu", "eifs", "roofing", "drywall", "storefront", "doors", "windows", "woodfence", "chainlink", "fencegate", "sitewall", "act", "paint", "flooring", "lighting", "device", "fixtures", "rtu"];
const DEFAULT_TRADES = ["brick", "eifs", "drywall", "slab", "doors"];
const STATUSES = ["active", "bidding", "won", "archived"];

function traces(project) {
  return project.takeoff?.traces?.length || 0;
}

/** Short card title — client name only; never repeat the site address. */
function cardTitle(project, clientName) {
  const client = clientName(project.clientId);
  if (client && client !== "No client") return client;
  return cleanProjectTitle(project.name);
}

function matchesSearch(project, clientName, q) {
  if (!q) return true;
  const hay = [
    project.name,
    project.address,
    clientName(project.clientId),
  ].join(" ").toLowerCase();
  return hay.includes(q);
}

/** Plan Estimator page at /plan-estimator — document-shell cards, no duplicate address. */
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

  return (
    <div className="flex flex-col gap-2.5 w-full min-h-0">
      {!embedded && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-md">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search estimator work"
              className="input pl-8 w-full"
            />
          </div>
          <button
            type="button"
            onClick={() => setEditing({})}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded bg-brand hover:bg-brand2 font-medium shrink-0"
          >
            <Plus size={16} /> New estimator work
          </button>
        </div>
      )}

      {embedded && q === "" && projects.length > 0 && (
        <div className="relative max-w-xs w-full max-lg:block lg:hidden">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search estimator work"
            className="input pl-8 w-full text-sm"
          />
        </div>
      )}

      {projects.length === 0 ? (
        <Empty onNew={() => setEditing({})} />
      ) : visible.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">No matches for “{query}”.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

      {editing && (
        <ProjectForm
          project={editing}
          clients={clients}
          onCancel={() => setEditing(null)}
          onSave={(data) => {
            if (editing.id) updateProject(editing.id, data);
            else {
              const id = addProject(data);
              openProject(id);
            }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Empty({ onNew }) {
  return (
    <div className="document-shell-outer-card border border-dashed border-border/50 rounded-[var(--radius,0.5rem)] p-10 text-center bg-card/30">
      <div className="text-slate-300 font-medium mb-1">No estimator work yet</div>
      <div className="text-sm text-slate-500 mb-4">Upload a plan set and start tracing takeoffs.</div>
      <button type="button" onClick={onNew} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded bg-brand hover:bg-brand2 font-medium">
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onCancel}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-3">
          <b>{project.id ? "Edit estimator work" : "New estimator work"}</b>
          <div className="flex-1" />
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} className="input" placeholder="e.g. Shell build-out" />
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
              <span className="text-xs text-slate-400">Trades to include ({trades.length})</span>
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
          <button type="button" onClick={onCancel} className="text-sm px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700">Cancel</button>
          <button
            type="button"
            onClick={() => onSave({ ...f, name: f.name.trim() || f.address?.trim() || "Untitled estimate", clientId: f.clientId || null, ...(project.id ? {} : { trades }) })}
            className="text-sm px-3 py-1.5 rounded bg-brand hover:bg-brand2 font-medium"
          >
            Save
          </button>
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
