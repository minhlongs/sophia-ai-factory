/**
 * Market Signals Ingest Cron — Handler-level tests.
 *
 * Covers:
 *   - Skips when no workspace sources configured
 *   - Processes YouTube source with BYOK credentials
 *   - Processes Google Trends RSS source (no credentials needed)
 *   - Per-workspace error isolation (continues on failures)
 *   - Dedupe upsert behavior
 *   - Cleanup expired signals step
 *
 * Uses mocked Inngest createFunction and shared D1 shim pattern.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ── Hoisted mocks ───────────────────────────────────────────────────────────

const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
const { mockFetchYouTubeTrending } = vi.hoisted(() => ({
  mockFetchYouTubeTrending: vi.fn(),
}));
const { mockFetchGoogleTrends } = vi.hoisted(() => ({
  mockFetchGoogleTrends: vi.fn(),
}));
const { mockUpsertSignalDeduped } = vi.hoisted(() => ({
  mockUpsertSignalDeduped: vi.fn(),
}));
const { mockDeleteExpiredSignals } = vi.hoisted(() => ({
  mockDeleteExpiredSignals: vi.fn(),
}));

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: (
      _cfg: unknown,
      _evt: unknown,
      handler: (...args: unknown[]) => unknown,
    ) => handler,
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({ logger: mockLogger }));

vi.mock('@/tree/market-signals/sources/youtube-source', () => ({
  fetchMultiRegionTrending: mockFetchYouTubeTrending,
}));

vi.mock('@/tree/market-signals/sources/rss-source', () => ({
  fetchMultiRegionTrends: mockFetchGoogleTrends,
}));

vi.mock('@/tree/market-signals/store', () => ({
  upsertSignalDeduped: mockUpsertSignalDeduped,
  deleteExpiredSignals: mockDeleteExpiredSignals,
}));

// ── Import after mocks ──────────────────────────────────────────────────────

import { marketSignalsIngestCron } from '@/forest/inngest/functions/market-signals-ingest-cron';

// ── Types ───────────────────────────────────────────────────────────────────

type InngestCronHandler = (ctx: {
  step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> };
}) => Promise<{
  ingested: number;
  workspaces: number;
  skipped?: boolean;
  reason?: string;
  errors?: Array<{ workspaceId: string; source: string; error: string }>;
}>;

type MarketSignal = {
  id: string;
  workspaceId: string;
  type: string;
  source: string;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  confidence: number;
  relevanceScore: number;
  expiresAt?: number;
  consumed: boolean;
  createdAt: number;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeD1Mock(rows: Record<string, unknown>[] = []) {
  const first = vi.fn().mockResolvedValue(null);
  const run = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } });
  const all = vi.fn().mockResolvedValue({ results: rows });
  const bind = vi.fn().mockReturnValue({ first, run, all });
  const prepare = vi.fn().mockReturnValue({ bind, first, run, all });
  return { prepare, bind, first, run, all };
}

function makeMockSignal(overrides: Partial<MarketSignal> = {}): MarketSignal {
  return {
    id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    workspaceId: 'ws-test',
    type: 'trend',
    source: 'youtube',
    title: 'Test Trending Video',
    summary: 'Test summary',
    data: { videoId: 'vid_123', viewCount: 100000 },
    confidence: 0.8,
    relevanceScore: 0.7,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    consumed: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('marketSignalsIngestCron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('skips when no workspace sources configured', async () => {
    const db = makeD1Mock([]);
    mockGetD1.mockResolvedValue(db);

    const handler = marketSignalsIngestCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await handler({ step: mockStep });

    expect(result).toEqual({
      ingested: 0,
      workspaces: 0,
      skipped: true,
      reason: 'no_sources_configured',
    });
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[market-signals-ingest] No workspace sources configured',
      expect.any(Object),
    );
    // Should not call fetch or upsert
    expect(mockFetchYouTubeTrending).not.toHaveBeenCalled();
    expect(mockFetchGoogleTrends).not.toHaveBeenCalled();
    expect(mockUpsertSignalDeduped).not.toHaveBeenCalled();
  });

  it('processes YouTube source with BYOK credentials successfully', async () => {
    const configs = [
      {
        workspace_id: 'ws-test',
        source: 'youtube',
        config_json: JSON.stringify({ userId: 'user-123', regionCode: 'US', maxSignals: 10 }),
      },
    ];
    const db = makeD1Mock(configs);
    mockGetD1.mockResolvedValue(db);

    const mockSignals = [makeMockSignal({ source: 'youtube', type: 'trend' }), makeMockSignal({ source: 'youtube', type: 'trend' })];
    mockFetchYouTubeTrending.mockResolvedValueOnce({
      signals: mockSignals,
      blockedReason: undefined,
    });
    mockUpsertSignalDeduped.mockResolvedValue({ ok: true, value: mockSignals[0] });

    const handler = marketSignalsIngestCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await handler({ step: mockStep });

    expect(result.ingested).toBe(2);
    expect(result.workspaces).toBe(1);
    expect(mockFetchYouTubeTrending).toHaveBeenCalledTimes(1);
    expect(mockUpsertSignalDeduped).toHaveBeenCalledTimes(2);
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[market-signals-ingest] Source ingested',
      expect.objectContaining({ workspaceId: 'ws-test', source: 'youtube', count: 2 }),
    );
  });

  it('processes Google Trends RSS source (no credentials needed)', async () => {
    const configs = [
      {
        workspace_id: 'ws-test',
        source: 'google-trends-rss',
        config_json: JSON.stringify({ regionCode: 'US', maxSignals: 20 }),
      },
    ];
    const db = makeD1Mock(configs);
    mockGetD1.mockResolvedValue(db);

    const mockSignals = [
      makeMockSignal({ source: 'google-trends-rss', type: 'search', title: 'AI Trends' }),
      makeMockSignal({ source: 'google-trends-rss', type: 'search', title: 'Video Marketing' }),
    ];
    mockFetchGoogleTrends.mockResolvedValueOnce({
      signals: mockSignals,
      blockedReason: undefined,
    });
    mockUpsertSignalDeduped.mockResolvedValue({ ok: true, value: mockSignals[0] });

    const handler = marketSignalsIngestCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await handler({ step: mockStep });

    expect(result.ingested).toBe(2);
    expect(result.workspaces).toBe(1);
    expect(mockFetchGoogleTrends).toHaveBeenCalledTimes(1);
    expect(mockUpsertSignalDeduped).toHaveBeenCalledTimes(2);
  });

  it('handles YouTube BYOK_REQUIRED gracefully (continues to next source)', async () => {
    const configs = [
      {
        workspace_id: 'ws-test',
        source: 'youtube',
        config_json: JSON.stringify({ userId: 'user-123', regionCode: 'US' }),
      },
      {
        workspace_id: 'ws-test',
        source: 'google-trends-rss',
        config_json: JSON.stringify({ regionCode: 'US' }),
      },
    ];
    const db = makeD1Mock(configs);
    mockGetD1.mockResolvedValue(db);

    // YouTube returns blocked
    mockFetchYouTubeTrending.mockResolvedValueOnce({
      signals: [],
      blockedReason: 'BYOK_REQUIRED: Customer must connect YouTube account in Setup Wizard',
    });
    // RSS returns signals
    const mockSignals = [makeMockSignal({ source: 'google-trends-rss', type: 'search' })];
    mockFetchGoogleTrends.mockResolvedValueOnce({
      signals: mockSignals,
      blockedReason: undefined,
    });
    mockUpsertSignalDeduped.mockResolvedValue({ ok: true, value: mockSignals[0] });

    const handler = marketSignalsIngestCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await handler({ step: mockStep });

    expect(result.ingested).toBe(1);
    expect(result.workspaces).toBe(1);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e: { error: string }) => e.error.includes('BYOK_REQUIRED'))).toBe(true);
    expect(mockFetchYouTubeTrending).toHaveBeenCalledTimes(1);
    expect(mockFetchGoogleTrends).toHaveBeenCalledTimes(1);
    expect(mockUpsertSignalDeduped).toHaveBeenCalledTimes(1);
  });

  it('per-workspace error isolation: fails one workspace but continues to next', async () => {
    const configs = [
      { workspace_id: 'ws-1', source: 'youtube', config_json: JSON.stringify({ userId: 'user-1' }) },
      { workspace_id: 'ws-2', source: 'google-trends-rss', config_json: JSON.stringify({ regionCode: 'US' }) },
    ];
    const db = makeD1Mock(configs);
    mockGetD1.mockResolvedValue(db);

    // ws-1 YouTube fetch throws
    mockFetchYouTubeTrending.mockRejectedValueOnce(new Error('Network error'));
    // ws-2 RSS succeeds
    const mockSignals = [makeMockSignal({ source: 'google-trends-rss', type: 'search', workspaceId: 'ws-2' })];
    mockFetchGoogleTrends.mockResolvedValueOnce({
      signals: mockSignals,
      blockedReason: undefined,
    });
    mockUpsertSignalDeduped.mockResolvedValue({ ok: true, value: mockSignals[0] });

    const handler = marketSignalsIngestCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await handler({ step: mockStep });

    expect(result.workspaces).toBe(2);
    expect(result.ingested).toBe(1);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e: { workspaceId: string; error: string }) => e.workspaceId === 'ws-1' && e.error.includes('Network error'))).toBe(true);
    expect(mockFetchYouTubeTrending).toHaveBeenCalledTimes(1);
    expect(mockFetchGoogleTrends).toHaveBeenCalledTimes(1);
  });

  it('per-source error isolation within workspace: fails YouTube but continues with RSS', async () => {
    const configs = [
      { workspace_id: 'ws-test', source: 'youtube', config_json: JSON.stringify({ userId: 'user-1' }) },
      { workspace_id: 'ws-test', source: 'google-trends-rss', config_json: JSON.stringify({ regionCode: 'US' }) },
    ];
    const db = makeD1Mock(configs);
    mockGetD1.mockResolvedValue(db);

    // YouTube throws
    mockFetchYouTubeTrending.mockRejectedValueOnce(new Error('YouTube API error'));
    // RSS succeeds
    const mockSignals = [makeMockSignal({ source: 'google-trends-rss', type: 'search' })];
    mockFetchGoogleTrends.mockResolvedValueOnce({
      signals: mockSignals,
      blockedReason: undefined,
    });
    mockUpsertSignalDeduped.mockResolvedValue({ ok: true, value: mockSignals[0] });

    const handler = marketSignalsIngestCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await handler({ step: mockStep });

    expect(result.workspaces).toBe(1);
    expect(result.ingested).toBe(1);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e: { source: string; error: string }) => e.source === 'youtube' && e.error.includes('YouTube API error'))).toBe(true);
    expect(mockFetchYouTubeTrending).toHaveBeenCalledTimes(1);
    expect(mockFetchGoogleTrends).toHaveBeenCalledTimes(1);
  });

  it('runs cleanup expired signals step', async () => {
    const configs = [
      { workspace_id: 'ws-test', source: 'youtube', config_json: JSON.stringify({ userId: 'user-1' }) },
    ];
    const db = makeD1Mock(configs);
    mockGetD1.mockResolvedValue(db);

    const mockSignals = [makeMockSignal()];
    mockFetchYouTubeTrending.mockResolvedValueOnce({
      signals: mockSignals,
      blockedReason: undefined,
    });
    mockUpsertSignalDeduped.mockResolvedValue({ ok: true, value: mockSignals[0] });
    mockDeleteExpiredSignals.mockResolvedValue({ ok: true, value: 5 });

    const handler = marketSignalsIngestCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await handler({ step: mockStep });

    expect(result.ingested).toBe(1);
    expect(mockDeleteExpiredSignals).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[market-signals-ingest] Cleaned up expired signals',
      expect.objectContaining({ deleted: 5 }),
    );
  });

  it('handles upsert failure gracefully (continues with next signal)', async () => {
    const configs = [
      { workspace_id: 'ws-test', source: 'youtube', config_json: JSON.stringify({ userId: 'user-1' }) },
    ];
    const db = makeD1Mock(configs);
    mockGetD1.mockResolvedValue(db);

    const mockSignals = [makeMockSignal({ id: 'sig-1' }), makeMockSignal({ id: 'sig-2' })];
    mockFetchYouTubeTrending.mockResolvedValueOnce({
      signals: mockSignals,
      blockedReason: undefined,
    });
    // First upsert fails, second succeeds
    mockUpsertSignalDeduped
      .mockResolvedValueOnce({ ok: false, error: new Error('DB constraint violation') })
      .mockResolvedValueOnce({ ok: true, value: mockSignals[1] });

    const handler = marketSignalsIngestCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await handler({ step: mockStep });

    expect(result.ingested).toBe(1);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e: { error: string }) => e.error.includes('upsert_failed_sig-1'))).toBe(true);
    expect(mockUpsertSignalDeduped).toHaveBeenCalledTimes(2);
  });

  it('handles unknown source type gracefully', async () => {
    const configs = [
      { workspace_id: 'ws-test', source: 'unknown-source', config_json: JSON.stringify({}) },
    ];
    const db = makeD1Mock(configs);
    mockGetD1.mockResolvedValue(db);

    const handler = marketSignalsIngestCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await handler({ step: mockStep });

    expect(result.workspaces).toBe(1);
    expect(result.ingested).toBe(0);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e: { error: string }) => e.error.includes('UNKNOWN_SOURCE'))).toBe(true);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[market-signals-ingest] Unknown source type',
      expect.objectContaining({ workspaceId: 'ws-test', source: 'unknown-source' }),
    );
  });

  it('returns no_sources_configured when config table read fails (missing table)', async () => {
    const db = makeD1Mock([]);
    db.all.mockRejectedValue(new Error('D1_ERROR: no such table: workspace_market_signal_configs'));
    mockGetD1.mockResolvedValue(db);

    const handler = marketSignalsIngestCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await handler({ step: mockStep });

    expect(result).toEqual({
      ingested: 0,
      workspaces: 0,
      skipped: true,
      reason: 'no_sources_configured',
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[market-signals-ingest] Failed to read workspace signal configs (table may not exist yet)',
      expect.objectContaining({ error: expect.stringContaining('no such table') }),
    );
    expect(mockFetchYouTubeTrending).not.toHaveBeenCalled();
    expect(mockFetchGoogleTrends).not.toHaveBeenCalled();
    expect(mockUpsertSignalDeduped).not.toHaveBeenCalled();
  });

  it('handles D1 not available gracefully', async () => {
    mockGetD1.mockResolvedValue(null);

    const handler = marketSignalsIngestCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await handler({ step: mockStep });

    expect(result).toEqual({
      ingested: 0,
      workspaces: 0,
      skipped: true,
      reason: 'no_sources_configured',
    });
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[market-signals-ingest] D1 not available',
      expect.any(Object),
    );
  });
});