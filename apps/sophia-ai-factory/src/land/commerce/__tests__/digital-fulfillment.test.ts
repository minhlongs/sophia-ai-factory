/**
 * Unit tests: digital fulfillment — grant on paid order, idempotency
 * (double-fulfill → exactly one row), precondition enforcement.
 * Real SQLite DB (shared D1 shim), no fake-pass mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn(), getD1: mockGetD1 }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createOrder, markOrderPaid } from '../commerce-order';
import { buildGrantRef, fulfillOrder } from '../digital-fulfillment';

const COMMERCE_TABLES = `
CREATE TABLE IF NOT EXISTS commerce_products (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  product_type TEXT NOT NULL DEFAULT 'digital',
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  asset_ref TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS commerce_orders (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  buyer_user_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_provider TEXT NOT NULL DEFAULT 'nowpayments',
  external_payment_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS commerce_fulfillments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  grant_ref TEXT,
  error TEXT,
  fulfilled_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT 0
);`;

function setupDb(assetRef: string | null = 'r2://course-pack.zip'): ReturnType<typeof freshDb> {
  const raw = freshDb();
  raw.exec(COMMERCE_TABLES);
  raw
    .prepare(
      `INSERT INTO commerce_products (id, workspace_id, name, price_cents, currency, asset_ref, is_active, created_at, updated_at)
       VALUES ('prod-1', 'ws-1', 'Test Product', 4900, 'USD', ?, 1, 0, 0)`,
    )
    .run(assetRef);
  mockGetD1.mockReturnValue(makeD1(raw));
  return raw;
}

async function createPaidOrder(): Promise<string> {
  const created = await createOrder({ workspaceId: 'ws-1', productId: 'prod-1' });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error('setup failed');
  const paid = await markOrderPaid(created.value.id, 'np-1');
  expect(paid.ok).toBe(true);
  return created.value.id;
}

async function countFulfillmentRows(orderId: string): Promise<number> {
  const db = mockGetD1() as ReturnType<typeof makeD1>;
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM commerce_fulfillments WHERE order_id = ?1')
    .bind(orderId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildGrantRef', () => {
  it('uses access:<assetRef> when the product has an asset', () => {
    expect(buildGrantRef('r2://pack.zip', 'ord-1')).toBe('access:r2://pack.zip');
  });

  it('falls back to download:<orderId> without an asset', () => {
    expect(buildGrantRef(null, 'ord-1')).toBe('download:ord-1');
  });
});

describe('fulfillOrder', () => {
  it('grants the delivery asset and moves the order to fulfilled', async () => {
    setupDb();
    const orderId = await createPaidOrder();

    const result = await fulfillOrder(orderId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.alreadyFulfilled).toBe(false);
    expect(result.value.grantRef).toBe('access:r2://course-pack.zip');

    const db = mockGetD1() as ReturnType<typeof makeD1>;
    const orderRow = await db
      .prepare('SELECT status FROM commerce_orders WHERE id = ?1')
      .bind(orderId)
      .first<{ status: string }>();
    expect(orderRow?.status).toBe('fulfilled');
    const fulRow = await db
      .prepare('SELECT status, grant_ref FROM commerce_fulfillments WHERE order_id = ?1')
      .bind(orderId)
      .first<{ status: string; grant_ref: string }>();
    expect(fulRow?.status).toBe('granted');
    expect(fulRow?.grant_ref).toBe('access:r2://course-pack.zip');
  });

  it('falls back to the download grant when no asset is configured', async () => {
    setupDb(null);
    const orderId = await createPaidOrder();

    const result = await fulfillOrder(orderId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.grantRef).toBe(`download:${orderId}`);
  });

  it('is idempotent: double-fulfill writes exactly one row', async () => {
    setupDb();
    const orderId = await createPaidOrder();

    const first = await fulfillOrder(orderId);
    const second = await fulfillOrder(orderId);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.alreadyFulfilled).toBe(false);
    expect(second.value.alreadyFulfilled).toBe(true);
    expect(second.value.fulfillmentId).toBe(first.value.fulfillmentId);
    expect(await countFulfillmentRows(orderId)).toBe(1);
  });

  it('refuses to fulfill a pending order', async () => {
    setupDb();
    const created = await createOrder({ workspaceId: 'ws-1', productId: 'prod-1' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await fulfillOrder(created.value.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ORDER_NOT_PAID');
    expect(await countFulfillmentRows(created.value.id)).toBe(0);
  });

  it('returns ORDER_NOT_FOUND for unknown orders', async () => {
    setupDb();

    const result = await fulfillOrder('missing-order');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ORDER_NOT_FOUND');
  });
});
