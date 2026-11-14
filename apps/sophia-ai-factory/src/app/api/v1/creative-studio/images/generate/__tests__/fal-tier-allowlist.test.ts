/**
 * Tier-allowlist regression tests across every fal and route/action image gate
 * owned by issue #152:
 *  1. POST /api/v1/creative-studio/images/generate (fal branch + MuAPI branch)
 *  2. handleFalGeneration (direct route handler)
 *  3. generateImageAction (server action — fal branch + MuAPI branch)
 *  4. executeFalImageGeneration / executeImageGeneration (land fal spending path)
 *
 * (The land MuAPI spending path `submitMuApiImageJob` / `image-generation-orchestrator.ts`
 * is gated separately in PR #151 for #145 so the two Draft PRs remain merge-conflict-free.)
 *
 * Verifies that any unrecognised, non-string, or Object.prototype tier value
 * is refused with `TIER_GATE` BEFORE:
 *  - D1 client / duplicate-job lookup (`createServerClient`)
 *  - credential resolution (`resolveUserApiKey` — neither customer BYOK nor `process.env.FAL_KEY`)
 *  - provider dispatch (`FalImageProvider.generate` / `submitMediaJob`)
 *  - billing (`deductCredits` / `trackUsage`)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockCreateServerClient,
  mockResolveUserApiKey,
  mockFalGenerate,
  mockSubmitMediaJob,
  mockDeductCredits,
  mockTrackUsage,
} = vi.hoisted(() => ({
  mockCreateServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
  mockResolveUserApiKey: vi.fn(),
  mockFalGenerate: vi.fn(),
  mockSubmitMediaJob: vi.fn(),
  mockDeductCredits: vi.fn(() => Promise.resolve(true)),
  mockTrackUsage: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: mockCreateServerClient,
  getD1: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: mockResolveUserApiKey,
}));

vi.mock('@/seed/ai/providers/fal-image-provider', () => ({
  FalImageProvider: class {
    generate = mockFalGenerate;
  },
}));

vi.mock('@/tree/clients/muapi-media-client', () => ({
  submitMediaJob: mockSubmitMediaJob,
  SUPPORTED_MODELS: { image: ['flux-schnell', 'flux-dev', 'hidream'] },
  isModelSupported: vi.fn(() => true),
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
  deductCredits: mockDeductCredits,
}));

vi.mock('@/tree/usage-metering', () => ({
  trackUsage: mockTrackUsage,
  calculateCredits: vi.fn(() => 1),
  hashLicenseKey: vi.fn(() => 'hashed_nonce'),
  resolveUserLicenseNonce: vi.fn(() => Promise.resolve('nonce_1')),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('@/land/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/land/image')>();
  return { ...actual, executeImageGeneration: vi.fn(actual.executeImageGeneration) };
});

vi.mock('../fal-handler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fal-handler')>();
  return { ...actual, handleFalGeneration: vi.fn(actual.handleFalGeneration) };
});

vi.mock('@/land/image/image-generation-helpers', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/land/image/image-generation-helpers')
  >();
  return { ...actual, submitMuApiImageJob: vi.fn(actual.submitMuApiImageJob) };
});

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { POST } from '../route';
import { handleFalGeneration } from '../fal-handler';
import { generateImageAction } from '@/app/actions/image-generate-action';
import { executeImageGeneration } from '@/land/image';
import { executeFalImageGeneration } from '@/land/image/fal-image-generation-runner';
import { submitMuApiImageJob } from '@/land/image/image-generation-helpers';
import type { Tier } from '@/seed/types';

const REJECTED_TIERS: Array<[string, unknown, string]> = [
  ['an unrecognised plan name', 'ULTRAMAX', 'ULTRAMAX'],
  ['an empty string', '', ''],
  ['a lowercase plan name', 'basic', 'basic'],
  ['a whitespace-padded plan name', ' BASIC ', ' BASIC '],
  ['a trailing-newline plan name', 'BASIC\n', 'BASIC\n'],
  ['null', null, 'null'],
  ['undefined', undefined, 'undefined'],
  ['a numeric value', 1, '1'],
  ['a boolean value', true, 'true'],
  ['a BigInt value', 1n, '1'],
  ['a Symbol value', Symbol('BASIC'), 'Symbol(BASIC)'],
  ['a plain object', {}, 'object'],
  ['a single-element canonical-name array', ['MASTER'], 'object'],
  ['a canonical-name toString object', { toString: (): string => 'MASTER' }, 'object'],
  ['a null-prototype object', Object.create(null), 'object'],
  [
    'an object with a throwing toString',
    {
      toString(): string {
        throw new Error('hostile toString');
      },
    },
    'object',
  ],
  ['the inherited __proto__ key', '__proto__', '__proto__'],
  ['the inherited constructor key', 'constructor', 'constructor'],
  ['the inherited toString key', 'toString', 'toString'],
  ['the inherited valueOf key', 'valueOf', 'valueOf'],
  ['the inherited hasOwnProperty key', 'hasOwnProperty', 'hasOwnProperty'],
];

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/creative-studio/images/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Nothing downstream may run: no DB, credential lookup, provider call, or billing. */
function expectNoSideEffects(): void {
  expect(mockCreateServerClient).not.toHaveBeenCalled();
  expect(mockResolveUserApiKey).not.toHaveBeenCalled();
  expect(mockFalGenerate).not.toHaveBeenCalled();
  expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  expect(mockDeductCredits).not.toHaveBeenCalled();
  expect(mockTrackUsage).not.toHaveBeenCalled();
}

