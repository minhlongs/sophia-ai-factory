-- Migration 0495: Authoritative Mekong Execution Contract v1 D1 Ticket Store
-- Enables native Cloudflare Edge D1 durability for all 10 SophiaExecutionContractV1
-- operations when MekongContractClient runs in ENABLED mode on Cloudflare Workers.

CREATE TABLE IF NOT EXISTS mekong_contract_tickets (
  ticket_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  mandate_hash TEXT NOT NULL,
  truth_status TEXT NOT NULL DEFAULT 'PLANNED',
  simulated INTEGER NOT NULL DEFAULT 0,
  execution_outcome TEXT NOT NULL DEFAULT 'EXECUTED',
  verification_outcome TEXT NOT NULL DEFAULT 'VERIFIED_SUCCESS',
  delivery_outcome TEXT NOT NULL DEFAULT 'SENT',
  business_outcome TEXT NOT NULL DEFAULT 'NOT_EVALUATED',
  verified_success_claim_permitted INTEGER NOT NULL DEFAULT 1,
  cost_budget REAL NOT NULL DEFAULT 10,
  actual_cost REAL NOT NULL DEFAULT 0.45,
  cost_status TEXT NOT NULL DEFAULT 'MEASURED',
  retry_budget INTEGER NOT NULL DEFAULT 3,
  cancel_reason TEXT,
  approval_reason TEXT,
  request_payload_json TEXT NOT NULL,
  artifacts_json TEXT NOT NULL DEFAULT '[]',
  verification_evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(workspace_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_mekong_tickets_workspace_status ON mekong_contract_tickets(workspace_id, truth_status);
CREATE INDEX IF NOT EXISTS idx_mekong_tickets_event ON mekong_contract_tickets(event_id);
