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
--   4. Safely backfills unambiguous historical `workspace_external_commissions.external_tx_id`
--      rows for `network = 'customer_partner_report'` by joining with
--      `pilot_affiliate_performance_entries` where `COUNT(DISTINCT user_id) = 1` for
--      `(org_id, external_ref_id)` and the target scoped key does not collide.
--      Ambiguous or orphaned legacy rows are left untouched (never guessed, never deleted).

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS workspace_external_commissions (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  campaign_id           TEXT,
  network               TEXT NOT NULL,
  niche                 TEXT NOT NULL DEFAULT 'saas_global',
  external_tx_id        TEXT NOT NULL,
  sub_id                TEXT,
  event_type            TEXT NOT NULL,
  status                TEXT NOT NULL
    CHECK (status IN ('pending', 'approved', 'paid_receipt', 'reversed')),
  gross_amount_cents    INTEGER NOT NULL DEFAULT 0,
  commission_cents      INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents    INTEGER NOT NULL DEFAULT 0
    CHECK (platform_fee_cents = 0),
  currency              TEXT NOT NULL DEFAULT 'USD',
  is_recurring          INTEGER NOT NULL DEFAULT 0,
  raw_payload           TEXT,
  occurred_at           INTEGER NOT NULL,
  created_at            INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ws_external_commissions_lifecycle
  ON workspace_external_commissions(tenant_id, network, external_tx_id, status);

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

-- Safely backfill unambiguous historical workspace_external_commissions.external_tx_id
-- rows (legacy unprefixed `${external_ref_id}:pending|confirmed` -> `${user_id}:${external_ref_id}:pending|confirmed`).
-- Only updates rows where:
--   1. network = 'customer_partner_report'
--   2. Exactly 1 distinct user_id owns (org_id, external_ref_id) in pilot_affiliate_performance_entries
--   3. The row is not already prefixed with `${user_id}:`
--   4. The target scoped (tenant_id, network, external_tx_id, status) does not already exist (no collision)
UPDATE workspace_external_commissions
SET external_tx_id = (
  SELECT p.user_id || ':' || workspace_external_commissions.external_tx_id
  FROM pilot_affiliate_performance_entries p
  WHERE p.org_id = workspace_external_commissions.tenant_id
    AND (
      workspace_external_commissions.external_tx_id = p.external_ref_id || ':pending'
      OR workspace_external_commissions.external_tx_id = p.external_ref_id || ':confirmed'
    )
  LIMIT 1
)
WHERE network = 'customer_partner_report'
  AND (
    external_tx_id LIKE '%:pending'
    OR external_tx_id LIKE '%:confirmed'
  )
  AND (
    SELECT COUNT(DISTINCT p.user_id)
    FROM pilot_affiliate_performance_entries p
    WHERE p.org_id = workspace_external_commissions.tenant_id
      AND (
        workspace_external_commissions.external_tx_id = p.external_ref_id || ':pending'
        OR workspace_external_commissions.external_tx_id = p.external_ref_id || ':confirmed'
      )
  ) = 1
  AND NOT EXISTS (
    SELECT 1
    FROM workspace_external_commissions existing
    WHERE existing.tenant_id = workspace_external_commissions.tenant_id
      AND existing.network = workspace_external_commissions.network
      AND existing.status = workspace_external_commissions.status
      AND existing.external_tx_id = (
        SELECT p.user_id || ':' || workspace_external_commissions.external_tx_id
        FROM pilot_affiliate_performance_entries p
        WHERE p.org_id = workspace_external_commissions.tenant_id
          AND (
            workspace_external_commissions.external_tx_id = p.external_ref_id || ':pending'
            OR workspace_external_commissions.external_tx_id = p.external_ref_id || ':confirmed'
          )
        LIMIT 1
      )
  );

PRAGMA foreign_keys = ON;
