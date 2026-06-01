/**
 * Unit tests for registerPublishingChannel — validator guards,
 * idempotent re-register, successful new insertion, and token encryption.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockFirst, mockRun, mockBind, mockPrepare, mockGetD1Raw } = vi.hoisted(() => {
  const first = vi.fn();
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn(() => ({ first, run }));
  const prepare = vi.fn(() => ({ bind }));
  const getD1Raw = vi.fn().mockResolvedValue({ prepare });
  return { mockFirst: first, mockRun: run, mockBind: bind, mockPrepare: prepare, mockGetD1Raw: getD1Raw };
});

vi.mock('@/seed/db/client', () => ({
  getD1Raw: mockGetD1Raw,
}));

import {
  registerPublishingChannel,
  validateRegisterInput,
  RegisterChannelError,
} from '@/land/publish/register-publishing-channel';
import { decryptToken } from '@/forest/publishing/token-crypto';

describe('validateRegisterInput', () => {
  it('rejects unsupported provider', () => {
    expect(() =>
      validateRegisterInput({
        userId: 'u1',
        provider: 'unknown' as unknown as 'tiktok',
        externalAccountId: 'a1',
        accessToken: 't1',
      }),
    ).toThrow(RegisterChannelError);
  });
  it('rejects missing accessToken', () => {
    expect(() =>
      validateRegisterInput({
        userId: 'u1',
        provider: 'tiktok',
        externalAccountId: 'a1',
        accessToken: '',
      }),
    ).toThrow(/required/);
  });
  it('accepts all supported providers', () => {
    const providers = ['tiktok', 'instagram', 'facebook', 'twitter', 'pinterest', 'linkedin', 'threads'] as const;
    for (const p of providers) {
      expect(() =>
        validateRegisterInput({ userId: 'u1', provider: p, externalAccountId: 'a1', accessToken: 't' }),
      ).not.toThrow();
    }
  });
});

describe('registerPublishingChannel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // AES-256-GCM requires a 32-byte (64 hex-char) key for every register call.
    process.env.OAUTH_TOKEN_ENC_KEY = 'c'.repeat(64);
    mockGetD1Raw.mockResolvedValue({ prepare: mockPrepare });
    mockBind.mockImplementation(() => ({ first: mockFirst, run: mockRun }));
    mockPrepare.mockImplementation(() => ({ bind: mockBind }));
    mockRun.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    delete process.env.OAUTH_TOKEN_ENC_KEY;
  });

  it('inserts new channel when none exists', async () => {
    mockFirst.mockResolvedValueOnce(null); // lookup
    const out = await registerPublishingChannel({
      userId: 'u1',
      provider: 'tiktok',
      externalAccountId: 'tt_acct_42',
      accessToken: 'tok',
      displayName: '@me',
    });
    expect(out.alreadyExisted).toBe(false);
    expect(out.channelId).toMatch(/^[0-9a-f]{32}$/);
    expect(out.provider).toBe('tiktok');
  });

  it('returns existing channelId on re-register (idempotent)', async () => {
    mockFirst.mockResolvedValueOnce({ id: 'existing-id-1234' });
    const out = await registerPublishingChannel({
      userId: 'u1',
      provider: 'instagram',
      externalAccountId: 'ig_42',
      accessToken: 'new-tok',
    });
    expect(out.alreadyExisted).toBe(true);
    expect(out.channelId).toBe('existing-id-1234');
  });

  it('stores access_token as AES ciphertext (not plaintext) on INSERT', async () => {
    mockFirst.mockResolvedValueOnce(null); // no existing row
    let capturedAccessToken: string | undefined;
    mockBind.mockImplementation((...args: unknown[]) => {
      // args order per INSERT: ?1=id, ?2=userId, ?3=provider, ?4=extId, ?5=displayName, ?6=access_token ...
      capturedAccessToken = args[5] as string;
      return { first: mockFirst, run: mockRun };
    });

    await registerPublishingChannel({
      userId: 'u1',
      provider: 'youtube',
      externalAccountId: 'yt_42',
      accessToken: 'my-plaintext-token',
    });

    expect(capturedAccessToken).toBeDefined();
    // Must not equal plaintext
    expect(capturedAccessToken).not.toBe('my-plaintext-token');
    // Must be AES-GCM prefix
    expect(capturedAccessToken).toMatch(/^aes:/);
    // Round-trip: decrypt recovers plaintext
    const recovered = await decryptToken(capturedAccessToken!);
    expect(recovered).toBe('my-plaintext-token');
  });

  it('stores encrypted token on UPDATE (re-register path)', async () => {
    mockFirst.mockResolvedValueOnce({ id: 'existing-999' }); // existing row
    let capturedAccessToken: string | undefined;
    mockBind.mockImplementation((...args: unknown[]) => {
      // UPDATE bind: ?1=access_token, ?2=refresh_token, ...
      capturedAccessToken = args[0] as string;
      return { first: mockFirst, run: mockRun };
    });

    await registerPublishingChannel({
      userId: 'u1',
      provider: 'tiktok',
      externalAccountId: 'tt_42',
      accessToken: 'refresh-plain-token',
    });

    expect(capturedAccessToken).toMatch(/^aes:/);
    const recovered = await decryptToken(capturedAccessToken!);
    expect(recovered).toBe('refresh-plain-token');
  });
});
