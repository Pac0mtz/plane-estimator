import { dbConfigured } from "../server/db.js";

export default function handler(_req, res) {
  res.status(200).json({ ok: true, db: dbConfigured() });
}
