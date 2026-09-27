-- 0313_planetary_swarm_v3_and_zk_identity_mesh.sql
-- Gate 11: $10,000,000 MRR ($120M ARR, 40,000 Paid Customers)
-- Pillar 2: Planetary Autonomous Swarm 3.0, W3C ZK-DID Identity Mesh & Agentic Spot Compute Auctions

-- 1. Planetary Swarm Nodes (Trans-Continental Topology)
CREATE TABLE IF NOT EXISTS planetary_swarm_nodes (
  id TEXT PRIMARY KEY,
  node_key TEXT NOT NULL UNIQUE,
  continent TEXT NOT NULL CHECK(continent IN ('NORTH_AMERICA', 'EUROPE', 'ASIA_PACIFIC', 'LATIN_AMERICA', 'MIDDLE_EAST_AFRICA')),
  datacenter_code TEXT NOT NULL, -- e.g. IAD-01, FRA-02, SIN-01, NRT-03
  ip_address_hash TEXT NOT NULL,
  ed25519_public_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ONLINE', 'SYNCING', 'DEGRADED', 'PARTITIONED', 'OFFLINE')) DEFAULT 'ONLINE',
  consensus_role TEXT NOT NULL CHECK(consensus_role IN ('VALIDATOR', 'OBSERVER', 'ARBITRATOR')) DEFAULT 'VALIDATOR',
  heartbeat_latency_ms INTEGER NOT NULL DEFAULT 8,
  uptime_percentage REAL NOT NULL DEFAULT 99.9999,
  last_heartbeat_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  registered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_planetary_swarm_nodes_continent ON planetary_swarm_nodes(continent, status);

-- 2. Zero-Knowledge Decentralized Identifier (ZK-DID) Registry
CREATE TABLE IF NOT EXISTS zk_did_identity_registry (
  id TEXT PRIMARY KEY,
  did TEXT NOT NULL UNIQUE, -- e.g. did:sophia:zk:ed25519:7a8b...
  owner_node_id TEXT NOT NULL REFERENCES planetary_swarm_nodes(id) ON DELETE CASCADE,
  controller_uri TEXT NOT NULL,
  public_key_multibase TEXT NOT NULL,
  credential_schema_hash TEXT NOT NULL,
  revocation_status TEXT NOT NULL CHECK(revocation_status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')) DEFAULT 'ACTIVE',
  proof_type TEXT NOT NULL DEFAULT 'Ed25519Signature2020',
  merkle_proof_hex TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_zk_did_registry_did ON zk_did_identity_registry(did);
CREATE INDEX IF NOT EXISTS idx_zk_did_registry_owner ON zk_did_identity_registry(owner_node_id);

-- 3. Agentic Spot Compute Auctions (Cross-Agent Resource Leasing)
CREATE TABLE IF NOT EXISTS agentic_spot_auctions (
  id TEXT PRIMARY KEY,
  auction_batch_id TEXT NOT NULL,
  seller_node_id TEXT NOT NULL REFERENCES planetary_swarm_nodes(id),
  buyer_agent_did TEXT NOT NULL REFERENCES zk_did_identity_registry(did),
  resource_type TEXT NOT NULL CHECK(resource_type IN ('GPU_H100_HR', 'GPU_A100_HR', 'QUANTUM_PROOF_VERIFY', 'HIGH_BANDWIDTH_EGRESS')),
  units_allocated INTEGER NOT NULL,
  clearing_price_micros INTEGER NOT NULL, -- USD micros (1 micro = 0.000001 USD)
  settlement_currency TEXT NOT NULL DEFAULT 'USDT',
  duration_seconds INTEGER NOT NULL,
  bid_proof_hash TEXT NOT NULL,
  settlement_status TEXT NOT NULL CHECK(settlement_status IN ('BID_OPEN', 'MATCHED', 'SETTLED', 'DISPUTED', 'CANCELLED')) DEFAULT 'MATCHED',
  executed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_agentic_spot_auctions_batch ON agentic_spot_auctions(auction_batch_id);
CREATE INDEX IF NOT EXISTS idx_agentic_spot_auctions_buyer ON agentic_spot_auctions(buyer_agent_did);
