-- Migration: tenant storage usage tracking
-- Phase 11: Tenant Isolation + Quota Tiers

CREATE TABLE IF NOT EXISTS tenant_storage_usage (
  tenant_id TEXT PRIMARY KEY,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  video_count INTEGER NOT NULL DEFAULT 0,
  last_calculated_at INTEGER NOT NULL DEFAULT 0,
  breakdown_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenant_storage_last_calc ON tenant_storage_usage(last_calculated_at);
