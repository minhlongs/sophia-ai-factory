import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CORS_OPTIONS_HEADERS,
  buildVideoStreamResponse,
  getSigningSecret,
  lookupVideoDownloadRecord,
  sanitizeFilename,
  type VideoDownloadRow,
} from './video-download-helpers';

const SIGNING_ENV_KEYS = [
  'VIDEO_DOWNLOAD_SIGNING_SECRET', 'AUTH_SECRET', 'JWT_SECRET',
] as const;
const originalSigningEnv = new Map<string, string | undefined>();

describe('video download helpers', () => {
  beforeEach(() => {
    originalSigningEnv.clear();
    for (const key of SIGNING_ENV_KEYS) {
      originalSigningEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of SIGNING_ENV_KEYS) {
      const value = originalSigningEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.restoreAllMocks();
  });

  it('prefers the dedicated signing secret, then auth and JWT secrets', () => {
    process.env.AUTH_SECRET = 'auth-secret';
    process.env.JWT_SECRET = 'jwt-secret';
    expect(getSigningSecret()).toBe('auth-secret');

    process.env.VIDEO_DOWNLOAD_SIGNING_SECRET = 'video-secret';
    expect(getSigningSecret()).toBe('video-secret');

    delete process.env.VIDEO_DOWNLOAD_SIGNING_SECRET;
    delete process.env.AUTH_SECRET;
    expect(getSigningSecret()).toBe('jwt-secret');
  });

  it('uses the documented fallback when no secret environment variable is set', () => {
    expect(getSigningSecret()).toBe('sophia-edge-download-signing-key-default');
  });

  it('replaces unsafe filename characters and caps the result at 100 characters', () => {
    expect(sanitizeFilename('../bad name?.mp4')).toBe('.._bad_name_.mp4');
    expect(sanitizeFilename('x'.repeat(120))).toHaveLength(100);
  });

  it('queries the video record by ID and returns the D1 row', async () => {
    const row: VideoDownloadRow = {
      id: 'video-1', user_id: 'user-1', title: 'Demo', r2_key: 'videos/demo.mp4', access_revoked: 0,
    };
    const first = vi.fn().mockResolvedValue(row);
    const bind = vi.fn().mockReturnValue({ first });
    const prepare = vi.fn().mockReturnValue({ bind });
    const db = { prepare } as unknown as Parameters<typeof lookupVideoDownloadRecord>[0];

    await expect(lookupVideoDownloadRecord(db, 'video-1')).resolves.toEqual(row);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ?1'));
    expect(bind).toHaveBeenCalledWith('video-1');
  });

  it('preserves a missing D1 row as null', async () => {
    const first = vi.fn().mockResolvedValue(null);
    const db = {
      prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnValue({ first }) }),
    } as unknown as Parameters<typeof lookupVideoDownloadRecord>[0];

    await expect(lookupVideoDownloadRecord(db, 'missing')).resolves.toBeNull();
  });

  it('builds a private attachment response with sanitized name and object metadata', async () => {
    const response = buildVideoStreamResponse(
      { body: 'video-bytes', size: 11, httpMetadata: { contentType: 'video/webm' } },
      'lesson/one?.webm',
      'video-1',
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('video/webm');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="lesson_one_.webm.mp4"');
    expect(response.headers.get('cache-control')).toBe('private, no-transform, max-age=86400');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('content-length')).toBe('11');
    await expect(response.text()).resolves.toBe('video-bytes');
  });

  it('uses the default media type and omits a zero content length', () => {
    const response = buildVideoStreamResponse({ body: null, size: 0 }, null, 'video-2');

    expect(response.headers.get('content-type')).toBe('video/mp4');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="video-2.mp4"');
    expect(response.headers.has('content-length')).toBe(false);
  });

  it('exposes the expected preflight headers', () => {
    expect(CORS_OPTIONS_HEADERS).toMatchObject({
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range, X-Download-Token',
    });
  });
});
