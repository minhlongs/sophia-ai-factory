-- 0322_zk_mpc_threshold_and_constitutional_statehood.sql
-- Gate 14: $100,000,000 MRR ($1.2B ARR, 400,000 Paid Customers)
-- Pillar 2: Zero-Knowledge Multi-Party Computation (ZK-MPC) & Autonomous Sovereign Statehood

-- 1. ZK-MPC Threshold Sessions (BGW/GMW Cryptographic Key Generation & Signing)
CREATE TABLE IF NOT EXISTS zk_mpc_threshold_sessions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  protocol_type TEXT NOT NULL CHECK(protocol_type IN ('BGW_ACTIVE', 'GMW_THRESHOLD', 'FROST_SCHNORR', 'SPDZ_HOMOMORPHIC')),
  total_participants INTEGER NOT NULL DEFAULT 9,
  threshold_quorum INTEGER NOT NULL DEFAULT 6, -- 6/9 threshold
  session_state TEXT NOT NULL CHECK(session_state IN ('COMMITMENT_PHASE', 'SECRET_SHARING', 'ZERO_KNOWLEDGE_PROOF_VERIFY', 'RECONSTRUCTED_READY', 'ABORTED')) DEFAULT 'COMMITMENT_PHASE',
  aggregated_public_key_hex TEXT NOT NULL,
  state_proof_merkle_root TEXT NOT NULL,
  execution_latency_ms INTEGER NOT NULL DEFAULT 24,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_zk_mpc_sessions_state ON zk_mpc_threshold_sessions(session_state, protocol_type);

-- 2. Constitutional Amendment Proposals (Autonomous AI Statehood Governance)
CREATE TABLE IF NOT EXISTS constitutional_amendment_proposals (
  id TEXT PRIMARY KEY,
  article_reference TEXT NOT NULL UNIQUE, -- e.g. CONST_ARTICLE_IX_COMPUTE_SOVEREIGNTY
  title TEXT NOT NULL,
  proposed_diff_json TEXT NOT NULL,
  sponsoring_sovereign_entity TEXT NOT NULL,
  supermajority_requirement_bps INTEGER NOT NULL DEFAULT 7500, -- 75.00% supermajority required
  affirmative_voting_power_weight REAL NOT NULL DEFAULT 0.0,
  dissenting_voting_power_weight REAL NOT NULL DEFAULT 0.0,
  formal_verification_passed INTEGER NOT NULL DEFAULT 0 CHECK(formal_verification_passed IN (0, 1)),
  anti_takeover_guardrail_intact INTEGER NOT NULL DEFAULT 1 CHECK(anti_takeover_guardrail_intact IN (0, 1)),
  ratification_status TEXT NOT NULL CHECK(ratification_status IN ('PROPOSED', 'FORMAL_AUDIT_PASS', 'DELIBERATING', 'RATIFIED_INTO_LAW', 'VETOED_UNCONSTITUTIONAL')) DEFAULT 'PROPOSED',
  timelock_enactment_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 3. Sovereign Treaty Compacts (Inter-Sovereignty Multi-Agent Pacts)
CREATE TABLE IF NOT EXISTS sovereign_treaty_compacts (
  id TEXT PRIMARY KEY,
  treaty_uuid TEXT NOT NULL UNIQUE,
  signatory_nations_json TEXT NOT NULL, -- JSON array of signatory sovereign nodes
  pact_category TEXT NOT NULL CHECK(pact_category IN ('NON_PROLIFERATION_OF_ROGUE_AI', 'RECIPROCAL_EXTRADITION_OF_MALICIOUS_SUBROUTINES', 'INTERSTELLAR_TRADE_ZONE', 'CROSS_CORRIDOR_SWAP_TREATY')),
  mutual_defense_escrow_cents INTEGER NOT NULL DEFAULT 25000000000, -- $250M escrow
  treaty_signature_mpc_proof TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  ratified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 4. Formal Verification Theorems (Mathematical Proof Invariants)
CREATE TABLE IF NOT EXISTS formal_verification_theorems (
  id TEXT PRIMARY KEY,
  theorem_identifier TEXT NOT NULL UNIQUE,
  domain_scope TEXT NOT NULL CHECK(domain_scope IN ('CONSTITUTIONAL_LAW', 'ESCROW_SOLVENCY', 'ZERO_KNOWLEDGE_SOUNDNESS', 'QUANTUM_STATE_ENTANGLEMENT')),
  proof_assistant_engine TEXT NOT NULL CHECK(proof_assistant_engine IN ('LEAN_4', 'COQ', 'ISABELLE_HOL', 'Z3_SMT')),
  theorem_statement_hash TEXT NOT NULL,
  qed_verified INTEGER NOT NULL DEFAULT 1 CHECK(qed_verified IN (0, 1)),
  verified_by_peer_nodes_count INTEGER NOT NULL DEFAULT 12,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
