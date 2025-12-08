-- =============================================
-- Build Lab Database Schema
-- =============================================
-- Run this in Supabase SQL Editor: supabase.com → SQL Editor

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_id TEXT UNIQUE NOT NULL,
  app_name TEXT NOT NULL,
  email TEXT NOT NULL,
  founder_name TEXT,
  problem TEXT,
  features TEXT[],
  integrations TEXT[],
  template TEXT NOT NULL,
  timeline TEXT DEFAULT '72h',
  price INTEGER DEFAULT 2500,
  status TEXT DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  deployed_url TEXT,
  github_branch TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_projects_project_id ON projects(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_email ON projects(email);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_template ON projects(template);

-- Event log for debugging and activity tracking
CREATE TABLE IF NOT EXISTS project_events (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_project ON project_events(project_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON project_events(created_at DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_events ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations from service role (API)
CREATE POLICY "Service role full access to projects" ON projects
  FOR ALL USING (true);

CREATE POLICY "Service role full access to events" ON project_events
  FOR ALL USING (true);

-- =============================================
-- Useful queries for analytics
-- =============================================

-- Total projects by status
-- SELECT status, COUNT(*) FROM projects GROUP BY status;

-- Projects by template
-- SELECT template, COUNT(*) FROM projects GROUP BY template;

-- Conversion rate (deployed / total)
-- SELECT
--   COUNT(*) FILTER (WHERE status = 'deployed') as deployed,
--   COUNT(*) as total,
--   ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'deployed') / COUNT(*), 2) as conversion_rate
-- FROM projects;

-- Average time to deploy
-- SELECT
--   AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60) as avg_minutes
-- FROM projects
-- WHERE status = 'deployed';

-- Recent projects
-- SELECT project_id, app_name, status, created_at
-- FROM projects
-- ORDER BY created_at DESC
-- LIMIT 20;

-- =============================================
-- Feature Flags
-- =============================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  disabled_reason TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flags_name ON feature_flags(name);

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to flags" ON feature_flags
  FOR ALL USING (true);

-- Initialize default flags (all templates enabled)
INSERT INTO feature_flags (name, enabled) VALUES
  ('contractor-crm', true),
  ('freelancer-invoices', true),
  ('booking-platform', true),
  ('agency-dashboard', true),
  ('basic-crud', true)
ON CONFLICT (name) DO NOTHING;
