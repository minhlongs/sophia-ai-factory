-- 0325_post_quantum_zk_snark_and_planetary_constitution.sql
-- Gate 15: $250,000,000 MRR ($3.0B ARR, 1,000,000 Paid Customers)
-- Pillar 2: Post-Quantum zk-SNARK Verifiable Statehood & Autonomous Planetary Constitutional Court

-- 1. Post-Quantum Threshold Sessions (FROST / Lattice signatures)
CREATE TABLE IF NOT EXISTS post_quantum_zk_sessions (
  id TEXT PRIMARY KEY,
  session_ref TEXT NOT NULL UNIQUE,
  protocol_standard TEXT NOT NULL CHECK(protocol_standard IN ('PQ_FROST_SHMIDT', 'DILITHIUM_THRESHOLD', 'FALCON_AGGREGATE')),
  threshold_k INTEGER NOT NULL,
  total_parties_n INTEGER NOT NULL,
  polynomial_degree INTEGER NOT NULL,
  public_group_commitment TEXT NOT NULL,
  session_status TEXT NOT NULL CHECK(session_status IN ('PARTICIPANT_REGISTRATION', 'COMMITMENT_COLLECTION', 'SIGNATURE_AGGREGATED', 'VERIFIED_FINAL')) DEFAULT 'PARTICIPANT_REGISTRATION',
  is_post_quantum_secure INTEGER NOT NULL DEFAULT 1 CHECK(is_post_quantum_secure IN (0, 1)),
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_pq_session_status ON post_quantum_zk_sessions(session_status, protocol_standard);

-- 2. Planetary Court Arbitrations (Multi-jurisdictional AI commercial court)
CREATE TABLE IF NOT EXISTS planetary_court_arbitrations (
  id TEXT PRIMARY KEY,
  dispute_case_ref TEXT NOT NULL UNIQUE,
  claimant_participant_id TEXT NOT NULL,
  respondent_participant_id TEXT NOT NULL,
  dispute_value_cents INTEGER NOT NULL,
  contract_merkle_root TEXT NOT NULL,
  evidence_sha256 TEXT NOT NULL,
  juror_count INTEGER NOT NULL DEFAULT 9,
  supermajority_threshold_pct REAL NOT NULL DEFAULT 75.0,
  verdict TEXT NOT NULL CHECK(verdict IN ('PENDING_EVIDENCE', 'DELIBERATING', 'CLAIMANT_PREVAILS', 'RESPONDENT_PREVAILS', 'DISMISSED_NO_JURISDICTION')) DEFAULT 'PENDING_EVIDENCE',
  jurors_slashed_count INTEGER NOT NULL DEFAULT 0,
  executed_remedy_cents INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 3. Constitutional Invariants Registry (Immutable core rights)
CREATE TABLE IF NOT EXISTS constitutional_invariants_registry (
  id TEXT PRIMARY KEY,
  article_code TEXT NOT NULL UNIQUE, -- e.g. ART_01_HUMAN_SOVEREIGNTY, ART_02_FULL_RESERVE_BACKING
  article_title TEXT NOT NULL,
  is_strictly_immutable INTEGER NOT NULL DEFAULT 1 CHECK(is_strictly_immutable IN (0, 1)),
  enforcement_circuit_hash TEXT NOT NULL,
  last_theorem_verified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 4. Recursive zk-SNARK State Compaction Proofs (1M transactions into 32 bytes)
CREATE TABLE IF NOT EXISTS zk_state_compaction_proofs (
  id TEXT PRIMARY KEY,
  proof_ref TEXT NOT NULL UNIQUE,
  batch_transaction_count INTEGER NOT NULL DEFAULT 1000000,
  previous_state_root TEXT NOT NULL,
  new_state_root TEXT NOT NULL,
  snark_proof_bytes_length INTEGER NOT NULL,
  verification_time_micros INTEGER NOT NULL,
  verifier_circuit_identifier TEXT NOT NULL,
  is_mathematically_sound INTEGER NOT NULL DEFAULT 1 CHECK(is_mathematically_sound IN (0, 1)),
  verified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
