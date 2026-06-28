-- Migration 0064: Customer Handovers
-- Tracks the full lifecycle of agency customer onboarding from contract to activation.

CREATE TABLE IF NOT EXISTS customer_handovers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  customer_user_id TEXT NOT NULL,
  agency_name TEXT NOT NULL,
  agency_type TEXT,
  tier TEXT NOT NULL,
  starter_sops TEXT,  -- JSON array of SOP slugs pre-installed
  magic_link_token TEXT UNIQUE,
  magic_link_expires_at INTEGER,
  created_by_admin_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  welcome_email_sent_at INTEGER,
  customer_first_login_at INTEGER,
  customer_first_sop_install_at INTEGER,
  customer_first_run_at INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','at_risk','churned'))
);

CREATE INDEX IF NOT EXISTS customer_handovers_admin_idx
  ON customer_handovers(created_by_admin_id, created_at);

CREATE INDEX IF NOT EXISTS customer_handovers_status_idx
  ON customer_handovers(status);

CREATE INDEX IF NOT EXISTS customer_handovers_token_idx
  ON customer_handovers(magic_link_token);

CREATE INDEX IF NOT EXISTS customer_handovers_user_idx
  ON customer_handovers(customer_user_id);
