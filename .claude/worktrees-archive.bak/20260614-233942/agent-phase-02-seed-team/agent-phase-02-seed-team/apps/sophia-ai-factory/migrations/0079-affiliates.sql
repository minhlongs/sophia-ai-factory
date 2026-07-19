-- Migration 0079: Discovered affiliates from external network scouts
-- Networks: impact_radius | partnerstack | cj | mock

CREATE TABLE IF NOT EXISTS discovered_affiliates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  network TEXT NOT NULL,
  external_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_url TEXT,
  commission_pct REAL,
  commission_flat_usd REAL,
  category TEXT,
  description TEXT,
  discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raw_payload TEXT,
  UNIQUE(network, external_id)
);

CREATE INDEX IF NOT EXISTS idx_aff_tenant ON discovered_affiliates(tenant_id, discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_aff_network ON discovered_affiliates(network);
