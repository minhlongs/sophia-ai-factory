# Phase 2: Database Schema for Overage Billing

## Overview
Tạo database schema cho overage billing, dunning workflow, và quota tracking.

## Migration Files

### 2.1 Overage Charges Table

**File:** `supabase/migrations/20260308_create_overage_charges_table.sql`

```sql
-- =====================================================
-- overage_charges table
-- =====================================================

CREATE TABLE IF NOT EXISTS overage_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- License identification
  license_nonce TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_item_id TEXT,

  -- Billing period
  billing_period_start INTEGER NOT NULL, -- Unix timestamp
  billing_period_end INTEGER NOT NULL,

  -- Usage metrics
  total_credits INTEGER NOT NULL DEFAULT 0,
  included_credits INTEGER NOT NULL DEFAULT 0,
  overage_credits INTEGER NOT NULL DEFAULT 0,

  -- Pricing
  overage_rate_per_credit NUMERIC(10,4) NOT NULL, -- in cents
  charge_amount_cents INTEGER NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Calculated, not yet reported
    'reported',     -- Sent to Stripe
    'invoiced',     -- Invoice created by Stripe
    'paid',         -- Payment successful
    'failed',       -- Payment failed
    'cancelled'     -- Manually cancelled
  )),

  -- Stripe references
  stripe_usage_record_id TEXT,
  stripe_invoice_id TEXT,
  stripe_invoice_item_id TEXT,

  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  reported_at TIMESTAMPTZ,
  invoiced_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_overage_charges_unique
  ON overage_charges(license_nonce, billing_period_start, billing_period_end);

CREATE INDEX idx_overage_charges_license
  ON overage_charges(license_nonce, created_at DESC);

CREATE INDEX idx_overage_charges_status
  ON overage_charges(status, created_at);

CREATE INDEX idx_overage_charges_stripe_customer
  ON overage_charges(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX idx_overage_charges_billing_period
  ON overage_charges(billing_period_start, billing_period_end);

-- RLS Policies
ALTER TABLE overage_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON overage_charges
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can view own overage charges"
  ON overage_charges
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM raas_licenses
    WHERE raas_licenses.nonce = overage_charges.license_nonce
    AND raas_licenses.metadata->>'userId' = auth.uid()::TEXT
  ));

-- Comments
COMMENT ON TABLE overage_charges IS 'Tracks overage charges for metered billing';
COMMENT ON COLUMN overage_charges.status IS 'Current status: pending, reported, invoiced, paid, failed, cancelled';
COMMENT ON COLUMN overage_charges.overage_credits IS 'Number of credits that exceeded the tier quota';
COMMENT ON COLUMN overage_charges.charge_amount_cents IS 'Total charge amount in cents';
```

### 2.2 Dunning Attempts Table

**File:** `supabase/migrations/20260308_create_dunning_attempts_table.sql`

```sql
-- =====================================================
-- dunning_attempts table
-- =====================================================

CREATE TABLE IF NOT EXISTS dunning_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- License identification
  license_nonce TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- Invoice reference
  stripe_invoice_id TEXT NOT NULL,
  invoice_amount_cents INTEGER NOT NULL,
  invoice_due_date TIMESTAMPTZ,

  -- Dunning configuration (snapshot at attempt time)
  dunning_settings_id UUID,
  max_retries INTEGER NOT NULL DEFAULT 3,
  retry_interval_hours INTEGER NOT NULL DEFAULT 24,
  grace_period_hours INTEGER NOT NULL DEFAULT 72,

  -- Attempt tracking
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Waiting to retry
    'retrying',     -- Retry in progress
    'succeeded',    -- Payment successful
    'failed',       -- All retries exhausted
    'cancelled',    -- Manually cancelled
    'grace_period'  -- In grace period
  )),

  -- Payment method tracking
  payment_method_id TEXT,
  payment_method_type TEXT,
  payment_failure_code TEXT,
  payment_failure_message TEXT,

  -- Retry scheduling
  scheduled_retry_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Grace period tracking
  grace_period_started_at TIMESTAMPTZ,
  grace_period_ends_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dunning_attempts_license
  ON dunning_attempts(license_nonce, created_at DESC);

CREATE INDEX idx_dunning_attempts_status
  ON dunning_attempts(status, scheduled_retry_at)
  WHERE status IN ('pending', 'retrying', 'grace_period');

CREATE INDEX idx_dunning_attempts_stripe_invoice
  ON dunning_attempts(stripe_invoice_id);

CREATE INDEX idx_dunning_attempts_scheduled_retry
  ON dunning_attempts(scheduled_retry_at)
  WHERE status = 'pending';

CREATE INDEX idx_dunning_attempts_grace_period
  ON dunning_attempts(grace_period_ends_at)
  WHERE status = 'grace_period';

-- RLS Policies
ALTER TABLE dunning_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON dunning_attempts
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Comments
COMMENT ON TABLE dunning_attempts IS 'Tracks dunning workflow attempts for failed payments';
COMMENT ON COLUMN dunning_attempts.status IS 'Current status: pending, retrying, succeeded, failed, cancelled, grace_period';
COMMENT ON COLUMN dunning_attempts.attempt_number IS 'Current retry attempt number (1-based)';
COMMENT ON COLUMN dunning_attempts.grace_period_ends_at IS 'Timestamp when grace period expires';
```

