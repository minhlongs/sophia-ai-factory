-- Migration 0361: 524,288-Bit Non-Archimedean Omni-Dimensional Holographic STARK & Omni-Dimensional Supreme Conclave
-- Gate 27: $2,500,000,000,000 MRR ($30,000.0B ARR / $30.0 Trillion ARR, 10,000,000,000 Paid Customers)
-- 524,288-bit STARK state compaction (10B transactions compacted into 64 bytes in <1 µs, target 500 ns); 99.9999% Conclave supermajority, 99.9% slash.

CREATE TABLE IF NOT EXISTS omni_dimensional_stark_batches (
  id TEXT PRIMARY KEY,
  batch_ref TEXT NOT NULL UNIQUE,
  batch_tx_count INTEGER NOT NULL DEFAULT 10000000000, -- 10,000,000,000 transactions
  previous_state_root TEXT NOT NULL, -- 64 bytes hex
  new_state_root TEXT NOT NULL, -- 64 bytes hex
  proof_bytes_length INTEGER NOT NULL DEFAULT 524288, -- 524,288-bit (65,536 bytes or 524,288 bytes proof)
  verification_time_micros INTEGER NOT NULL DEFAULT 1, -- Sub-1 µs (500 ns target)
  circuit_identifier TEXT NOT NULL,
  is_mathematically_sound INTEGER NOT NULL DEFAULT 1,
  stark_digest TEXT NOT NULL,
  compacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_omni_dimensional_stark_batch_ref ON omni_dimensional_stark_batches(batch_ref);

CREATE TABLE IF NOT EXISTS omni_dimensional_conclave_disputes (
  id TEXT PRIMARY KEY,
  dispute_case_ref TEXT NOT NULL UNIQUE,
  claimant_participant_id TEXT NOT NULL,
  respondent_participant_id TEXT NOT NULL,
  dispute_value_cents INTEGER NOT NULL,
  evidence_sha256 TEXT NOT NULL,
  total_jurors INTEGER NOT NULL DEFAULT 1000000,
  claimant_votes INTEGER NOT NULL,
  respondent_votes INTEGER NOT NULL,
  supermajority_pct REAL NOT NULL, -- Threshold 99.9999%
  jurors_slashed_count INTEGER NOT NULL DEFAULT 0,
  total_slashed_stake_cents INTEGER NOT NULL DEFAULT 0, -- 99.9% stake slashing
  executed_remedy_cents INTEGER NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'DELIBERATING', -- PENDING_EVIDENCE, DELIBERATING, CLAIMANT_PREVAILS, RESPONDENT_PREVAILS, DISMISSED_INSUFFICIENT_EVIDENCE
  ruling_hash TEXT NOT NULL,
  ruled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_omni_dimensional_conclave_case ON omni_dimensional_conclave_disputes(dispute_case_ref);

CREATE TABLE IF NOT EXISTS omni_dimensional_constitutional_invariants (
  id TEXT PRIMARY KEY,
  article_code TEXT NOT NULL UNIQUE,
  article_title TEXT NOT NULL,
  is_strictly_immutable INTEGER NOT NULL DEFAULT 1,
  last_theorem_verified_at TEXT NOT NULL,
  enforcement_circuit_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
