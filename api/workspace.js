import { pullWorkspace, pushWorkspace } from "../server/workspace.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json(await pullWorkspace());
    }
    if (req.method === "PUT") {
      await pushWorkspace(req.body || {});
      return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };
