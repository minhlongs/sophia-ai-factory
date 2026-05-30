-- Migration 0071: add receipt_sent flag to payment_events
-- Enables idempotent receipt email sending — skip if already sent for payment_id.

ALTER TABLE payment_events ADD COLUMN receipt_sent INTEGER DEFAULT 0;
