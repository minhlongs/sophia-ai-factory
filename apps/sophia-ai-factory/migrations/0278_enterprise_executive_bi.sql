-- Migration: 0278_enterprise_executive_bi
-- Phase 18–19: Enterprise Executive Business Intelligence & Automated Reporting
-- Sequentially follows 0277_enterprise_org_invitations.sql

-- ============================================================================
-- 1. PRE-FLIGHT PRAGMA IDEMPOTENCY CHECKS
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA defer_foreign_keys = ON;

-- ============================================================================
-- 2. TABLE: executive_bi_metrics
-- Description: Analytical rollups and periodic snapshots for enterprise organizations.
-- Supports peak MRR, generation throughput, viral scoring, and affiliate ROI.
-- ============================================================================

CREATE TABLE IF NOT EXISTS executive_bi_metrics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  mrr_cents INTEGER NOT NULL DEFAULT 0,
  throughput_count INTEGER NOT NULL DEFAULT 0,
  viral_score REAL NOT NULL DEFAULT 0,
  affiliate_revenue_cents INTEGER NOT NULL DEFAULT 0,
  marketing_spend_cents INTEGER NOT NULL DEFAULT 0,
  channel TEXT DEFAULT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE & TENANT ISOLATION
-- ============================================================================

-- 1. Primary composite index for multi-tenant date range queries
CREATE INDEX IF NOT EXISTS idx_executive_bi_metrics_org_period 
  ON executive_bi_metrics(org_id, period_start, period_end);

-- 2. Recency index for chronological listing and audit
CREATE INDEX IF NOT EXISTS idx_executive_bi_metrics_org_created 
  ON executive_bi_metrics(org_id, created_at DESC);

-- 3. Start boundary index for period filtering
CREATE INDEX IF NOT EXISTS idx_executive_bi_metrics_period_start 
  ON executive_bi_metrics(period_start);

-- 4. End boundary index for period filtering
CREATE INDEX IF NOT EXISTS idx_executive_bi_metrics_period_end 
  ON executive_bi_metrics(period_end);
