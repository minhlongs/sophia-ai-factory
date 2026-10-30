-- Extend affiliate_network_credentials CHECK constraint with the postback networks.
--
-- Why: tenant-scoped postback verification reads per-workspace secrets from this
-- table, but the CHECK allow-list rejects rewardful/awin/tiktok_shop/okx (used by
-- the canonical /api/postback core) and amazon/accesstrade (used by the legacy
-- ecommerce delegation). Without these values every such verification fails
-- closed on production, even for workspaces that stored a credential.
--
-- SQLite does not support DROP CHECK, so we recreate the table (0248 pattern).
-- Idempotent: guarded by _migration_0488_applied so re-runs are no-ops.
-- NOTE: 0248's guard used `INSERT ... VALUES ... WHERE`, which is invalid
-- SQLite; the equivalent valid form (INSERT ... SELECT ... WHERE) is used here.
-- No data change: all existing rows are copied verbatim; only the allow-list grows.

CREATE TABLE IF NOT EXISTS _migration_0488_applied (
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO _migration_0488_applied (applied_at)
  SELECT CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM _migration_0488_applied);

CREATE TABLE IF NOT EXISTS _affiliate_network_credentials_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  network TEXT NOT NULL CHECK(network IN (
    'impact_radius','partnerstack','cj','shareasale','clickbank',
    'binance','bybit','bitget','coinbase',
    'google_adsense','youtube_partner','adsense_legacy',
    'rewardful','awin','tiktok_shop','okx','amazon','accesstrade'
  )),
  encrypted_credentials TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','invalid','rate_limited')),
  last_validated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, network)
);

INSERT INTO _affiliate_network_credentials_new
  SELECT id, tenant_id, network, encrypted_credentials, status, last_validated_at, created_at, updated_at
  FROM affiliate_network_credentials;

DROP TABLE affiliate_network_credentials;

ALTER TABLE _affiliate_network_credentials_new RENAME TO affiliate_network_credentials;

CREATE INDEX IF NOT EXISTS idx_affcred_tenant ON affiliate_network_credentials(tenant_id);
