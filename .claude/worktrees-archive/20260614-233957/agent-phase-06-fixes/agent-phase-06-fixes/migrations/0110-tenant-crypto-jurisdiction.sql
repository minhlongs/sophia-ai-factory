-- Migration: 0110-tenant-crypto-jurisdiction.sql
-- Add crypto_jurisdiction column to tenant_settings
-- Used by crypto-compliance-tab.tsx for per-tenant jurisdiction declaration.

-- Phase 08: Crypto Disclaimer + KYC Notice

ALTER TABLE tenant_settings
  ADD COLUMN crypto_jurisdiction TEXT DEFAULT 'US'
    CHECK (crypto_jurisdiction IN ('US', 'EU', 'VN', 'SG', 'JP'));

-- Index for quick lookup per tenant
CREATE INDEX IF NOT EXISTS idx_tenant_settings_crypto_jurisdiction
  ON tenant_settings (crypto_jurisdiction);
