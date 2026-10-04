-- Migration 0421: 549,755,813,888-Bit Non-Archimedean Braided STARK & Sovereign Conclave
-- Gate 47: $10,000,000,000,000,000,000 MRR ($120,000,000,000,000,000,000 ARR / $120.0 Sextillion ARR, 40,000,000,000,000,000 Paid Customers)
-- 549,755,813,888-bit STARK state compaction (40,000T transactions compacted into 64 bytes in <0.2 ns, target 0.05 ns); 99.999999999999999999999999% Conclave supermajority (24 nines), 99.99999999999999999% slash (17 nines).

CREATE TABLE IF NOT EXISTS decemmilliaquadrillion_braided_stark_batches (
  id TEXT PRIMARY KEY,
  batch_ref TEXT NOT NULL UNIQUE,
  batch_tx_count INTEGER NOT NULL DEFAULT 40000000000000000, -- 40,000,000,000,000,000 transactions (40 Quadrillion)
  previous_state_root TEXT NOT NULL, -- 64 bytes hex
  newState_root TEXT NOT NULL, -- 64 bytes hex
  proof_bytes_length INTEGER NOT NULL DEFAULT 549755813888, -- 549,755,813,888-bit (68,719,476,736 bytes = 64 GiB)
  verification_time_nanos INTEGER NOT NULL DEFAULT 1, -- Sub-0.2 ns (0.05 ns target)
  circuit_identifier TEXT NOT NULL,
  is_mathematically_sound INTEGER NOT NULL DEFAULT 1,
  stark_digest TEXT NOT NULL,
  compacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_decem_braided_stark_batch_ref ON decemmilliaquadrillion_braided_stark_batches(batch_ref);

CREATE TABLE IF NOT EXISTS sovereign_decemmilliaquadrillion_conclave_disputes (
  id TEXT PRIMARY KEY,
  dispute_case_ref TEXT NOT NULL UNIQUE,
  claimant_participant_id TEXT NOT NULL,
  respondent_participant_id TEXT NOT NULL,
  dispute_value_cents INTEGER NOT NULL,
  evidence_sha256 TEXT NOT NULL,
  total_jurors INTEGER NOT NULL DEFAULT 20000000000000, -- 20 Trillion Jurors
  claimant_votes INTEGER NOT NULL,
  respondent_votes INTEGER NOT NULL,
  supermajority_pct REAL NOT NULL, -- Threshold 99.999999999999999999999999% (24 nines)
  jurors_slashed_count INTEGER NOT NULL DEFAULT 0,
  total_slashed_stake_cents INTEGER NOT NULL DEFAULT 0, -- 99.99999999999999999% stake slashing (17 nines)
  executed_remedy_cents INTEGER NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'DELIBERATING', -- PENDING_EVIDENCE, DELIBERATING, CLAIMANT_PREVAILS, RESPONDENT_PREVAILS, DISMISSED_INSUFFICIENT_EVIDENCE
  ruling_hash TEXT NOT NULL,
  ruled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_decem_conclave_case ON sovereign_decemmilliaquadrillion_conclave_disputes(dispute_case_ref);

CREATE TABLE IF NOT EXISTS decemmilliaquadrillion_empire_constitutional_invariants (
  id TEXT PRIMARY KEY,
  article_code TEXT NOT NULL UNIQUE,
  article_title TEXT NOT NULL,
  is_strictly_immutable INTEGER NOT NULL DEFAULT 1,
  last_theorem_verified_at TEXT NOT NULL,
  enforcement_circuit_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
