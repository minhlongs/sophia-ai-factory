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

/** Build a mock D1 where .run() resolves with the given meta.changes value */
function makeD1Success(changes: number) {
  return {
    prepare: () => ({
      bind: () => ({
        run: vi.fn().mockReturnValue({ meta: { changes } }),
      }),
    }),
  } as unknown as D1Database;
}

/** Build a mock D1 where .run() throws (real D1 error contract) */
function makeD1Throws(msg: string) {
  return {
    prepare: () => ({
      bind: () => ({
        run: vi.fn().mockRejectedValue(new Error(msg)),
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
    vi.mocked(getD1).mockReturnValue(makeD1Success(1));

    const result = await insertAiPromptVideo(INPUT);
    expect(result.videoId).toBe('mission-xyz');
    expect(result.alreadyExisted).toBe(false);
  });

  it('returns alreadyExisted=true when row existed (INSERT OR IGNORE no-op)', async () => {
    // D1 returns meta.changes=0 when INSERT OR IGNORE skipped the row
    vi.mocked(getD1).mockReturnValue(makeD1Success(0));

    const result = await insertAiPromptVideo(INPUT);
    expect(result.videoId).toBe('mission-xyz');
    expect(result.alreadyExisted).toBe(true);
  });

  it('calling twice with same missionId returns alreadyExisted on second call', async () => {
    // First call: insert succeeds (changes=1)
    vi.mocked(getD1).mockReturnValueOnce(makeD1Success(1));
    const first = await insertAiPromptVideo(INPUT);
    expect(first.alreadyExisted).toBe(false);

    // Second call: INSERT OR IGNORE no-op (changes=0)
    vi.mocked(getD1).mockReturnValueOnce(makeD1Success(0));
    const second = await insertAiPromptVideo(INPUT);
    expect(second.videoId).toBe(first.videoId);
    expect(second.alreadyExisted).toBe(true);
  });

  it('accepts custom title without error', async () => {
    vi.mocked(getD1).mockReturnValue(makeD1Success(1));

    const result = await insertAiPromptVideo({ ...INPUT, title: 'My Custom Video' });
    expect(result.videoId).toBe('mission-xyz');
    expect(result.alreadyExisted).toBe(false);
  });

  it('propagates D1 throw (real error contract — no .error field)', async () => {
    vi.mocked(getD1).mockReturnValue(
      makeD1Throws('D1_ERROR: UNIQUE constraint failed: videos.id'),
    );

    await expect(insertAiPromptVideo(INPUT)).rejects.toThrow(
      'D1_ERROR: UNIQUE constraint failed: videos.id',
    );
  });
});
