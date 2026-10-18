import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1PreparedStatement } from '@cloudflare/workers-types';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { DbClient } from './payos-idempotency';

const mocks = vi.hoisted(() => ({
  resolveOrgId: vi.fn(),
  invalidateOrgIdCache: vi.fn(),
}));

vi.mock('@/seed/auth/workspace-access', () => ({ resolveOrgId: mocks.resolveOrgId }));
vi.mock('@/seed/auth/org-resolver', () => ({ invalidateOrgIdCache: mocks.invalidateOrgIdCache }));

import { activatePayOsSubscription } from './payos-subscription';

const order: PendingOrder = {
  order_id: 'sophia_user-1_123',
  user_id: 'user-1',
  tier: 'BASIC',
  period: 'monthly',
  payment_method: 'payos',
  amount_usd_cents: 19900,
  amount_vnd: 4975000,
  promo_code: null,
  customer_email: null,
  invoice_url: 'https://pay.payos.vn/web/link-1',
  provider_payment_id: 'link-1',
  status: 'pending',
  payment_id: null,
  created_at: '2026-10-18T00:00:00.000Z',
  completed_at: null,
};

function makeDb(batchResult?: Array<{ success: boolean; error?: string; meta: { changes: number } }>) {
  const prepared: Array<{ sql: string; values: unknown[] }> = [];
  const batch = vi.fn(async (statements: D1PreparedStatement[]) =>
    batchResult ?? statements.map(() => ({ success: true, meta: { changes: 1 } })),
  );
  const rawDb = {
    prepare(sql: string) {
      const record = { sql, values: [] as unknown[] };
      prepared.push(record);
      const statement = {
        bind(...args: unknown[]) {
          record.values = args;
          return statement;
        },
        async first<T>() {
          return null as T | null;
        },
      };
      return statement;
    },
    batch,
  };
  const db = {
    unwrap: () => rawDb,
    prepare: rawDb.prepare,
  } as unknown as DbClient;
  return { db, rawDb, prepared, batch };
}

describe('activatePayOsSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOrgId.mockResolvedValue(null);
  });

  it('creates a unique customer organization and commits activation without selecting an arbitrary org', async () => {
    const { db, prepared, batch } = makeDb();

    const result = await activatePayOsSubscription({
      db,
      userId: order.user_id,
      tier: 'BASIC',
      order,
      paymentLinkId: 'link-1',
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    });

    expect(result.orgId).toMatch(/^[0-9a-f-]{36}$/i);
    const organizationInsert = prepared.find(({ sql }) => sql.includes('INSERT INTO organizations'));
    const membershipInsert = prepared.find(({ sql }) => sql.includes('INSERT INTO org_members'));
    expect(organizationInsert?.values[0]).toBe(result.orgId);
    expect(membershipInsert?.values[0]).toBe(result.orgId);
    expect(organizationInsert?.sql).toContain('SELECT ?1, ?2, ?3, ?4, ?5, ?5 WHERE EXISTS');
    expect(prepared.some(({ sql }) => sql.includes('SELECT id FROM organizations'))).toBe(false);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateOrgIdCache).toHaveBeenCalledWith(order.user_id);
  });

  it('fails activation if the D1 batch reports a write failure', async () => {
    const failedResult = Array.from({ length: 6 }, () => ({
      success: false,
      error: 'write failed',
      meta: { changes: 0 },
    }));
    const { db } = makeDb(failedResult);

    await expect(activatePayOsSubscription({
      db,
      userId: order.user_id,
      tier: 'BASIC',
      order,
      paymentLinkId: 'link-1',
      lockCreatedAt: '2026-10-18T00:00:00.000Z',
    })).rejects.toThrow('PayOS entitlement transaction failed');
    expect(mocks.invalidateOrgIdCache).not.toHaveBeenCalled();
  });
});
