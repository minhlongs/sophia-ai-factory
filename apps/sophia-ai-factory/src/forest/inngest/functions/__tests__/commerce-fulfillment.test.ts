/**
 * Unit tests: commerce-fulfillment Inngest function — the
 * payment-confirmed → fulfill → revenue-event path.
 *
 * The Inngest client boundary is mocked (createFunction captures the
 * handler, send is observed); the land commerce modules run against a real
 * SQLite DB via the shared D1 shim — no fake-pass mocks on the domain code.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

const { mockGetD1, mockSend, handlers } = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  mockSend: vi.fn(),
  handlers: [] as Array<(ctx: unknown) => Promise<unknown>>,
}));

vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn(), getD1: mockGetD1 }));
vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: (_cfg: unknown, _evt: unknown, handler: (ctx: unknown) => Promise<unknown>) => {
      handlers.push(handler);
      return handler;
    },
    send: mockSend,
  },
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import '@/forest/inngest/functions/commerce-fulfillment';
import { createOrder, markOrderPaid } from '@/land/commerce/commerce-order';

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

type HandlerResult =
  | {
      ok: true;
      orderId: string;
      granted: boolean;
      fulfillmentId: string;
      revenueExternalId: string;
    }
  | { ok: false; orderId: string; code: string; message: string };

const handler = handlers[0] as (ctx: {
  event: { data: Record<string, unknown> };
  step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> };
}) => Promise<HandlerResult>;

const step = { run: (_name: string, fn: () => Promise<unknown>) => fn() };

function eventData(orderId: string) {
  return {
    orderId,
    productId: 'prod-1',
    workspaceId: 'ws-1',
    paymentId: 'np-123',
    amountCents: 4900,
    currency: 'USD',
  };
}

function setupDb(): ReturnType<typeof freshDb> {
  const raw = freshDb();
  raw.exec(COMMERCE_TABLES);
  raw
    .prepare(
      `INSERT INTO commerce_products (id, workspace_id, name, price_cents, currency, asset_ref, is_active, created_at, updated_at)
       VALUES ('prod-1', 'ws-1', 'Test Product', 4900, 'USD', 'r2://course-pack.zip', 1, 0, 0)`,
    )
    .run();
  mockGetD1.mockReturnValue(makeD1(raw));
  return raw;
}

async function createPaidOrder(): Promise<string> {
  const created = await createOrder({ workspaceId: 'ws-1', productId: 'prod-1' });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error('setup failed');
  const paid = await markOrderPaid(created.value.id, 'np-123');
  expect(paid.ok).toBe(true);
  return created.value.id;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue(undefined);
});

describe('commerceFulfillment', () => {
  it('fulfills a paid order and emits the commerce revenue event', async () => {
    setupDb();
    const orderId = await createPaidOrder();

    const result = await handler({ event: { data: eventData(orderId) }, step });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.granted).toBe(true);
    expect(result.fulfillmentId).toMatch(/^cful_/);
    expect(result.revenueExternalId).toBe(`commerce_prod-1_${orderId}`);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'revenue/event.recorded',
        data: expect.objectContaining({
          source: 'commerce',
          externalId: `commerce_prod-1_${orderId}`,
          amountCents: 4900,
          currency: 'USD',
          workspaceId: 'ws-1',
        }),
      }),
    );
  });

  it('is idempotent on redelivery: second run grants nothing but still emits revenue', async () => {
    setupDb();
    const orderId = await createPaidOrder();

    const first = await handler({ event: { data: eventData(orderId) }, step });
    const second = await handler({ event: { data: eventData(orderId) }, step });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.granted).toBe(true);
    expect(second.granted).toBe(false);

    const db = mockGetD1() as ReturnType<typeof makeD1>;
    const count = await db
      .prepare('SELECT COUNT(*) AS n FROM commerce_fulfillments WHERE order_id = ?1')
      .bind(orderId)
      .first<{ n: number }>();
    expect(count?.n).toBe(1);
    // Revenue emitted twice is safe: the ingestion lock dedupes by event id.
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('throws for a not-yet-paid order so Inngest retries', async () => {
    setupDb();
    const created = await createOrder({ workspaceId: 'ws-1', productId: 'prod-1' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await expect(
      handler({ event: { data: eventData(created.value.id) }, step }),
    ).rejects.toThrow(/ORDER_NOT_PAID/);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns a terminal failure for unknown orders', async () => {
    setupDb();

    const result = await handler({ event: { data: eventData('missing-order') }, step });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('ORDER_NOT_FOUND');
    expect(mockSend).not.toHaveBeenCalled();
  });
});
