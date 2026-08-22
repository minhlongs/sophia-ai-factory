/**
 * Tests for land/youtube server actions.
 * Auth via getCurrentUser(); Zod validation; Inngest emit (best-effort).
 *
 * @module land/youtube/__tests__/actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: vi.fn() },
}));
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import {
  createChannelConfigAction,
  getChannelConfigAction,
  scheduleContentAction,
  triggerContentPipelineAction,
} from '../actions';
import { mockYouTubeD1, type YouTubeTestDb } from './youtube-test-db';

const USER_ID = 'user-1';
const CONFIG_ID = 'config-1';

let testDb: YouTubeTestDb;

beforeEach(() => {
  vi.clearAllMocks();
  testDb = mockYouTubeD1();
  vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID, email: 'user@example.com' });
});

// ── createChannelConfigAction ───────────────────────────────────────────────

describe('createChannelConfigAction', () => {
  it('creates a channel config for the current user', async () => {
    const result = await createChannelConfigAction({
      channelId: 'UC_1',
      channelTitle: 'My Channel',
      objective: 'Grow subscribers',
      audience: 'Tech enthusiasts',
      contentPillars: ['AI', 'Automation'],
      cadence: '3-per-week',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.configId).toHaveLength(32);

    const row = testDb.raw
      .prepare('SELECT * FROM youtube_channel_configs WHERE id = ?')
      .get(result.value.configId) as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.user_id).toBe(USER_ID);
    expect(row.objective).toBe('Grow subscribers');
    expect(row.cadence).toBe('3-per-week');
  });

  it('returns UNAUTHENTICATED when no user session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await createChannelConfigAction({
      channelId: 'UC_1',
      objective: 'x',
      audience: 'y',
      contentPillars: ['a'],
      cadence: 'weekly',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns VALIDATION_ERROR when channelId is missing', async () => {
    const result = await createChannelConfigAction({
      channelId: '',
      objective: 'x',
      audience: 'y',
      contentPillars: ['a'],
      cadence: 'weekly',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR when contentPillars is empty', async () => {
    const result = await createChannelConfigAction({
      channelId: 'UC_1',
      objective: 'x',
      audience: 'y',
      contentPillars: [],
      cadence: 'weekly',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR when cadence is invalid', async () => {
    const result = await createChannelConfigAction({
      channelId: 'UC_1',
      objective: 'x',
      audience: 'y',
      contentPillars: ['a'],
      cadence: 'every-month' as 'daily',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR when objective is too long', async () => {
    const result = await createChannelConfigAction({
      channelId: 'UC_1',
      objective: 'x'.repeat(501),
      audience: 'y',
      contentPillars: ['a'],
      cadence: 'weekly',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR when autonomyLevel is out of range', async () => {
    const result = await createChannelConfigAction({
      channelId: 'UC_1',
      objective: 'x',
      audience: 'y',
      contentPillars: ['a'],
      cadence: 'weekly',
      autonomyLevel: 9,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});

// ── getChannelConfigAction ──────────────────────────────────────────────────

describe('getChannelConfigAction', () => {
  it('returns the channel config for the current user', async () => {
    const created = await createChannelConfigAction({
      channelId: 'UC_1',
      channelTitle: 'My Channel',
      objective: 'Grow subscribers',
      audience: 'Tech enthusiasts',
      contentPillars: ['AI'],
      cadence: '3-per-week',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await getChannelConfigAction('UC_1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.config).not.toBeNull();
    const cfg = result.value.config as { objective: string; channelId: string };
    expect(cfg.objective).toBe('Grow subscribers');
    expect(cfg.channelId).toBe('UC_1');
  });

  it('returns null config when none exists', async () => {
    const result = await getChannelConfigAction('UC_missing');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.config).toBeNull();
  });

  it('returns UNAUTHENTICATED when no user session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await getChannelConfigAction('UC_1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns VALIDATION_ERROR when channelId is missing', async () => {
    const result = await getChannelConfigAction('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});

// ── scheduleContentAction ───────────────────────────────────────────────────

describe('scheduleContentAction', () => {
  it('creates a calendar entry for the current user', async () => {
    const result = await scheduleContentAction({
      channelConfigId: CONFIG_ID,
      title: 'Scheduled video',
      scheduledAt: '2026-08-25T10:00:00Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.entryId).toHaveLength(32);

    const row = testDb.raw
      .prepare('SELECT * FROM youtube_content_calendar WHERE id = ?')
      .get(result.value.entryId) as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.user_id).toBe(USER_ID);
    expect(row.title).toBe('Scheduled video');
    expect(row.status).toBe('scheduled');
  });

  it('returns UNAUTHENTICATED when no user session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await scheduleContentAction({
      channelConfigId: CONFIG_ID,
      title: 'x',
      scheduledAt: '2026-08-25T10:00:00Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns VALIDATION_ERROR when title is missing', async () => {
    const result = await scheduleContentAction({
      channelConfigId: CONFIG_ID,
      title: '',
      scheduledAt: '2026-08-25T10:00:00Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR when scheduledAt is not ISO', async () => {
    const result = await scheduleContentAction({
      channelConfigId: CONFIG_ID,
      title: 'x',
      scheduledAt: 'not-a-date',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR when channelConfigId is missing', async () => {
    const result = await scheduleContentAction({
      channelConfigId: '',
      title: 'x',
      scheduledAt: '2026-08-25T10:00:00Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});

// ── triggerContentPipelineAction ────────────────────────────────────────────

describe('triggerContentPipelineAction', () => {
  // triggerContentPipelineAction loads the config via getChannelConfigById and
  // returns REPO_ERROR if it is missing, so seed one for the tests that reach
  // the frequency gate.
  function seedConfig() {
    testDb.raw
      .prepare(
        `INSERT INTO youtube_channel_configs
         (id, user_id, channel_id, objective, audience, content_pillars, cadence,
          posts_per_week, content_buffer_days, autonomy_level)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        CONFIG_ID,
        USER_ID,
        'UC_1',
        'Grow subscribers',
        'Tech enthusiasts',
        '["AI"]',
        '3-per-week',
        3,
        3,
        2,
      );
  }

  it('returns triggered: false when frequency gates block generation', async () => {
    seedConfig();
    // Seed a full content buffer so evaluateFrequency blocks.
    for (let i = 0; i < 3; i++) {
      testDb.raw
        .prepare(
          `INSERT INTO youtube_content_calendar
           (id, user_id, channel_config_id, title, status, scheduled_at)
           VALUES (?, ?, ?, ?, 'scheduled', ?)`,
        )
        .run(`cal-${i}`, USER_ID, CONFIG_ID, `title-${i}`, `2026-08-2${3 + i}T00:00:00Z`);
    }

    const result = await triggerContentPipelineAction({ channelConfigId: CONFIG_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.triggered).toBe(false);
    expect(typeof result.value.reason).toBe('string');
  });

  it('returns UNAUTHENTICATED when no user session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await triggerContentPipelineAction({ channelConfigId: CONFIG_ID });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns VALIDATION_ERROR when channelConfigId is missing', async () => {
    const result = await triggerContentPipelineAction({ channelConfigId: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns REPO_ERROR when the channel config does not exist', async () => {
    const result = await triggerContentPipelineAction({ channelConfigId: 'missing-config' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('REPO_ERROR');
  });

  it('emits an Inngest event when frequency gates pass', async () => {
    seedConfig();
    vi.mocked(inngest.send).mockResolvedValue(undefined as never);
    const result = await triggerContentPipelineAction({
      channelConfigId: CONFIG_ID,
      topic: 'AI news',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.triggered).toBe(true);
    expect(inngest.send).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(inngest.send).mock.calls[0][0] as {
      name: string;
      data: { userId: string; channelConfigId: string; topic: string | null };
    };
    expect(payload.name).toBe('youtube.content.pipeline.requested');
    expect(payload.data.userId).toBe(USER_ID);
    expect(payload.data.channelConfigId).toBe(CONFIG_ID);
    expect(payload.data.topic).toBe('AI news');
  });

  it('is non-fatal when Inngest emit fails', async () => {
    seedConfig();
    vi.mocked(inngest.send).mockRejectedValue(new Error('inngest down'));
    const result = await triggerContentPipelineAction({ channelConfigId: CONFIG_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.triggered).toBe(true);
  });
});