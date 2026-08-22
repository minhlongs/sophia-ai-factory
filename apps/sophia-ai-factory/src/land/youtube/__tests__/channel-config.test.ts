/**
 * Tests for channel-config CRUD + validation helpers.
 * Uses an in-memory SQLite D1 shim with the real migration schema.
 *
 * @module land/youtube/__tests__/channel-config
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
  createChannelConfig,
  getChannelConfig,
  getChannelConfigById,
  updateChannelConfig,
  listChannelConfigs,
  deactivateChannelConfig,
} from '../channel-config';
import {
  postsPerWeekForCadence,
  stringifyList,
  parseList,
  parseMetadata,
  genId,
  buildUpdateFields,
  rowToConfig,
  type CreateChannelConfigInput,
} from '../channel-config-types';
import { mockYouTubeD1, type YouTubeTestDb } from './youtube-test-db';

const USER_ID = 'user-1';
const CHANNEL_ID = 'UC_channel_abc';

let testDb: YouTubeTestDb;

beforeEach(() => {
  vi.clearAllMocks();
  testDb = mockYouTubeD1();
});

const validInput = (over: Partial<CreateChannelConfigInput> = {}): CreateChannelConfigInput => ({
  userId: USER_ID,
  channelId: CHANNEL_ID,
  channelTitle: 'My Channel',
  objective: 'Grow subscribers',
  audience: 'Tech enthusiasts',
  contentPillars: ['AI', 'Automation'],
  cadence: '3-per-week',
  ...over,
});

// ── Pure helpers (channel-config-types) ─────────────────────────────────────

describe('postsPerWeekForCadence', () => {
  it('returns explicit value when provided and positive', () => {
    expect(postsPerWeekForCadence('weekly', 5)).toBe(5);
  });

  it('floors a fractional explicit value', () => {
    expect(postsPerWeekForCadence('weekly', 2.9)).toBe(2);
  });

  it('falls back to cadence default when explicit is 0', () => {
    expect(postsPerWeekForCadence('daily', 0)).toBe(7);
  });

  it('falls back to cadence default when explicit is undefined', () => {
    expect(postsPerWeekForCadence('daily')).toBe(7);
    expect(postsPerWeekForCadence('every-2-days')).toBe(3);
    expect(postsPerWeekForCadence('3-per-week')).toBe(3);
    expect(postsPerWeekForCadence('weekly')).toBe(1);
  });

  it('falls back to cadence default when explicit is negative', () => {
    expect(postsPerWeekForCadence('weekly', -2)).toBe(1);
  });
});

describe('stringifyList / parseList', () => {
  it('round-trips a list of strings', () => {
    const values = ['AI', 'Automation', 'SaaS'];
    expect(parseList(stringifyList(values))).toEqual(values);
  });

  it('parseList returns empty array for null', () => {
    expect(parseList(null)).toEqual([]);
  });

  it('parseList returns empty array for invalid JSON', () => {
    expect(parseList('not-json')).toEqual([]);
  });

  it('parseList returns empty array for non-array JSON', () => {
    expect(parseList('{"a":1}')).toEqual([]);
  });

  it('parseList coerces non-string array items to strings', () => {
    expect(parseList('[1, 2, "three"]')).toEqual(['1', '2', 'three']);
  });
});

describe('parseMetadata', () => {
  it('parses a valid JSON object', () => {
    expect(parseMetadata('{"key":"value"}')).toEqual({ key: 'value' });
  });

  it('returns null for null input', () => {
    expect(parseMetadata(null)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseMetadata('not-json')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parseMetadata('"just a string"')).toBeNull();
  });
});

describe('genId', () => {
  it('returns a 32-char hex string without dashes', () => {
    const id = genId();
    expect(id).toHaveLength(32);
    expect(id).not.toContain('-');
    expect(/^[0-9a-f]+$/.test(id)).toBe(true);
  });

  it('returns unique ids across calls', () => {
    expect(genId()).not.toBe(genId());
  });
});

describe('buildUpdateFields', () => {
  it('returns null when no fields are provided', () => {
    expect(buildUpdateFields({})).toBeNull();
  });

  it('builds fields for provided values only', () => {
    const built = buildUpdateFields({ objective: 'New objective' });
    expect(built).not.toBeNull();
    expect(built?.fields).toEqual(['objective = ?']);
    expect(built?.values).toEqual(['New objective']);
  });

  it('stringifies contentPillars', () => {
    const built = buildUpdateFields({ contentPillars: ['A', 'B'] });
    expect(built?.values[0]).toBe('["A","B"]');
  });

  it('converts isActive boolean to 1/0', () => {
    expect(buildUpdateFields({ isActive: true })?.values[0]).toBe(1);
    expect(buildUpdateFields({ isActive: false })?.values[0]).toBe(0);
  });

  it('resolves postsPerWeek via cadence when cadence also provided', () => {
    const built = buildUpdateFields({ cadence: 'daily', postsPerWeek: 0 });
    expect(built?.values).toContain(7);
  });

  it('serializes metadata to JSON and null when absent', () => {
    expect(buildUpdateFields({ metadata: { a: 1 } })?.values[0]).toBe('{"a":1}');
    expect(buildUpdateFields({ metadata: undefined })).toBeNull();
  });
});

describe('rowToConfig', () => {
  it('maps a DB row to a ChannelConfig', () => {
    const config = rowToConfig({
      id: 'cfg-1',
      user_id: USER_ID,
      channel_id: CHANNEL_ID,
      channel_title: 'Title',
      objective: 'Obj',
      audience: 'Aud',
      content_pillars: '["AI"]',
      cadence: 'weekly',
      posts_per_week: 1,
      guardrails: null,
      content_buffer_days: 3,
      autonomy_level: 2,
      is_active: 1,
      metadata: '{"k":"v"}',
      created_at: '2026-08-22T00:00:00Z',
      updated_at: '2026-08-22T00:00:00Z',
    });

    expect(config.id).toBe('cfg-1');
    expect(config.contentPillars).toEqual(['AI']);
    expect(config.isActive).toBe(true);
    expect(config.metadata).toEqual({ k: 'v' });
    expect(config.postsPerWeek).toBe(1);
  });

  it('handles null channel_title and metadata', () => {
    const config = rowToConfig({
      id: 'cfg-2',
      user_id: USER_ID,
      channel_id: CHANNEL_ID,
      channel_title: null,
      objective: 'Obj',
      audience: 'Aud',
      content_pillars: null,
      cadence: 'weekly',
      posts_per_week: 0,
      guardrails: null,
      content_buffer_days: 0,
      autonomy_level: 0,
      is_active: 0,
      metadata: null,
      created_at: 'x',
      updated_at: 'x',
    });

    expect(config.channelTitle).toBeNull();
    expect(config.contentPillars).toEqual([]);
    expect(config.metadata).toBeNull();
    expect(config.isActive).toBe(false);
  });
});

// ── createChannelConfig ─────────────────────────────────────────────────────

describe('createChannelConfig', () => {
  it('creates a config and reads it back', async () => {
    const result = await createChannelConfig(validInput());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.config.userId).toBe(USER_ID);
    expect(result.config.channelId).toBe(CHANNEL_ID);
    expect(result.config.objective).toBe('Grow subscribers');
    expect(result.config.contentPillars).toEqual(['AI', 'Automation']);
    expect(result.config.cadence).toBe('3-per-week');
    expect(result.config.postsPerWeek).toBe(3);
    expect(result.config.isActive).toBe(true);
  });

  it('applies default buffer days and autonomy level', async () => {
    const result = await createChannelConfig(validInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.config.contentBufferDays).toBe(3);
    expect(result.config.autonomyLevel).toBe(2);
  });

  it('rejects a duplicate (user, channel) config', async () => {
    await createChannelConfig(validInput());
    const dup = await createChannelConfig(validInput());
    expect(dup.success).toBe(false);
    if (!dup.success) expect(dup.error).toContain('already exists');
  });

  it('allows the same channel for a different user', async () => {
    await createChannelConfig(validInput());
    const other = await createChannelConfig(validInput({ userId: 'user-2' }));
    expect(other.success).toBe(true);
  });

  it('returns failure when D1 binding is unavailable', async () => {
    vi.mocked(getD1).mockResolvedValue(null);
    const result = await createChannelConfig(validInput());
    expect(result.success).toBe(false);
  });
});

// ── getChannelConfig / getChannelConfigById ─────────────────────────────────

describe('getChannelConfig', () => {
  it('returns the config for (user, channel)', async () => {
    await createChannelConfig(validInput());
    const config = await getChannelConfig(USER_ID, CHANNEL_ID);
    expect(config).not.toBeNull();
    expect(config?.channelId).toBe(CHANNEL_ID);
  });

  it('returns null when not found', async () => {
    const config = await getChannelConfig(USER_ID, 'missing-channel');
    expect(config).toBeNull();
  });
});

describe('getChannelConfigById', () => {
  it('returns the config for the owning user', async () => {
    const created = await createChannelConfig(validInput());
    expect(created.success).toBe(true);
    if (!created.success) return;

    const config = await getChannelConfigById(created.config.id, USER_ID);
    expect(config).not.toBeNull();
    expect(config?.id).toBe(created.config.id);
  });

  it('returns null for a non-owning user', async () => {
    const created = await createChannelConfig(validInput());
    expect(created.success).toBe(true);
    if (!created.success) return;

    const config = await getChannelConfigById(created.config.id, 'other-user');
    expect(config).toBeNull();
  });
});

// ── updateChannelConfig ─────────────────────────────────────────────────────

describe('updateChannelConfig', () => {
  it('updates objective and audience', async () => {
    const created = await createChannelConfig(validInput());
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await updateChannelConfig(created.config.id, USER_ID, {
      objective: 'New objective',
      audience: 'New audience',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.config.objective).toBe('New objective');
    expect(result.config.audience).toBe('New audience');
  });

  it('updates contentPillars and cadence', async () => {
    const created = await createChannelConfig(validInput());
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await updateChannelConfig(created.config.id, USER_ID, {
      contentPillars: ['Finance'],
      cadence: 'daily',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.config.contentPillars).toEqual(['Finance']);
    expect(result.config.cadence).toBe('daily');
  });

  it('fails with no fields to update', async () => {
    const created = await createChannelConfig(validInput());
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await updateChannelConfig(created.config.id, USER_ID, {});
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('No fields to update');
  });

  it('fails for a non-owning user', async () => {
    const created = await createChannelConfig(validInput());
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await updateChannelConfig(created.config.id, 'other-user', {
      objective: 'x',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('not found or access denied');
  });
});

// ── listChannelConfigs ──────────────────────────────────────────────────────

describe('listChannelConfigs', () => {
  it('lists all configs for a user', async () => {
    await createChannelConfig(validInput({ channelId: 'UC_1' }));
    await createChannelConfig(validInput({ channelId: 'UC_2' }));
    await createChannelConfig(validInput({ userId: 'user-2', channelId: 'UC_3' }));

    const configs = await listChannelConfigs(USER_ID);
    expect(configs).toHaveLength(2);
    expect(configs.every((c) => c.userId === USER_ID)).toBe(true);
  });

  it('returns an empty list when the user has no configs', async () => {
    const configs = await listChannelConfigs('no-configs-user');
    expect(configs).toEqual([]);
  });
});

// ── deactivateChannelConfig ─────────────────────────────────────────────────

describe('deactivateChannelConfig', () => {
  it('soft-deletes by setting is_active = 0', async () => {
    const created = await createChannelConfig(validInput());
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await deactivateChannelConfig(created.config.id, USER_ID);
    expect(result.success).toBe(true);

    const config = await getChannelConfigById(created.config.id, USER_ID);
    expect(config?.isActive).toBe(false);
  });

  it('fails for a non-owning user', async () => {
    const created = await createChannelConfig(validInput());
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await deactivateChannelConfig(created.config.id, 'other-user');
    expect(result.success).toBe(false);
  });

  it('fails for a missing config', async () => {
    const result = await deactivateChannelConfig('missing-id', USER_ID);
    expect(result.success).toBe(false);
  });
});