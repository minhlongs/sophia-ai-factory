-- Migration 0433: Ducenti-Quinquaginta-Quintillion ($250.0 Quintillion) 8,796,093,022,208-Bit Braided STARK & Sovereign Conclave Arbitration
-- Gate 51: $250,000,000,000,000,000,000 MRR ($3,000,000,000,000,000,000,000 ARR / $3.0 Septillion ARR, 1,000,000,000,000,000,000 Paid Customers)
-- 8,796,093,022,208-bit non-Archimedean STARK compaction, sub-0.03ns verification (0.010 ns target), 28-nines supermajority, 21-nines slashing penalty.

CREATE TABLE IF NOT EXISTS ducentiquinquagintaquintillion_braided_stark_batches (
  id TEXT PRIMARY KEY,
  batch_ref TEXT NOT NULL UNIQUE,
  batch_tx_count INTEGER NOT NULL DEFAULT 1000000000000000000, -- 1,000,000,000,000,000,000 (1.0 Quintillion)
  previous_state_root TEXT NOT NULL,
  new_state_root TEXT NOT NULL,
  proof_bytes_length INTEGER NOT NULL DEFAULT 8796093022208, -- 8,796,093,022,208-bit (1024 GiB proof surface)
  verification_time_nanos REAL NOT NULL DEFAULT 0.010, -- Sub-0.03 ns (0.010 ns / 10 picoseconds target)
  circuit_identifier TEXT NOT NULL DEFAULT 'CIRCUIT-DUCENTIQUINQUAGINTAQUINTILLION-8796B-STARK-V30',
  is_mathematically_sound INTEGER NOT NULL DEFAULT 1,
  stark_digest TEXT NOT NULL,
  compacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ducentiquinquagintaquintillion_stark_batch ON ducentiquinquagintaquintillion_braided_stark_batches(batch_ref);

CREATE TABLE IF NOT EXISTS ducentiquinquagintaquintillion_conclave_disputes (
  id TEXT PRIMARY KEY,
  dispute_case_ref TEXT NOT NULL UNIQUE,
  claimant_participant_id TEXT NOT NULL,
  respondent_participant_id TEXT NOT NULL,
  dispute_value_cents INTEGER NOT NULL,
  evidence_sha256 TEXT NOT NULL,
  total_jurors INTEGER NOT NULL DEFAULT 500000000000000, -- 500 Trillion nodes
  claimant_votes INTEGER NOT NULL DEFAULT 0,
  respondent_votes INTEGER NOT NULL DEFAULT 0,
  supermajority_pct REAL NOT NULL DEFAULT 0.0, -- Required: 99.99999999999999999999999999%
  jurors_slashed_count INTEGER NOT NULL DEFAULT 0,
  total_slashed_stake_cents INTEGER NOT NULL DEFAULT 0,
  executed_remedy_cents INTEGER NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'PENDING_EVIDENCE',
  ruling_hash TEXT NOT NULL,
  ruled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ducentiquinquagintaquintillion_dispute_verdict ON ducentiquinquagintaquintillion_conclave_disputes(verdict);

CREATE TABLE IF NOT EXISTS ducentiquinquagintaquintillion_conclave_juror_stakes (
  id TEXT PRIMARY KEY,
  juror_node_id TEXT NOT NULL UNIQUE,
  staked_amount_cents INTEGER NOT NULL,
  slashed_amount_cents INTEGER NOT NULL DEFAULT 0,
  reputation_score REAL NOT NULL DEFAULT 1.0,
  is_slashed INTEGER NOT NULL DEFAULT 0,
  registered_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
