/**
 * Customer-BYOK cost-ownership tests for the MuAPI image branch.
 *
 * MuAPI image generation is customer-paid via BYOK only: the server resolves
 * `resolveUserApiKey(userId, 'muapi')` with NO platform environment fallback,
 * so `process.env.MUAPI_API_KEY` is never spent on image generation.
 *
 * These tests pin that boundary across all three entry points:
 * 1. POST /api/v1/creative-studio/images/generate
 * 2. generateImageAction (server action)
 * 3. executeImageGeneration (land orchestrator)
 *
 * - Without a customer BYOK `'muapi'` key (even if `process.env.MUAPI_API_KEY`
 *   is set), every entry point refuses with `NO_API_KEY` before `submitMediaJob`.
 * - With a customer BYOK `'muapi'` key, allowed models dispatch using the
 *   customer's key and record `cost_classification: 'UNMETERED'`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks (hoisted) ──────────────────────────────────────────────────────────

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn(),
}));

const { mockSubmitMediaJob, mockInsert } = vi.hoisted(() => ({
  mockSubmitMediaJob: vi.fn(),
  mockInsert: vi.fn(() => ({ error: null })),
}));

vi.mock('@/tree/clients/muapi-media-client', () => ({
  submitMediaJob: mockSubmitMediaJob,
  SUPPORTED_MODELS: { image: ['flux-schnell', 'flux-dev', 'hidream'] },
  isModelSupported: vi.fn(() => true),
  getJobStatus: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  })),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn((_userId: string, provider: string) =>
    Promise.resolve(provider === 'fal-ai' ? 'fal_test_key' : null),
  ),
}));

vi.mock('@/seed/ai/providers/fal-image-provider', () => ({
  FalImageProvider: class {
    generate = vi.fn(() =>
      Promise.resolve({
        assetRef: 'https://fal.ai/images/test.png',
        provider: 'fal-ai',
        costCents: 0,
        latencyMs: 800,
        metadata: { model: 'fal-ai/flux-schnell' },
      }),
    );
  },
}));

vi.mock('@/land/image/fal-image-r2-service', () => ({
  storeFalImageInR2: vi.fn(() =>
    Promise.resolve({
      permanentUrl: 'https://cdn.example.com/media/fal/job/image.png',
      storageKey: 'media/fal/job/image.png',
      bucket: 'VIDEO_BUCKET',
      sizeBytes: 1024,
      usedFallback: false,
    }),
  ),
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  deductCredits: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/tree/usage-metering', () => ({
  trackUsage: vi.fn(() => Promise.resolve({ success: true })),
  calculateCredits: vi.fn(() => 1),
  hashLicenseKey: vi.fn(() => 'hashed_nonce_abc'),
  resolveUserLicenseNonce: vi.fn(() => Promise.resolve('license_nonce_xyz')),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { POST } from '../route';
import { generateImageAction } from '@/app/actions/image-generate-action';
import { executeImageGeneration } from '@/land/image';

const NON_FAL_MODELS = ['flux-schnell', 'flux-dev', 'hidream'];

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/creative-studio/images/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('MuAPI image models require customer BYOK and never spend platform MUAPI_API_KEY', () => {
  const originalEnvKey = process.env.MUAPI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MUAPI_API_KEY = 'platform_operator_secret_key';
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    });
    vi.mocked(resolveUserTier).mockResolvedValue('ENTERPRISE');
    vi.mocked(resolveUserApiKey).mockImplementation((_userId, provider) =>
      Promise.resolve(provider === 'fal-ai' ? 'fal_test_key' : null),
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('[]', { status: 200 }),
    );
  });

  afterEach(() => {
    if (originalEnvKey === undefined) {
      delete process.env.MUAPI_API_KEY;
    } else {
      process.env.MUAPI_API_KEY = originalEnvKey;
    }
  });

  describe.each(NON_FAL_MODELS)('model %s without customer BYOK key', (model) => {
    it('is refused by the API route with 422 NO_API_KEY without touching platform MUAPI_API_KEY', async () => {
      const res = await POST(createRequest({ prompt: 'A sunset', model }));
      const body = (await res.json()) as { message: string; code: string };

      expect(res.status).toBe(422);
      expect(body.code).toBe('NO_API_KEY');
      expect(resolveUserApiKey).toHaveBeenCalledWith('user-1', 'muapi');
      expect(mockSubmitMediaJob).not.toHaveBeenCalled();
    });

    it('is refused by the server action with NO_API_KEY before provider dispatch', async () => {
      const result = await generateImageAction({ prompt: 'A sunset', model, aspectRatio: '1:1' });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.code).toBe('NO_API_KEY');
      expect(resolveUserApiKey).toHaveBeenCalledWith('user-1', 'muapi');
      expect(mockSubmitMediaJob).not.toHaveBeenCalled();
    });

    it('is refused by the land orchestrator with NO_API_KEY before provider dispatch', async () => {
      const result = await executeImageGeneration({
        userId: 'user-1',
        tier: 'ENTERPRISE',
        prompt: 'A sunset',
        model,
        aspectRatio: '1:1',
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.code).toBe('NO_API_KEY');
      expect(resolveUserApiKey).toHaveBeenCalledWith('user-1', 'muapi');
      expect(mockSubmitMediaJob).not.toHaveBeenCalled();
    });
  });

  it('dispatches with the customer BYOK key when the customer has configured one', async () => {
    vi.mocked(resolveUserTier).mockResolvedValue('BASIC');
    vi.mocked(resolveUserApiKey).mockImplementation((_userId, provider) =>
      Promise.resolve(provider === 'muapi' ? 'customer_byok_muapi_key' : 'fal_test_key'),
    );
    mockSubmitMediaJob.mockResolvedValueOnce({
      success: true,
      job: { id: 'muapi_job_42', status: 'pending', type: 'image', model: 'flux-schnell', createdAt: '2026-10-25' },
    });

    const res = await POST(createRequest({ prompt: 'A sunset', model: 'flux-schnell' }));
    const body = (await res.json()) as { jobId: string };

    expect(res.status).toBe(201);
    expect(body.jobId).toBe('muapi_job_42');
    expect(resolveUserApiKey).toHaveBeenCalledWith('user-1', 'muapi');
    expect(mockSubmitMediaJob).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'image', model: 'flux-schnell', prompt: 'A sunset' }),
      'customer_byok_muapi_key',
    );
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'muapi_job_42',
        provider: 'muapi',
        cost_classification: 'UNMETERED',
      }),
    );
  });

  it('rejects a MuAPI model outside the customer tier with TIER_GATE before resolving keys', async () => {
    vi.mocked(resolveUserTier).mockResolvedValue('BASIC');

    const res = await POST(createRequest({ prompt: 'A sunset', model: 'flux-dev' }));

    expect(res.status).toBe(403);
    expect(resolveUserApiKey).not.toHaveBeenCalled();
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  });

  it('still accepts a fal model so the fal contract is unchanged', async () => {
    vi.mocked(resolveUserTier).mockResolvedValue('PREMIUM');

    const res = await POST(createRequest({ prompt: 'A sunset', model: 'fal-ai/flux-schnell' }));
    const body = (await res.json()) as { jobId: string };

    expect(res.status).toBe(201);
    expect(body.jobId).toBeDefined();
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  });

  it('still gates a fal model the tier does not allow with 403', async () => {
    vi.mocked(resolveUserTier).mockResolvedValue('BASIC');

    const res = await POST(createRequest({ prompt: 'A sunset', model: 'fal-ai/flux/dev' }));

    expect(res.status).toBe(403);
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  });
});
