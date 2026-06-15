/**
 * Tests for storage-usage-stats — D1 mocked.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getStorageSnapshot } from './storage-usage-stats';

interface MockSeq {
  summary?: {
    tenant_count: number;
    total_bytes: number;
    total_videos: number;
    stale_count: number;
  } | null;
  topTenants?: Array<{
    tenant_id: string;
    total_bytes: number;
    video_count: number;
    last_calculated_at: number;
  }>;
  bindCapture?: (...args: unknown[]) => void;
}

function setD1Mock(seq: MockSeq) {
  // Bind returns BOTH first + all so the same chain handles either call style.
  const first = vi.fn().mockImplementation(() => Promise.resolve(seq.summary ?? null));
  const all = vi.fn().mockResolvedValue({ results: seq.topTenants ?? [], success: true });
  const bind = vi.fn().mockImplementation((...args: unknown[]) => {
    seq.bindCapture?.(...args);
    return { first, all };
  });
  const db = { prepare: vi.fn().mockReturnValue({ bind }) };
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = {
    ...((globalThis as unknown as { __env?: Record<string, unknown> }).__env ?? {}),
    DB: db,
  };
}

afterEach(() => vi.clearAllMocks());

describe('getStorageSnapshot', () => {
  it('returns zero snapshot when DB empty', async () => {
    setD1Mock({});
    const result = await getStorageSnapshot(10);
    expect(result.global.tenantCount).toBe(0);
    expect(result.global.totalBytes).toBe(0);
    expect(result.global.totalVideos).toBe(0);
    expect(result.global.staleTenantCount).toBe(0);
    expect(result.topTenants).toEqual([]);
  });

  it('aggregates global counts', async () => {
    setD1Mock({
      summary: {
        tenant_count: 50,
        total_bytes: 1024 * 1024 * 1024 * 25, // 25 GB
        total_videos: 1234,
        stale_count: 7,
      },
    });
    const result = await getStorageSnapshot(10);
    expect(result.global.tenantCount).toBe(50);
    expect(result.global.totalBytes).toBe(1024 * 1024 * 1024 * 25);
    expect(result.global.totalVideos).toBe(1234);
    expect(result.global.staleTenantCount).toBe(7);
  });

  it('maps top tenants and computes ageSec', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    setD1Mock({
      topTenants: [
        {
          tenant_id: 'tenant-A',
          total_bytes: 5 * 1024 * 1024 * 1024,
          video_count: 100,
          last_calculated_at: nowSec - 300,
        },
      ],
    });
    const result = await getStorageSnapshot(10);
    expect(result.topTenants).toHaveLength(1);
    expect(result.topTenants[0].tenantId).toBe('tenant-A');
    expect(result.topTenants[0].totalBytes).toBe(5 * 1024 * 1024 * 1024);
    expect(result.topTenants[0].ageSec).toBeGreaterThanOrEqual(299);
    expect(result.topTenants[0].ageSec).toBeLessThanOrEqual(301);
  });

  it('clamps limit to [1,100] and floors fractional', async () => {
    const bound: unknown[][] = [];
    setD1Mock({ bindCapture: (...args) => bound.push(args) });

    await getStorageSnapshot(9999);
    // bound[0] = stale_cutoff bind, bound[1] = limit bind
    expect(bound[1][0]).toBe(100);

    bound.length = 0;
    await getStorageSnapshot(0);
    expect(bound[1][0]).toBe(1);

    bound.length = 0;
    await getStorageSnapshot(25.7);
    expect(bound[1][0]).toBe(25);
  });

  it('uses caller-provided staleAfterSec for cutoff calculation', async () => {
    const bound: unknown[][] = [];
    setD1Mock({ bindCapture: (...args) => bound.push(args) });
    const nowSec = Math.floor(Date.now() / 1000);
    await getStorageSnapshot(10, 3600); // stale after 1h
    const cutoffArg = bound[0][0] as number;
    expect(cutoffArg).toBeGreaterThanOrEqual(nowSec - 3601);
    expect(cutoffArg).toBeLessThanOrEqual(nowSec - 3599);
  });

  it('coerces numeric strings from D1 driver', async () => {
    setD1Mock({
      summary: {
        tenant_count: '5' as unknown as number,
        total_bytes: '12345' as unknown as number,
        total_videos: '10' as unknown as number,
        stale_count: '0' as unknown as number,
      },
      topTenants: [
        {
          tenant_id: 't', total_bytes: '999' as unknown as number,
          video_count: '3' as unknown as number, last_calculated_at: 1700000000,
        },
      ],
    });
    const result = await getStorageSnapshot(10);
    expect(typeof result.global.tenantCount).toBe('number');
    expect(result.global.totalBytes).toBe(12345);
    expect(result.topTenants[0].totalBytes).toBe(999);
  });
});
