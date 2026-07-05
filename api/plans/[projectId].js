import { loadPlan, savePlan, deletePlan } from "../server/plans.js";
import { deleteProject } from "../server/workspace.js";

export const config = { api: { bodyParser: false } };

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const projectId = req.query.projectId;
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });

  try {
    if (req.method === "GET") {
      const plan = await loadPlan(projectId);
      if (!plan) return res.status(404).json({ error: "No plan saved" });
      res.setHeader("Content-Type", plan.kind === "pdf" ? "application/pdf" : "application/octet-stream");
      res.setHeader("X-File-Name", encodeURIComponent(plan.fileName));
      res.setHeader("X-Plan-Kind", plan.kind);
      res.setHeader("X-Plan-Meta", encodeURIComponent(JSON.stringify(plan.planMeta)));
      return res.status(200).send(plan.buffer);
    }

    if (req.method === "PUT") {
      const body = await readBody(req);
      const fileName = decodeURIComponent(req.headers["x-file-name"] || "plan");
      const kind = req.headers["x-plan-kind"];
      const planMeta = JSON.parse(decodeURIComponent(req.headers["x-plan-meta"] || "{}"));
      if (!kind || !body.length) return res.status(400).json({ error: "Missing plan file or kind" });
      await savePlan(projectId, body, { fileName, kind, planMeta });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      await deletePlan(projectId);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
