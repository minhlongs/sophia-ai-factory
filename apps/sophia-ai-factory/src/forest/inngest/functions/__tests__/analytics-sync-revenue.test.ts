/**
 * Integration tests: analytics-sync cron → YouTube revenue ingestion.
 *
 * Exercises the real handler end-to-end against a real SQLite DB (shared D1
 * shim): real normalizer, real revenue-ingestion, real idempotent event
 * writer. Only the HTTP boundary (YouTube fetch), credential decryption,
 * the video_analytics upsert, and the feedback loop are stubbed.
 *
 * Covers: revenue rows written with correct workspace/value/channel/asset,
 * idempotency across a second cron pass, no-org users skipped without
 * failing the sync.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { YouTubeAnalyticsRow } from '@/land/analytics/youtube-analytics-fetcher';

const { mockGetD1, mockFetchYT, mockGetCreds, mockUpsert, mockFeedback } = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  mockFetchYT: vi.fn(),
  mockGetCreds: vi.fn(),
  mockUpsert: vi.fn(),
  mockFeedback: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_cfg: unknown, _cron: unknown, handler: unknown) => ({
      _handler: handler,
    })),
  },
}));
vi.mock('@/land/analytics/youtube-analytics-fetcher', () => ({
  fetchYouTubeAnalytics: mockFetchYT,
}));
vi.mock('@/forest/publishing/credential-manager', () => ({
  getDecryptedCredentials: mockGetCreds,
  storeCredentials: vi.fn(),
}));
vi.mock('@/seed/db/repositories/video-analytics-repo', () => ({
  upsertVideoAnalytics: mockUpsert,
}));
vi.mock('@/tree/sop/performance-feedback-engine', () => ({
  runPerformanceFeedbackAndOptimization: mockFeedback,
}));

import { analyticsSync } from '../analytics-sync';
import { logger } from '@/seed/utils/logger-utility';

const EXTRA_TABLES = `
CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  UNIQUE(org_id, user_id)
);
CREATE TABLE IF NOT EXISTS video_publishes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_video_id TEXT,
  status TEXT DEFAULT 'pending'
);`;

interface EventRow {
  id: string;
  workspace_id: string;
  asset_id: string;
  entity_id: string;
  channel: string;
  event_type: string;
  value_cents: number;
  recorded_at: number;
}

interface CronResult {
  synced: number;
  optimizedCount: number;
  revenueEvents: number;
}

interface StepStub {
  run: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
}

type CronHandler = (ctx: { step: StepStub }) => Promise<unknown>;

function ytRow(videoId: string, date: string, estimatedRevenue: number): YouTubeAnalyticsRow {
  return {
    videoId, date, views: 100, estimatedMinutesWatched: 10, averageViewDuration: 60,
    impressions: 1000, impressionClickThroughRate: 5, likes: 10, comments: 2,
    shares: 1, estimatedRevenue,
  };
}

// micro USD: 2_500_000 → 250 cents, 1_000_000 → 100 cents, 500_000 → 50 cents
const YT_ROWS: YouTubeAnalyticsRow[] = [
  ytRow('yt-platform-1', '2026-08-01', 2_500_000),
  ytRow('yt-platform-1', '2026-08-02', 1_000_000),
  ytRow('yt-platform-2', '2026-08-01', 500_000),
];

async function runCron(): Promise<CronResult> {
  const handler = (analyticsSync as unknown as { _handler: CronHandler })._handler;
  const result = await handler({ step: { run: (_id, fn) => fn() } });
  return result as CronResult;
}

async function revenueRows(): Promise<EventRow[]> {
  const db = await mockGetD1();
  const { results } = await db
    .prepare("SELECT * FROM performance_events WHERE event_type = 'revenue' ORDER BY id")
    .all();
  return results as EventRow[];
}

describe('analytics-sync cron → revenue ingestion (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const raw = freshDb();
    raw.exec(EXTRA_TABLES);
    raw.prepare('INSERT INTO org_members (org_id, user_id) VALUES (?, ?)').run('org-1', 'user-1');
    raw
      .prepare('INSERT INTO video_publishes (id, user_id, video_id, platform, platform_video_id, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run('pub-1', 'user-1', 'vid-1', 'youtube', 'yt-platform-1', 'published');
    raw
      .prepare('INSERT INTO video_publishes (id, user_id, video_id, platform, platform_video_id, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run('pub-2', 'user-2', 'vid-2', 'youtube', 'yt-platform-2', 'published');
    mockGetD1.mockResolvedValue(makeD1(raw));
    mockGetCreds.mockImplementation(async (userId: string) => ({
      accessToken: `token-${userId}`,
      refreshToken: null,
      expiresAt: null,
      isExpired: false,
    }));
    mockFetchYT.mockImplementation(async (_token: string, videoIds: string[]) =>
      YT_ROWS.filter((r) => videoIds.includes(r.videoId)),
    );
    mockUpsert.mockResolvedValue(undefined);
    mockFeedback.mockResolvedValue(0);
  });

  it('writes revenue events with correct workspace, cents, channel, asset', async () => {
    const result = await runCron();

    expect(result).toEqual({ synced: 3, optimizedCount: 0, revenueEvents: 2 });
    expect(mockUpsert).toHaveBeenCalledTimes(3);

    const events = await revenueRows();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: 'rev_user-1_vid-1_2026-08-01',
      workspace_id: 'org-1',
      asset_id: 'vid-1',
      entity_id: 'vid-1',
      channel: 'youtube',
      event_type: 'revenue',
      value_cents: 250,
      recorded_at: Date.UTC(2026, 7, 1),
    });
    expect(events[1]).toMatchObject({
      id: 'rev_user-1_vid-1_2026-08-02',
      workspace_id: 'org-1',
      value_cents: 100,
      recorded_at: Date.UTC(2026, 7, 2),
    });
  });

  it('second cron pass over the same range writes zero duplicate rows', async () => {
    const first = await runCron();
    expect(first.revenueEvents).toBe(2);
    expect(await revenueRows()).toHaveLength(2);

    const second = await runCron();
    expect(second.synced).toBe(3);
    expect(second.revenueEvents).toBe(0);
    expect(await revenueRows()).toHaveLength(2);
  });

  it('skips a user without org membership without failing the sync', async () => {
    const result = await runCron();

    // user-2's row was fetched and upserted but wrote no revenue event
    expect(result.synced).toBe(3);
    expect(result.revenueEvents).toBe(2);
    const events = await revenueRows();
    expect(events.every((e) => e.workspace_id === 'org-1')).toBe(true);
    expect(events.some((e) => e.entity_id === 'vid-2')).toBe(false);
    expect(vi.mocked(logger.warn)).toHaveBeenCalled();
  });
});
