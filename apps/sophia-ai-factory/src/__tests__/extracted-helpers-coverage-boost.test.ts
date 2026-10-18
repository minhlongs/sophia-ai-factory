/**
 * Targeted branch coverage suite for extracted helpers (< 180 LOC).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchPaymentMethod } from '@/app/api/checkout/modules/payment-dispatcher';
import { executeWebhookDeliveryAttempts } from '@/tree/partners/webhook-bus/delivery-attempt-runner';
import { fetchMultiTierRates } from '@/tree/fx/hedging/rate-oracle';
import {
  resolveKv,
  tryReadCachedKvRates,
  parseLiveRates,
} from '@/tree/fx/hedging/rate-oracle-cache';
import { BEDROCK_RATES_TABLE } from '@/tree/billing/fx-converter';

vi.mock('@/tree/clients/nowpayments-client', () => ({
  createCheckout: vi.fn().mockResolvedValue({ invoiceUrl: 'https://nowpayments.test/inv-1' }),
  createInvoiceUrl: vi.fn().mockReturnValue('https://nowpayments.test/inv-fallback'),
}));
vi.mock('@/land/orders/pending-order-repo', () => ({
  writeOrder: vi.fn().mockResolvedValue({ id: 'ord-1' }),
}));
vi.mock('@/app/api/checkout/modules/payment-dispatcher-providers', () => ({
  dispatchPayOsMethod: vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, provider: 'payos' }), { status: 200 })),
  dispatchOfflineMethod: vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, provider: 'offline' }), { status: 200 })),
}));

describe('extracted-helpers-coverage-boost', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('payment-dispatcher', () => {
    it('handles nowpayments method with successful checkout generation and fallback', async () => {
      const res = await dispatchPaymentMethod({
        paymentMethod: 'nowpayments',
        tier: 'BASIC',
        userId: 'usr-1',
        period: 'monthly',
        customerEmail: 'test@sophia.test',
      });
      expect(res.status).toBe(200);

      const { createCheckout } = await import('@/tree/clients/nowpayments-client');
      vi.mocked(createCheckout).mockRejectedValueOnce('Non-error string');

      const resFallback = await dispatchPaymentMethod({
        paymentMethod: 'nowpayments',
        tier: 'PREMIUM',
        userId: 'usr-2',
        period: 'one_time' as never,
      });
      expect(resFallback.status).toBe(200);
    });

    it('returns 500 when writeOrder rejects and dispatches payos/offline/unknown', async () => {
      const { writeOrder } = await import('@/land/orders/pending-order-repo');
      vi.mocked(writeOrder).mockRejectedValueOnce(new Error('D1 insert failed'));
      const res500 = await dispatchPaymentMethod({
        paymentMethod: 'nowpayments',
        tier: 'BASIC',
        userId: 'usr-fail',
        period: 'monthly',
      });
      expect(res500.status).toBe(500);

      expect((await dispatchPaymentMethod({ paymentMethod: 'payos', tier: 'BASIC', userId: 'u3', period: 'monthly' })).status).toBe(200);
      expect((await dispatchPaymentMethod({ paymentMethod: 'cash', tier: 'ENTERPRISE', userId: 'u4', period: 'yearly' })).status).toBe(200);
      expect((await dispatchPaymentMethod({ paymentMethod: 'unknown' as never, tier: 'BASIC', userId: 'u5', period: 'monthly' })).status).toBe(400);
    });
  });

  describe('delivery-attempt-runner', () => {
    it('covers HTTP 200, non-retryable 404, retryable 502/503, and non-Error throws', async () => {
      const okFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
      expect((await executeWebhookDeliveryAttempts({
        endpointUrl: 'https://hook.test/ep', eventId: 'e1', eventType: 'partner.client.quota_low',
        payloadJson: '{}', headerValue: 'sig', maxAttempts: 2, fetchFn: okFetch as never,
      })).delivered).toBe(true);

      const err404Fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
      expect((await executeWebhookDeliveryAttempts({
        endpointUrl: 'https://hook.test/ep', eventId: 'e2', eventType: 'partner.client.quota_low',
        payloadJson: '{}', headerValue: 'sig', maxAttempts: 2, fetchFn: err404Fetch as never,
      })).lastError).toContain('Non-retryable HTTP 404');

      const retryFetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 502 } as Response)
        .mockRejectedValueOnce('string-socket-err')
        .mockResolvedValueOnce({ ok: false, status: 503 } as Response);
      const retryRes = await executeWebhookDeliveryAttempts({
        endpointUrl: 'https://hook.test/ep', eventId: 'e3', eventType: 'partner.client.quota_low',
        payloadJson: '{}', headerValue: 'sig', maxAttempts: 3, fetchFn: retryFetch as never,
      });
      expect(retryRes.attempts).toBe(3);
    });
  });

  describe('rate-oracle & rate-oracle-cache', () => {
    it('resolves KV from env and globalScope, parses live rates, and handles cache misses', async () => {
      const mockKv = {
        get: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('invalid-json'),
        put: vi.fn().mockResolvedValue(undefined),
      };
      expect(resolveKv({ EXPERIMENT_KV: mockKv })).toBe(mockKv);
      (globalThis as Record<string, unknown>).KV_KV = mockKv;
      expect(resolveKv()).toBe(mockKv);
      delete (globalThis as Record<string, unknown>).KV_KV;
      (globalThis as Record<string, unknown>).EXPERIMENT_KV = mockKv;
      expect(resolveKv()).toBe(mockKv);
      delete (globalThis as Record<string, unknown>).EXPERIMENT_KV;
      expect(resolveKv()).toBeNull();

      expect(await tryReadCachedKvRates(mockKv)).toBeNull();
      expect(await tryReadCachedKvRates(mockKv)).toBeNull();

      const fallbackParsed = parseLiveRates({});
      expect(fallbackParsed.EUR).toBe(BEDROCK_RATES_TABLE.EUR);
      expect(fallbackParsed.VND).toBe(BEDROCK_RATES_TABLE.VND);

      const customParsed = parseLiveRates({
        rates: { EUR: 0.91, GBP: 0.78, JPY: 151, SGD: 1.33, AUD: 1.52, CAD: 1.38, VND: 25300, THB: 34.5, IDR: 15900 },
      });
      expect(customParsed.EUR).toBe(0.91);
      expect(customParsed.IDR).toBe(15900);
    });

    it('returns KV cached rates and falls back to bedrock when live fetch fails', async () => {
      const mockKv = {
        get: vi.fn().mockResolvedValue(JSON.stringify({
          rates: { VND: 25400, EUR: 0.92 },
          sourceProvider: 'KV_CACHE_MOCK',
          fetchedAt: Date.now(),
        })),
        put: vi.fn().mockResolvedValue(undefined),
      };
      const res = await fetchMultiTierRates({ KV_KV: mockKv });
      expect(res.sourceProvider).toBe('KV_CACHE');

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));
      try {
        const fallback = await fetchMultiTierRates({});
        expect(fallback.sourceProvider).toBe('BEDROCK_FALLBACK');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
