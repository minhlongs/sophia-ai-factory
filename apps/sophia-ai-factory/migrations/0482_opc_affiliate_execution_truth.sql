-- Migration 0482: OPC affiliate execution truth (D1 / SQLite compatible).
--
-- WHY: several production repositories (approval, postback, reconciliation,
-- execution runs, media artifacts, optimizer feedback) referenced tables that
-- had no DDL in this repository. Without these tables every "success" was a
-- caught DB error or an in-memory fake. This migration creates the durable,
-- tenant-scoped state those contracts require.
--
-- Rules enforced at the DB boundary (not only in TypeScript):
--   * Domain B external affiliate earnings belong 100% to the workspace:
--     `platform_fee_cents` is constrained to 0. This ledger MUST NOT be used
--     for subscription billing, Refer Sophia rewards, or partner payouts.
--   * Every idempotency / exactly-once key is scoped by tenant_id, so tenant A
--     replaying a provider event can never suppress tenant B's event.
--   * An execution run cannot be called `rendered` without a verified media
--     artifact; `artifact_id` stays NULL until `recordVerifiedArtifact`.
--   * Currency is stored per row. There is no FX conversion here and no
--     mixed-currency headline total.
--
-- This script is intentionally rerunnable: every statement uses
-- IF NOT EXISTS / ON CONFLICT DO NOTHING. Tests apply it twice against a
-- database that already has migration 0206 to prove the upgrade path.

-- ---------------------------------------------------------------------------
-- 1. Domain B ledger: workspace-owned external affiliate commissions.
--    Lifecycle rows are deduplicated on (tenant, network, external_tx_id,
--    status). Partial refunds carry an `#adj:` suffix in external_tx_id and are
--    retained as immutable adjustment history, never overwritten.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2. CEO campaign approvals, bound to a hash of the exact material payload.
--    Changing the script, target URL, jurisdiction, disclosure, target account
--    or render budget invalidates the approval (see campaign-approval-repo).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_campaign_approvals (
  id                            TEXT PRIMARY KEY,
  tenant_id                     TEXT NOT NULL,
  campaign_id                   TEXT NOT NULL,
  niche                         TEXT NOT NULL,
  jurisdiction                  TEXT NOT NULL,
  approval_payload_hash         TEXT NOT NULL,
  estimated_render_cost_cents   INTEGER NOT NULL DEFAULT 0,
  status                        TEXT NOT NULL DEFAULT 'pending_ceo',
  invalidated_reason            TEXT,
  approved_by                   TEXT,
  approved_at                   INTEGER,
  created_at                    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_campaign_approvals_lookup
  ON agent_campaign_approvals(tenant_id, campaign_id, created_at);

-- ---------------------------------------------------------------------------
-- 3. Tenant-scoped provider event lock. `commission_events` (migration 0206)
--    has a GLOBAL primary key, so it cannot be the sole replay guard for a
--    multi-tenant webhook. This table is the authoritative ingest lock.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opc_postback_events (
  tenant_id         TEXT NOT NULL,
  event_id          TEXT NOT NULL,
  network           TEXT NOT NULL,
  external_tx_id    TEXT NOT NULL,
  provider_time_ms  INTEGER NOT NULL DEFAULT 0,
  ingest_seq        INTEGER NOT NULL DEFAULT 0,
  raw_hash          TEXT,
  recorded_at       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, event_id)
);

-- ---------------------------------------------------------------------------
-- 4. Canonical execution run state. A queued job, a render manifest or an
--    accepted webhook is NOT media and NOT a publication. `artifact_id` is
--    populated only after a verified artifact row exists.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS affiliate_execution_runs (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  campaign_id           TEXT NOT NULL,
  offer_id              TEXT,
  approval_id           TEXT,
  idempotency_key       TEXT NOT NULL,
  state                 TEXT NOT NULL DEFAULT 'approval_pending'
    CHECK (state IN ('draft', 'approval_pending', 'render_queued', 'rendered',
                     'publish_queued', 'published', 'blocked', 'failed', 'cancelled')),
  locale                TEXT NOT NULL DEFAULT 'en',
  market                TEXT,
  artifact_id           TEXT,
  channel_id            TEXT,
  reserved_cost_cents   INTEGER NOT NULL DEFAULT 0,
  actual_cost_cents     INTEGER,
  failure_reason        TEXT,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_execution_runs_idempotency
  ON affiliate_execution_runs(tenant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_affiliate_execution_runs_campaign
  ON affiliate_execution_runs(tenant_id, campaign_id);

-- ---------------------------------------------------------------------------
-- 5. Verified media metadata. `is_fixture = 1` may be used in local tests but
--    must never be presented to an operator as a real production render.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS affiliate_media_artifacts (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  run_id              TEXT NOT NULL,
  storage_key         TEXT NOT NULL,
  media_type          TEXT NOT NULL,
  byte_size           INTEGER NOT NULL,
  duration_sec        INTEGER,
  checksum_sha256     TEXT NOT NULL,
  is_fixture          INTEGER NOT NULL DEFAULT 0,
  verified_at         INTEGER NOT NULL,
  created_at          INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_media_artifacts_run_storage
  ON affiliate_media_artifacts(tenant_id, run_id, storage_key);

-- ---------------------------------------------------------------------------
-- 6. Exactly-once optimizer feedback. The event insert is the lock; the
--    posterior update happens only for the winner of that insert.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opc_feedback_events (
  tenant_id       TEXT NOT NULL,
  event_id        TEXT NOT NULL,
  arm_id          TEXT NOT NULL,
  conversions     INTEGER NOT NULL DEFAULT 0,
  reward_cents    INTEGER NOT NULL DEFAULT 0,
  cost_cents      INTEGER NOT NULL DEFAULT 0,
  observed_at     INTEGER NOT NULL,
  applied_at      INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, event_id)
);

CREATE TABLE IF NOT EXISTS opc_bandit_arms (
  tenant_id       TEXT NOT NULL,
  arm_id          TEXT NOT NULL,
  alpha           REAL NOT NULL DEFAULT 1,
  beta            REAL NOT NULL DEFAULT 1,
  pulls           INTEGER NOT NULL DEFAULT 0,
  conversions     INTEGER NOT NULL DEFAULT 0,
  reward_cents    INTEGER NOT NULL DEFAULT 0,
  cost_cents      INTEGER NOT NULL DEFAULT 0,
  last_event_id   TEXT,
  updated_at      INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, arm_id)
);
