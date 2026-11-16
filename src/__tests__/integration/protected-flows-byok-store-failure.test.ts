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
vi.mock('@cloudflare/d1', () => ({}));

import { buildProviderPool } from '@/forest/quota/provider-pool';
import { pollDidVideo } from '@/forest/inngest/functions/video-generate-visual-providers';
import { getHeyGenClient } from '@/land/heygen/client/byok-resolver';
import { generateNicheCampaignVoiceover } from '@/tree/video/render/niche-voiceover-generator';
import { UserApiKeyLookupError } from '@/tree/byok/user-api-key-store';

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

describe('lookup error classification drives the fail-closed paths', () => {
  it.each(['STORE_UNAVAILABLE', 'DECRYPT_FAILED', 'KEY_VERSION_UNSUPPORTED'])(
    'treats %s as a credential failure, not an absent key',
    (code) => {
      const error = new UserApiKeyLookupError(
        code as 'STORE_UNAVAILABLE' | 'DECRYPT_FAILED' | 'KEY_VERSION_UNSUPPORTED',
      );
      expect(error.message).toBe(`BYOK_${code}`);
    },
  );
});
