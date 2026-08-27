/**
 * Audience Analysis Cron — idempotency + per-channel error isolation.
 *
 * Pattern: hoisted module mocks via vi.hoisted (same style as
 * market-signals-ingest-cron.test.ts).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted mocks so vi.mock can reference them
const { mockDecryptToken } = vi.hoisted(() => ({ mockDecryptToken: vi.fn() }));
const { mockFetchMetrics } = vi.hoisted(() => ({ mockFetchMetrics: vi.fn() }));
const { mockUpsertMetrics } = vi.hoisted(() => ({ mockUpsertMetrics: vi.fn() }));
const { mockAll } = vi.hoisted(() => ({ mockAll: vi.fn() }));
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const fakeDb = {
  prepare: () => ({ all: mockAll }),
};

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => fakeDb,
}));
vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: (_cfg: unknown, _evt: unknown, handler: (...a: unknown[]) => unknown) => handler,
  },
}));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: mockLogger }));
vi.mock('@/tree/crypto/token-crypto', () => ({ decryptToken: mockDecryptToken }));
vi.mock('@/tree/audience/metrics-fetcher', () => ({ fetchPlatformMetrics: mockFetchMetrics }));
vi.mock('@/tree/audience/metrics-store', () => ({ upsertAudienceMetrics: mockUpsertMetrics }));

import { audienceAnalysisCron } from '@/forest/inngest/functions/audience-analysis-cron';
import type { PlatformMetricsSnapshot } from '@/tree/audience/types';

type CronResult = { pulled: number; failed: number; channels: number; skipped?: boolean };

type InngestCronHandler = (ctx: {
  step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> };
}) => Promise<CronResult>;

const handler = audienceAnalysisCron as unknown as InngestCronHandler;

function makeChannel(overrides: Partial<{ tenant_id: string; provider: string; access_token: string }> = {}) {
  return {
    tenant_id: 'ws-1',
    provider: 'tiktok',
    access_token: 'enc:tiktok-token',
    ...overrides,
  };
}

function snap(platform: string, followers = 999, engagementRate = 0.042): PlatformMetricsSnapshot {
  return {
    platform: platform as PlatformMetricsSnapshot['platform'],
    followers,
    engagementRate,
    demographics: {},
  };
}

const step = { run: (_name: string, fn: () => Promise<unknown>) => fn() };

describe('audienceAnalysisCron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips cleanly when no active channels exist', async () => {
    mockAll.mockResolvedValueOnce({ results: [] });
    const result = await handler({ step });
    expect(result.skipped).toBe(true);
    expect(result.channels).toBe(0);
  });

  it('pulls and upserts metrics for a happy-path channel', async () => {
    mockAll.mockResolvedValueOnce({ results: [makeChannel()] });
    mockDecryptToken.mockResolvedValueOnce('plain-tiktok');
    mockFetchMetrics.mockResolvedValueOnce({ ok: true, value: snap('tiktok') });
    mockUpsertMetrics.mockResolvedValueOnce({ ok: true, value: { windowStartMs: 1_234 } });

    const result = await handler({ step });
    expect(result.pulled).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockFetchMetrics).toHaveBeenCalledWith('tiktok', 'plain-tiktok');
  });

  it('is idempotent — double-run of the same window upserts the same row (no duplicates)', async () => {
    // Run 1
    mockAll.mockResolvedValueOnce({ results: [makeChannel()] });
    mockDecryptToken.mockResolvedValueOnce('plain-tiktok');
    mockFetchMetrics.mockResolvedValueOnce({ ok: true, value: snap('tiktok') });
    mockUpsertMetrics.mockResolvedValueOnce({ ok: true, value: { windowStartMs: 1_234 } });
    await handler({ step });

    // Run 2 — same day window, same channel
    mockAll.mockResolvedValueOnce({ results: [makeChannel()] });
    mockDecryptToken.mockResolvedValueOnce('plain-tiktok');
    mockFetchMetrics.mockResolvedValueOnce({ ok: true, value: snap('tiktok') });
    mockUpsertMetrics.mockResolvedValueOnce({ ok: true, value: { windowStartMs: 1_234 } });
    await handler({ step });

    // Both runs upsert with the SAME (workspace, platform, windowStartMs) key;
    // the UNIQUE constraint + ON CONFLICT DO UPDATE keeps exactly one row.
    expect(mockUpsertMetrics).toHaveBeenCalledTimes(2);
    const [firstCall] = mockUpsertMetrics.mock.calls[0];
    const [secondCall] = mockUpsertMetrics.mock.calls[1];
    expect(secondCall.workspaceId).toBe(firstCall.workspaceId);
    expect(secondCall.platform).toBe(firstCall.platform);
    expect(secondCall.windowStartMs).toBe(firstCall.windowStartMs);
  });

  it('isolates per-channel errors — a fetch failure does not abort other channels', async () => {
    const channels = [
      makeChannel({ provider: 'tiktok' }),
      makeChannel({ provider: 'youtube', access_token: 'enc:bad-token' }),
    ];
    mockAll.mockResolvedValueOnce({ results: channels });
    mockDecryptToken.mockResolvedValueOnce('plain-tiktok').mockResolvedValueOnce('plain-yt');
    mockFetchMetrics
      .mockResolvedValueOnce({ ok: true, value: snap('tiktok') })
      .mockResolvedValueOnce({ ok: false, error: { code: 'FETCH_FAILED', message: 'bad' } });
    mockUpsertMetrics.mockResolvedValueOnce({ ok: true, value: { windowStartMs: 0 } });

    const result = await handler({ step });
    expect(result.channels).toBe(2);
    expect(result.pulled).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('counts a decrypt failure as a failed channel without throwing', async () => {
    mockAll.mockResolvedValueOnce({ results: [makeChannel()] });
    mockDecryptToken.mockRejectedValueOnce(new Error('decrypt failed'));

    const result = await handler({ step });
    expect(result.failed).toBe(1);
    expect(result.pulled).toBe(0);
    expect(mockFetchMetrics).not.toHaveBeenCalled();
  });
});
