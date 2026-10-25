/**
 * Door-closed tests for the non-fal image branch.
 *
 * The MuAPI branch spends the platform's MUAPI_API_KEY while recording no
 * provider cost and deducting no credits, so no caller may reach it. These tests
 * pin that boundary at each of the three entry points:
 *
 * 1. POST /api/v1/creative-studio/images/generate
 * 2. generateImageAction (server action)
 * 3. executeImageGeneration (land orchestrator)
 *
 * Each rejection must happen before any provider dispatch, which is asserted
 * by requiring submitMediaJob to have never been called. The same model
 * reaching the fal branch is asserted to still succeed, so the rejection is
 * about the provider and not about the tier or the request shape.
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
  SUPPORTED_MODELS: { image: ['flux-schnell', 'flux-dev', 'hidream'] },
  isModelSupported: vi.fn(() => true),
  getJobStatus: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
    })),
  })),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn(() => Promise.resolve('fal_test_key')),
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

describe('non-fal image models are rejected before any provider dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    });
    vi.mocked(resolveUserTier).mockResolvedValue('BASIC');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('[]', { status: 200 }),
    );
  });

  describe.each(NON_FAL_MODELS)('model %s', (model) => {
    it('is rejected by the API route without dispatching to MuAPI', async () => {
      const res = await POST(createRequest({ prompt: 'A sunset', model }));
      const body = (await res.json()) as { message: string };

      expect(res.status).toBe(403);
      expect(body.message).toContain(model);
      expect(mockSubmitMediaJob).not.toHaveBeenCalled();
    });

    it('is rejected by the server action with a typed code and a naming message', async () => {
      const result = await generateImageAction({ prompt: 'A sunset', model, aspectRatio: '1:1' });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.code).toBe('TIER_GATE');
      expect(result.error).toContain(model);
      expect(mockSubmitMediaJob).not.toHaveBeenCalled();
    });

    it('is rejected by the land orchestrator before provider dispatch', async () => {
      const result = await executeImageGeneration({
        userId: 'user-1',
        tier: 'BASIC',
        prompt: 'A sunset',
        model,
        aspectRatio: '1:1',
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.code).toBe('TIER_GATE');
      expect(result.error).toContain(model);
      expect(mockSubmitMediaJob).not.toHaveBeenCalled();
    });
  });

  it('rejects a non-fal model even when the tier list would have allowed it', async () => {
    // flux-schnell is listed in TIER_ALLOWED_MODELS for every tier, so the tier
    // gate used to pass; the provider gate is what must now refuse it.
    vi.mocked(resolveUserTier).mockResolvedValue('ENTERPRISE');

    const res = await POST(createRequest({ prompt: 'A sunset', model: 'flux-schnell' }));

    expect(res.status).toBe(403);
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

  it('still gates a fal model the tier does not allow with the same TIER_GATE code', async () => {
    vi.mocked(resolveUserTier).mockResolvedValue('BASIC');

    const res = await POST(createRequest({ prompt: 'A sunset', model: 'fal-ai/flux/dev' }));

    expect(res.status).toBe(403);
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  });
});
