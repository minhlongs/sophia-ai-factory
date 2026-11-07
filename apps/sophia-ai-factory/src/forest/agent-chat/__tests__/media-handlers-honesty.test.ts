/**
 * Media handler honesty tests (forest/agent-chat/executor/media-handlers.ts)
 *
 * The video and voice model lists used to substitute a placeholder row when the
 * customer had stored no credential: a video model presented as
 * `openrouter default` with `active: true`, a voice as `elevenlabs default`.
 * A caller reading the tool output as "this key is usable" would then run a
 * paid call on a credential the customer never provided.
 *
 * These tests pin the repaired contract: the rowset is exactly what the
 * canonical `user_provider_credentials` table holds, and an empty result stays
 * empty. That is the honest answer to "no key configured".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Row = Record<string, unknown>;

/** Minimal D1 `all()` stand-in that reports the SQL it was handed. */
function makeDb(rows: Row[] = []) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => ({
        all: async () => {
          calls.push({ sql, params });
          return { results: rows };
        },
      }),
    }),
  };
  return { db, calls };
}

const mockGetD1 = vi.fn();

vi.mock('@/seed/db/client', () => ({
  getD1: () => mockGetD1(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('media handlers report only stored credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the video credential rows verbatim, without inventing a default', async () => {
    const { db } = makeDb([{ provider: 'openrouter', display_hint: 'gpt-4o-mini' }]);
    mockGetD1.mockResolvedValue(db);
    const { executeListVideoModels } = await import('../executor/media-handlers');

    const res = await executeListVideoModels('user_1');

    expect(res.success).toBe(true);
    expect(res.content).toEqual([
      { provider: 'openrouter', model: 'gpt-4o-mini', active: 1 },
    ]);
  });

  it('returns an empty list when no video credential is stored, not a placeholder', async () => {
    const { db } = makeDb([]);
    mockGetD1.mockResolvedValue(db);
    const { executeListVideoModels } = await import('../executor/media-handlers');

    const res = await executeListVideoModels('user_1');

    expect(res.success).toBe(true);
    expect(res.content).toEqual([]);
  });

  it('returns the voice credential rows verbatim, without inventing a default', async () => {
    const { db } = makeDb([{ provider: 'elevenlabs', display_hint: 'nova' }]);
    mockGetD1.mockResolvedValue(db);
    const { executeListVoiceModels } = await import('../executor/media-handlers');

    const res = await executeListVoiceModels('user_1');

    expect(res.success).toBe(true);
    expect(res.content).toEqual([
      { provider: 'elevenlabs', voice: 'nova', active: 1 },
    ]);
  });

  it('returns an empty list when no voice credential is stored, not a placeholder', async () => {
    const { db } = makeDb([]);
    mockGetD1.mockResolvedValue(db);
    const { executeListVoiceModels } = await import('../executor/media-handlers');

    const res = await executeListVoiceModels('user_1');

    expect(res.success).toBe(true);
    expect(res.content).toEqual([]);
  });

  it('reads the table the credential store writes, scoped to the calling user', async () => {
    const { db, calls } = makeDb([]);
    mockGetD1.mockResolvedValue(db);
    const { executeListVideoModels } = await import('../executor/media-handlers');

    await executeListVideoModels('user_42');

    const call = calls[0];
    expect(call.sql).toContain('user_provider_credentials');
    expect(call.sql).not.toContain('byok_credentials');
    expect(call.params).toEqual(['user_42']);
  });

  it('fails the tool call when the database is unreachable, rather than guessing', async () => {
    mockGetD1.mockResolvedValue(null);
    const { executeListVideoModels } = await import('../executor/media-handlers');

    const res = await executeListVideoModels('user_1');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/database/i);
    expect(res.content).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'openrouter' }),
    ]));
  });
});
