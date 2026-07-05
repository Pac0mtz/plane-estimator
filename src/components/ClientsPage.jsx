import { useState } from "react";
import { Plus, Users, Pencil, Trash2, X, Mail, Phone, FolderKanban } from "lucide-react";
import { useStore } from "../store/useStore.js";

export default function ClientsPage() {
  const { clients, projects, addClient, updateClient, deleteClient } = useStore();
  const [editing, setEditing] = useState(null);

  const projectCount = (id) => projects.filter((p) => p.clientId === id).length;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-5 max-w-4xl mx-auto w-full">
        <Users className="text-brand shrink-0" />
        <h1 className="text-lg md:text-xl font-bold">Clients</h1>
        <div className="flex-1" />
        <button onClick={() => setEditing({})}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded bg-brand hover:bg-brand2 font-medium">
          <Plus size={16} /> New client
        </button>
      </div>

      <div className="max-w-4xl mx-auto w-full">
        {clients.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-lg p-12 text-center">
            <Users className="mx-auto text-slate-600 mb-3" size={36} />
            <div className="text-slate-300 font-medium">No clients yet</div>
            <div className="text-sm text-slate-500 mb-4">Add clients to attach them to projects and proposals.</div>
            <button onClick={() => setEditing({})} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded bg-brand hover:bg-brand2 font-medium">
              <Plus size={16} /> New client
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-900 divide-y divide-slate-800">
            {clients.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3">
                <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-semibold shrink-0">
                  {(c.name || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name || "(unnamed)"} {c.company && <span className="text-slate-500 font-normal">· {c.company}</span>}</div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-3">
                    {c.email && <span className="flex items-center gap-1"><Mail size={11} />{c.email}</span>}
                    {c.phone && <span className="flex items-center gap-1"><Phone size={11} />{c.phone}</span>}
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 flex items-center gap-1"><FolderKanban size={12} />{projectCount(c.id)}</span>
                <button onClick={() => setEditing(c)} title="Edit" className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"><Pencil size={14} /></button>
                <button onClick={() => confirm(`Delete client “${c.name}”?`) && deleteClient(c.id)} title="Delete" className="p-1.5 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <ClientForm client={editing}
          onCancel={() => setEditing(null)}
          onSave={(data) => {
            if (editing.id) updateClient(editing.id, data);
            else addClient(data);
            setEditing(null);
          }} />
      )}
    </div>
  );
}

function ClientForm({ client, onCancel, onSave }) {
  const [f, setF] = useState({
    name: client.name || "", company: client.company || "", email: client.email || "", phone: client.phone || "",
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onCancel}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-3">
          <b>{client.id ? "Edit client" : "New client"}</b>
          <div className="flex-1" />
          <button onClick={onCancel} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <Field label="Name"><input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} className="input" placeholder="Contact name" /></Field>
          <Field label="Company"><input value={f.company} onChange={(e) => set("company", e.target.value)} className="input" placeholder="Company" /></Field>
          <Field label="Email"><input value={f.email} onChange={(e) => set("email", e.target.value)} className="input" placeholder="name@company.com" /></Field>
          <Field label="Phone"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} className="input" placeholder="(419) 555-0100" /></Field>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700">Cancel</button>
          <button onClick={() => onSave({ ...f, name: f.name.trim() || "Unnamed client" })}
            className="text-sm px-3 py-1.5 rounded bg-brand hover:bg-brand2 font-medium">Save</button>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <label className="flex flex-col gap-1"><span className="text-xs text-slate-400">{label}</span>{children}</label>
);
