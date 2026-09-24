-- Migration 0289: Enterprise Billing, Multi-Currency & Automated E-Invoicing
-- Milestone 3 — Enterprise Scale Engine (Cross-Border Dual-Rail Billing, Dynamic Multi-Currency & E-Invoicing)

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  invoice_number TEXT NOT NULL UNIQUE,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subaccount_id TEXT,
  tier TEXT NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'annual' CHECK (billing_cycle IN ('monthly', 'annual', 'one_time')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'VND', 'EUR', 'JPY', 'SGD')),
  fx_rate REAL NOT NULL DEFAULT 1.0,
  tax_id TEXT,
  legal_name TEXT NOT NULL,
  billing_address TEXT NOT NULL,
  vat_rate REAL NOT NULL DEFAULT 0.0,
  vat_amount_cents INTEGER NOT NULL DEFAULT 0,
  total_amount_cents INTEGER NOT NULL,
  tax_form_type TEXT NOT NULL DEFAULT 'NONE' CHECK (tax_form_type IN ('W8_BEN', 'W9', 'NONE')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  pdf_r2_key TEXT,
  paid_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_subaccount_id ON invoices(subaccount_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
