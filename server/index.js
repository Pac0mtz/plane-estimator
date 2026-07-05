import "dotenv/config";
import express from "express";
import cors from "cors";
import { dbConfigured } from "./db.js";
import { pullWorkspace, pushWorkspace, deleteClient, deleteProject } from "./workspace.js";
import { loadPlan, savePlan, deletePlan } from "./plans.js";

const app = express();
const PORT = process.env.API_PORT || 8787;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, db: dbConfigured() });
});

app.get("/api/workspace", async (_req, res) => {
  try {
    res.json(await pullWorkspace());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/workspace", async (req, res) => {
  try {
    await pushWorkspace(req.body || {});
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/clients/:id", async (req, res) => {
  try {
    await deleteClient(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/projects/:id", async (req, res) => {
  try {
    await deletePlan(req.params.id);
    await deleteProject(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Plan file: raw body + metadata headers
app.get("/api/plans/:projectId", async (req, res) => {
  try {
    const plan = await loadPlan(req.params.projectId);
    if (!plan) return res.status(404).json({ error: "No plan saved" });
    res.setHeader("Content-Type", plan.kind === "pdf" ? "application/pdf" : "application/octet-stream");
    res.setHeader("X-File-Name", encodeURIComponent(plan.fileName));
    res.setHeader("X-Plan-Kind", plan.kind);
    res.setHeader("X-Plan-Meta", encodeURIComponent(JSON.stringify(plan.planMeta)));
    res.send(plan.buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/plans/:projectId", express.raw({ type: "*/*", limit: "200mb" }), async (req, res) => {
  try {
    const fileName = decodeURIComponent(req.headers["x-file-name"] || "plan");
    const kind = req.headers["x-plan-kind"];
    const planMeta = JSON.parse(decodeURIComponent(req.headers["x-plan-meta"] || "{}"));
    if (!kind || !req.body?.length) return res.status(400).json({ error: "Missing plan file or kind" });
    await savePlan(req.params.projectId, req.body, { fileName, kind, planMeta });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/plans/:projectId", async (req, res) => {
  try {
    await deletePlan(req.params.projectId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (!dbConfigured()) {
  console.warn("DATABASE_URL not set — API will error until Neon is configured.");
}

app.listen(PORT, () => {
  console.log(`Plan Forge API on http://localhost:${PORT} (Neon: ${dbConfigured() ? "yes" : "no"})`);
});
