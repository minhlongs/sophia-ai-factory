-- Migration 0522: Scope pilot_affiliate_performance_entries uniqueness to (org_id, user_id, external_ref_id)
--
-- Fixes Issue #213: Migration 0520 defined UNIQUE (org_id, external_ref_id) on
-- pilot_affiliate_performance_entries, which caused cross-user collisions and
-- unauthorized readback when two users in the same organization submitted the
-- same external_ref_id.
--
-- Safety guarantees:
--   1. Additive / non-destructive table rebuild: preserves 100% of existing rows,
--      row counts, and financial totals (pending_commission_cents, confirmed_commission_cents).
--   2. Relaxing UNIQUE (org_id, external_ref_id) -> UNIQUE (org_id, user_id, external_ref_id)
--      cannot introduce uniqueness conflicts on existing data because every existing
--      (org_id, external_ref_id) pair is already unique.
--   3. Safe to re-run (idempotent) and safe on both upgraded and clean databases.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS pilot_affiliate_performance_entries (
  id                         TEXT PRIMARY KEY,
  org_id                     TEXT NOT NULL,
  user_id                    TEXT NOT NULL,
  campaign_id                TEXT NOT NULL,
  offer_id                   TEXT NOT NULL,
  report_source              TEXT NOT NULL,
  report_period              TEXT NOT NULL,
  external_ref_id            TEXT NOT NULL,
  clicks_count               INTEGER,
  signups_count              INTEGER NOT NULL DEFAULT 0,
  qualified_conversions      INTEGER NOT NULL DEFAULT 0,
  pending_commission_cents   INTEGER NOT NULL DEFAULT 0,
  confirmed_commission_cents INTEGER NOT NULL DEFAULT 0,
  currency                   TEXT NOT NULL DEFAULT 'USD',
  notes                      TEXT,
  created_at_iso             TEXT NOT NULL,
  updated_at_iso             TEXT NOT NULL,
  UNIQUE (org_id, user_id, external_ref_id)
);

DROP TABLE IF EXISTS pilot_affiliate_performance_entries_v2;

CREATE TABLE pilot_affiliate_performance_entries_v2 (
  id                         TEXT PRIMARY KEY,
  org_id                     TEXT NOT NULL,
  user_id                    TEXT NOT NULL,
  campaign_id                TEXT NOT NULL,
  offer_id                   TEXT NOT NULL,
  report_source              TEXT NOT NULL,
  report_period              TEXT NOT NULL,
  external_ref_id            TEXT NOT NULL,
  clicks_count               INTEGER,
  signups_count              INTEGER NOT NULL DEFAULT 0,
  qualified_conversions      INTEGER NOT NULL DEFAULT 0,
  pending_commission_cents   INTEGER NOT NULL DEFAULT 0,
  confirmed_commission_cents INTEGER NOT NULL DEFAULT 0,
  currency                   TEXT NOT NULL DEFAULT 'USD',
  notes                      TEXT,
  created_at_iso             TEXT NOT NULL,
  updated_at_iso             TEXT NOT NULL,
  UNIQUE (org_id, user_id, external_ref_id)
);

INSERT INTO pilot_affiliate_performance_entries_v2 (
  id,
  org_id,
  user_id,
  campaign_id,
  offer_id,
  report_source,
  report_period,
  external_ref_id,
  clicks_count,
  signups_count,
  qualified_conversions,
  pending_commission_cents,
  confirmed_commission_cents,
  currency,
  notes,
  created_at_iso,
  updated_at_iso
)
SELECT
  id,
  org_id,
  user_id,
  campaign_id,
  offer_id,
  report_source,
  report_period,
  external_ref_id,
  clicks_count,
  signups_count,
  qualified_conversions,
  pending_commission_cents,
  confirmed_commission_cents,
  currency,
  notes,
  created_at_iso,
  updated_at_iso
FROM pilot_affiliate_performance_entries;

DROP TABLE pilot_affiliate_performance_entries;
ALTER TABLE pilot_affiliate_performance_entries_v2 RENAME TO pilot_affiliate_performance_entries;

CREATE INDEX IF NOT EXISTS idx_pilot_aff_perf_org_user_created
  ON pilot_affiliate_performance_entries(org_id, user_id, created_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_pilot_aff_perf_campaign
  ON pilot_affiliate_performance_entries(org_id, campaign_id);

PRAGMA foreign_keys = ON;
