-- Migration 0506: Additive Manual Pilot Settlement & Audit Ledger (G3)
-- Supports Option A (BASIC pilot_14d, 1,990,000 VND, 500 MCU, 14 days, 0 cloud video renders).
-- Strictly additive: zero destructive drops/alters; safe for existing production D1 tables.

CREATE TABLE IF NOT EXISTS manual_pilot_settlements (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  org_id TEXT,
  sku_code TEXT NOT NULL DEFAULT 'BASIC_PILOT_14D',
  expected_amount_vnd INTEGER NOT NULL,
  received_amount_vnd INTEGER,
  transfer_reference TEXT NOT NULL,
  bank_transaction_ref TEXT UNIQUE,
  payer_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending_manual_payment'
    CHECK (status IN (
      'pending_manual_payment',
      'under_review',
      'activated',
      'rejected',
      'refund_pending',
      'refunded'
    )),
  reconciled_by_admin_id TEXT,
  reconciled_at TEXT,
  activated_at TEXT,
  entitlement_period_end TEXT,
  granted_mcu INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT UNIQUE,
  refund_id TEXT,
  refund_amount_vnd INTEGER,
  refund_reason TEXT,
  refund_external_ref TEXT,
  refund_requested_by TEXT,
  refund_requested_at TEXT,
  refund_confirmed_by TEXT,
  refund_confirmed_at TEXT,
  audit_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_manual_pilot_settlements_status_created
  ON manual_pilot_settlements (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_pilot_settlements_user
  ON manual_pilot_settlements (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_pilot_settlements_transfer_ref
  ON manual_pilot_settlements (transfer_reference);

CREATE TABLE IF NOT EXISTS manual_pilot_audit_log (
  id TEXT PRIMARY KEY,
  settlement_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN (
      'created',
      'approved_and_activated',
      'duplicate_rejected',
      'rejected',
      'refund_requested',
      'refund_confirmed'
    )),
  actor_admin_id TEXT,
  actor_role TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_manual_pilot_audit_log_order
  ON manual_pilot_audit_log (order_id, created_at DESC);
