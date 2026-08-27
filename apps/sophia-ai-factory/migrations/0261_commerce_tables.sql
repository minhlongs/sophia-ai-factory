-- Migration: 0261_commerce_tables
-- Commerce Interfaces — digital product catalog, orders, and fulfillments.
-- All timestamps are MILLISECONDS (matches performance_events convention,
-- migration 0243: strftime('%s','now') * 1000).
-- Fully additive; uses IF NOT EXISTS for idempotent application.

CREATE TABLE IF NOT EXISTS commerce_products (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  product_type TEXT NOT NULL DEFAULT 'digital',   -- 'digital' | 'access'
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  asset_ref TEXT,                                 -- R2 key / access grant target
  is_active INTEGER NOT NULL DEFAULT 1,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_commerce_products_workspace
  ON commerce_products(workspace_id, is_active);

CREATE TABLE IF NOT EXISTS commerce_orders (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  buyer_user_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',         -- pending|paid|fulfilled|failed|refunded
  payment_provider TEXT NOT NULL DEFAULT 'nowpayments',
  external_payment_id TEXT,                       -- NOWPayments payment_id
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_commerce_orders_workspace
  ON commerce_orders(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_product
  ON commerce_orders(product_id, status);

CREATE TABLE IF NOT EXISTS commerce_fulfillments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',         -- pending|granted|failed
  grant_ref TEXT,                                 -- download URL / access token ref
  error TEXT,
  fulfilled_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  -- Idempotency: one fulfillment per order. Double-IPN re-delivery is a no-op.
  UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_commerce_fulfillments_order
  ON commerce_fulfillments(order_id);
