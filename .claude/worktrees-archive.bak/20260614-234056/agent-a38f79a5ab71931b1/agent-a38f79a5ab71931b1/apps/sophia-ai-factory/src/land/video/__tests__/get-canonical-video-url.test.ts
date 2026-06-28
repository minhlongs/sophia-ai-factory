/**
 * Unit tests for get-canonical-video-url.ts
 *
 * Covers: valid r2_key, missing row, foreign user, null r2_key,
 *         missing R2_PUBLIC_HOSTNAME env var.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/seed/db/client', () => ({
  getD1Raw: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  getCanonicalVideoUrl,
  VideoNotFoundError,
  VideoUnauthorizedError,
  VideoNotMirroredError,
} from '../get-canonical-video-url';
import { getD1Raw } from '@/seed/db/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeD1(row: Record<string, unknown> | null) {
  return {
    prepare: () => ({
      bind: () => ({
        first: vi.fn().mockResolvedValue(row),
      }),
    }),
  } as unknown as D1Database;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getCanonicalVideoUrl', () => {
  const USER_ID = 'user-abc';
  const VIDEO_ID = 'video-123';
  const R2_KEY = 'video-jobs/mission-xyz/final.mp4';
  const R2_HOST = 'pub-test.r2.dev';

  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, R2_PUBLIC_HOSTNAME: R2_HOST };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns canonical R2 URL when video exists and is owned by user', async () => {
    vi.mocked(getD1Raw).mockResolvedValue(
      makeD1({ id: VIDEO_ID, user_id: USER_ID, r2_key: R2_KEY }),
    );

    const url = await getCanonicalVideoUrl(VIDEO_ID, USER_ID);
    expect(url).toBe(`https://${R2_HOST}/${R2_KEY}`);
  });

  it('throws VideoNotFoundError when row does not exist', async () => {
    vi.mocked(getD1Raw).mockResolvedValue(makeD1(null));

    await expect(getCanonicalVideoUrl(VIDEO_ID, USER_ID)).rejects.toThrow(
      VideoNotFoundError,
    );
  });

  it('throws VideoUnauthorizedError when user_id does not match', async () => {
    vi.mocked(getD1Raw).mockResolvedValue(
      makeD1({ id: VIDEO_ID, user_id: 'other-user', r2_key: R2_KEY }),
    );

    await expect(getCanonicalVideoUrl(VIDEO_ID, USER_ID)).rejects.toThrow(
      VideoUnauthorizedError,
    );
  });

  it('throws VideoNotMirroredError when r2_key is null', async () => {
    vi.mocked(getD1Raw).mockResolvedValue(
      makeD1({ id: VIDEO_ID, user_id: USER_ID, r2_key: null }),
    );

    await expect(getCanonicalVideoUrl(VIDEO_ID, USER_ID)).rejects.toThrow(
      VideoNotMirroredError,
    );
  });

  it('throws generic Error when R2_PUBLIC_HOSTNAME is not configured', async () => {
    delete process.env.R2_PUBLIC_HOSTNAME;

    vi.mocked(getD1Raw).mockResolvedValue(
      makeD1({ id: VIDEO_ID, user_id: USER_ID, r2_key: R2_KEY }),
    );

    await expect(getCanonicalVideoUrl(VIDEO_ID, USER_ID)).rejects.toThrow(
      'R2_PUBLIC_HOSTNAME env var not configured',
    );
  });
});
