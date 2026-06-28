-- Migration: video_templates registry
-- Phase 08: Visual Generator — Template + Cinematic paths
-- Mirrors migrations/0033-video-templates.sql (wrangler-discoverable copy)

CREATE TABLE IF NOT EXISTS video_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  duration_sec INTEGER NOT NULL DEFAULT 30,
  brand_bumper_url TEXT,
  transitions_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_video_templates_tenant ON video_templates(tenant_id);
