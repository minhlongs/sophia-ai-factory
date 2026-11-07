/**
 * BYOK credential consumers — protected flow behaviour when the store fails.
 *
 * The property under test: when the credential store or decryption fails, a
 * video-generation consumer either fails closed for that provider or degrades
 * to a safe fallback, and never reports an unknown credential as "not
 * configured" — which would silently spend another provider on a key that was
 * never proven usable.
 *
 * Boundary: these are contract tests over the consumers' own handling. The
 * D1 binding is rejected or made to throw, standing in for any store outage.
 * A real D1 outage, a rotated master key, and a Cloudflare-side outage each
 * also need a live account to reproduce.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));
// Quota is not the property under test; keep the pool test focused on the
// credential-store failure.
vi.mock('@/tree/quota/video-quota', () => ({
  checkVideoQuota: vi.fn().mockResolvedValue({ allowed: true, limit: 100, used: 0 }),
}));
vi.mock('@cloudflare/d1', () => ({}));

import { buildProviderPool } from '@/forest/quota/provider-pool';
import { pollDidVideo } from '@/forest/inngest/functions/video-generate-visual-providers';
import { getHeyGenClient } from '@/land/heygen/client/byok-resolver';
import { generateNicheCampaignVoiceover } from '@/tree/video/render/niche-voiceover-generator';

const noSleep = async () => {};

beforeEach(() => {
  process.env.BYOK_ENABLED = '1';
});

afterEach(() => {
  delete process.env.BYOK_ENABLED;
  delete process.env.HEYGEN_API_KEY;
  vi.restoreAllMocks();
});

describe('provider pool survives a credential-store outage', () => {
  it('omits the unusable provider instead of rejecting', async () => {
    mockGetD1.mockRejectedValue(new Error('D1 unavailable'));

    await expect(
      buildProviderPool('u_owner', { taskType: 'visual', estimatedInputTokens: 10 }),
    ).resolves.toBeInstanceOf(Array);
  });
});

describe('D-ID visual provider fails closed on a credential-store outage', () => {
  it('reports no video rather than dispatching a provider request', async () => {
    mockGetD1.mockRejectedValue(new Error('D1 unavailable'));

    await expect(
      pollDidVideo('u_owner', 'a prompt', noSleep),
    ).resolves.toEqual({ videoUrl: null, provider: 'd-id' });
  });
});

describe('HeyGen client fails closed on a credential-store outage', () => {
  it('returns null instead of falling back to the platform key', async () => {
    process.env.HEYGEN_API_KEY = 'platform-should-not-be-used';
    mockGetD1.mockRejectedValue(new Error('D1 unavailable'));

    await expect(getHeyGenClient('u_owner')).resolves.toBeNull();
  });
});

describe('niche voiceover fails closed on a credential-store outage', () => {
  it('reports CREDENTIALS_MISSING instead of dispatching a synthesis request', async () => {
    mockGetD1.mockRejectedValue(new Error('D1 unavailable'));

    const result = await generateNicheCampaignVoiceover({
      planId: 'plan_1',
      userId: 'u_owner',
      tenantId: undefined,
      narrationText: 'narration',
      niche: 'finance',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('CREDENTIALS_MISSING');
    expect(result.providerRequestDispatched).toBe(false);
  });
});

describe('the semantic readers never throw on a credential-store outage', () => {
  it('keeps the compatibility readers non-throwing, so un-migrated callers do not crash', async () => {
    mockGetD1.mockRejectedValue(new Error('D1 unavailable'));

    const { getUserApiKey } = await import('@/tree/byok/user-api-key-store');
    const { resolveUserApiKey } = await import('@/tree/byok/resolve-user-api-key');

    await expect(getUserApiKey('u_owner', 'elevenlabs')).resolves.toBeNull();
    await expect(resolveUserApiKey('u_owner', 'elevenlabs', 'env-key')).resolves.toBe('env-key');
  });

  it('reports the failure status through the status-aware reader', async () => {
    mockGetD1.mockRejectedValue(new Error('D1 unavailable'));

    const { lookupUserApiKey } = await import('@/tree/byok/user-api-key-store');

    await expect(lookupUserApiKey('u_owner', 'elevenlabs')).resolves.toEqual({
      status: 'STORE_UNAVAILABLE',
    });
  });
});

describe('lookup status is what lets consumers tell a failure from an absent key', () => {
  it('reports STORE_UNAVAILABLE rather than NOT_CONFIGURED when D1 fails', async () => {
    mockGetD1.mockRejectedValue(new Error('D1 unavailable'));

    const { lookupUserApiKey } = await import('@/tree/byok/user-api-key-store');
    const result = await lookupUserApiKey('u_owner', 'elevenlabs');

    expect(result.status).toBe('STORE_UNAVAILABLE');
  });

  it('reports NOT_CONFIGURED when the row is simply absent', async () => {
    mockGetD1.mockResolvedValue({
      prepare: () => ({ bind: () => ({ first: async () => null }) }),
    });

    const { lookupUserApiKey } = await import('@/tree/byok/user-api-key-store');
    const result = await lookupUserApiKey('u_owner', 'elevenlabs');

    expect(result.status).toBe('NOT_CONFIGURED');
  });
});
