/**
 * Tests for GET /api/v1/creative-studio/images/[id]/download
 *
 * Covers:
 * 1. Unauthenticated request → 401
 * 2. Foreign / missing job → 404 (IDOR protection)
 * 3. Incomplete job → 409
 * 4. R2 stream when storage_key is present
 * 5. Upstream CDN proxy fallback when storage_key is absent
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({})),
}));

vi.mock('@/tree/creative-studio/image-job-queries', () => ({
  getUserImageJob: vi.fn(),
}));

vi.mock('@/land/video/storage/r2-binding', () => ({
  getVideoBucket: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserImageJob } from '@/tree/creative-studio/image-job-queries';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { GET } from '../route';

function makeRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/v1/creative-studio/images/${id}/download`);
}

describe('GET /api/v1/creative-studio/images/[id]/download', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
    });
    vi.mocked(getVideoBucket).mockResolvedValue(null);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await GET(makeRequest('job_1'), { params: Promise.resolve({ id: 'job_1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when the job does not exist or belongs to another user', async () => {
    vi.mocked(getUserImageJob).mockResolvedValue(null);

    const res = await GET(makeRequest('foreign_job'), {
      params: Promise.resolve({ id: 'foreign_job' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 409 when the job is still pending', async () => {
    vi.mocked(getUserImageJob).mockResolvedValue({
      id: 'job_pending',
      user_id: 'user_1',
      model: 'fal-ai/flux-schnell',
      prompt: 'A mountain',
      status: 'pending',
      result_url: null,
      thumbnail_url: null,
      provider: 'fal-ai',
      error: null,
      created_at: 1700000000,
      completed_at: null,
    });

    const res = await GET(makeRequest('job_pending'), {
      params: Promise.resolve({ id: 'job_pending' }),
    });
    expect(res.status).toBe(409);
  });

  it('streams directly from R2 when storage_key is available', async () => {
    vi.mocked(getUserImageJob).mockResolvedValue({
      id: 'fal-12345678',
      user_id: 'user_1',
      model: 'fal-ai/flux-schnell',
      prompt: 'Neon cyberpunk alley',
      status: 'completed',
      result_url: 'https://cdn.test/image.png',
      thumbnail_url: null,
      provider: 'fal-ai',
      error: null,
      storage_key: 'media/fal/fal-12345678/image.png',
      mime: 'image/png',
      size: 4,
      created_at: 1700000000,
      completed_at: 1700000010,
    });

    const fakeBytes = new Uint8Array([137, 80, 78, 71]);
    vi.mocked(getVideoBucket).mockResolvedValue({
      bucket: {
        get: vi.fn().mockResolvedValue({
          body: fakeBytes,
          size: 4,
          httpMetadata: { contentType: 'image/png' },
        }),
      } as unknown as R2Bucket,
      publicBaseUrl: 'https://cdn.test',
    });

    const res = await GET(makeRequest('fal-12345678'), {
      params: Promise.resolve({ id: 'fal-12345678' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Content-Disposition')).toContain(
      'attachment; filename="neon-cyberpunk-alley-12345678.png"',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('proxies from result_url when R2 bucket is unavailable', async () => {
    vi.mocked(getUserImageJob).mockResolvedValue({
      id: 'job_cdn_99',
      user_id: 'user_1',
      model: 'fal-ai/flux-schnell',
      prompt: 'Golden retriever puppy',
      status: 'completed',
      result_url: 'https://fal.media/files/puppy.png',
      thumbnail_url: null,
      provider: 'fal-ai',
      error: null,
      storage_key: null,
      mime: 'image/png',
      created_at: 1700000000,
      completed_at: 1700000010,
    });

    fetchSpy.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': '3' },
      }),
    );

    const res = await GET(makeRequest('job_cdn_99'), {
      params: Promise.resolve({ id: 'job_cdn_99' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain(
      'attachment; filename="golden-retriever-puppy-b_cdn_99.png"',
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://fal.media/files/puppy.png',
      expect.any(Object),
    );
  });
});
