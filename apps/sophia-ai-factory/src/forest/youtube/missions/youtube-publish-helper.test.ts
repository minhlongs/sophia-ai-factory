import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  decryptToken: vi.fn(),
  refreshChannelToken: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/tree/crypto/token-crypto', () => ({ decryptToken: mocks.decryptToken }));
vi.mock('@/forest/publishing/oauth-token-refresher', () => ({ refreshChannelToken: mocks.refreshChannelToken }));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: { warn: mocks.warn, error: mocks.error } }));

import type { D1Client } from '@/seed/db/client';
import type { PublishingChannel } from '@/forest/publishing/publisher-interface';
import { resolveYoutubeAccessToken, sanitizeYoutubeError } from './youtube-publish-helper';

const query = {
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
};

function makeChannel(overrides: Partial<PublishingChannel> = {}): PublishingChannel {
  return {
    id: 'channel-1', tenant_id: 'tenant-1', user_id: 'user-1', provider: 'youtube',
    external_account_id: 'youtube-account-1', display_name: 'Demo channel',
    access_token: 'encrypted-access-token', refresh_token: 'encrypted-refresh-token',
    expires_at: null, status: 'active', refreshing_at: null, created_at: 1, updated_at: 1,
    ...overrides,
  };
}

function makeDb(refreshedToken: string | null = null): D1Client {
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.single.mockResolvedValue({ data: refreshedToken ? { access_token: refreshedToken } : null, error: null });
  return { from: vi.fn(() => query) } as unknown as D1Client;
}

describe('YouTube publish token helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.decryptToken.mockResolvedValue('decrypted-access-token');
    mocks.refreshChannelToken.mockResolvedValue(undefined);
  });

  it('decrypts a stored token that does not need refresh', async () => {
    const channel = makeChannel({ expires_at: null });
    const result = await resolveYoutubeAccessToken(makeDb(), channel);

    expect(result).toEqual({ ok: true, accessToken: 'decrypted-access-token' });
    expect(mocks.refreshChannelToken).not.toHaveBeenCalled();
    expect(mocks.decryptToken).toHaveBeenCalledWith('encrypted-access-token');
  });

  it('refreshes a token near expiry and decrypts the refreshed database value', async () => {
    const channel = makeChannel({ expires_at: 1 });
    const db = makeDb('encrypted-refreshed-token');

    const result = await resolveYoutubeAccessToken(db, channel);

    expect(mocks.refreshChannelToken).toHaveBeenCalledWith(channel);
    expect(query.select).toHaveBeenCalledWith('access_token');
    expect(query.eq).toHaveBeenCalledWith('id', 'channel-1');
    expect(channel.access_token).toBe('encrypted-refreshed-token');
    expect(mocks.decryptToken).toHaveBeenCalledWith('encrypted-refreshed-token');
    expect(result).toEqual({ ok: true, accessToken: 'decrypted-access-token' });
  });

  it('returns a reconnect hint when refresh fails and sanitizes logged provider errors', async () => {
    mocks.refreshChannelToken.mockRejectedValue(new Error('refresh failed for Bearer abc.def access_token=secret'));

    const result = await resolveYoutubeAccessToken(makeDb(), makeChannel({ expires_at: 1 }));

    expect(result).toEqual({
      ok: false,
      result: {
        ok: false,
        error: 'token_refresh_failed',
        data: { hint: 'Reconnect YouTube in Settings > Integrations' },
      },
    });
    expect(mocks.warn).toHaveBeenCalledWith('[youtube:publish] Token refresh failed', expect.objectContaining({
      channelId: 'channel-1',
      err: 'refresh failed for Bearer [REDACTED] access_token=[REDACTED]',
    }));
    expect(mocks.decryptToken).not.toHaveBeenCalled();
  });

  it('returns a disconnected result when no access token is stored', async () => {
    const result = await resolveYoutubeAccessToken(makeDb(), makeChannel({ access_token: null }));

    expect(result).toEqual({
      ok: false,
      result: {
        ok: false,
        error: 'channel_disconnected',
        data: { hint: 'Channel has no stored access_token; reconnect via Settings > Integrations' },
      },
    });
    expect(mocks.decryptToken).not.toHaveBeenCalled();
  });

  it('returns a structured failure when token decryption fails', async () => {
    mocks.decryptToken.mockRejectedValue(new Error('ciphertext invalid'));

    const result = await resolveYoutubeAccessToken(makeDb(), makeChannel());

    expect(result).toEqual({ ok: false, result: { ok: false, error: 'token_decrypt_failed' } });
    expect(mocks.error).toHaveBeenCalledWith(
      '[youtube:publish] Token decryption failed',
      expect.any(Error),
      { channelId: 'channel-1' },
    );
  });

  it('redacts bearer and OAuth tokens and limits sanitized error length', () => {
    expect(sanitizeYoutubeError('Bearer abc.123 access_token=secret&x=1 refresh_token=rotate'))
      .toBe('Bearer [REDACTED] access_token=[REDACTED]&x=1 refresh_token=[REDACTED]');
    expect(sanitizeYoutubeError('x'.repeat(600))).toHaveLength(500);
    expect(sanitizeYoutubeError({ reason: 'unknown' })).toBe('[object Object]');
  });
});
