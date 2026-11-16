/**
 * Door-closed, canonical tier allowlist, and customer-BYOK tests for /api/media/generate.
 *
 * Pins three security and billing invariants on POST /api/media/generate:
 * 1. Canonical paid-tier allowlist (`PREMIUM` / `ENTERPRISE` / `MASTER` as own
 *    properties on `TIER_RANK`), refusing `BASIC` and any non-canonical /
 *    prototype-key tier value with 403 `TIER_GATE`.
 * 2. Image generation stays refused with 403.
 * 3. Video and audio dispatch ONLY with the caller's stored `'muapi'` BYOK key
 *    (`{ fund: 'byok', apiKey }`), never spending `process.env.MUAPI_API_KEY`,
 *    and fail closed with 500 `DB_ERROR` if D1 cannot persist `media_jobs`.
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

const { mockSubmitMediaJob, mockResolveUserApiKey, mockGetD1, mockRun } = vi.hoisted(() => ({
  mockSubmitMediaJob: vi.fn(),
  mockResolveUserApiKey: vi.fn(),
  mockGetD1: vi.fn(),
  mockRun: vi.fn(),
}));

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: mockResolveUserApiKey,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mockGetD1,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

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

const ADVERSARIAL_NON_PAID_TIERS: Array<[string, unknown]> = [
  ['BASIC', 'BASIC'],
  ['undefined', undefined],
  ['null', null],
  ['empty string', ''],
  ['whitespace', '   '],
  ['lowercase premium', 'premium'],
  ['lowercase basic', 'basic'],
  ['unlisted FREE', 'FREE'],
  ['unlisted PRO', 'PRO'],
  ['unlisted STARTER', 'STARTER'],
  ['unlisted ADMIN', 'ADMIN'],
  ['trailing newline PREMIUM\\n', 'PREMIUM\n'],
  ['__proto__', '__proto__'],
  ['constructor', 'constructor'],
  ['toString', 'toString'],
  ['valueOf', 'valueOf'],
  ['hasOwnProperty', 'hasOwnProperty'],
  ['number 2', 2],
  ['boolean true', true],
  ['array ["PREMIUM"]', ['PREMIUM']],
  ['object with throwing toString', { toString: () => { throw new Error('boom'); } }],
];

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/media/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubHealthyD1() {
  mockRun.mockResolvedValue({ success: true });
  mockGetD1.mockResolvedValue({
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        run: mockRun,
      })),
    })),
  });
}

describe('POST /api/media/generate refuses image generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MUAPI_API_KEY', 'operator_platform_secret_key');
    vi.mocked(getCurrentUser).mockResolvedValue(TEST_USER);
    vi.mocked(resolveUserTier).mockResolvedValue('PREMIUM');
    mockResolveUserApiKey.mockResolvedValue('customer_byok_muapi_key');
    stubHealthyD1();
    mockSubmitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job-1', status: 'pending', type: 'image', model: 'flux-schnell' },
    });
  });

  describe.each(IMAGE_MODELS)('image model %s', (model) => {
    it('is refused for a PREMIUM session without resolving BYOK or dispatching to provider', async () => {
      const res = await POST(createRequest({ type: 'image', model, prompt: 'A sunset' }));
      const body = (await res.json()) as { error: string };

      expect(res.status).toBe(403);
      expect(body.error).toContain(model);
      expect(mockResolveUserApiKey).not.toHaveBeenCalled();
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

  it.each(ADVERSARIAL_NON_PAID_TIERS)(
    'refuses non-paid or non-canonical tier (%s) with 403 TIER_GATE before reading BYOK or provider',
    async (_label, tierValue) => {
      vi.mocked(resolveUserTier).mockResolvedValue(tierValue as never);

      const res = await POST(createRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave' }));
      const body = (await res.json()) as { error: string; code: string };

      expect(res.status).toBe(403);
      expect(body.code).toBe('TIER_GATE');
      expect(mockResolveUserApiKey).not.toHaveBeenCalled();
      expect(mockSubmitMediaJob).not.toHaveBeenCalled();
    },
  );
});

describe('POST /api/media/generate enforces customer BYOK and D1 persistence for video and audio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MUAPI_API_KEY', 'operator_platform_secret_key');
    vi.mocked(getCurrentUser).mockResolvedValue(TEST_USER);
    vi.mocked(resolveUserTier).mockResolvedValue('PREMIUM');
    mockResolveUserApiKey.mockResolvedValue('customer_byok_muapi_key');
    stubHealthyD1();
    mockSubmitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job-1', status: 'pending', type: 'video', model: 'kling-3.0' },
    });
  });

  it('refuses with 422 NO_API_KEY when customer has no stored muapi BYOK key, even when MUAPI_API_KEY is set', async () => {
    mockResolveUserApiKey.mockResolvedValue(null);

    const res = await POST(
      createRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave', duration: 5 }),
    );
    const body = (await res.json()) as { error: string; code: string };

    expect(res.status).toBe(422);
    expect(body.code).toBe('NO_API_KEY');
    expect(mockResolveUserApiKey).toHaveBeenCalledWith('user-1', 'muapi');
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  });

  it('refuses with 422 NO_API_KEY when customer muapi BYOK key is whitespace-only', async () => {
    mockResolveUserApiKey.mockResolvedValue('   ');

    const res = await POST(
      createRequest({ type: 'audio', model: 'suno-v4', prompt: 'A calm song' }),
    );
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(422);
    expect(body.code).toBe('NO_API_KEY');
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  });

  it('fails closed with 500 DB_ERROR before spending customer BYOK when D1 is unavailable', async () => {
    mockGetD1.mockResolvedValue(null);

    const res = await POST(
      createRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave' }),
    );
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(500);
    expect(body.code).toBe('DB_ERROR');
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  });

  it('fails closed with 500 DB_ERROR when media_jobs insert throws', async () => {
    mockRun.mockRejectedValueOnce(new Error('D1 write error'));

    const res = await POST(
      createRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave' }),
    );
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(500);
    expect(body.code).toBe('DB_ERROR');
  });

  it('dispatches a supported video model with { fund: "byok", apiKey } across all canonical paid tiers', async () => {
    for (const paidTier of ['PREMIUM', 'ENTERPRISE', 'MASTER'] as const) {
      vi.mocked(resolveUserTier).mockResolvedValueOnce(paidTier);

      const res = await POST(
        createRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave', duration: 5 }),
      );
      const body = (await res.json()) as { jobId: string };

      expect(res.status).toBe(200);
      expect(body.jobId).toBe('job-1');
    }

    expect(mockSubmitMediaJob).toHaveBeenCalledTimes(3);
    expect(mockSubmitMediaJob).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'video', model: 'kling-3.0', prompt: 'A wave', duration: 5 }),
      { fund: 'byok', apiKey: 'customer_byok_muapi_key' },
    );
  });

  it('dispatches a supported audio model with { fund: "byok", apiKey }', async () => {
    mockSubmitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job-2', status: 'pending', type: 'audio', model: 'suno-v4' },
    });

    const res = await POST(createRequest({ type: 'audio', model: 'suno-v4', prompt: 'A calm song' }));

    expect(res.status).toBe(200);
    expect(mockSubmitMediaJob).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'audio', model: 'suno-v4', prompt: 'A calm song' }),
      { fund: 'byok', apiKey: 'customer_byok_muapi_key' },
    );
  });

  it('still rejects a model the provider does not carry', async () => {
    const res = await POST(
      createRequest({ type: 'video', model: 'kling-99-ultra', prompt: 'A wave' }),
    );

    expect(res.status).toBe(400);
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  });

  it('returns 400 Invalid JSON body on malformed JSON instead of leaking a 500 SyntaxError', async () => {
    const badReq = new NextRequest('http://localhost/api/media/generate', {
      method: 'POST',
      body: '{not-json',
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(badReq);
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON body');
    expect(mockSubmitMediaJob).not.toHaveBeenCalled();
  });

  it('retries transient SQLITE_BUSY on media_jobs insert and succeeds without losing customer BYOK job', async () => {
    mockRun
      .mockRejectedValueOnce(new Error('SQLITE_BUSY: database is locked'))
      .mockResolvedValueOnce({ success: true });

    const res = await POST(
      createRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave' }),
    );
    const body = (await res.json()) as { jobId: string };

    expect(res.status).toBe(200);
    expect(body.jobId).toBe('job-1');
    expect(mockRun).toHaveBeenCalledTimes(2);
  });

  it('rejects non-HTTPS imageUrl in request validation with 400', async () => {
    const res = await POST(
      createRequest({
        type: 'video',
        model: 'kling-3.0',
        prompt: 'A wave',
        imageUrl: 'http://insecure.example.com/ref.png',
      }),
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
