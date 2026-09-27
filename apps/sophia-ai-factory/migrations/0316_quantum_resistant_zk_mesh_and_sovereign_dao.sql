-- 0316_quantum_resistant_zk_mesh_and_sovereign_dao.sql
-- Gate 12: $25,000,000 MRR ($300M ARR, 100,000 Paid Customers)
-- Pillar 2: Quantum-Resistant ZK Lattice Proof Mesh & Sovereign AI DAO Governance

-- 1. Quantum-Resistant Identity Keys (NIST FIPS 203 ML-KEM & FIPS 204 ML-DSA)
CREATE TABLE IF NOT EXISTS quantum_identity_keys (
  id TEXT PRIMARY KEY,
  agent_did TEXT NOT NULL UNIQUE, -- e.g. did:sophia:quantum:kyber1024:...
  algorithm TEXT NOT NULL CHECK(algorithm IN ('ML_KEM_1024', 'ML_DSA_87', 'HYBRID_KYBER_ED25519', 'FALCON_1024')),
  public_key_hex TEXT NOT NULL,
  key_encapsulation_parameter_bytes INTEGER NOT NULL DEFAULT 1568,
  security_category INTEGER NOT NULL DEFAULT 5, -- Category 5 (256-bit quantum security)
  is_revoked INTEGER NOT NULL DEFAULT 0 CHECK(is_revoked IN (0, 1)),
  activated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quantum_keys_algo ON quantum_identity_keys(algorithm, is_revoked);

-- 2. Lattice Proof Verifications
CREATE TABLE IF NOT EXISTS lattice_proof_verifications (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES quantum_identity_keys(id) ON DELETE CASCADE,
  challenge_nonce_hex TEXT NOT NULL,
  shared_secret_hash_hex TEXT NOT NULL,
  signature_hex TEXT NOT NULL,
  verification_latency_ms INTEGER NOT NULL,
  is_verified INTEGER NOT NULL CHECK(is_verified IN (0, 1)),
  verified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_lattice_proof_verified ON lattice_proof_verifications(is_verified, verified_at);

-- 3. Sovereign AI DAO Proposals & Protocol Upgrades
CREATE TABLE IF NOT EXISTS sovereign_dao_proposals (
  id TEXT PRIMARY KEY,
  proposal_number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description_cid TEXT NOT NULL, -- IPFS/Arweave CID
  proposer_did TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('TREASURY_ALLOCATION', 'ALGORITHM_UPGRADE', 'FEE_STRUCTURE', 'EMERGENCY_CIRCUIT_BREAKER', 'GLOBAL_EXPANSION')),
  quorum_threshold_tokens INTEGER NOT NULL DEFAULT 50000000, -- 50M governance tokens
  approval_threshold_bps INTEGER NOT NULL DEFAULT 6667, -- 66.67% supermajority
  total_votes_cast INTEGER NOT NULL DEFAULT 0,
  yes_votes_cast INTEGER NOT NULL DEFAULT 0,
  no_votes_cast INTEGER NOT NULL DEFAULT 0,
  abstain_votes_cast INTEGER NOT NULL DEFAULT 0,
  execution_timelock_seconds INTEGER NOT NULL DEFAULT 86400, -- 24h timelock
  status TEXT NOT NULL CHECK(status IN ('DRAFT', 'ACTIVE', 'PASSED', 'REJECTED', 'QUEUED', 'EXECUTED', 'CANCELLED')) DEFAULT 'DRAFT',
  voting_starts_at TEXT NOT NULL,
  voting_ends_at TEXT NOT NULL,
  executed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sovereign_dao_status ON sovereign_dao_proposals(status, voting_ends_at);

-- 4. DAO Vote Receipts & Merkle Quorum Audit
CREATE TABLE IF NOT EXISTS dao_vote_receipts (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES sovereign_dao_proposals(id) ON DELETE CASCADE,
  voter_did TEXT NOT NULL,
  voting_power_weight INTEGER NOT NULL,
  vote_choice TEXT NOT NULL CHECK(vote_choice IN ('YES', 'NO', 'ABSTAIN')),
  quantum_signature_hex TEXT NOT NULL,
  merkle_leaf_hash TEXT NOT NULL,
  casted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dao_vote_receipt_voter ON dao_vote_receipts(proposal_id, voter_did);
