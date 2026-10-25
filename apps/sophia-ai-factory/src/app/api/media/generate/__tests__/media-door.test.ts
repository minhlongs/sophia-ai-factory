/**
 * Door-closed tests for the /api/media/generate image branch.
 *
 * This route authenticates a session, gates on tier, then dispatches against
 * the platform's own MUAPI_API_KEY. Unlike the fal image path it records no
 * provider cost and deducts no credits, so an image request reaching
 * submitMediaJob spends operator money with no metering and no media_jobs row.
 *
 * Image must therefore be refused, while video and audio — which have no
 * metered replacement provider — must keep working exactly as before. The
 * video/audio cases are not incidental: without them the image refusal could
 * pass by blocking everything.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks (hoisted) ──────────────────────────────────────────────────────────

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn(),
}));

const { mockSubmitMediaJob } = vi.hoisted(() => ({ mockSubmitMediaJob: vi.fn() }));
vi.mock('@/tree/clients/muapi-media-client', () => ({
  submitMediaJob: mockSubmitMediaJob,
  SUPPORTED_MODELS: {
    image: ['flux-schnell', 'flux-dev', 'midjourney'],
    video: ['kling-3.0', 'seedance-2.0', 'veo3'],
    audio: ['suno-v4', 'mmaudio'],
  },
  isModelSupported: (type: string, model: string) => {
    const catalog: Record<string, string[]> = {
      image: ['flux-schnell', 'flux-dev', 'midjourney'],
      video: ['kling-3.0', 'seedance-2.0', 'veo3'],
      audio: ['suno-v4', 'mmaudio'],
    };
    return catalog[type]?.includes(model) ?? false;
  },
}));

import type { User } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { POST, GET } from '../route';

const TEST_USER: User = {
  id: 'user-1',
  email: 'test@example.com',
} as User;

const IMAGE_MODELS = ['flux-schnell', 'flux-dev', 'midjourney'];

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/media/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/media/generate refuses image generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The key is present so the only thing standing between a request and the
    // provider is the refusal under test — not a missing-credential 503.
    vi.stubEnv('MUAPI_API_KEY', 'muapi_test_key');
    vi.mocked(getCurrentUser).mockResolvedValue(TEST_USER);
    vi.mocked(resolveUserTier).mockResolvedValue('PREMIUM');
    mockSubmitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job-1', status: 'pending', type: 'image', model: 'flux-schnell' },
    });
  });

  describe.each(IMAGE_MODELS)('image model %s', (model) => {
    it('is refused for a PREMIUM session without dispatching to the provider', async () => {
      const res = await POST(createRequest({ type: 'image', model, prompt: 'A sunset' }));
      const body = (await res.json()) as { error: string };

      expect(res.status).toBe(403);
      expect(body.error).toContain(model);
      expect(mockSubmitMediaJob).not.toHaveBeenCalled();
    });

    it('is refused for the highest tier too, so the refusal is not a tier gate', async () => {
      vi.mocked(resolveUserTier).mockResolvedValue('MASTER');

      const res = await POST(createRequest({ type: 'image', model, prompt: 'A sunset' }));

      expect(res.status).toBe(403);
      expect(mockSubmitMediaJob).not.toHaveBeenCalled();
    });
  });

  it('still refuses an image request that is not even in the catalog', async () => {
    const res = await POST(
      createRequest({ type: 'image', model: 'not-a-real-model', prompt: 'A sunset' }),
    );

    expect(res.status).toBe(403);
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  });

  it('requires authentication before the image refusal, so an anonymous caller cannot probe the catalog', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await POST(createRequest({ type: 'image', model: 'flux-schnell', prompt: 'A sunset' }));

    expect(res.status).toBe(401);
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  });

  it('still refuses a BASIC tier before anything else', async () => {
    vi.mocked(resolveUserTier).mockResolvedValue('BASIC');

    const res = await POST(createRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave' }));

    expect(res.status).toBe(403);
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  });
});

describe('POST /api/media/generate keeps video and audio working', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MUAPI_API_KEY', 'muapi_test_key');
    vi.mocked(getCurrentUser).mockResolvedValue(TEST_USER);
    vi.mocked(resolveUserTier).mockResolvedValue('PREMIUM');
    mockSubmitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job-1', status: 'pending', type: 'video', model: 'kling-3.0' },
    });
  });

  it('dispatches a supported video model', async () => {
    const res = await POST(
      createRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave', duration: 5 }),
    );
    const body = (await res.json()) as { jobId: string };

    expect(res.status).toBe(200);
    expect(body.jobId).toBe('job-1');
    expect(mockSubmitMediaJob).toHaveBeenCalledTimes(1);
  });

  it('dispatches a supported audio model', async () => {
    mockSubmitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job-2', status: 'pending', type: 'audio', model: 'suno-v4' },
    });

    const res = await POST(createRequest({ type: 'audio', model: 'suno-v4', prompt: 'A calm song' }));

    expect(res.status).toBe(200);
    expect(mockSubmitMediaJob).toHaveBeenCalledTimes(1);
  });

  it('still rejects a model the provider does not carry', async () => {
    const res = await POST(
      createRequest({ type: 'video', model: 'kling-99-ultra', prompt: 'A wave' }),
    );

    expect(res.status).toBe(400);
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  });
});

describe('GET /api/media/generate no longer advertises image models', () => {
  it('lists video and audio models only', async () => {
    const res = await GET();
    const body = (await res.json()) as { models: Record<string, unknown>; image: string };

    expect(body.models.image).toBeUndefined();
    expect(body.models.video).toContain('kling-3.0');
    expect(body.models.audio).toContain('suno-v4');
    expect(body.image).toContain('/api/v1/creative-studio/images/generate');
  });
});
