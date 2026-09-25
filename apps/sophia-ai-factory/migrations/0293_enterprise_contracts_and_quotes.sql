-- Migration 0293: Enterprise Custom SLA Contracts, Quotes & Digital Signatures
-- Milestone: Enterprise Scale Engine ($200K MRR)

CREATE TABLE IF NOT EXISTS enterprise_quotes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  deal_id TEXT, -- Loose reference to enterprise_deals(id)
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL UNIQUE,
  mcu_capacity_monthly INTEGER NOT NULL CHECK (mcu_capacity_monthly >= 50000 AND mcu_capacity_monthly <= 500000),
  sla_uptime_percent REAL NOT NULL DEFAULT 99.9,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  base_price_cents INTEGER NOT NULL,
  volume_discount_percent REAL NOT NULL,
  annual_discount_percent REAL NOT NULL DEFAULT 0.0,
  final_price_cents INTEGER NOT NULL,
  final_price_vnd INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'VND')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_enterprise_quotes_org_id ON enterprise_quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_quotes_status ON enterprise_quotes(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_quotes_number ON enterprise_quotes(quote_number);

CREATE TABLE IF NOT EXISTS enterprise_contracts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  deal_id TEXT, -- Loose reference to enterprise_deals(id)
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quote_id TEXT REFERENCES enterprise_quotes(id) ON DELETE SET NULL,
  contract_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'pending_signature', 'signed', 'active', 'suspended', 'terminated', 'expired')
  ),
  sla_uptime_percent REAL NOT NULL DEFAULT 99.9,
  mcu_capacity_monthly INTEGER NOT NULL CHECK (mcu_capacity_monthly >= 50000 AND mcu_capacity_monthly <= 500000),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  unit_price_per_mcu_cents REAL NOT NULL,
  volume_discount_percent REAL NOT NULL,
  monthly_commitment_cents INTEGER NOT NULL,
  annual_commitment_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'VND')),
  
  -- Cryptographic Integrity & SHA-256 Signatures
  contract_sha256 TEXT NOT NULL, -- 64-char hex SHA-256 digest of canonical terms
  terms_version TEXT NOT NULL DEFAULT '2026.1-ENTERPRISE-SLA',
  
  -- Customer Execution
  customer_signer_name TEXT,
  customer_signer_email TEXT,
  customer_signer_title TEXT,
  customer_signer_ip TEXT,
  customer_signature_hash TEXT,
  customer_signed_at INTEGER,
  
  -- Platform Execution
  platform_signature_hash TEXT,
  platform_signed_at INTEGER,
  
  -- Term & Lifecycle
  effective_date TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  payment_rail TEXT CHECK (payment_rail IN ('NOWPAYMENTS', 'PAYOS', 'MANUAL')),
  last_invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_enterprise_contracts_org_id ON enterprise_contracts(org_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_contracts_status ON enterprise_contracts(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_contracts_number ON enterprise_contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_enterprise_contracts_sha ON enterprise_contracts(contract_sha256);
