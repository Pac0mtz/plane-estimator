-- Plan Forge on Neon Postgres
-- Run once in Neon SQL Editor (Console → SQL).

CREATE TABLE IF NOT EXISTS clients (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT 'Untitled project',
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  address text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  takeoff jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON projects(updated_at DESC);

CREATE TABLE IF NOT EXISTS project_plans (
  project_id text PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  file_name text NOT NULL DEFAULT 'plan.pdf',
  kind text NOT NULL CHECK (kind IN ('pdf', 'image')),
  content bytea NOT NULL,
  plan_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
