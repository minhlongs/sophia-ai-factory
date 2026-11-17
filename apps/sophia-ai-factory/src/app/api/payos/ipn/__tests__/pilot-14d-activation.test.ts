/**
 * Unit & integration tests for 14-Day Paid Pilot (`pilot_14d` — 1,990,000 VND / $79).
 * @module app/api/payos/ipn/__tests__/pilot-14d-activation.test
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import type { D1Client } from '@/seed/db/client';
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
    then: (resolve: (v: FakeQueryResult) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

describe('14-Day Paid Pilot (pilot_14d — 1,990,000 VND / $79)', () => {
  const prevUsdToVnd = process.env.USD_TO_VND;
  const prevFeaturePayOs = process.env.FEATURE_PAYOS;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOrgId.mockResolvedValue('org_pilot_1');
    mocks.sendReceiptEmail.mockResolvedValue(undefined);
    mocks.recordAudit.mockResolvedValue(undefined);
    mocks.writeOrder.mockResolvedValue(undefined);
  });

  afterEach(() => {
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
      };
      const db = {
        from: vi.fn((table: string) =>
          buildChainableQuery({ data: table === 'pending_orders' ? [pilotOrder] : null, error: null }),
        ),
      } as unknown as D1Client;

      const validation = await findAndValidatePayOsOrder({
        db, orderCode: 998877, paymentLinkId: 'pilot-link-99', amount: 1_990_000, eventId: 'payos_998877',
      });
      expect(validation).toEqual({
        ok: true,
        data: {
          orderId: 'sophia_user_pilot_1', userId: 'user_pilot', tier: 'BASIC',
          billingPeriod: 'pilot_14d', periodEnd: expectedIso, orgId: 'org_pilot_1', subaccountId: undefined,
        },
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('activates BASIC for 14 days end-to-end and sends accurate $79 pilot_14d receipt', async () => {
    const pilotOrder = {
      order_id: 'sophia_user_pilot_2', user_id: 'user_pilot_2', tier: 'BASIC',
      period: 'pilot_14d', amount_vnd: 1_990_000, invoice_url: 'https://pay.payos.vn/web/pilot-link-2',
    };
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'pending_orders') return buildChainableQuery({ data: [pilotOrder], error: null });
        if (table === 'user') return buildChainableQuery({ data: { name: 'CEO', email: 'ceo@agency.vn' }, error: null });
        return buildChainableQuery({ data: null, error: null });
      }),
    } as unknown as D1Client;
    const d1 = {
      prepare: vi.fn(() => ({ bind: vi.fn(() => ({
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue({ count: 0, id: null, tier: null, plan: null, status: null, current_period_start: null, current_period_end: null }),
      })) })),
      batch: vi.fn(async (statements: unknown[]) => statements.map(() => ({ success: true, meta: { changes: 1 } }))),
    } as unknown as D1Database;

    const result = await activatePayOsTier({
      db, d1, orderCode: 776655, paymentLinkId: 'pilot-link-2', amount: 1_990_000, eventId: 'payos_776655',
    });

    expect(result).toEqual({ ok: true });
    expect(d1.batch).toHaveBeenCalledTimes(1);
    expect(mocks.sendReceiptEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ceo@agency.vn',
        tier: 'BASIC',
        period: 'pilot_14d',
        amountUsd: 79,
        paymentMethod: 'payos',
      }),
    );
  });

  it('creates an offline_pilot_fallback pending order when FEATURE_PAYOS !== true and uses PayOS when enabled', async () => {
    process.env.FEATURE_PAYOS = 'false';
    const fallbackRes = await dispatchPayOsMethod({
      paymentMethod: 'payos', tier: 'BASIC', userId: 'u_pilot', period: 'pilot_14d', customerEmail: 'ceo@sme.vn',
    });
    expect(fallbackRes.status).toBe(200);
    await expect(fallbackRes.json()).resolves.toMatchObject({
      status: 'pending_manual_payment', provider: 'offline_pilot_fallback', amountVnd: 1_990_000, amountUsd: 79,
    });
    expect(mocks.writeOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 'BASIC', period: 'pilot_14d', payment_method: 'offline', amount_usd_cents: 7900, amount_vnd: 1_990_000,
      }),
    );

    process.env.FEATURE_PAYOS = 'true';
    mocks.createPayOsInvoice.mockResolvedValueOnce({
      checkoutUrl: 'https://pay.payos.vn/web/live-pilot', qrUrl: 'https://pay.payos.vn/qr/live-pilot',
      paymentLinkId: 'live-pilot', orderCode: 554433, expiresAt: '2026-11-15T01:00:00.000Z',
    });
    const liveRes = await dispatchPayOsMethod({ paymentMethod: 'payos', tier: 'BASIC', userId: 'u_pilot', period: 'pilot_14d' });
    expect(liveRes.status).toBe(200);
    await expect(liveRes.json()).resolves.toMatchObject({ url: 'https://pay.payos.vn/web/live-pilot', provider: 'payos', orderCode: 554433 });
  });
});
