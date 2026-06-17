-- Migration: 0124_org_quota_overrides
-- Description: Allow custom per-org quota overrides (missions, credentials, members, webhooks, apiKeys)
-- Created: 2026-06-17 for Phase 5 (Per-Organization Quotas)

CREATE TABLE IF NOT EXISTS org_quota_overrides (
  org_id TEXT NOT NULL PRIMARY KEY,
  missions INTEGER NOT NULL,
  credentials INTEGER NOT NULL,
  members INTEGER NOT NULL,
  webhooks INTEGER NOT NULL,
  api_keys INTEGER NOT NULL,
  set_by TEXT NOT NULL,
  set_at INTEGER NOT NULL,
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
  FOREIGN KEY (set_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_org_quota_overrides_org_id ON org_quota_overrides(org_id);
