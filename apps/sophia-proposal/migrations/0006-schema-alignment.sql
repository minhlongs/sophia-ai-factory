-- Migration: Align schema with code expectations
-- Fix: polar_customer_id missing from billing_settings
ALTER TABLE billing_settings ADD COLUMN polar_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_billing_settings_polar_customer ON billing_settings(polar_customer_id);

-- Fix: email missing from organizations
ALTER TABLE organizations ADD COLUMN email TEXT;

-- Fix: org_balances missing columns
ALTER TABLE org_balances ADD COLUMN reserved INTEGER NOT NULL DEFAULT 0;
ALTER TABLE org_balances ADD COLUMN lifetime_credits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE org_balances ADD COLUMN lifetime_debits INTEGER NOT NULL DEFAULT 0;
