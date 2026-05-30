-- Migration 0084: Affiliate network API credentials (per-tenant BYOK)
-- Stores encrypted API credentials for affiliate networks.
-- Safe to re-run (idempotent).

CREATE TABLE IF NOT EXISTS affiliate_network_credentials (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  network TEXT NOT NULL CHECK(network IN (
    'impact_radius','partnerstack','cj','shareasale','clickbank',
    'binance','bybit','bitget','coinbase'
  )),
  encrypted_credentials TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','invalid','rate_limited')),
  last_validated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, network)
);

CREATE INDEX IF NOT EXISTS idx_affcred_tenant ON affiliate_network_credentials(tenant_id);
