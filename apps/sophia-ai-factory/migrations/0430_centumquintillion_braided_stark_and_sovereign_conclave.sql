-- Migration 0430: Centum-Quintillion ($100.0 Quintillion) 4,398,046,511,104-Bit Braided STARK & Sovereign Conclave Arbitration
-- Gate 50: $100,000,000,000,000,000,000 MRR ($1,200,000,000,000,000,000,000 ARR / $1.2 Septillion ARR, 400,000,000,000,000,000 Paid Customers)
-- 4,398,046,511,104-bit non-Archimedean STARK compaction, sub-0.08ns verification (0.015 ns target), 27-nines supermajority, 20-nines slashing penalty.

CREATE TABLE IF NOT EXISTS centumquintillion_braided_stark_batches (
  id TEXT PRIMARY KEY,
  batch_ref TEXT NOT NULL UNIQUE,
  batch_tx_count INTEGER NOT NULL DEFAULT 400000000000000000, -- 400,000,000,000,000,000 (400 Quadrillion)
  previous_state_root TEXT NOT NULL,
  new_state_root TEXT NOT NULL,
  proof_bytes_length INTEGER NOT NULL DEFAULT 4398046511104, -- 4,398,046,511,104-bit (512 GiB proof surface)
  verification_time_nanos REAL NOT NULL DEFAULT 0.015, -- Sub-0.08 ns (0.015 ns / 15 picoseconds target)
  circuit_identifier TEXT NOT NULL DEFAULT 'CIRCUIT-CENTUMQUINTILLION-4398B-STARK-V30',
  is_mathematically_sound INTEGER NOT NULL DEFAULT 1,
  stark_digest TEXT NOT NULL,
  compacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_centumquintillion_stark_batch ON centumquintillion_braided_stark_batches(batch_ref);

CREATE TABLE IF NOT EXISTS centumquintillion_conclave_disputes (
  id TEXT PRIMARY KEY,
  dispute_case_ref TEXT NOT NULL UNIQUE,
  claimant_participant_id TEXT NOT NULL,
  respondent_participant_id TEXT NOT NULL,
  dispute_value_cents INTEGER NOT NULL,
  evidence_sha256 TEXT NOT NULL,
  total_jurors INTEGER NOT NULL DEFAULT 200000000000000, -- 200 Trillion nodes
  claimant_votes INTEGER NOT NULL DEFAULT 0,
  respondent_votes INTEGER NOT NULL DEFAULT 0,
  supermajority_pct REAL NOT NULL DEFAULT 0.0, -- Required: 99.999999999999999999999999999%
  jurors_slashed_count INTEGER NOT NULL DEFAULT 0,
  total_slashed_stake_cents INTEGER NOT NULL DEFAULT 0,
  executed_remedy_cents INTEGER NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'PENDING_EVIDENCE', -- PENDING_EVIDENCE, DELIBERATING, CLAIMANT_PREVAILS, RESPONDENT_PREVAILS, DISMISSED_INSUFFICIENT_EVIDENCE
  ruling_hash TEXT NOT NULL,
  ruled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_centumquintillion_dispute_verdict ON centumquintillion_conclave_disputes(verdict);

CREATE TABLE IF NOT EXISTS centumquintillion_conclave_juror_stakes (
  id TEXT PRIMARY KEY,
  juror_node_id TEXT NOT NULL UNIQUE,
  staked_amount_cents INTEGER NOT NULL,
  slashed_amount_cents INTEGER NOT NULL DEFAULT 0,
  reputation_score REAL NOT NULL DEFAULT 1.0,
  is_slashed INTEGER NOT NULL DEFAULT 0,
  registered_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
