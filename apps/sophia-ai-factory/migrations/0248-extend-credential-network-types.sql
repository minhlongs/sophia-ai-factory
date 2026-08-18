-- Extend affiliate_network_credentials CHECK constraint to include ad network types.
-- SQLite does not support DROP CHECK, so we recreate the table.
-- Safe to re-run (idempotent via CREATE TABLE IF NOT EXISTS + INSERT).

CREATE TABLE IF NOT EXISTS _affiliate_network_credentials_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  network TEXT NOT NULL CHECK(network IN (
    'impact_radius','partnerstack','cj','shareasale','clickbank',
    'binance','bybit','bitget','coinbase',
    'google_adsense','youtube_partner','adsense_legacy'
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
