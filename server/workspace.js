import { getSql } from "./db.js";

const SETTINGS_KEY = "workspace";

function rowToClient(r) {
  return { id: r.id, name: r.name, company: r.company, email: r.email, phone: r.phone };
}

function rowToProject(r) {
  return {
    id: r.id,
    name: r.name,
    clientId: r.client_id,
    address: r.address,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    takeoff: r.takeoff || {},
  };
}

export async function pullWorkspace() {
  const sql = getSql();
  const [clients, projects, settings] = await Promise.all([
    sql`SELECT * FROM clients ORDER BY updated_at DESC`,
    sql`SELECT * FROM projects ORDER BY updated_at DESC`,
    sql`SELECT value FROM app_settings WHERE key = ${SETTINGS_KEY}`,
  ]);
  return {
    clients: clients.map(rowToClient),
    projects: projects.map(rowToProject),
    settings: settings[0]?.value || null,
  };
}

export async function pushWorkspace({ clients = [], projects = [], settings = null }) {
  const sql = getSql();
  for (const c of clients) {
    await sql`
      INSERT INTO clients (id, name, company, email, phone, updated_at)
      VALUES (${c.id}, ${c.name || ""}, ${c.company || ""}, ${c.email || ""}, ${c.phone || ""}, ${c.updatedAt || new Date().toISOString()})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, company = EXCLUDED.company, email = EXCLUDED.email,
        phone = EXCLUDED.phone, updated_at = EXCLUDED.updated_at
    `;
  }
  for (const p of projects) {
    await sql`
      INSERT INTO projects (id, name, client_id, address, status, takeoff, created_at, updated_at)
      VALUES (
        ${p.id}, ${p.name || "Untitled project"}, ${p.clientId || null}, ${p.address || ""},
        ${p.status || "active"}, ${JSON.stringify(p.takeoff || {})}::jsonb,
        ${p.createdAt || new Date().toISOString()}, ${p.updatedAt || new Date().toISOString()}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, client_id = EXCLUDED.client_id, address = EXCLUDED.address,
        status = EXCLUDED.status, takeoff = EXCLUDED.takeoff, updated_at = EXCLUDED.updated_at
    `;
  }
  if (settings) {
    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (${SETTINGS_KEY}, ${JSON.stringify(settings)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
  }
}

export async function deleteClient(id) {
  const sql = getSql();
  await sql`DELETE FROM clients WHERE id = ${id}`;
}

export async function deleteProject(id) {
  const sql = getSql();
  await sql`DELETE FROM projects WHERE id = ${id}`;
}

export async function pushProject(project) {
  await pushWorkspace({ clients: [], projects: [project], settings: null });
}
