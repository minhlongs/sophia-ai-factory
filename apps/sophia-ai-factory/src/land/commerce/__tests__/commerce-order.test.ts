/**
 * Unit tests: commerce order lifecycle — creation, pending→paid→fulfilled
 * transitions, idempotent re-confirmation, and zod validation rejections.
 * Real SQLite DB (shared D1 shim), no fake-pass mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn(), getD1: mockGetD1 }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  buildCommerceEventId,
  createOrder,
  getOrder,
  markOrderFulfilled,
  markOrderPaid,
} from '../commerce-order';

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
);`;

function seedProduct(
  raw: ReturnType<typeof freshDb>,
  overrides: { id?: string; priceCents?: number; isActive?: number } = {},
): string {
  const id = overrides.id ?? 'prod-1';
  raw
    .prepare(
      `INSERT INTO commerce_products (id, workspace_id, name, price_cents, currency, is_active, created_at, updated_at)
       VALUES (?, 'ws-1', 'Test Product', ?, 'USD', ?, 0, 0)`,
    )
    .run(id, overrides.priceCents ?? 4900, overrides.isActive ?? 1);
  return id;
}

function setupDb(): ReturnType<typeof freshDb> {
  const raw = freshDb();
  raw.exec(COMMERCE_TABLES);
  mockGetD1.mockReturnValue(makeD1(raw));
  return raw;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildCommerceEventId', () => {
  it('builds commerce_{productId}_{orderId} event ids', () => {
    expect(buildCommerceEventId('prod-1', 'ord-9')).toBe('commerce_prod-1_ord-9');
  });
});

describe('createOrder', () => {
  it('creates a pending order with amount = price x quantity', async () => {
    const raw = setupDb();
    seedProduct(raw, { priceCents: 4900 });

    const result = await createOrder({
      workspaceId: 'ws-1',
      productId: 'prod-1',
      quantity: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('pending');
    expect(result.value.amountCents).toBe(9800);
    expect(result.value.currency).toBe('USD');
    expect(result.value.paymentProvider).toBe('nowpayments');
    expect(result.value.externalPaymentId).toBeNull();
  });

  it('rejects invalid input via zod', async () => {
    setupDb();

    const result = await createOrder({ workspaceId: '', productId: 'prod-1' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('rejects when the product does not exist', async () => {
    setupDb();

    const result = await createOrder({ workspaceId: 'ws-1', productId: 'missing' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('rejects when the product is inactive', async () => {
    const raw = setupDb();
    seedProduct(raw, { isActive: 0 });

    const result = await createOrder({ workspaceId: 'ws-1', productId: 'prod-1' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PRODUCT_INACTIVE');
  });
});

describe('markOrderPaid', () => {
  async function createPendingOrder(): Promise<string> {
    const raw = setupDb();
    seedProduct(raw);
    const created = await createOrder({ workspaceId: 'ws-1', productId: 'prod-1' });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('setup failed');
    return created.value.id;
  }

  it('moves pending → paid and records the external payment id', async () => {
    const orderId = await createPendingOrder();

    const result = await markOrderPaid(orderId, 'np-123');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transitioned).toBe(true);
    expect(result.value.order.status).toBe('paid');
    expect(result.value.order.externalPaymentId).toBe('np-123');
  });

  it('is an idempotent no-op when the order is already paid', async () => {
    const orderId = await createPendingOrder();
    await markOrderPaid(orderId, 'np-123');

    const replay = await markOrderPaid(orderId, 'np-123');

    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.transitioned).toBe(false);
    expect(replay.value.order.status).toBe('paid');
  });

  it('returns NOT_FOUND for unknown orders', async () => {
    setupDb();

    const result = await markOrderPaid('missing-order', 'np-1');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });
});

describe('markOrderFulfilled', () => {
  it('moves a paid order to fulfilled', async () => {
    const raw = setupDb();
    seedProduct(raw);
    const created = await createOrder({ workspaceId: 'ws-1', productId: 'prod-1' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await markOrderPaid(created.value.id, 'np-1');

    const result = await markOrderFulfilled(created.value.id);

    expect(result.ok).toBe(true);
    const after = await getOrder(created.value.id);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.status).toBe('fulfilled');
  });

  it('getOrder returns NOT_FOUND for unknown orders', async () => {
    setupDb();

    const result = await getOrder('missing-order');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });
});
