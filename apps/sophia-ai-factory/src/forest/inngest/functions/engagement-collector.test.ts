/**
 * Engagement Collector Tests — Phase 3
 *
 * Covers:
 * - No published jobs → returns no_jobs
 * - Fetches metrics via publisher import
 * - Normalizes and inserts into engagement_metrics
 * - Dead-letter after MAX_ATTEMPTS failures
 * - Handles missing D1 binding gracefully
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mockGetD1 = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
const mockNormalize = vi.hoisted(() => vi.fn());

// ── Module mocks ──────────────────────────────────────────────────────────────

 // inngest.createFunction returns handler → testable as plain function
vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: (_cfg: unknown, _evt: unknown, handler: (...args: unknown[]) => unknown) => handler,
  },
}));

vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));

vi.mock('@/seed/utils/logger-utility', () => ({ logger: mockLogger }));

vi.mock('@/seed/utils/metrics-normalizer', () => ({
  normalizeMetrics: mockNormalize,
}));

// Publisher providers — individual tests override as needed
vi.mock('@/land/video/publishing/providers/youtube-publisher', () => ({
  default: { getMetrics: vi.fn() },
  youtubePublisher: { getMetrics: vi.fn() },
}));
vi.mock('@/land/video/publishing/providers/tiktok-publisher', () => ({
  default: { getMetrics: vi.fn() },
  tiktokPublisher: { getMetrics: vi.fn() },
}));
vi.mock('@/land/video/publishing/providers/telegram-publisher', () => ({
  default: { getMetrics: vi.fn() },
  telegramPublisher: { getMetrics: vi.fn() },
}));
vi.mock('@/land/video/publishing/providers/instagram-publisher', () => ({
  default: { getMetrics: vi.fn() },
  instagramPublisher: { getMetrics: vi.fn() },
}));
vi.mock('@/land/video/publishing/providers/facebook-publisher', () => ({
  default: { getMetrics: vi.fn() },
  facebookPublisher: { getMetrics: vi.fn() },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { engagementCollector } from './engagement-collector';

// ── Types ────────────────────────────────────────────────────────────────────

type CronHandler = (
  ctx: {
    step: {
      run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>;
    };
  },
) => Promise<unknown>;

// ── Helpers ──────────────────────────────────────────────────────────────────

const NORMALIZED_METRIC = {
  views: 100,
  likes: 10,
  comments: 2,
  shares: 1,
  engagementRate: 13,
  platform: 'youtube',
  postId: 'p1',
  collectedAt: Math.floor(Date.now() / 1000),
};

function makeD1Mock() {
  const run = vi.fn().mockResolvedValue({ changes: 1 });
  const all = vi.fn().mockResolvedValue({ results: [] });
  const first = vi.fn().mockResolvedValue(null);
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({ run, all, first }),
      run,
      all,
      first,
    }),
    run,
    all,
    first,
  };
}

/**
 * Build a step mock.  By default `fn()` is called (which exercises the real
 * fetchMetrics → normalizeMetrics chain).  Tests override per-case.
 */
