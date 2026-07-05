import { useState } from "react";
import { Plus, Users, Pencil, Trash2, X, Mail, Phone, FolderKanban } from "lucide-react";
import { useStore } from "../store/useStore.js";
import PageShell from "./PageShell.jsx";

export default function ClientsPage() {
  const { clients, projects, addClient, updateClient, deleteClient } = useStore();
  const [editing, setEditing] = useState(null);
  const projectCount = (id) => projects.filter((p) => p.clientId === id).length;

  return (
    <PageShell
      title="Clients"
      icon={Users}
      subtitle="Contacts linked to projects and proposals."
      stats={clients.length ? [
        { label: "Clients", value: clients.length },
        { label: "Projects", value: projects.length },
        { label: "With email", value: clients.filter((c) => c.email).length },
        { label: "With phone", value: clients.filter((c) => c.phone).length },
      ] : []}
      toolbar={(
        <button onClick={() => setEditing({})} className="desk-btn-primary flex items-center gap-1.5 text-sm px-4 h-10 lg:h-9 rounded-md font-medium">
          <Plus size={16} /> New client
        </button>
      )}
    >
      {clients.length === 0 ? (
        <div className="desk-card border border-dashed border-slate-700/80 rounded-xl p-8 lg:p-12 text-center bg-slate-950/40">
          <Users className="mx-auto text-slate-600 mb-3" size={36} />
          <div className="text-slate-200 font-medium text-base lg:text-lg">No clients yet</div>
          <div className="text-sm text-slate-500 mb-5">Add clients to attach them to projects and proposals.</div>
          <button onClick={() => setEditing({})} className="desk-btn-primary inline-flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-md font-medium">
            <Plus size={16} /> New client
          </button>
        </div>
      ) : (
        <div className="desk-card rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/80 overflow-hidden">
          {clients.map((c) => (
            <div key={c.id} className="group flex items-center gap-3 lg:gap-4 px-4 py-3 lg:py-3.5 hover:bg-slate-900/60 transition-colors">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 font-semibold shrink-0 ring-1 ring-slate-700/50">
                {(c.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-sm lg:text-[15px]">
                  {c.name || "(unnamed)"}
                  {c.company && <span className="text-slate-500 font-normal"> · {c.company}</span>}
                </div>
                <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                  {c.email && <span className="flex items-center gap-1"><Mail size={11} />{c.email}</span>}
                  {c.phone && <span className="flex items-center gap-1"><Phone size={11} />{c.phone}</span>}
                </div>
              </div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0 tabular-nums">
                <FolderKanban size={12} />{projectCount(c.id)}
              </span>
              <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button onClick={() => setEditing(c)} title="Edit" className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"><Pencil size={14} /></button>
                <button onClick={() => confirm(`Delete client “${c.name}”?`) && deleteClient(c.id)} title="Delete" className="p-2 rounded-md bg-slate-800 hover:bg-rose-900/60 text-slate-300"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ClientForm client={editing}
          onCancel={() => setEditing(null)}
          onSave={(data) => {
            if (editing.id) updateClient(editing.id, data);
            else addClient(data);
            setEditing(null);
          }} />
      )}
    </PageShell>
  );
}

function ClientForm({ client, onCancel, onSave }) {
  const [f, setF] = useState({
    name: client.name || "", company: client.company || "", email: client.email || "", phone: client.phone || "",
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-6" onClick={onCancel}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg p-5 lg:p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-4">
          <b className="text-base lg:text-lg">{client.id ? "Edit client" : "New client"}</b>
          <div className="flex-1" />
          <button onClick={onCancel} className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
          <Field label="Name"><input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} className="input h-10" placeholder="Contact name" /></Field>
          <Field label="Company"><input value={f.company} onChange={(e) => set("company", e.target.value)} className="input h-10" placeholder="Company" /></Field>
          <Field label="Email" className="lg:col-span-2"><input value={f.email} onChange={(e) => set("email", e.target.value)} className="input h-10" placeholder="name@company.com" /></Field>
          <Field label="Phone" className="lg:col-span-2"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} className="input h-10" placeholder="(419) 555-0100" /></Field>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-800">
          <button onClick={onCancel} className="text-sm px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 h-10">Cancel</button>
          <button onClick={() => onSave({ ...f, name: f.name.trim() || "Unnamed client" })}
            className="desk-btn-primary text-sm px-4 h-10 rounded-md font-medium">Save</button>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children, className = "" }) => (
  <label className={`flex flex-col gap-1.5 ${className}`}><span className="text-xs text-slate-400 font-medium">{label}</span>{children}</label>
);
