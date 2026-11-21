import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { D1Database } from '@cloudflare/workers-types';
import type { D1Client } from '@/seed/db/client';

const hoisted = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getD1: vi.fn(),
  addCredits: vi.fn(),
  verifyCronAuth: vi.fn(),
  wasRecentlyRun: vi.fn(),
  recordCronRun: vi.fn(),
  buildPublisher: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: hoisted.createServerClient,
  getD1: hoisted.getD1,
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  addCredits: hoisted.addCredits,
}));

vi.mock('@/seed/security/cron-auth', () => ({
  verifyCronAuth: hoisted.verifyCronAuth,
}));

vi.mock('@/land/cron/run-tracker', () => ({
  wasRecentlyRun: hoisted.wasRecentlyRun,
  recordCronRun: hoisted.recordCronRun,
}));

vi.mock('@/land/video/publishing/upload/publisher-factory', () => ({
  buildPublisher: hoisted.buildPublisher,
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  resolveOrgId: vi.fn().mockResolvedValue('org_1'),
}));

vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import { uploadToProvider } from '@/land/video/publishing/upload/upload-executor';
import { ProvenanceBlockedError } from '@/tree/publishing/synthetic-media-disclosure';
import { queryActiveCustomerSubscription } from '@/land/billing/customer-subscription-query';
import { commitPayOsSubscriptionBatch } from '@/app/api/payos/ipn/modules/payroll-subscription';
import { acquireEventLock, handleFailedPayment } from '@/app/api/payos/ipn/modules/event-locker';
import { findAndValidatePayOsOrder } from '@/app/api/payos/ipn/modules/tier-activator-validator';
import { mapLedgerRow } from '@/tree/publishing/approval/ledger-store';
import { GET as mcuMonthlyResetGet } from '@/app/api/cron/mcu-monthly-reset/route';
import { POST as payosCheckoutPost } from '@/app/api/payos/route';
import { POST as payosIpnPost } from '@/app/api/payos/ipn/route';

