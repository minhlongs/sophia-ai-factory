/**
 * Tests for content-calendar CRUD + buffer/frequency management.
 * Uses an in-memory SQLite D1 shim with the real migration schema.
 *
 * @module land/youtube/__tests__/content-calendar
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getD1 } from '@/seed/db/client';
import {
  createCalendarEntry,
  getCalendarEntry,
  listUpcomingEntries,
  countPostsLast7Days,
  getLastPostAt,
  evaluateFrequency,
  updateCalendarEntry,
  cancelCalendarEntry,
} from '../content-calendar';
import { mockYouTubeD1, type YouTubeTestDb } from './youtube-test-db';

const USER_ID = 'user-1';
const CONFIG_ID = 'config-1';
const NOW = new Date('2026-08-22T00:00:00Z');

let testDb: YouTubeTestDb;

beforeEach(() => {
  vi.clearAllMocks();
  testDb = mockYouTubeD1();
});

function insertRawEntry(over: Record<string, unknown> = {}): string {
  const id = `cal-${Math.random().toString(36).slice(2, 10)}`;
  const row = {
    id,
    user_id: USER_ID,
    channel_config_id: CONFIG_ID,
    title: 'Test video',
    topic: 'Test topic',
    content_type: 'Tutorial',
    status: 'scheduled',
    scheduled_at: '2026-08-23T00:00:00Z',
    strategy_id: null,
    script_id: null,
    seo_id: null,
    production_id: null,
    published_video_id: null,
    notes: null,
    created_at: '2026-08-21T00:00:00Z',
    ...over,
  };
  testDb.raw
    .prepare(
      `INSERT INTO youtube_content_calendar
       (id, user_id, channel_config_id, title, topic, content_type, status, scheduled_at,
        strategy_id, script_id, seo_id, production_id, published_video_id, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.id, row.user_id, row.channel_config_id, row.title, row.topic, row.content_type,
      row.status, row.scheduled_at, row.strategy_id, row.script_id, row.seo_id,
      row.production_id, row.published_video_id, row.notes, row.created_at,
    );
  return id;
}

// ── createCalendarEntry ─────────────────────────────────────────────────────

describe('createCalendarEntry', () => {
  it('creates an entry with defaults and reads it back', async () => {
    const result = await createCalendarEntry({
      userId: USER_ID,
      channelConfigId: CONFIG_ID,
      title: 'My first video',
      scheduledAt: '2026-08-25T10:00:00Z',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.entry.title).toBe('My first video');
    expect(result.entry.status).toBe('scheduled');
    expect(result.entry.userId).toBe(USER_ID);
    expect(result.entry.channelConfigId).toBe(CONFIG_ID);
    expect(result.entry.topic).toBeNull();
    expect(result.entry.id).toHaveLength(32);
  });

  it('persists optional fields', async () => {
    const result = await createCalendarEntry({
      userId: USER_ID,
      channelConfigId: CONFIG_ID,
      title: 'Full entry',
      topic: 'AI automation',
      contentType: 'Explainer',
      status: 'ready',
      scheduledAt: '2026-08-25T10:00:00Z',
      strategyId: 'strat-1',
      scriptId: 'script-1',
      seoId: 'seo-1',
      productionId: 'prod-1',
      notes: 'high priority',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.entry.topic).toBe('AI automation');
    expect(result.entry.contentType).toBe('Explainer');
    expect(result.entry.status).toBe('ready');
    expect(result.entry.strategyId).toBe('strat-1');
    expect(result.entry.scriptId).toBe('script-1');
    expect(result.entry.seoId).toBe('seo-1');
    expect(result.entry.productionId).toBe('prod-1');
    expect(result.entry.notes).toBe('high priority');
  });

  it('returns failure when D1 binding is unavailable', async () => {
    vi.mocked(getD1).mockResolvedValue(null);
    const result = await createCalendarEntry({
      userId: USER_ID,
      title: 'x',
      scheduledAt: '2026-08-25T10:00:00Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('D1 database binding not available');
  });
});

// ── getCalendarEntry ────────────────────────────────────────────────────────

describe('getCalendarEntry', () => {
  it('returns the entry for the owning user', async () => {
    const id = insertRawEntry({ title: 'Owned entry' });
    const entry = await getCalendarEntry(id, USER_ID);
    expect(entry).not.toBeNull();
    expect(entry?.title).toBe('Owned entry');
  });

  it('returns null for a different user (ownership check)', async () => {
    const id = insertRawEntry();
    const entry = await getCalendarEntry(id, 'other-user');
    expect(entry).toBeNull();
  });

  it('returns null for a missing entry', async () => {
    const entry = await getCalendarEntry('missing-id', USER_ID);
    expect(entry).toBeNull();
  });

  it('throws when D1 binding is unavailable', async () => {
    vi.mocked(getD1).mockResolvedValue(null);
    await expect(getCalendarEntry('x', USER_ID)).rejects.toThrow(
      /D1 database binding not available/,
    );
  });
});

// ── listUpcomingEntries ─────────────────────────────────────────────────────

describe('listUpcomingEntries', () => {
  it('returns only scheduled/generating/ready entries at or after now, ordered by scheduled_at', async () => {
    insertRawEntry({ scheduled_at: '2026-08-24T00:00:00Z', status: 'scheduled' });
    insertRawEntry({ scheduled_at: '2026-08-23T00:00:00Z', status: 'ready' });
    insertRawEntry({ scheduled_at: '2026-08-25T00:00:00Z', status: 'generating' });
    insertRawEntry({ scheduled_at: '2026-08-26T00:00:00Z', status: 'published' });
    insertRawEntry({ scheduled_at: '2026-08-21T00:00:00Z', status: 'scheduled' });

    const entries = await listUpcomingEntries(USER_ID, CONFIG_ID, NOW);

    expect(entries).toHaveLength(3);
    expect(entries[0].scheduledAt).toBe('2026-08-23T00:00:00Z');
    expect(entries[1].scheduledAt).toBe('2026-08-24T00:00:00Z');
    expect(entries[2].scheduledAt).toBe('2026-08-25T00:00:00Z');
  });

  it('excludes entries belonging to other users or configs', async () => {
    insertRawEntry({ user_id: 'other-user' });
    insertRawEntry({ channel_config_id: 'other-config' });
    insertRawEntry({});

    const entries = await listUpcomingEntries(USER_ID, CONFIG_ID, NOW);
    expect(entries).toHaveLength(1);
  });

  it('returns an empty list when nothing is scheduled', async () => {
    const entries = await listUpcomingEntries(USER_ID, CONFIG_ID, NOW);
    expect(entries).toEqual([]);
  });
});

// ── countPostsLast7Days ─────────────────────────────────────────────────────

describe('countPostsLast7Days', () => {
  it('counts ready/published entries created in the trailing 7 days', async () => {
    insertRawEntry({ status: 'ready', created_at: '2026-08-20T00:00:00Z' });
    insertRawEntry({ status: 'published', created_at: '2026-08-18T00:00:00Z' });
    insertRawEntry({ status: 'scheduled', created_at: '2026-08-20T00:00:00Z' });
    insertRawEntry({ status: 'ready', created_at: '2026-08-10T00:00:00Z' });

    const count = await countPostsLast7Days(USER_ID, CONFIG_ID, NOW);
    expect(count).toBe(2);
  });

  it('returns 0 when no entries match', async () => {
    const count = await countPostsLast7Days(USER_ID, CONFIG_ID, NOW);
    expect(count).toBe(0);
  });
});

// ── getLastPostAt ───────────────────────────────────────────────────────────

describe('getLastPostAt', () => {
  it('returns the most recent ready/published created_at', async () => {
    insertRawEntry({ status: 'ready', created_at: '2026-08-18T00:00:00Z' });
    insertRawEntry({ status: 'published', created_at: '2026-08-20T00:00:00Z' });
    insertRawEntry({ status: 'scheduled', created_at: '2026-08-21T00:00:00Z' });

    const lastPostAt = await getLastPostAt(USER_ID, CONFIG_ID);
    expect(lastPostAt).toBe('2026-08-20T00:00:00Z');
  });

  it('returns null when no generated/published entries exist', async () => {
    const lastPostAt = await getLastPostAt(USER_ID, CONFIG_ID);
    expect(lastPostAt).toBeNull();
  });
});

// ── evaluateFrequency ───────────────────────────────────────────────────────

describe('evaluateFrequency', () => {
  it('allows generation when buffer is empty and cap not reached', async () => {
    const result = await evaluateFrequency({
      userId: USER_ID,
      channelConfigId: CONFIG_ID,
      cadence: 'weekly',
      postsPerWeek: 1,
      bufferDays: 3,
      now: NOW,
    });
    expect(result.shouldGenerate).toBe(true);
  });

  it('blocks generation when the content buffer is full', async () => {
    insertRawEntry({ scheduled_at: '2026-08-23T00:00:00Z', status: 'scheduled' });
    insertRawEntry({ scheduled_at: '2026-08-24T00:00:00Z', status: 'ready' });
    insertRawEntry({ scheduled_at: '2026-08-25T00:00:00Z', status: 'scheduled' });

    const result = await evaluateFrequency({
      userId: USER_ID,
      channelConfigId: CONFIG_ID,
      cadence: 'weekly',
      postsPerWeek: 1,
      bufferDays: 3,
      now: NOW,
    });
    expect(result.shouldGenerate).toBe(false);
    expect(result.reason).toContain('Content buffer sufficient');
  });

  it('blocks generation when the weekly cap is reached', async () => {
    insertRawEntry({ status: 'published', created_at: '2026-08-20T00:00:00Z' });

    const result = await evaluateFrequency({
      userId: USER_ID,
      channelConfigId: CONFIG_ID,
      cadence: 'weekly',
      postsPerWeek: 1,
      bufferDays: 0,
      now: NOW,
    });
    expect(result.shouldGenerate).toBe(false);
    expect(result.reason).toContain('Weekly cap reached');
  });
});

// ── updateCalendarEntry ─────────────────────────────────────────────────────

describe('updateCalendarEntry', () => {
  it('updates status and artifact ids', async () => {
    const id = insertRawEntry();
    const result = await updateCalendarEntry(id, USER_ID, {
      status: 'ready',
      strategyId: 'strat-9',
      scriptId: 'script-9',
      publishedVideoId: 'vid-9',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.entry.status).toBe('ready');
    expect(result.entry.strategyId).toBe('strat-9');
    expect(result.entry.scriptId).toBe('script-9');
    expect(result.entry.publishedVideoId).toBe('vid-9');
  });

  it('updates notes and scheduledAt', async () => {
    const id = insertRawEntry();
    const result = await updateCalendarEntry(id, USER_ID, {
      notes: 'updated notes',
      scheduledAt: '2026-09-01T00:00:00Z',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.entry.notes).toBe('updated notes');
    expect(result.entry.scheduledAt).toBe('2026-09-01T00:00:00Z');
  });

  it('fails with no fields to update', async () => {
    const id = insertRawEntry();
    const result = await updateCalendarEntry(id, USER_ID, {});
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('No fields to update');
  });

  it('fails for a non-owning user', async () => {
    const id = insertRawEntry();
    const result = await updateCalendarEntry(id, 'other-user', { status: 'ready' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('not found or access denied');
  });

  it('returns failure when D1 binding is unavailable', async () => {
    vi.mocked(getD1).mockResolvedValue(null);
    const result = await updateCalendarEntry('x', USER_ID, { status: 'ready' });
    expect(result.success).toBe(false);
  });
});

// ── cancelCalendarEntry ─────────────────────────────────────────────────────

describe('cancelCalendarEntry', () => {
  it('sets status to cancelled', async () => {
    const id = insertRawEntry();
    const result = await cancelCalendarEntry(id, USER_ID);
    expect(result.success).toBe(true);

    const entry = await getCalendarEntry(id, USER_ID);
    expect(entry?.status).toBe('cancelled');
  });

  it('fails for a non-owning user', async () => {
    const id = insertRawEntry();
    const result = await cancelCalendarEntry(id, 'other-user');
    expect(result.success).toBe(false);
  });
});