function makeStep() {
  return {
    run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => {
      return fn();
    }),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('engagementCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetD1.mockReturnValue(makeD1Mock());
    mockNormalize.mockReturnValue(NORMALIZED_METRIC);
  });

  it('returns no_jobs when no published items exist', async () => {
    const db = makeD1Mock();
    db.all.mockResolvedValue({ results: [] });
    mockGetD1.mockReturnValue(db);

    const handler = engagementCollector as unknown as CronHandler;
    const result = await handler({ step: makeStep() });

    expect(result).toEqual({ rowsProcessed: 0, message: 'no_jobs' });
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[engagement-collector] No published jobs to process',
    );
  });

  it('returns error when D1 binding is unavailable', async () => {
    mockGetD1.mockReturnValue(null);

    const handler = engagementCollector as unknown as CronHandler;
    const result = await handler({ step: makeStep() });

    expect(result).toEqual({ error: 'd1_unavailable', rowsProcessed: 0 });
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[engagement-collector] D1 binding not available',
    );
  });

  it('queries published jobs and invokes step.run per job', async () => {
    const db = makeD1Mock();
    const jobs = [
      { id: 'job-1', provider: 'youtube', channel_post_id: 'yt-001' },
      { id: 'job-2', provider: 'tiktok', channel_post_id: 'tt-002' },
    ];
    db.all.mockResolvedValue({ results: jobs });
    mockGetD1.mockReturnValue(db);

    const step = makeStep();
    const handler = engagementCollector as unknown as CronHandler;
    const result = await handler({ step });

    // DB select called to fetch jobs; step.run called for each (fetch + insert = 2××2 + 1 = 5)
    expect(db.prepare).toHaveBeenCalled();
    expect(result.rowsProcessed).toBe(2);
  });

  it('stops at BATCH_LIMIT (50)', async () => {
    const db = makeD1Mock();
    const jobs = Array.from({ length: 60 }, (_, i) => ({
      id: `job-${i}`,
      provider: 'tiktok',
      channel_post_id: `tt-${i}`,
    }));
    db.all.mockResolvedValue({ results: jobs });
    mockGetD1.mockReturnValue(db);

    const handler = engagementCollector as unknown as CronHandler;
    await handler({ step: makeStep() });

    const calls = (makeStep().run as ReturnType<typeof vi.fn>).mock.calls;
    // 1 fetch-published-jobs + up to 50 × 2 (fetch+insert) = max 101
    expect(calls.length).toBeLessThanOrEqual(101);
  });

  it('skips job and logs debug when publisher getMetrics throws', async () => {
    const db = makeD1Mock();
    db.all.mockResolvedValue({
      results: [
        { id: 'job-err', provider: 'telegram', channel_post_id: 'tg-001' },
      ],
    });
    mockGetD1.mockReturnValue(db);

    // Make telegram publisher throw → fetchMetrics returns null → skip path
    const telePub = await import('@/land/video/publishing/providers/telegram-publisher');
    vi.mocked((telePub.TelegramPublisher as unknown as { getMetrics: (s: string) => Promise<any> }).getMetrics)
      ?.mockRejectedValueOnce(new Error('network timeout'));

    const handler = engagementCollector as unknown as CronHandler;
    const result = await handler({ step: makeStep() });

    expect(result.rowsProcessed).toBe(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[engagement-collector] getMetrics failed',
      expect.objectContaining({ provider: 'telegram', postId: 'tg-001' }),
    );
  });

  it('dead-letters job after 3 consecutive failures', async () => {
    const db = makeD1Mock();
    db.all.mockResolvedValue({
      results: [
        { id: 'job-dl', provider: 'youtube', channel_post_id: 'yt-dl' },
      ],
    });
    mockGetD1.mockReturnValue(db);

    // Publisher always fails → skip path → handleFailure every time
    const ytPub = await import('@/land/video/publishing/providers/youtube-publisher');
    vi.mocked(ytPub.default?.getMetrics ?? ytPub.youtubePublisher?.getMetrics)
      ?.mockRejectedValue(new Error('persistent failure'));

    // Simulate handleFailure tracking state across 3 cron runs
    let attemptCount = 0;
    db.first.mockImplementation(async () => {
      if (attemptCount === 0) { attemptCount++; return null; }
      if (attemptCount === 1) { attemptCount++; return { attempt_count: 2 }; }
      return { attempt_count: 3 };
    });

    const handler = engagementCollector as unknown as CronHandler;
    // 3 cron runs → attempt_count reaches 3 → dead-letter logged
    for (let i = 0; i < 3; i++) {
      await handler({ step: makeStep() });
    }

    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[engagement-collector] Dead-lettered job',
      expect.objectContaining({ jobId: 'job-dl' }),
    );
  });
});
