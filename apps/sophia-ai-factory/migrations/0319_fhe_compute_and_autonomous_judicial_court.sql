-- 0319_fhe_compute_and_autonomous_judicial_court.sql
-- Gate 13: $50,000,000 MRR ($600M ARR, 200,000 Paid Customers)
-- Pillar 2: Fully Homomorphic Encryption (FHE) & Zero-Knowledge Autonomous Judicial Court

-- 1. FHE Ciphertext Workloads (In-Memory Homomorphic Computation)
CREATE TABLE IF NOT EXISTS fhe_ciphertext_workloads (
  id TEXT PRIMARY KEY,
  workload_id TEXT NOT NULL UNIQUE,
  scheme_type TEXT NOT NULL CHECK(scheme_type IN ('CKKS', 'TFHE', 'BFV', 'BGV')),
  ciphertext_digest_sha256 TEXT NOT NULL,
  polynomial_modulus_degree INTEGER NOT NULL DEFAULT 16384, -- 16K or 32K degree
  current_noise_budget_bits INTEGER NOT NULL DEFAULT 85,
  min_noise_budget_threshold INTEGER NOT NULL DEFAULT 15,
  requires_bootstrapping INTEGER NOT NULL DEFAULT 0 CHECK(requires_bootstrapping IN (0, 1)),
  status TEXT NOT NULL CHECK(status IN ('ENCRYPTED_IN_TRANSIT', 'PROCESSING_HOMOMORPHIC', 'BOOTSTRAPPED', 'EVALUATED_READY', 'CORRUPTED')) DEFAULT 'ENCRYPTED_IN_TRANSIT',
  execution_duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_fhe_workloads_status ON fhe_ciphertext_workloads(status, scheme_type);

-- 2. FHE Bootstrapping Circuits
CREATE TABLE IF NOT EXISTS fhe_bootstrap_circuits (
  id TEXT PRIMARY KEY,
  circuit_hash TEXT NOT NULL UNIQUE,
  gate_depth INTEGER NOT NULL DEFAULT 48,
  lut_evaluations_count INTEGER NOT NULL DEFAULT 1024,
  refresh_time_ms INTEGER NOT NULL DEFAULT 120,
  is_verified INTEGER NOT NULL DEFAULT 1 CHECK(is_verified IN (0, 1)),
  last_used_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 3. Autonomous Judicial Dispute Cases (Supreme Smart Court)
CREATE TABLE IF NOT EXISTS judicial_dispute_cases (
  id TEXT PRIMARY KEY,
  case_number TEXT NOT NULL UNIQUE, -- e.g. CASE_2026_AI_0901
  claimant_identity_hash TEXT NOT NULL,
  respondent_identity_hash TEXT NOT NULL,
  dispute_category TEXT NOT NULL CHECK(dispute_category IN ('SLA_BREACH', 'IP_INFRINGEMENT', 'ESCROW_DEFAULT', 'ORBITAL_DATA_CORRUPTION', 'UNAUTHORIZED_SUBROUTINE')),
  disputed_amount_cents INTEGER NOT NULL,
  escrow_bond_cents INTEGER NOT NULL,
  evidence_merkle_root TEXT NOT NULL,
  assigned_juror_count INTEGER NOT NULL DEFAULT 7,
  verdict_threshold_ratio REAL NOT NULL DEFAULT 0.714, -- 5/7 supermajority
  appeal_window_expires_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('FILED', 'DISCOVERY', 'JUROR_DELIBERATION', 'VERDICT_RENDERED', 'APPEALED', 'EXECUTED_FINAL')) DEFAULT 'FILED',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_judicial_cases_status ON judicial_dispute_cases(status, dispute_category);

-- 4. Judicial Arbitration Verdicts
CREATE TABLE IF NOT EXISTS judicial_arbitration_verdicts (
  id TEXT PRIMARY KEY,
  case_number TEXT NOT NULL,
  verdict_outcome TEXT NOT NULL CHECK(verdict_outcome IN ('CLAIMANT_FAVORED', 'RESPONDENT_FAVORED', 'SPLIT_SETTLEMENT', 'DISMISSED_WITH_PREJUDICE')),
  affirmative_votes INTEGER NOT NULL,
  dissenting_votes INTEGER NOT NULL,
  slashed_juror_stakes_cents INTEGER NOT NULL DEFAULT 0,
  disbursed_compensation_cents INTEGER NOT NULL DEFAULT 0,
  zero_knowledge_proof_hash TEXT NOT NULL,
  formal_verification_passed INTEGER NOT NULL DEFAULT 1 CHECK(formal_verification_passed IN (0, 1)),
  executed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY(case_number) REFERENCES judicial_dispute_cases(case_number)
);
