/**
 * Unit tests for videos-repo.ts — insertAiPromptVideo
 *
 * Reflects real D1 contract:
 *   - D1 THROWS on errors (no .error field on D1Result)
 *   - result.meta.changes === 0 means INSERT OR IGNORE was a no-op (row existed)
 *   - videos.id === missionId (deterministic 1:1, genuinely idempotent on PK)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/seed/utils/to-error', () => ({
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

import { insertAiPromptVideo } from '../videos-repo';
import { getD1 } from '@/seed/db/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a mock D1 where .first() returns the given row (new insert path).
 * Uses missionId as the row id to match the real INSERT ... RETURNING id contract.
 */
function makeD1FirstReturns(row: { id: string } | null) {
  return {
    prepare: () => ({
      bind: () => ({
        first: vi.fn().mockResolvedValue(row),
      }),
    }),
  } as unknown as D1Database;
}

/** Build a mock D1 where .first() rejects (real D1 error contract — throws on error) */
function makeD1Throws(msg: string) {
  return {
    prepare: () => ({
      bind: () => ({
        first: vi.fn().mockRejectedValue(new Error(msg)),
      }),
    }),
  } as unknown as D1Database;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('insertAiPromptVideo', () => {
  const INPUT = {
    userId: 'user-abc',
    missionId: 'mission-xyz',
    r2Key: 'video-jobs/mission-xyz/final.mp4',
    videoUrl: 'https://pub-test.r2.dev/video-jobs/mission-xyz/final.mp4',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns videoId equal to missionId on new insert', async () => {
    vi.mocked(getD1).mockResolvedValue(makeD1FirstReturns({ id: 'mission-xyz' }));

    const result = await insertAiPromptVideo(INPUT);
    expect(result.videoId).toBe('mission-xyz');
    expect(result.alreadyExisted).toBe(false);
  });

  it('returns alreadyExisted=true when row existed (INSERT OR IGNORE no-op)', async () => {
    // D1 .first() returns null when INSERT OR IGNORE skipped the row
    vi.mocked(getD1).mockResolvedValue(makeD1FirstReturns(null));

    const result = await insertAiPromptVideo(INPUT);
    expect(result.videoId).toBe('mission-xyz');
    expect(result.alreadyExisted).toBe(true);
  });

  it('calling twice with same missionId returns alreadyExisted on second call', async () => {
    // First call: insert succeeds (.first() returns the row)
    vi.mocked(getD1).mockResolvedValueOnce(makeD1FirstReturns({ id: 'mission-xyz' }));
    const first = await insertAiPromptVideo(INPUT);
    expect(first.alreadyExisted).toBe(false);

    // Second call: INSERT OR IGNORE is a no-op (.first() returns null)
    vi.mocked(getD1).mockResolvedValueOnce(makeD1FirstReturns(null));
    const second = await insertAiPromptVideo(INPUT);
    expect(second.videoId).toBe(first.videoId);
    expect(second.alreadyExisted).toBe(true);
  });

  it('accepts custom title without error', async () => {
    vi.mocked(getD1).mockResolvedValue(makeD1FirstReturns({ id: 'mission-xyz' }));

    const result = await insertAiPromptVideo({ ...INPUT, title: 'My Custom Video' });
    expect(result.videoId).toBe('mission-xyz');
    expect(result.alreadyExisted).toBe(false);
  });

  it('propagates D1 throw (real error contract — no .error field)', async () => {
    vi.mocked(getD1).mockResolvedValue(
      makeD1Throws('D1_ERROR: UNIQUE constraint failed: videos.id'),
    );

    await expect(insertAiPromptVideo(INPUT)).rejects.toThrow(
      'D1_ERROR: UNIQUE constraint failed: videos.id',
    );
  });
});
