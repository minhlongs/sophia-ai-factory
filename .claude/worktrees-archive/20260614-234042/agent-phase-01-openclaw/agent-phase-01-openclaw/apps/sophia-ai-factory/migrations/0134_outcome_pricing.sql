CREATE TABLE IF NOT EXISTS outcome_pricing_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  percentage REAL NOT NULL DEFAULT 15.0,
  min_revenue_cents INTEGER NOT NULL DEFAULT 0,
  max_revenue_cents INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pricing_tier_active ON outcome_pricing_tiers(is_active);

CREATE TABLE IF NOT EXISTS outcome_billing_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  outcome_id TEXT,
  gross_revenue_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL,
  fee_percentage REAL NOT NULL,
  pricing_tier_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  settled_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_billing_user ON outcome_billing_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_status ON outcome_billing_events(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_execution ON outcome_billing_events(execution_id);
