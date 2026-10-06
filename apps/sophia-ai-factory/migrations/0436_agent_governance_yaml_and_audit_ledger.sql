-- Migration 0436: Agent Governance YAML (AGY) Schema & Policy Evaluation Audit Ledger
-- Phase: Milestone M2 (Agent Governance YAML Schema & Engine)
-- Covers: agy_policy_audit_ledger, agy_governance_configs

-- 1. AGY Policy Evaluation Audit Ledger Table
CREATE TABLE IF NOT EXISTS agy_policy_audit_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  agency_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  requested_autonomy TEXT NOT NULL,
  max_autonomy TEXT,
  required_autonomy TEXT DEFAULT 'L1',
  requested_compute INTEGER NOT NULL DEFAULT 0,
  requested_compute_units INTEGER NOT NULL DEFAULT 0,
  allowed INTEGER NOT NULL CHECK (allowed IN (0, 1)),
  reason TEXT NOT NULL,
  escalation_triggered INTEGER NOT NULL DEFAULT 0 CHECK (escalation_triggered IN (0, 1)),
  evaluation_sha256 TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agy_policy_audit_agency_id ON agy_policy_audit_ledger(agency_id);
CREATE INDEX IF NOT EXISTS idx_agy_policy_audit_agent_id ON agy_policy_audit_ledger(agent_id);
CREATE INDEX IF NOT EXISTS idx_agy_policy_audit_created_at ON agy_policy_audit_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_agy_policy_audit_agency_created ON agy_policy_audit_ledger(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agy_policy_audit_sha ON agy_policy_audit_ledger(evaluation_sha256);

-- 2. Declarative AGY Configurations Table
CREATE TABLE IF NOT EXISTS agy_governance_configs (
  id TEXT PRIMARY KEY NOT NULL,
  agency_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '1.0',
  raw_yaml TEXT NOT NULL,
  config_json TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agy_gov_cfg_agency_agent ON agy_governance_configs(agency_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_agy_gov_cfg_agency_active ON agy_governance_configs(agency_id, is_active);
