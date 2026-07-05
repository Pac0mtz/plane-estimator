import { getSql } from "./db.js";

export async function loadPlan(projectId) {
  const sql = getSql();
  const rows = await sql`
    SELECT file_name, kind, content, plan_meta
    FROM project_plans WHERE project_id = ${projectId}
  `;
  const row = rows[0];
  if (!row) return null;
  const buffer = row.content instanceof Uint8Array ? Buffer.from(row.content) : row.content;
  return {
    fileName: row.file_name,
    kind: row.kind,
    planMeta: row.plan_meta,
    buffer,
  };
}

export async function savePlan(projectId, buffer, { fileName, kind, planMeta }) {
  const sql = getSql();
  await sql`
    INSERT INTO project_plans (project_id, file_name, kind, content, plan_meta, updated_at)
    VALUES (
      ${projectId}, ${fileName || "plan"}, ${kind},
      ${buffer}, ${JSON.stringify(planMeta || {})}::jsonb, now()
    )
    ON CONFLICT (project_id) DO UPDATE SET
      file_name = EXCLUDED.file_name,
      kind = EXCLUDED.kind,
      content = EXCLUDED.content,
      plan_meta = EXCLUDED.plan_meta,
      updated_at = now()
  `;
}

export async function deletePlan(projectId) {
  const sql = getSql();
  await sql`DELETE FROM project_plans WHERE project_id = ${projectId}`;
}
