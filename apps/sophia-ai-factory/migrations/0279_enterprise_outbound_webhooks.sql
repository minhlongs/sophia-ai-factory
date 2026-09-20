-- Migration: 0279_enterprise_outbound_webhooks
-- Phase 18–19: Resilient Outbound Webhooks & Event Streaming Bus
-- Sequentially follows 0278_enterprise_executive_bi.sql

-- ============================================================================
-- 1. PRE-FLIGHT PRAGMA IDEMPOTENCY CHECKS
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA defer_foreign_keys = ON;

-- ============================================================================
-- 2. TABLE: webhook_endpoints (enterprise extension)
-- Description: Extend legacy webhook_endpoints with org_id and status columns.
-- ============================================================================

ALTER TABLE webhook_endpoints ADD COLUMN org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE webhook_endpoints ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

UPDATE webhook_endpoints SET org_id = tenant_id WHERE org_id IS NULL AND tenant_id IS NOT NULL;

-- ============================================================================
-- 3. TABLE: webhook_deliveries
-- Description: Outbound webhook delivery log, retry schedule, and DLQ state machine.
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY DEFAULT ('del_' || lower(hex(randomblob(12)))),
  endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON formatted event payload string
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'success', 'failed', 'dead_letter')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at INTEGER NOT NULL,
  response_code INTEGER DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- ============================================================================
-- 4. INDEXES FOR PERFORMANCE, RETRY QUEUE & TENANT ISOLATION
-- ============================================================================

-- Endpoints indexes
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org_id 
  ON webhook_endpoints(org_id);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org_status 
  ON webhook_endpoints(org_id, status);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_status 
  ON webhook_endpoints(status);

-- Deliveries indexes
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org_id 
  ON webhook_deliveries(org_id);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org_status 
  ON webhook_deliveries(org_id, status);

-- Endpoint-scoped deliveries indexes
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_id 
  ON webhook_deliveries(endpoint_id);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_status 
  ON webhook_deliveries(endpoint_id, status);

-- Retry worker index: fast query on failed deliveries ready for retry
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry_queue 
  ON webhook_deliveries(status, next_attempt_at)
  WHERE status = 'failed';

-- Chronological indexes per tenant and globally
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org_created 
  ON webhook_deliveries(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at 
  ON webhook_deliveries(created_at DESC);
