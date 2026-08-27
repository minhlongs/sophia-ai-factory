/**
 * Metrics fetcher tests — HTTP via vi.spyOn(globalThis, 'fetch') sequences,
 * circuit breaker behavior, failure-kind classification.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { fetchPlatformMetrics, withDemographics } from '../metrics-fetcher';
import { shouldAllowRequest, recordFailure } from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchPlatformMetrics', () => {
  it('fetches YouTube subscriber count via BYOK token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(200, { items: [{ statistics: { subscriberCount: '12345' } }] }),
    );

    const result = await fetchPlatformMetrics('youtube', 'yt-token');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.platform).toBe('youtube');
      expect(result.value.followers).toBe(12345);
    }
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('youtube.googleapis.com');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer yt-token');
  });

  it('fetches Facebook followers + engagement from page token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(200, { fan_count: 1000, followers_count: 2000, talking_about_count: 100 }),
    );

    const result = await fetchPlatformMetrics('facebook', 'page123:page-token');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.followers).toBe(2000);
      expect(result.value.engagementRate).toBeCloseTo(0.05, 6);
    }
  });

  it('returns FETCH_FAILED and records failure on HTTP 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }));

    const result = await fetchPlatformMetrics('youtube', 'yt-token');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FETCH_FAILED');
  });

  it('classifies HTTP 401 as AUTH_FAILURE', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(401, {}));

    const result = await fetchPlatformMetrics('tiktok', 'bad-token');
    expect(result.ok).toBe(false);
    // AUTH_FAILURE opens the circuit immediately — verify via the breaker API.
    expect(shouldAllowRequest('audience-tiktok')).toBe(false);
  });

  it('returns CIRCUIT_OPEN without calling fetch when the breaker is open', async () => {
    recordFailure('audience-instagram', FailureKind.AUTH_FAILURE);
    expect(shouldAllowRequest('audience-instagram')).toBe(false);

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await fetchPlatformMetrics('instagram', 'ig-token');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CIRCUIT_OPEN');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns FETCH_FAILED when the network rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'));

    const result = await fetchPlatformMetrics('youtube', 'yt-token');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FETCH_FAILED');
  });
});

describe('withDemographics', () => {
  it('keeps valid shares and drops out-of-range values', () => {
    const snapshot = { platform: 'youtube' as const, followers: 10, engagementRate: 0.1, demographics: {} };
    const merged = withDemographics(snapshot, {
      ageBuckets: { '18-24': 0.5, '25-34': 1.5 },
      countries: { VN: 0.7, US: -0.1 },
    });
    expect(merged.demographics.ageBuckets).toEqual({ '18-24': 0.5 });
    expect(merged.demographics.countries).toEqual({ VN: 0.7 });
  });
});
