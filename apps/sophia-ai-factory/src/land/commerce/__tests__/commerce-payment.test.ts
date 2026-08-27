/**
 * Unit tests: commerce payment confirmation — the NOWPayments IPN →
 * commerce bridge. Covers pending→paid marking, replay idempotency,
 * validation rejections, and the fulfillment enqueue contract.
 * Real SQLite DB (shared D1 shim); only the Inngest send boundary is mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

const { mockGetD1, mockSend } = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  mockSend: vi.fn(),
}));
vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn(), getD1: mockGetD1 }));
vi.mock('@/seed/inngest/client', () => ({ inngest: { send: mockSend } }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { confirmCommercePayment } from '../commerce-payment';
import { createOrder } from '../commerce-order';

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

function setupDb(): ReturnType<typeof freshDb> {
  const raw = freshDb();
  raw.exec(COMMERCE_TABLES);
  raw
    .prepare(
      `INSERT INTO commerce_products (id, workspace_id, name, price_cents, currency, is_active, created_at, updated_at)
       VALUES ('prod-1', 'ws-1', 'Test Product', 4900, 'USD', 1, 0, 0)`,
    )
    .run();
  mockGetD1.mockReturnValue(makeD1(raw));
  return raw;
}

async function createPendingOrder(): Promise<string> {
  const created = await createOrder({ workspaceId: 'ws-1', productId: 'prod-1' });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error('setup failed');
  return created.value.id;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue(undefined);
});

describe('confirmCommercePayment', () => {
  it('marks a pending order paid and enqueues fulfillment', async () => {
    setupDb();
    const orderId = await createPendingOrder();

    const result = await confirmCommercePayment({
      orderId,
      paymentId: 'np-123',
      paymentStatus: 'confirmed',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.markedPaid).toBe(true);
    expect(result.value.enqueued).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'commerce/payment.confirmed',
        data: expect.objectContaining({
          orderId,
          productId: 'prod-1',
          workspaceId: 'ws-1',
          paymentId: 'np-123',
          amountCents: 4900,
          currency: 'USD',
        }),
      }),
    );

    const db = mockGetD1() as ReturnType<typeof makeD1>;
    const row = await db
      .prepare('SELECT status, external_payment_id FROM commerce_orders WHERE id = ?1')
      .bind(orderId)
      .first<{ status: string; external_payment_id: string | null }>();
    expect(row?.status).toBe('paid');
    expect(row?.external_payment_id).toBe('np-123');
  });

  it('is idempotent on replay: already-paid order stays paid, no double mark', async () => {
    setupDb();
    const orderId = await createPendingOrder();
    await confirmCommercePayment({ orderId, paymentId: 'np-123', paymentStatus: 'confirmed' });

    const replay = await confirmCommercePayment({
      orderId,
      paymentId: 'np-123',
      paymentStatus: 'finished',
    });

    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.markedPaid).toBe(false);
    expect(replay.value.enqueued).toBe(true);
  });

  it('rejects invalid payloads via zod', async () => {
    setupDb();

    const result = await confirmCommercePayment({ orderId: 'ord-1', paymentStatus: 'confirmed' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_INPUT');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('rejects unknown orders with ORDER_NOT_FOUND (webhook fall-through)', async () => {
    setupDb();

    const result = await confirmCommercePayment({
      orderId: 'missing',
      paymentId: 'np-1',
      paymentStatus: 'confirmed',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ORDER_NOT_FOUND');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('refuses confirmation for a failed order', async () => {
    setupDb();
    const orderId = await createPendingOrder();
    const db = mockGetD1() as ReturnType<typeof makeD1>;
    await db.prepare(`UPDATE commerce_orders SET status = 'failed' WHERE id = ?1`).bind(orderId).run();

    const result = await confirmCommercePayment({
      orderId,
      paymentId: 'np-1',
      paymentStatus: 'confirmed',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('WRITE_FAILED');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('surfaces enqueue failure so the caller can retry', async () => {
    setupDb();
    const orderId = await createPendingOrder();
    mockSend.mockRejectedValueOnce(new Error('inngest down'));

    const result = await confirmCommercePayment({
      orderId,
      paymentId: 'np-1',
      paymentStatus: 'confirmed',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('WRITE_FAILED');
    expect(result.error.message).toContain('enqueue failed');
  });
});
