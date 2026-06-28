-- Migration 0065: Handover source tracking
-- Adds source column to distinguish auto-IPN handovers from manual admin wizard.
-- Also adds trigger_payment_id for idempotency checks.

ALTER TABLE customer_handovers ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'auto_payment', 'auto_signup'));

ALTER TABLE customer_handovers ADD COLUMN trigger_payment_id TEXT;

CREATE INDEX IF NOT EXISTS customer_handovers_source_idx
  ON customer_handovers(source, created_at);

CREATE INDEX IF NOT EXISTS customer_handovers_payment_idx
  ON customer_handovers(trigger_payment_id);