### 2.3 Dunning Settings Table

**File:** `supabase/migrations/20260308_create_dunning_settings_table.sql`

```sql
-- =====================================================
-- dunning_settings table
-- =====================================================

CREATE TABLE IF NOT EXISTS dunning_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Configuration name
  name TEXT NOT NULL,
  description TEXT,

  -- Retry configuration
  max_retry_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_retry_attempts >= 0 AND max_retry_attempts <= 10),
  retry_interval_hours INTEGER NOT NULL DEFAULT 24 CHECK (retry_interval_hours >= 1),

  -- Grace period configuration
  grace_period_enabled BOOLEAN DEFAULT true,
  grace_period_hours INTEGER DEFAULT 72 CHECK (grace_period_hours >= 0),

  -- Escalation settings
  escalate_to_admin_after_failures INTEGER DEFAULT 3,
  notify_customer_on_retry BOOLEAN DEFAULT true,
  notify_customer_on_grace_period BOOLEAN DEFAULT true,

  -- Amount thresholds
  min_amount_cents_to_dun INTEGER DEFAULT 100, -- $1.00 minimum
  max_amount_cents_to_dun INTEGER, -- No maximum if null

  -- Applicable tiers (JSON array of tier names, empty = all tiers)
  applicable_tiers JSONB DEFAULT '[]'::jsonb,

  -- Active flag
  is_active BOOLEAN DEFAULT true,

  -- Priority (higher = evaluated first)
  priority INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Indexes
CREATE UNIQUE INDEX idx_dunning_settings_name
  ON dunning_settings(name)
  WHERE is_active = true;

CREATE INDEX idx_dunning_settings_active
  ON dunning_settings(is_active, priority DESC);

-- Insert default settings
INSERT INTO dunning_settings (
  name,
  description,
  max_retry_attempts,
  retry_interval_hours,
  grace_period_enabled,
  grace_period_hours,
  applicable_tiers,
  is_active,
  priority
) VALUES (
  'Default Dunning Configuration',
  'Default configuration for all tiers: 3 retries every 24 hours with 72-hour grace period',
  3,
  24,
  true,
  72,
  '[]'::jsonb,
  true,
  0
) ON CONFLICT DO NOTHING;

-- Insert enterprise tier settings (higher priority)
INSERT INTO dunning_settings (
  name,
  description,
  max_retry_attempts,
  retry_interval_hours,
  grace_period_enabled,
  grace_period_hours,
  applicable_tiers,
  is_active,
  priority
) VALUES (
  'Enterprise Dunning Configuration',
  'Extended configuration for enterprise tier: 5 retries every 48 hours with 168-hour grace period',
  5,
  48,
  true,
  168,
  '["ENTERPRISE", "MASTER"]'::jsonb,
  true,
  10
) ON CONFLICT DO NOTHING;

-- RLS Policies
ALTER TABLE dunning_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON dunning_settings
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Admins can manage dunning settings"
  ON dunning_settings
  FOR ALL
  USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Users can view active settings"
  ON dunning_settings
  FOR SELECT
  USING (is_active = true);

-- Comments
COMMENT ON TABLE dunning_settings IS 'Configuration for dunning workflow behavior';
COMMENT ON COLUMN dunning_settings.max_retry_attempts IS 'Maximum number of retry attempts before marking as failed';
COMMENT ON COLUMN dunning_settings.grace_period_hours IS 'Hours after final retry failure before service suspension';
COMMENT ON COLUMN dunning_settings.applicable_tiers IS 'JSON array of tier names this config applies to; empty = all tiers';
```

## Verification

### Check Tables Created
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('overage_charges', 'dunning_attempts', 'dunning_settings');
```

### Verify Indexes
```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('overage_charges', 'dunning_attempts', 'dunning_settings');
```

### Verify RLS Policies
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('overage_charges', 'dunning_attempts', 'dunning_settings');
```
