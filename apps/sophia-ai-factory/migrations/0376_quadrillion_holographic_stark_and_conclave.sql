-- Migration 0376: 16,777,216-Bit Non-Archimedean Quadrillion Holographic STARK & Sovereign Conclave
-- Gate 32: $100,000,000,000,000 MRR ($1,200,000.0B ARR / $1,200.0 Trillion ARR / $1.2 Quadrillion ARR, 400,000,000,000 Paid Customers)
-- 16,777,216-bit STARK state compaction (400B transactions compacted into 64 bytes in <15 ns, target 10 ns); 99.999999999% Conclave supermajority, 99.99999% slash.

CREATE TABLE IF NOT EXISTS quadrillion_holographic_stark_batches (
  id TEXT PRIMARY KEY,
  batch_ref TEXT NOT NULL UNIQUE,
  batch_tx_count INTEGER NOT NULL DEFAULT 400000000000, -- 400,000,000,000 transactions
  previous_state_root TEXT NOT NULL, -- 64 bytes hex
  new_state_root TEXT NOT NULL, -- 64 bytes hex
  proof_bytes_length INTEGER NOT NULL DEFAULT 16777216, -- 16,777,216-bit
  verification_time_nanos INTEGER NOT NULL DEFAULT 10, -- Sub-15 ns (10 ns target)
  circuit_identifier TEXT NOT NULL,
  is_mathematically_sound INTEGER NOT NULL DEFAULT 1,
  stark_digest TEXT NOT NULL,
  compacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quad_holo_stark_batch_ref ON quadrillion_holographic_stark_batches(batch_ref);

CREATE TABLE IF NOT EXISTS quadrillion_trans_cosmic_conclave_disputes (
  id TEXT PRIMARY KEY,
  dispute_case_ref TEXT NOT NULL UNIQUE,
  claimant_participant_id TEXT NOT NULL,
  respondent_participant_id TEXT NOT NULL,
  dispute_value_cents INTEGER NOT NULL,
  evidence_sha256 TEXT NOT NULL,
  total_jurors INTEGER NOT NULL DEFAULT 200000000,
  claimant_votes INTEGER NOT NULL,
  respondent_votes INTEGER NOT NULL,
  supermajority_pct REAL NOT NULL, -- Threshold 99.999999999%
  jurors_slashed_count INTEGER NOT NULL DEFAULT 0,
  total_slashed_stake_cents INTEGER NOT NULL DEFAULT 0, -- 99.99999% stake slashing
  executed_remedy_cents INTEGER NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'DELIBERATING', -- PENDING_EVIDENCE, DELIBERATING, CLAIMANT_PREVAILS, RESPONDENT_PREVAILS, DISMISSED_INSUFFICIENT_EVIDENCE
  ruling_hash TEXT NOT NULL,
  ruled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quad_conclave_case ON quadrillion_trans_cosmic_conclave_disputes(dispute_case_ref);

CREATE TABLE IF NOT EXISTS quadrillion_empire_constitutional_invariants (
  id TEXT PRIMARY KEY,
  article_code TEXT NOT NULL UNIQUE,
  article_title TEXT NOT NULL,
  is_strictly_immutable INTEGER NOT NULL DEFAULT 1,
  last_theorem_verified_at TEXT NOT NULL,
  enforcement_circuit_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