describe('Genesis-08 changed-branch coverage suite', () => {
  const savedFeaturePayos = process.env.FEATURE_PAYOS;
  const savedChecksumKey = process.env.PAYOS_CHECKSUM_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.verifyCronAuth.mockReturnValue(null);
    hoisted.wasRecentlyRun.mockResolvedValue(false);
    hoisted.addCredits.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (savedFeaturePayos === undefined) delete process.env.FEATURE_PAYOS;
    else process.env.FEATURE_PAYOS = savedFeaturePayos;
    if (savedChecksumKey === undefined) delete process.env.PAYOS_CHECKSUM_KEY;
    else process.env.PAYOS_CHECKSUM_KEY = savedChecksumKey;
  });

  describe('uploadToProvider error classification (retryable vs terminal)', () => {
    function makeUploadArgs(errToThrow: unknown, retryCount = 0) {
      const scheduleRetry = vi.fn().mockResolvedValue(undefined);
      const eq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn(() => ({ eq }));
      hoisted.buildPublisher.mockReturnValue({
        upload: vi.fn().mockRejectedValue(errToThrow),
      });
      return {
        scheduleRetry,
        update,
        args: {
          channel: { id: 'ch_1', provider: 'youtube' } as never,
          accessToken: 'tok',
          videoUrl: 'https://cdn.example.com/v.mp4',
          job: {
            caption: 'hello',
            hashtags_json: '["#ai"]',
            title: 'Title',
            product_link: 'https://shop.example.com',
            privacy_status: 'private',
          } as never,
          db: { from: vi.fn(() => ({ update })) } as never,
          jobId: 'job_1',
          retryCount,
          scheduleRetry,
          tenantId: 'org_1',
          userId: 'user_1',
          compliance: {
            privacyLevel: 'SELF_ONLY' as const,
            brandOrganicToggle: true,
            brandContentToggle: false,
            containsSyntheticMedia: true,
          },
        },
      };
    }

    it('marks terminal 4xx (401/403), NonRetriableError, and ProvenanceBlockedError as failed without retry', async () => {
      for (const terminalErr of [
        Object.assign(new Error('Unauthorized'), { statusCode: 401 }),
        Object.assign(new Error('Explicit non-retriable'), { nonRetriable: true }),
        Object.assign(new Error('Named non-retriable'), { name: 'NonRetriableError' }),
        new ProvenanceBlockedError('missing provenance'),
      ]) {
        const { args, scheduleRetry } = makeUploadArgs(terminalErr);
        const res = await uploadToProvider(args);
        expect(res.shouldRetry).toBe(false);
        expect(scheduleRetry).not.toHaveBeenCalled();
      }
    });

    it('schedules retry on 429, 408, 503, and primitive thrown values below MAX_RETRIES', async () => {
      for (const retryableErr of [
        Object.assign(new Error('Rate limit'), { statusCode: 429 }),
        Object.assign(new Error('Request timeout'), { statusCode: 408 }),
        Object.assign(new Error('Gateway unavailable'), { statusCode: 503 }),
        'transient string failure',
      ]) {
        const { args, scheduleRetry } = makeUploadArgs(retryableErr, 1);
        const res = await uploadToProvider(args);
        expect(res.shouldRetry).toBe(true);
        expect(scheduleRetry).toHaveBeenCalledWith('job_1', 'org_1', 'user_1', 2, undefined);
      }
    });
  });

  describe('mcu-monthly-reset cron pilot & expiry filtering', () => {
    it('skips null user_id, expired rows, 14-day pilots, and unknown tiers while resetting valid monthly plans', async () => {
      const now = Date.now();
      const rows = [
        { user_id: null, tier: 'BASIC', current_period_end: null },
        { user_id: 'u_no_end', tier: null, plan: 'basic', current_period_end: null },
        {
          user_id: 'u_expired',
          tier: 'PREMIUM',
          current_period_start: new Date(now - 40 * 86_400_000).toISOString(),
          current_period_end: new Date(now - 86_400_000).toISOString(),
        },
        {
          user_id: 'u_pilot_14d',
          tier: 'BASIC',
          current_period_start: new Date(now - 2 * 86_400_000).toISOString(),
          current_period_end: new Date(now + 12 * 86_400_000).toISOString(),
        },
        {
          user_id: 'u_monthly_30d',
          tier: 'PREMIUM',
          current_period_start: new Date(now - 5 * 86_400_000).toISOString(),
          current_period_end: new Date(now + 25 * 86_400_000).toISOString(),
        },
        {
          user_id: 'u_unknown_tier',
          tier: null,
          plan: null,
          current_period_end: new Date(now + 25 * 86_400_000).toISOString(),
        },
      ];

      hoisted.createServerClient.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => Promise.resolve({ data: rows, error: null }),
          }),
        }),
      });

      const res = await mcuMonthlyResetGet(new NextRequest('http://localhost/api/cron/mcu-monthly-reset'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { processed: number; errors: number };
      expect(body.processed).toBe(2);
      expect(hoisted.addCredits).toHaveBeenCalledTimes(2);

      // Also cover null users array gracefully
      hoisted.createServerClient.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      });
      const emptyRes = await mcuMonthlyResetGet(new NextRequest('http://localhost/api/cron/mcu-monthly-reset'));
      expect(emptyRes.status).toBe(200);
    });
  });

  describe('queryActiveCustomerSubscription user & org expiry fallbacks', () => {
    function mockSubQueries(userRow: unknown, orgRow: unknown) {
      let call = 0;
      hoisted.createServerClient.mockReturnValue({
        prepare: () => ({
          bind: () => ({
            first: () => Promise.resolve(++call === 1 ? userRow : orgRow),
          }),
        }),
      });
    }

    it('covers expired userSub with active orgSub, expired orgSub, and no orgSub', async () => {
      const pastIso = new Date(Date.now() - 60_000).toISOString();
      const futureIso = new Date(Date.now() + 86_400_000).toISOString();

      mockSubQueries(
        { tier: 'BASIC', plan: 'basic', status: 'active', current_period_end: pastIso },
        { tier: null, plan: 'premium', status: null, current_period_end: futureIso },
      );
      expect(await queryActiveCustomerSubscription('u1')).toEqual({
        resolvedTier: 'PREMIUM',
        subStatus: 'active',
        periodEnd: futureIso,
      });

      mockSubQueries(
        null,
        { tier: 'PREMIUM', plan: 'premium', status: 'active', current_period_end: pastIso },
      );
      expect(await queryActiveCustomerSubscription('u2')).toEqual({
        resolvedTier: 'BASIC',
        subStatus: 'expired',
        periodEnd: pastIso,
      });

      mockSubQueries(
        { tier: 'BASIC', plan: 'basic', status: 'active', current_period_end: pastIso },
        null,
      );
      expect(await queryActiveCustomerSubscription('u3')).toEqual({
        resolvedTier: 'BASIC',
        subStatus: 'expired',
        periodEnd: pastIso,
      });
    });
  });

  describe('PayOS batch commit, order matching, and dynamic feature flags', () => {
    it('updates existing org subscription and handles missing orgId / invalid now timestamp', async () => {
      const batch = vi.fn(async (statements: unknown[]) => statements.map(() => ({ success: true, meta: { changes: 1 } })));
      const d1 = {
        prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first: vi.fn().mockResolvedValue({
          count: 1, id: 'sub_1', tier: 'BASIC', plan: 'basic', status: 'expired',
          current_period_start: '2026-01-01T00:00:00.000Z', current_period_end: '2026-01-15T00:00:00.000Z',
        }) })) })),
        batch,
      } as unknown as D1Database;
      const dbWithExisting = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 'sub_1',
                    plan: 'basic',
                    tier: 'BASIC',
                    status: 'expired',
                    current_period_start: '2026-01-01T00:00:00.000Z',
                    current_period_end: '2026-01-15T00:00:00.000Z',
                  },
                }),
            }),
          }),
        }),
      } as unknown as D1Client;

      await commitPayOsSubscriptionBatch({
        db: dbWithExisting,
        d1,
        userId: 'u_reactivate',
        orgId: 'org_1',
        tier: 'BASIC',
        periodEnd: '2026-12-15T00:00:00.000Z',
        now: 'not-a-valid-date',
        orderCode: 12345,
        orderId: 'ord_12345',
        amount: 4975000,
        eventId: 'payos_12345', lockCreatedAt: '2026-11-17T00:00:00.000Z',
        order: { amount_usd_cents: 19900, amount_vnd: 4975000 } as import('@/land/orders/pending-order-types').PendingOrder,
      });
      expect(batch).toHaveBeenCalledTimes(1);

      // Missing ownership must fail closed before any batch execution.
      await expect(commitPayOsSubscriptionBatch({
        db: dbWithExisting,
        d1,
        orgId: undefined,
        tier: 'BASIC',
        billingPeriod: 'monthly',
        periodEnd: '2026-12-15T00:00:00.000Z',
        now: '2026-11-15T00:00:00.000Z',
        orderCode: 12346,
        orderId: 'ord_12346',
        amount: 4975000,
        eventId: 'payos_12346', lockCreatedAt: '2026-11-17T00:00:00.000Z',
        order: {} as import('@/land/orders/pending-order-types').PendingOrder,
      })).rejects.toThrow('requires a buyer organization');
      expect(batch).toHaveBeenCalledTimes(1);

      // Pilot orders must fail closed for manual review even when userId and orgId are present.
      await expect(commitPayOsSubscriptionBatch({
        db: dbWithExisting,
        d1,
        userId: 'u_pilot',
        orgId: 'org_1',
        tier: 'BASIC',
        billingPeriod: 'pilot_14d',
        periodEnd: '2026-12-15T00:00:00.000Z',
        now: '2026-11-15T00:00:00.000Z',
        orderCode: 12347,
        orderId: 'ord_12347',
        amount: 1990000,
        eventId: 'payos_12347', lockCreatedAt: '2026-11-17T00:00:00.000Z',
        order: { period: 'pilot_14d' } as import('@/land/orders/pending-order-types').PendingOrder,
      })).rejects.toThrow('Pilot payment requires manual review');
      expect(batch).toHaveBeenCalledTimes(1);
    });

    it('matches orders by provider_payment_id / provider_order_code and rejects already-settled orders', async () => {
      const settledDb = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({
                  data:
                    table === 'pending_orders'
                      ? [
                          {
                            order_id: 'ord_settled',
                            user_id: 'u1',
                            tier: 'BASIC',
                            payment_method: 'payos',
                            status: 'completed',
                            provider_payment_id: 'plink_match',
                            provider_order_code: 777,
                            invoice_url: null,
                          },
                        ]
                      : [],
                  error: null,
                }),
            }),
          }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }),
      } as unknown as D1Client;

      const settled = await findAndValidatePayOsOrder({
        db: settledDb,
        orderCode: 777,
        paymentLinkId: 'plink_match',
        amount: 1_990_000,
        eventId: 'payos_777',
      });
      expect(settled).toEqual({ ok: false, error: 'Order already settled', status: 409 });

      const lockD1 = {
        prepare: vi
          .fn()
          .mockReturnValueOnce({ bind: () => ({ run: () => Promise.resolve({ meta: { changes: 0 } }) }) })
          .mockReturnValueOnce({
            bind: () => ({ first: () => Promise.resolve({ processed: 1 }) }),
          }),
      } as unknown as D1Database;
      await expect(acquireEventLock(lockD1, 'ev_1', 777, false, 0, {})).resolves.toEqual({
        status: 'already_processed',
      });

      // Cancellation claims the pending order and the lock in one lease-qualified
      // batch; a failed claim must throw rather than silently drop the event.
      const cancelledOrder = {
        order_id: 'ord_cancel', user_id: 'u1', tier: 'BASIC', period: 'monthly',
        payment_method: 'payos', status: 'pending', provider_payment_id: 'link-1',
        provider_order_code: 777, invoice_url: 'https://pay.payos.vn/web/link-1',
        amount_vnd: 4_975_000,
      } as unknown as import('@/land/orders/pending-order-types').PendingOrder;
      const makeCancelDb = (changes: number[]) => ({
        unwrap: () => ({
          prepare: () => ({ bind: () => ({}) }),
          batch: async () => changes.map((n) => ({ success: true, meta: { changes: n } })),
        }),
      }) as unknown as D1Client;

      await expect(handleFailedPayment({
        db: makeCancelDb([1, 1]), order: cancelledOrder, eventId: 'payos_777',
        lockCreatedAt: 'lease-1', table: 'payos_events',
      })).resolves.toBeUndefined();

      await expect(handleFailedPayment({
        db: makeCancelDb([0, 1]), order: cancelledOrder, eventId: 'payos_777',
        lockCreatedAt: 'lease-1', table: 'payos_events',
      })).rejects.toThrow('Payment cancellation claim failed');
    });

    it('falls back to invoice_url matching for standard orders and requires manual review for PayOS pilot_14d orders', async () => {
      function makeOrdersDb(orders: unknown[]) {
        return {
          from: () => ({
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: orders, error: null }),
              }),
            }),
            delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          }),
        } as unknown as D1Client;
      }

      const legacyByLink = await findAndValidatePayOsOrder({
        db: makeOrdersDb([
          {
            order_id: 'ord_legacy_link',
            user_id: 'u1',
            tier: 'BASIC',
            period: 'monthly',
            payment_method: 'payos',
            status: 'pending',
            provider_payment_id: null,
            provider_order_code: 999_888,
            invoice_url: 'https://pay.payos.vn/web/plink_legacy',
            amount_vnd: 4_975_000,
          },
        ]),
        orderCode: 999_888,
        paymentLinkId: 'plink_legacy',
        amount: 4_975_000,
        eventId: 'payos_legacy',
      });
      expect(legacyByLink.ok).toBe(true);

      const legacyByCode = await findAndValidatePayOsOrder({
        db: makeOrdersDb([
          {
            order_id: 'ord_legacy_code',
            user_id: 'u1',
            tier: 'BASIC',
            period: 'monthly',
            payment_method: 'payos',
            status: 'pending',
            provider_payment_id: null,
            provider_order_code: 555_444,
            invoice_url: 'https://pay.payos.vn/web/555444',
            amount_vnd: 4_975_000,
          },
        ]),
        orderCode: 555_444,
        paymentLinkId: 'unrelated_link',
        amount: 4_975_000,
        eventId: 'payos_code',
      });
      // An order code alone is not identity: with no stored provider_payment_id the
      // callback link must still correlate with the stored invoice_url.
      expect(legacyByCode).toEqual({ ok: false, error: 'Order not found', status: 400 });

      const pilotOnPremium = await findAndValidatePayOsOrder({
        db: makeOrdersDb([
          {
            order_id: 'ord_bad_pilot',
            user_id: 'u1',
            tier: 'PREMIUM',
            period: 'pilot_14d',
            payment_method: 'payos',
            status: 'pending',
            provider_payment_id: 'plink_bad',
            provider_order_code: 111,
            invoice_url: null,
            amount_vnd: 1_990_000,
          },
        ]),
        orderCode: 111,
        paymentLinkId: 'plink_bad',
        amount: 1_990_000,
        eventId: 'payos_bad_pilot',
      });
      expect(pilotOnPremium).toEqual({
        ok: false,
        error: 'Pilot payment requires manual review / Thanh toán Pilot cần được kiểm tra thủ công',
        status: 409,
      });

      const pilotOnBasic = await findAndValidatePayOsOrder({
        db: makeOrdersDb([
          {
            order_id: 'ord_basic_pilot',
            user_id: 'u1',
            tier: 'BASIC',
            period: 'pilot_14d',
            payment_method: 'payos',
            status: 'pending',
            provider_payment_id: 'plink_basic_pilot',
            provider_order_code: 112,
            invoice_url: null,
            amount_vnd: 1_990_000,
          },
        ]),
        orderCode: 112,
        paymentLinkId: 'plink_basic_pilot',
        amount: 1_990_000,
        eventId: 'payos_basic_pilot',
      });
      expect(pilotOnBasic).toEqual({
        ok: false,
        error: 'Pilot payment requires manual review / Thanh toán Pilot cần được kiểm tra thủ công',
        status: 409,
      });
    });

    it('enforces runtime FEATURE_PAYOS and PAYOS_CHECKSUM_KEY guards on PayOS routes', async () => {
      process.env.FEATURE_PAYOS = 'false';
      const disabledCheckout = await payosCheckoutPost(
        new NextRequest('http://localhost/api/payos', { method: 'POST', body: '{}' }),
      );
      expect(disabledCheckout.status).toBe(503);

      const disabledIpn = await payosIpnPost(
        new NextRequest('http://localhost/api/payos/ipn', { method: 'POST', body: '{}' }),
      );
      expect(disabledIpn.status).toBe(503);

      process.env.FEATURE_PAYOS = 'true';
      delete process.env.PAYOS_CHECKSUM_KEY;
      const missingSecretIpn = await payosIpnPost(
        new NextRequest('http://localhost/api/payos/ipn', { method: 'POST', body: '{}' }),
      );
      expect(missingSecretIpn.status).toBe(500);
    });
  });

  describe('mapLedgerRow malformed compliance_json resilience', () => {
    it('ignores invalid JSON and non-object JSON arrays in compliance_json', () => {
      const baseRow = {
        idempotency_key: 'a'.repeat(64),
        tenant_id: 'org_1',
        channel_id: 'ch_1',
        platform: 'tiktok',
        media_ref: 'r2://v.mp4',
        decision: 'approved',
        reviewer_id: 'rev_1',
        comment: null,
        approved_at: 1700000000,
        expires_at: null,
        created_at: 1700000000,
      };
      expect(mapLedgerRow({ ...baseRow, compliance_json: '{bad json' }).compliance).toBeUndefined();
      expect(mapLedgerRow({ ...baseRow, compliance_json: '[1,2,3]' }).compliance).toBeUndefined();
    });
  });
});
