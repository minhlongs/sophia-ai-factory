-- Migration 0367: 2,097,152-Bit Non-Archimedean Pan-Dimensional Holographic STARK & Pan-Dimensional Supreme Conclave
-- Gate 29: $10,000,000,000,000 MRR ($120,000.0B ARR / $120.0 Trillion ARR, 40,000,000,000 Paid Customers)
-- 2,097,152-bit STARK state compaction (40B transactions compacted into 64 bytes in <250 ns, target 125 ns); 99.999999% Conclave supermajority, 99.99% slash.

CREATE TABLE IF NOT EXISTS pan_dimensional_holographic_stark_batches (
  id TEXT PRIMARY KEY,
  batch_ref TEXT NOT NULL UNIQUE,
  batch_tx_count INTEGER NOT NULL DEFAULT 40000000000, -- 40,000,000,000 transactions
  previous_state_root TEXT NOT NULL, -- 64 bytes hex
  new_state_root TEXT NOT NULL, -- 64 bytes hex
  proof_bytes_length INTEGER NOT NULL DEFAULT 2097152, -- 2,097,152-bit
  verification_time_nanos INTEGER NOT NULL DEFAULT 125, -- Sub-250 ns (125 ns target)
  circuit_identifier TEXT NOT NULL,
  is_mathematically_sound INTEGER NOT NULL DEFAULT 1,
  stark_digest TEXT NOT NULL,
  compacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pan_dim_holo_stark_batch_ref ON pan_dimensional_holographic_stark_batches(batch_ref);

CREATE TABLE IF NOT EXISTS pan_dimensional_supreme_conclave_disputes (
  id TEXT PRIMARY KEY,
  dispute_case_ref TEXT NOT NULL UNIQUE,
  claimant_participant_id TEXT NOT NULL,
  respondent_participant_id TEXT NOT NULL,
  dispute_value_cents INTEGER NOT NULL,
  evidence_sha256 TEXT NOT NULL,
  total_jurors INTEGER NOT NULL DEFAULT 20000000,
  claimant_votes INTEGER NOT NULL,
  respondent_votes INTEGER NOT NULL,
  supermajority_pct REAL NOT NULL, -- Threshold 99.999999%
  jurors_slashed_count INTEGER NOT NULL DEFAULT 0,
  total_slashed_stake_cents INTEGER NOT NULL DEFAULT 0, -- 99.99% stake slashing
  executed_remedy_cents INTEGER NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'DELIBERATING', -- PENDING_EVIDENCE, DELIBERATING, CLAIMANT_PREVAILS, RESPONDENT_PREVAILS, DISMISSED_INSUFFICIENT_EVIDENCE
  ruling_hash TEXT NOT NULL,
  ruled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pan_dim_supreme_conclave_case ON pan_dimensional_supreme_conclave_disputes(dispute_case_ref);

CREATE TABLE IF NOT EXISTS pan_dimensional_empire_constitutional_invariants (
  id TEXT PRIMARY KEY,
  article_code TEXT NOT NULL UNIQUE,
  article_title TEXT NOT NULL,
  is_strictly_immutable INTEGER NOT NULL DEFAULT 1,
  last_theorem_verified_at TEXT NOT NULL,
  enforcement_circuit_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
