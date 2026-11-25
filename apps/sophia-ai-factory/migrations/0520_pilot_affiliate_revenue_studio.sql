-- Migration 0520: Pilot Affiliate Revenue Studio (Crypto & SaaS Affiliate Offers, Campaigns & Partner Performance Reports)
--
-- Additive, idempotent D1 migration supporting the Affiliate Campaign Studio
-- vertical slice on the isolated Private Beta database (`sophia-pilot-db`) while
-- remaining 100% compatible with canonical Domain B reconciliation (`workspace_external_commissions`).
--
-- Invariants enforced at the DB boundary:
--   1. Strict `(org_id, user_id)` / `tenant_id` isolation across every table.
--   2. Domain B `workspace_external_commissions` (`platform_fee_cents = 0`) is ensured
--      present so `fetchWorkspaceDomainBReconciliation` runs against real D1 rows.
--   3. Partner performance entries deduplicate per workspace `(org_id, external_ref_id)`
--      so `pilot_affiliate_performance_entries` stays 1:1 aligned with `workspace_external_commissions`.

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
CREATE INDEX IF NOT EXISTS idx_ws_external_commissions_tenant_time
  ON workspace_external_commissions(tenant_id, occurred_at);

CREATE TABLE IF NOT EXISTS pilot_affiliate_offers (
  id                    TEXT PRIMARY KEY,
  org_id                TEXT NOT NULL,
  user_id               TEXT NOT NULL,
  vertical              TEXT NOT NULL CHECK (vertical IN ('crypto', 'saas')),
  product_name          TEXT NOT NULL,
  official_website_url  TEXT NOT NULL,
  referral_url          TEXT NOT NULL,
  commission_terms      TEXT NOT NULL,
  target_audience       TEXT NOT NULL,
  target_market         TEXT NOT NULL,
  product_info_source   TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at_iso        TEXT NOT NULL,
  updated_at_iso        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pilot_aff_offers_org_user_created
  ON pilot_affiliate_offers(org_id, user_id, created_at_iso DESC);

CREATE TABLE IF NOT EXISTS pilot_affiliate_campaigns (
  id                    TEXT PRIMARY KEY,
  org_id                TEXT NOT NULL,
  user_id               TEXT NOT NULL,
  offer_id              TEXT NOT NULL,
  idempotency_key       TEXT NOT NULL,
  payload_hash          TEXT NOT NULL,
  vertical              TEXT NOT NULL CHECK (vertical IN ('crypto', 'saas')),
  campaign_name         TEXT NOT NULL,
  referral_url          TEXT NOT NULL,
  target_market         TEXT NOT NULL,
  provenance            TEXT NOT NULL CHECK (provenance IN ('fixture_simulated', 'live_provider')),
  provenance_label      TEXT NOT NULL,
  review_state          TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (review_state IN ('pending_review', 'approved', 'rejected')),
  version               INTEGER NOT NULL DEFAULT 1,
  campaign_pack_json    TEXT NOT NULL,
  estimated_ai_cost_microusd INTEGER NOT NULL DEFAULT 0,
  approved_at_iso       TEXT,
  approved_by_user_id   TEXT,
  rejected_at_iso       TEXT,
  rejection_reason      TEXT,
  created_at_iso        TEXT NOT NULL,
  updated_at_iso        TEXT NOT NULL,
  UNIQUE (org_id, user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_pilot_aff_campaigns_org_user_created
  ON pilot_affiliate_campaigns(org_id, user_id, created_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_pilot_aff_campaigns_offer
  ON pilot_affiliate_campaigns(org_id, offer_id);

CREATE TABLE IF NOT EXISTS pilot_affiliate_performance_entries (
  id                        TEXT PRIMARY KEY,
  org_id                    TEXT NOT NULL,
  user_id                   TEXT NOT NULL,
  campaign_id               TEXT NOT NULL,
  offer_id                  TEXT NOT NULL,
  report_source             TEXT NOT NULL,
  report_period             TEXT NOT NULL,
  external_ref_id           TEXT NOT NULL,
  clicks_count              INTEGER,
  signups_count             INTEGER NOT NULL DEFAULT 0,
  qualified_conversions     INTEGER NOT NULL DEFAULT 0,
  pending_commission_cents  INTEGER NOT NULL DEFAULT 0,
  confirmed_commission_cents INTEGER NOT NULL DEFAULT 0,
  currency                  TEXT NOT NULL DEFAULT 'USD',
  notes                     TEXT,
  created_at_iso            TEXT NOT NULL,
  updated_at_iso            TEXT NOT NULL,
  UNIQUE (org_id, external_ref_id)
);

CREATE INDEX IF NOT EXISTS idx_pilot_aff_perf_org_user_created
  ON pilot_affiliate_performance_entries(org_id, user_id, created_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_pilot_aff_perf_campaign
  ON pilot_affiliate_performance_entries(org_id, campaign_id);
