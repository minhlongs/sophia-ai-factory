-- Migration 0501: Workspace Tenant Isolation for Affiliate Partners
-- Adds tenant_id (default 'default') and a composite tenant/status/payout index
-- to affiliate_partners so workspace owners can recruit, review (under_review),
-- and batch Dual-Rail payouts strictly within their own tenant scope.

ALTER TABLE affiliate_partners ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

CREATE INDEX IF NOT EXISTS idx_affiliate_partners_tenant_status
  ON affiliate_partners(tenant_id, status, pending_payout_cents DESC);
