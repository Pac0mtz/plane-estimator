import { deletePlan } from "../server/plans.js";
import { deleteProject } from "../server/workspace.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Missing id" });
  try {
    await deletePlan(id);
    await deleteProject(id);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
