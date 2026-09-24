import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  convertCurrency,
  formatCurrency,
  getLiveOrCachedFxRates,
  BEDROCK_FX_RATES,
} from '../fx-converter';
import type { FxRateMap, SupportedCurrency } from '@/seed/types/enterprise-billing';

describe('tree/billing/fx-converter', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('convertCurrency', () => {
    it('returns exact amount and rate 1.0 for same-currency conversion', () => {
      const res1 = convertCurrency(19900, 'USD', 'USD');
      expect(res1.convertedCents).toBe(19900);
      expect(res1.rate).toBe(1.0);

      const res2 = convertCurrency(500000, 'VND', 'VND');
      expect(res2.convertedCents).toBe(500000);
      expect(res2.rate).toBe(1.0);
    });

    it('converts USD to target currencies using bedrock rates', () => {
      // 100 USD = 10000 cents
      const toVnd = convertCurrency(10000, 'USD', 'VND');
      expect(toVnd.rate).toBe(25450.0);
      expect(toVnd.convertedCents).toBe(254500000);

      const toEur = convertCurrency(10000, 'USD', 'EUR');
      expect(toEur.rate).toBe(0.92);
      expect(toEur.convertedCents).toBe(9200);

      const toJpy = convertCurrency(10000, 'USD', 'JPY');
      expect(toJpy.rate).toBe(155.0);
      expect(toJpy.convertedCents).toBe(1550000);

      const toSgd = convertCurrency(10000, 'USD', 'SGD');
      expect(toSgd.rate).toBe(1.35);
      expect(toSgd.convertedCents).toBe(13500);
    });

    it('converts non-USD cross-currency pairs accurately (e.g. EUR -> VND)', () => {
      // rate = VND rate / EUR rate = 25450 / 0.92
      const res = convertCurrency(9200, 'EUR', 'VND');
      expect(res.rate).toBeCloseTo(25450 / 0.92, 4);
      // 9200 * (25450 / 0.92) = 254,500,000 cents
      expect(res.convertedCents).toBe(254500000);
    });

    it('respects custom FxRateMap overrides', () => {
      const customRates: FxRateMap = {
        base: 'USD',
        rates: {
          USD: 1.0,
          VND: 26000.0,
          EUR: 0.95,
          JPY: 160.0,
          SGD: 1.40,
        },
        fetchedAt: Date.now(),
        ttlSeconds: 3600,
      };

      const res = convertCurrency(10000, 'USD', 'VND', customRates);
      expect(res.rate).toBe(26000.0);
      expect(res.convertedCents).toBe(260000000);
    });

    it('handles negative amounts cleanly (for refunds, credits, and adjustments)', () => {
      const res = convertCurrency(-5000, 'USD', 'EUR');
      expect(res.rate).toBe(0.92);
      expect(res.convertedCents).toBe(-4600);
    });

    it('handles zero amounts without NaN or divide-by-zero errors', () => {
      const res = convertCurrency(0, 'USD', 'SGD');
      expect(res.convertedCents).toBe(0);
      expect(res.rate).toBe(1.35);
    });

    it('throws descriptive error on unsupported source or target currency', () => {
      expect(() =>
        convertCurrency(100, 'GBP' as SupportedCurrency, 'USD'),
      ).toThrowError(/Invalid source currency/);

      expect(() =>
        convertCurrency(100, 'USD', 'AUD' as SupportedCurrency),
      ).toThrowError(/Invalid target currency/);
    });

    it('throws error when custom rates contain zero or negative rate', () => {
      const invalidRates: FxRateMap = {
        base: 'USD',
        rates: {
          USD: 0,
          VND: 25000,
          EUR: 0.9,
          JPY: 150,
          SGD: 1.3,
        },
        fetchedAt: Date.now(),
        ttlSeconds: 3600,
      };

      expect(() =>
        convertCurrency(100, 'USD', 'EUR', invalidRates),
      ).toThrowError(/Invalid exchange rate/);
    });
  });

  describe('formatCurrency', () => {
    it('formats USD currency with 2 decimals in en-US', () => {
      const formatted = formatCurrency(19900, 'USD');
      expect(formatted).toBe('$199.00');
    });

    it('formats EUR currency in en-US or de-DE', () => {
      const formatted = formatCurrency(9200, 'EUR', 'en-US');
      expect(formatted).toContain('92.00');
    });

    it('formats zero-decimal currencies (VND, JPY) without decimal fractions', () => {
      const formattedVnd = formatCurrency(254500000, 'VND', 'vi-VN');
      expect(formattedVnd).toContain('2.545.000');
      expect(formattedVnd).not.toContain(',00');

      const formattedJpy = formatCurrency(1550000, 'JPY', 'ja-JP');
      expect(formattedJpy).toContain('15,500');
      expect(formattedJpy).not.toContain('.00');
    });

    it('handles negative currency formatting', () => {
      const formatted = formatCurrency(-5000, 'USD', 'en-US');
      expect(formatted).toBe('-$50.00');
    });

    it('throws error when given an invalid currency', () => {
      expect(() => formatCurrency(100, 'XYZ' as SupportedCurrency)).toThrowError(
        /Invalid currency for formatting/,
      );
    });
  });

  describe('getLiveOrCachedFxRates', () => {
    it('returns valid cached rates from KV when available and not expired', async () => {
      const freshTimestamp = Date.now() - 60000; // 1 min ago
      const mockCached: FxRateMap = {
        base: 'USD',
        rates: {
          USD: 1.0,
          VND: 25500.0,
          EUR: 0.93,
          JPY: 156.0,
          SGD: 1.36,
        },
        fetchedAt: freshTimestamp,
        ttlSeconds: 3600,
      };

      const mockKv = {
        get: vi.fn().mockResolvedValue(JSON.stringify(mockCached)),
        put: vi.fn().mockResolvedValue(undefined),
      };

      const result = await getLiveOrCachedFxRates({ KV_KV: mockKv });
      expect(mockKv.get).toHaveBeenCalledWith('fx_rates:usd:v1');
      expect(result.rates.VND).toBe(25500.0);
      expect(result.rates.EUR).toBe(0.93);
    });

    it('fetches fresh rates from live endpoint when KV is a cache miss', async () => {
      const mockKv = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };

      const liveResponse = {
        rates: {
          VND: 25480.0,
          EUR: 0.915,
          JPY: 154.2,
          SGD: 1.345,
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => liveResponse,
      } as unknown as Response);

      const result = await getLiveOrCachedFxRates({ KV_KV: mockKv });
      expect(result.rates.VND).toBe(25480.0);
      expect(result.rates.EUR).toBe(0.915);
      expect(mockKv.put).toHaveBeenCalled();
    });

    it('falls back to static bedrock rates when KV is empty and live fetch throws', async () => {
      const mockKv = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const result = await getLiveOrCachedFxRates({ KV_KV: mockKv });
      expect(result.rates.USD).toBe(BEDROCK_FX_RATES.rates.USD);
      expect(result.rates.VND).toBe(BEDROCK_FX_RATES.rates.VND);
      expect(result.rates.EUR).toBe(BEDROCK_FX_RATES.rates.EUR);
    });
  });
});
