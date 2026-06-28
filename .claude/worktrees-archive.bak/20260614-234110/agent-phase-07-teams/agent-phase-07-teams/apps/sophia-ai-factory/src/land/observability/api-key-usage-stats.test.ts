/**
 * Tests for api-key-usage-stats — D1 mocked.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getApiKeyUsageStats } from './api-key-usage-stats';

interface RawRow {
  api_key_id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  is_active: number;
  request_count: number;
  error_count: number;
  avg_latency_ms: number | null;
  max_latency_ms: number | null;
  last_used_at: string | null;
  created_at: string;
}

function setD1Mock(opts: { rows?: RawRow[]; bindCapture?: (...args: unknown[]) => void }) {
  const all = vi.fn().mockResolvedValue({ results: opts.rows ?? [], success: true });
  const bind = vi.fn().mockImplementation((...args: unknown[]) => {
    opts.bindCapture?.(...args);
    return { all };
  });
  const db = { prepare: vi.fn().mockReturnValue({ bind }) };
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = {
    ...((globalThis as unknown as { __env?: Record<string, unknown> }).__env ?? {}),
    DB: db,
  };
}

afterEach(() => vi.clearAllMocks());

describe('getApiKeyUsageStats', () => {
  it('returns empty array when no rows', async () => {
    setD1Mock({});
    const result = await getApiKeyUsageStats(0, 1000);
    expect(result).toEqual([]);
  });

  it('maps fields + computes error rate + boolean flag', async () => {
    setD1Mock({
      rows: [
        {
          api_key_id: 'k-1',
          org_id: 'org-1',
          name: 'Prod key',
          key_prefix: 'sk_live_abc',
          is_active: 1,
          request_count: 1000,
          error_count: 25,
          avg_latency_ms: 87.6,
          max_latency_ms: 1234,
          last_used_at: '2026-05-10T17:00:00Z',
          created_at: '2026-04-01T00:00:00Z',
        },
      ],
    });
    const result = await getApiKeyUsageStats(0, 1000);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      apiKeyId: 'k-1',
      orgId: 'org-1',
      name: 'Prod key',
      keyPrefix: 'sk_live_abc',
      isActive: true,
      requestCount: 1000,
      errorCount: 25,
      errorRate: 0.025,
      avgLatencyMs: 88,
      maxLatencyMs: 1234,
      lastUsedAt: '2026-05-10T17:00:00Z',
      createdAt: '2026-04-01T00:00:00Z',
    });
  });

  it('handles keys with zero usage (LEFT JOIN behaviour)', async () => {
    setD1Mock({
      rows: [
        {
          api_key_id: 'k-dormant', org_id: 'org-2', name: 'Unused',
          key_prefix: 'sk_test_xxx', is_active: 1,
          request_count: 0, error_count: 0,
          avg_latency_ms: null, max_latency_ms: null,
          last_used_at: null, created_at: '2026-04-01T00:00:00Z',
        },
      ],
    });
    const result = await getApiKeyUsageStats(0, 1000);
    expect(result[0].requestCount).toBe(0);
    expect(result[0].errorRate).toBe(0);
    expect(result[0].avgLatencyMs).toBe(0);
    expect(result[0].lastUsedAt).toBeNull();
  });

  it('is_active=0 maps to isActive false', async () => {
    setD1Mock({
      rows: [
        {
          api_key_id: 'k-rev', org_id: 'org-3', name: 'Revoked',
          key_prefix: 'sk_x', is_active: 0,
          request_count: 0, error_count: 0,
          avg_latency_ms: null, max_latency_ms: null,
          last_used_at: null, created_at: '2026-04-01T00:00:00Z',
        },
      ],
    });
    const result = await getApiKeyUsageStats(0, 1000);
    expect(result[0].isActive).toBe(false);
  });

  it('throws when fromTs > toTs', async () => {
    setD1Mock({});
    await expect(getApiKeyUsageStats(2000, 1000)).rejects.toThrow(/fromTs/);
  });

  it('clamps limit to [1, 200] and floors fractional', async () => {
    const bound: unknown[][] = [];
    setD1Mock({ bindCapture: (...args) => bound.push(args) });

    await getApiKeyUsageStats(0, 1000, 9999);
    expect(bound[0][2]).toBe(200);

    bound.length = 0;
    await getApiKeyUsageStats(0, 1000, 0);
    expect(bound[0][2]).toBe(1);

    bound.length = 0;
    await getApiKeyUsageStats(0, 1000, 25.7);
    expect(bound[0][2]).toBe(25);
  });

  it('rounds avg latency to nearest int', async () => {
    setD1Mock({
      rows: [
        {
          api_key_id: 'k', org_id: 'o', name: 'n', key_prefix: 'p', is_active: 1,
          request_count: 100, error_count: 0,
          avg_latency_ms: 42.4, max_latency_ms: 100,
          last_used_at: null, created_at: '2026-04-01T00:00:00Z',
        },
      ],
    });
    const result = await getApiKeyUsageStats(0, 1000);
    expect(result[0].avgLatencyMs).toBe(42);
  });
});
