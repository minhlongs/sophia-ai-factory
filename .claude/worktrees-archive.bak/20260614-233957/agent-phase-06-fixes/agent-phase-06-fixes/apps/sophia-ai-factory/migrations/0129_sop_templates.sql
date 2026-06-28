-- Migration: sop_graph_templates
-- Stores serialized SOPGraph definitions for DAG-based parallel execution.
-- Separate from sop_templates (marketplace templates with playbooks).

CREATE TABLE IF NOT EXISTS sop_graph_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  graph_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  category TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sop_graph_templates_active ON sop_graph_templates(is_active, category);
CREATE INDEX IF NOT EXISTS idx_sop_graph_templates_creator ON sop_graph_templates(created_by, updated_at DESC);
