-- Migration 0500: Multi-Tenant Isolation for Affiliate Referrals, Payouts, and Commissions
-- Adds tenant_id (default 'default') and composite multi-tenant indexes across the
-- affiliate referral, commission, and payout ledger tables so Partner-Resell agencies
-- have strict tenant-scoped attribution and settlement isolation.

-- 1. affiliate_referrals: tenant_id column + composite partner/status index
ALTER TABLE affiliate_referrals ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_aff_referrals_tenant_partner
  ON affiliate_referrals(tenant_id, partner_id, status);

-- 2. affiliate_payouts: tenant_id column + composite status/created_at index
ALTER TABLE affiliate_payouts ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_aff_payouts_tenant_status
  ON affiliate_payouts(tenant_id, status, created_at DESC);

-- 3. affiliate_commissions: tenant_id column + composite partner/status/payable_at index
ALTER TABLE affiliate_commissions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_aff_comm_tenant_partner_status
  ON affiliate_commissions(tenant_id, partner_id, status, payable_at);
