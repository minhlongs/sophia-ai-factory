/**
 * Integration tests for fal-ai provider route wiring.
 *
 * Validates:
 * 1. fal-ai/flux-schnell dispatch returns 201 with jobId
 * 2. Tier gating blocks BASIC tier from fal-ai/flux/dev
 * 3. MuAPI models still work (non-breaking)
 * 4. 401 from fal.ai → 502 response
 * 5. 400 invalid body → 400 response
 * 6. 502 from fal.ai → 502 response
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

// Mock tier resolution
vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn(),
}));

// Mock BYOK resolver
vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn(),
}));

// Mock D1 client
vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
    })),
  })),
}));

// Mock MuAPI client
vi.mock('@/tree/clients/muapi-media-client', () => ({
  submitMediaJob: vi.fn(),
  SUPPORTED_MODELS: { image: ['flux-schnell', 'flux-dev', 'hidream'] },
}));

// Mock logger
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { POST } from '../route';

const VALID_FAL_RESPONSE = {
  images: [{ url: 'https://fal.ai/images/test.png', width: 1024, height: 768, content_type: 'image/png' }],
  timings: { inference: 0.5 },
  seed: 123,
};

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/creative-studio/images/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fal-ai route integration', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-123', email: 'test@example.com' });
  });

  afterEach(() => {
    fetchMock.mockRestore();
    vi.clearAllMocks();
  });

  it('dispatches fal-ai/flux-schnell and returns 201 with jobId', async () => {
    vi.mocked(resolveUserTier).mockResolvedValue('PREMIUM');
    vi.mocked(resolveUserApiKey).mockResolvedValue('fal_test_key');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_FAL_RESPONSE), { status: 200 }),
    );

    const res = await POST(createRequest({ prompt: 'A sunset', model: 'fal-ai/flux-schnell' }));
    const body = (await res.json()) as { jobId: string };

    expect(res.status).toBe(201);
    expect(body.jobId).toBeDefined();
    expect(body.jobId).toMatch(/^fal-/);
  });

  it('blocks BASIC tier from fal-ai/flux/dev (tier gating)', async () => {
    vi.mocked(resolveUserTier).mockResolvedValue('BASIC');

    const res = await POST(createRequest({ prompt: 'A sunset', model: 'fal-ai/flux/dev' }));
    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(403);
    expect(body.message).toContain('not available');
  });

  it('allows ENTERPRISE tier to use fal-ai/flux/dev', async () => {
    vi.mocked(resolveUserTier).mockResolvedValue('ENTERPRISE');
    vi.mocked(resolveUserApiKey).mockResolvedValue('fal_test_key');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_FAL_RESPONSE), { status: 200 }),
    );

    const res = await POST(createRequest({ prompt: 'A sunset', model: 'fal-ai/flux/dev' }));
    expect(res.status).toBe(201);
  });

  it('returns 502 when fal.ai returns 401', async () => {
    vi.mocked(resolveUserTier).mockResolvedValue('PREMIUM');
    vi.mocked(resolveUserApiKey).mockResolvedValue('bad_key');
    fetchMock.mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    const res = await POST(createRequest({ prompt: 'A sunset', model: 'fal-ai/flux-schnell' }));
    expect(res.status).toBe(502);
  });

  it('returns 502 when fal.ai returns 500', async () => {
    vi.mocked(resolveUserTier).mockResolvedValue('PREMIUM');
    vi.mocked(resolveUserApiKey).mockResolvedValue('fal_test_key');
    fetchMock.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    );

    const res = await POST(createRequest({ prompt: 'A sunset', model: 'fal-ai/flux-schnell' }));
    expect(res.status).toBe(502);
  });

  it('returns 400 for invalid body (empty prompt)', async () => {
    const res = await POST(createRequest({ prompt: '', model: 'fal-ai/flux-schnell' }));
    expect(res.status).toBe(400);
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await POST(createRequest({ prompt: 'A sunset', model: 'fal-ai/flux-schnell' }));
    expect(res.status).toBe(401);
  });

  it('MuAPI models still work (non-breaking)', async () => {
    vi.mocked(resolveUserTier).mockResolvedValue('PREMIUM');
    const { submitMediaJob } = await import('@/tree/clients/muapi-media-client');
    vi.mocked(submitMediaJob).mockResolvedValue({
      success: true,
      job: {
        id: 'muapi-job-123',
        status: 'pending',
        type: 'image',
        model: 'flux-schnell',
        createdAt: new Date().toISOString(),
      },
    });

    const res = await POST(createRequest({ prompt: 'A sunset', model: 'flux-schnell' }));
    const body = (await res.json()) as { jobId: string };

    expect(res.status).toBe(201);
    expect(body.jobId).toBe('muapi-job-123');
  });
});
