-- 0069-org-branding.sql
-- Per-org branding for video watermarks + email templates.

CREATE TABLE IF NOT EXISTS org_branding (
  org_id              TEXT PRIMARY KEY,
  agency_name         TEXT,
  logo_url            TEXT,
  watermark_position  TEXT NOT NULL DEFAULT 'bottom-right',
  watermark_opacity   REAL NOT NULL DEFAULT 0.85,
  -- 'always' | 'master_plus' | 'never' — controls which tier sees the customer logo
  watermark_policy    TEXT NOT NULL DEFAULT 'master_plus',
  primary_color       TEXT,
  updated_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_org_branding_updated_at ON org_branding(updated_at DESC);
