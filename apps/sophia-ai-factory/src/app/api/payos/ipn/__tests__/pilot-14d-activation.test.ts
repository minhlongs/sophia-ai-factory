// @vitest-environment node
/**
 * Unit & integration tests for 14-Day Paid Pilot (`pilot_14d` — 1,990,000 VND / $79).
 * @module app/api/payos/ipn/__tests__/pilot-14d-activation.test
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import type { D1Client } from '@/seed/db/client';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import {
  PAID_PILOT_14_DAY_PRICE_CENTS,
  PAID_PILOT_14_DAY_PRICE_VND,
  PAID_PILOT_DURATION_DAYS,
} from '@/tree/finance/pilot-unit-economics-types';

const mocks = vi.hoisted(() => ({
  resolveOrgId: vi.fn(),
  sendReceiptEmail: vi.fn(),
  recordAudit: vi.fn(),
  writeOrder: vi.fn(),
  createPayOsInvoice: vi.fn(),
}));
const state = vi.hoisted(() => ({ db: null as D1Database | null }));

vi.mock('@/seed/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/seed/db/client')>();
  return { ...actual, getD1Safe: async () => state.db };
});

vi.mock('@/seed/auth/workspace-access', () => ({ resolveOrgId: mocks.resolveOrgId }));
vi.mock('@/land/billing/email/receipt-email-sender', () => ({ sendReceiptEmail: mocks.sendReceiptEmail }));
vi.mock('@/seed/db/audit/audit-log', () => ({ recordAudit: mocks.recordAudit }));
vi.mock('@/land/orders/pending-order-repo', () => ({
  writeOrder: mocks.writeOrder,
  markOrderCompleted: vi.fn(),
}));
vi.mock('@/land/payments/payos-gateway/payos-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/land/payments/payos-gateway/payos-service')>();
  return { ...actual, createPayOsInvoice: mocks.createPayOsInvoice };
});

import { getPayOsTierConfig } from '@/land/payments/payos';
import { findAndValidatePayOsOrder } from '../modules/tier-activator-validator';
import { activatePayOsTier } from '../modules/tier-activator';
import { calculatePayOsPeriodEnd } from '@/app/api/webhooks/payos/modules/payos-subscription';
import { dispatchPayOsMethod } from '@/app/api/checkout/modules/payment-dispatcher-providers';

interface FakeQueryResult {
  data: unknown;
  error: { message: string } | null;
}

function buildChainableQuery(result: FakeQueryResult) {
  const query = {
    select: () => query,
    eq: () => query,
    update: () => query,
    delete: () => query,
    single: async () => result,
    maybeSingle: async () => result,
    then: (resolve: (value: FakeQueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

describe('14-Day Paid Pilot (pilot_14d — 1,990,000 VND / $79)', () => {
  const prevUsdToVnd = process.env.USD_TO_VND;
  const prevFeaturePayOs = process.env.FEATURE_PAYOS;

  beforeEach(() => {
    vi.clearAllMocks();
    state.db = null;
    mocks.resolveOrgId.mockResolvedValue('org_pilot_1');
    mocks.sendReceiptEmail.mockResolvedValue(undefined);
    mocks.recordAudit.mockResolvedValue(undefined);
    mocks.writeOrder.mockResolvedValue(undefined);
  });

  afterEach(() => {
    state.db = null;
    if (prevUsdToVnd === undefined) delete process.env.USD_TO_VND;
    else process.env.USD_TO_VND = prevUsdToVnd;
    if (prevFeaturePayOs === undefined) delete process.env.FEATURE_PAYOS;
    else process.env.FEATURE_PAYOS = prevFeaturePayOs;
  });

  it('returns canonical 1,990,000 VND / $79 for BASIC pilot_14d without USD_TO_VND and rejects higher tiers', () => {
    delete process.env.USD_TO_VND;
    const config = getPayOsTierConfig('BASIC', 'pilot_14d');
    expect(config).toEqual({
      tier: 'BASIC',
      vndAmount: PAID_PILOT_14_DAY_PRICE_VND,
      usdAmount: PAID_PILOT_14_DAY_PRICE_CENTS / 100,
    });
    expect(config.vndAmount).toBe(1_990_000);
    expect(config.usdAmount).toBe(79);
    expect(() => getPayOsTierConfig('PREMIUM', 'pilot_14d')).toThrow(/BASIC/);
    expect(() => getPayOsTierConfig('ENTERPRISE', 'pilot_14d')).toThrow(/BASIC/);
    expect(() => getPayOsTierConfig('MASTER', 'pilot_14d')).toThrow(/BASIC/);
  });

  it('computes +14 day periodEnd in both findAndValidatePayOsOrder and calculatePayOsPeriodEnd', async () => {
    const fixedNow = new Date('2026-11-15T00:00:00.000Z').getTime();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow);
    const expectedIso = new Date(fixedNow + PAID_PILOT_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    try {
      expect(calculatePayOsPeriodEnd('BASIC', 'pilot_14d')).toEqual({ isLifetime: false, periodEnd: expectedIso });

      const pilotOrder = {
        order_id: 'sophia_user_pilot_1', user_id: 'user_pilot', tier: 'BASIC',
        period: 'pilot_14d', amount_vnd: null, invoice_url: 'https://pay.payos.vn/web/pilot-link-99',
        payment_method: 'payos', provider_order_code: 998877, provider_payment_id: 'pilot-link-99',
        status: 'pending',
      };
      const db = {
        from: vi.fn((table: string) =>
          buildChainableQuery({ data: table === 'pending_orders' ? [pilotOrder] : null, error: null }),
        ),
      } as unknown as D1Client;

      const validation = await findAndValidatePayOsOrder({
        db, orderCode: 998877, paymentLinkId: 'pilot-link-99', amount: 1_990_000, eventId: 'payos_998877',
      });
      expect(validation).toEqual({ ok: false, error: expect.stringContaining('manual review'), status: 409 });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('rejects automatic pilot activation before any batch or receipt effects', async () => {
    const pilotOrder = {
      order_id: 'sophia_user_pilot_2', user_id: 'user_pilot_2', tier: 'BASIC',
      period: 'pilot_14d', amount_vnd: 1_990_000, invoice_url: 'https://pay.payos.vn/web/pilot-link-2', payment_method: 'payos', provider_order_code: 776655,
    };
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'pending_orders') return buildChainableQuery({ data: [pilotOrder], error: null });
        if (table === 'user') return buildChainableQuery({ data: { name: 'CEO', email: 'ceo@agency.vn' }, error: null });
        return buildChainableQuery({ data: null, error: null });
      }),
    } as unknown as D1Client;
    const prepareCalls: string[] = [];
    const d1 = {
      prepare: vi.fn((sql: string) => {
        prepareCalls.push(sql);
        return { bind: vi.fn(() => ({
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(
            sql.includes('SELECT ?1 AS amount_vnd')
              ? { amount_vnd: PAID_PILOT_14_DAY_PRICE_VND }
              : { count: 0, id: null, tier: null, plan: null, status: null, current_period_start: null, current_period_end: null },
          ),
        })) };
      }),
      batch: vi.fn(async (statements: unknown[]) => statements.map(() => ({ success: true, meta: { changes: 1 } }))),
    } as unknown as D1Database;

    const result = await activatePayOsTier({
      db, d1, orderCode: 776655, paymentLinkId: 'pilot-link-2', amount: 1_990_000, eventId: 'payos_776655', lockCreatedAt: '2026-11-17T00:00:00.000Z', order: pilotOrder as unknown as import('@/land/orders/pending-order-types').PendingOrder,
    });

    expect(result).toEqual({ ok: false, error: expect.stringContaining('manual review'), status: 409 });
    expect(d1.batch).not.toHaveBeenCalled();
    expect(mocks.sendReceiptEmail).not.toHaveBeenCalled();
  });

  it('does not send a pilot receipt without committed evidence', async () => {
    const pilotOrder = {
      order_id: 'sophia_user_pilot_2', user_id: 'user_pilot_2', tier: 'BASIC',
      period: 'pilot_14d', amount_vnd: 1_990_000, invoice_url: 'https://pay.payos.vn/web/pilot-link-2', payment_method: 'payos', provider_order_code: 776655,
    };
    const db = {
      from: vi.fn((table: string) => table === 'pending_orders'
        ? buildChainableQuery({ data: [pilotOrder], error: null })
        : table === 'user' ? buildChainableQuery({ data: { name: 'CEO', email: 'ceo@agency.vn' }, error: null })
        : buildChainableQuery({ data: null, error: null })),
    } as unknown as D1Client;
    const d1 = {
      prepare: vi.fn((sql: string) => ({ bind: vi.fn(() => ({
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(sql.includes('SELECT ?1 AS amount_vnd') ? null
          : { count: 0, id: null, tier: null, plan: null, status: null, current_period_start: null, current_period_end: null }),
      })) })),
      batch: vi.fn(async (statements: unknown[]) => statements.map(() => ({ success: true, meta: { changes: 1 } }))),
    } as unknown as D1Database;
    const result = await activatePayOsTier({
      db, d1, orderCode: 776655, paymentLinkId: 'pilot-link-2', amount: 1_990_000, eventId: 'payos_776655',
      lockCreatedAt: '2026-11-17T00:00:00.000Z', order: pilotOrder as unknown as import('@/land/orders/pending-order-types').PendingOrder,
    });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('manual review'), status: 409 });
    expect(d1.batch).not.toHaveBeenCalled();
    expect(mocks.sendReceiptEmail).not.toHaveBeenCalled();
  });

});