function expectNoRouteDelegation(): void {
  expectNoSideEffects();
  expect(vi.mocked(handleFalGeneration)).not.toHaveBeenCalled();
  expect(vi.mocked(submitMuApiImageJob)).not.toHaveBeenCalled();
}

function expectNoActionDelegation(): void {
  expectNoSideEffects();
  expect(vi.mocked(executeImageGeneration)).not.toHaveBeenCalled();
  expect(vi.mocked(submitMuApiImageJob)).not.toHaveBeenCalled();
}

describe('image generation tier allowlist gates (fal + route + server action + runner)', () => {
  const originalFalKey = process.env.FAL_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = 'platform_fal_secret_key';
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    });
    mockResolveUserApiKey.mockResolvedValue('fal_customer_or_platform_key');
    mockFalGenerate.mockResolvedValue({
      assetRef: 'https://fal.ai/images/test.png',
      provider: 'fal-ai',
      costCents: 0,
      latencyMs: 500,
      metadata: { model: 'fal-ai/flux-schnell' },
    });
    mockSubmitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'muapi_job_1', status: 'pending', type: 'image', model: 'flux-schnell' },
    });
  });

  afterEach(() => {
    if (originalFalKey === undefined) {
      delete process.env.FAL_KEY;
    } else {
      process.env.FAL_KEY = originalFalKey;
    }
  });

  describe('POST /api/v1/creative-studio/images/generate — fal BASIC model', () => {
    it.each(REJECTED_TIERS)(
      'refuses %s with 403 TIER_GATE before DB, key lookup, or fal dispatch',
      async (_label, tier, expectedLabel) => {
        vi.mocked(resolveUserTier).mockResolvedValue(tier as Tier);

        const res = await POST(
          createRequest({ prompt: 'A sunset', model: 'fal-ai/flux-schnell' }),
        );
        const body = (await res.json()) as { message: string; code?: string };

        expect(res.status).toBe(403);
        expect(body).toEqual({
          message: `Unknown plan "${expectedLabel}". Image generation requires a recognised plan.`,
          code: 'TIER_GATE',
        });
        expectNoRouteDelegation();
      },
    );
  });

  describe('POST /api/v1/creative-studio/images/generate — MuAPI BASIC model', () => {
    it.each(REJECTED_TIERS)(
      'refuses %s with 403 TIER_GATE before DB, key lookup, or MuAPI dispatch',
      async (_label, tier) => {
        vi.mocked(resolveUserTier).mockResolvedValue(tier as Tier);

        const res = await POST(createRequest({ prompt: 'A sunset', model: 'flux-schnell' }));
        const body = (await res.json()) as { message: string; code?: string };

        expect(res.status).toBe(403);
        expect(body.code).toBe('TIER_GATE');
        expectNoRouteDelegation();
      },
    );

    it('maps a downstream TIER_GATE result from submitMuApiImageJob to HTTP 403 instead of 500', async () => {
      vi.mocked(resolveUserTier).mockResolvedValue('BASIC');
      vi.mocked(submitMuApiImageJob).mockResolvedValueOnce({
        success: false,
        error: 'Downstream tier gate refusal',
        code: 'TIER_GATE',
      });

      const res = await POST(createRequest({ prompt: 'A sunset', model: 'flux-schnell' }));
      const body = (await res.json()) as { message: string; code?: string };

      expect(res.status).toBe(403);
      expect(body).toEqual({
        message: 'Downstream tier gate refusal',
        code: 'TIER_GATE',
      });
    });

    it('refuses a disallowed BASIC model with 403 TIER_GATE and truncates the echoed model', async () => {
      vi.mocked(resolveUserTier).mockResolvedValue('BASIC');

      const longModel = 'm'.repeat(200);
      const res = await POST(createRequest({ prompt: 'A sunset', model: longModel }));
      const body = (await res.json()) as { message: string; code?: string };

      expect(res.status).toBe(403);
      expect(body).toEqual({
        message: `Model "${longModel.slice(0, 128)}" is not available for your BASIC plan.`,
        code: 'TIER_GATE',
      });
      expectNoRouteDelegation();
    });
  });

  describe('handleFalGeneration (direct call)', () => {
    it.each(REJECTED_TIERS)(
      'refuses %s with 403 TIER_GATE even when invoked directly',
      async (_label, tier) => {
        const res = await handleFalGeneration(
          { id: 'user-1', email: 'test@example.com' },
          tier as string,
          'A sunset',
          'fal-ai/flux-schnell',
          '1:1',
        );
        const body = (await res.json()) as { message: string; code?: string };

        expect(res.status).toBe(403);
        expect(body.code).toBe('TIER_GATE');
        expectNoSideEffects();
      },
    );

    it('returns 403 with code TIER_GATE when a canonical BASIC tier requests a higher-tier fal model', async () => {
      const res = await handleFalGeneration(
        { id: 'user-1', email: 'test@example.com' },
        'BASIC',
        'A sunset',
        'fal-ai/flux-pro',
        '1:1',
      );
      const body = (await res.json()) as { message: string; code?: string };

      expect(res.status).toBe(403);
      expect(body.code).toBe('TIER_GATE');
      expectNoSideEffects();
    });

    it('refuses non-string and >128-character model values safely with 403 TIER_GATE', async () => {
      const nonStringRes = await handleFalGeneration(
        { id: 'user-1', email: 'test@example.com' },
        'BASIC',
        'A sunset',
        ['fal-ai/flux-schnell'] as unknown as string,
        '1:1',
      );
      const nonStringBody = (await nonStringRes.json()) as { message: string; code?: string };
      expect(nonStringRes.status).toBe(403);
      expect(nonStringBody).toEqual({
        message: 'Model "object" is not available for your BASIC plan.',
        code: 'TIER_GATE',
      });

      const longModel = `fal-ai/${'x'.repeat(200)}`;
      const longRes = await handleFalGeneration(
        { id: 'user-1', email: 'test@example.com' },
        'BASIC',
        'A sunset',
        longModel,
        '1:1',
      );
      const longBody = (await longRes.json()) as { message: string; code?: string };
      expect(longRes.status).toBe(403);
      expect(longBody).toEqual({
        message: `Model "${longModel.slice(0, 128)}" is not available for your BASIC plan.`,
        code: 'TIER_GATE',
      });
      expectNoSideEffects();
    });
  });

  describe('generateImageAction (server action)', () => {
    it.each(REJECTED_TIERS)(
      'refuses %s on fal BASIC model with TIER_GATE before orchestrator side effects',
      async (_label, tier) => {
        vi.mocked(resolveUserTier).mockResolvedValue(tier as Tier);

        const result = await generateImageAction({
          prompt: 'A sunset',
          model: 'fal-ai/flux-schnell',
          aspectRatio: '1:1',
        });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.code).toBe('TIER_GATE');
        expectNoActionDelegation();
      },
    );

    it.each(REJECTED_TIERS)(
      'refuses %s on MuAPI BASIC model with TIER_GATE before orchestrator side effects',
      async (_label, tier) => {
        vi.mocked(resolveUserTier).mockResolvedValue(tier as Tier);

        const result = await generateImageAction({
          prompt: 'A sunset',
          model: 'flux-schnell',
          aspectRatio: '1:1',
        });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.code).toBe('TIER_GATE');
        expectNoActionDelegation();
      },
    );

    it('refuses a disallowed >128-character model on both fal and MuAPI branches and truncates the echoed model', async () => {
      vi.mocked(resolveUserTier).mockResolvedValue('BASIC');

      const longFalModel = `fal-ai/${'f'.repeat(200)}`;
      const falResult = await generateImageAction({
        prompt: 'A sunset',
        model: longFalModel,
        aspectRatio: '1:1',
      });
      expect(falResult).toEqual({
        success: false,
        error: `Model "${longFalModel.slice(0, 128)}" is not available for your BASIC plan.`,
        code: 'TIER_GATE',
      });

      const longMuapiModel = 'u'.repeat(200);
      const muapiResult = await generateImageAction({
        prompt: 'A sunset',
        model: longMuapiModel,
        aspectRatio: '1:1',
      });
      expect(muapiResult).toEqual({
        success: false,
        error: `Model "${longMuapiModel.slice(0, 128)}" is not available for your BASIC plan.`,
        code: 'TIER_GATE',
      });
      expectNoActionDelegation();
    });
  });

  describe('executeFalImageGeneration and executeImageGeneration (land fal spending path)', () => {
    it.each(REJECTED_TIERS)(
      'refuses %s with TIER_GATE before DB, key lookup, or fal dispatch',
      async (_label, tier) => {
        const result = await executeImageGeneration({
          userId: 'user-1',
          tier: tier as string,
          prompt: 'A sunset',
          model: 'fal-ai/flux-schnell',
          aspectRatio: '1:1',
        });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.code).toBe('TIER_GATE');
        expectNoSideEffects();
      },
    );

    it('refuses a canonical BASIC tier requesting fal-ai/flux/dev when executeFalImageGeneration is called directly', async () => {
      const result = await executeFalImageGeneration({
        userId: 'user-1',
        tier: 'BASIC',
        prompt: 'A sunset',
        model: 'fal-ai/flux/dev',
        aspectRatio: '1:1',
      });

      expect(result).toEqual({
        success: false,
        error: 'Model "fal-ai/flux/dev" is not available for your BASIC plan.',
        code: 'TIER_GATE',
      });
      expectNoSideEffects();
    });

    it('refuses non-string and >128-character model values safely when executeFalImageGeneration is called directly', async () => {
      const nonStringResult = await executeFalImageGeneration({
        userId: 'user-1',
        tier: 'BASIC',
        prompt: 'A sunset',
        model: null as unknown as string,
        aspectRatio: '1:1',
      });
      expect(nonStringResult).toEqual({
        success: false,
        error: 'Model "object" is not available for your BASIC plan.',
        code: 'TIER_GATE',
      });

      const longModel = `fal-ai/${'z'.repeat(200)}`;
      const longResult = await executeFalImageGeneration({
        userId: 'user-1',
        tier: 'BASIC',
        prompt: 'A sunset',
        model: longModel,
        aspectRatio: '1:1',
      });
      expect(longResult).toEqual({
        success: false,
        error: `Model "${longModel.slice(0, 128)}" is not available for your BASIC plan.`,
        code: 'TIER_GATE',
      });
      expectNoSideEffects();
    });

    it.each(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const)(
      'still admits canonical %s tier on fal-ai/flux-schnell',
      async (tier) => {
        const result = await executeFalImageGeneration({
          userId: 'user-1',
          tier,
          prompt: 'A sunset',
          model: 'fal-ai/flux-schnell',
          aspectRatio: '1:1',
        });

        expect(result.success).toBe(true);
        expect(mockFalGenerate).toHaveBeenCalledTimes(1);
      },
    );
  });
});
