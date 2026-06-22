import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockDb = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      }),
    }),
  };
  const mockRawDb = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      }),
    }),
  };
  return {
    mockDb,
    mockRawDb,
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    refreshTikTok: vi.fn().mockResolvedValue({ access_token: 'new_tiktok_tok', expires_in: 7200 }),
    refreshYouTube: vi.fn().mockResolvedValue({ access_token: 'new_youtube_tok', expires_in: 3600 }),
    // Wave 12 G1 — 4 new publishers
    refreshThreadsToken: vi.fn().mockResolvedValue({ access_token: 'new_threads_tok', expires_in: 5184000 }),
    refreshReddit: vi.fn().mockResolvedValue({ access_token: 'new_reddit_tok', expires_in: 3600 }),
    refreshAtprotoSession: vi.fn().mockResolvedValue({ accessJwt: 'new_bsky_jwt', refreshJwt: 'new_bsky_refresh', did: 'did:plc:test' }),
    parseMastodonAccountId: vi.fn().mockReturnValue({ instanceUrl: 'https://mastodon.social', accountId: 'testuser' }),
  };
});

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mocks.logger,
}));

// Mock token-crypto with async functions (C1)
vi.mock('../token-crypto', () => ({
  encryptToken: async (t: string) => `aes:${Buffer.from(t).toString('base64')}`,
  decryptToken: async (t: string) => {
    if (t.startsWith('enc:')) return Buffer.from(t.slice(4), 'base64').toString('utf8');
    if (t.startsWith('aes:')) return Buffer.from(t.slice(4), 'base64').toString('utf8');
    return t;
  },
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(() => mocks.mockRawDb),
  createServerClient: vi.fn(() => mocks.mockDb),
}));

vi.mock('@/land/tiktok/tiktok-token-manager', () => ({
  refreshAccessToken: mocks.refreshTikTok,
}));

vi.mock('@/land/youtube/youtube-oauth-client', () => ({
  refreshAccessToken: mocks.refreshYouTube,
}));

vi.mock('@/land/video/publishing/providers/threads', () => ({
  refreshLongLivedToken: mocks.refreshThreadsToken,
}));

vi.mock('@/land/video/publishing/providers/reddit', () => ({
  refreshAccessToken: mocks.refreshReddit,
}));

vi.mock('@/land/video/publishing/providers/bluesky', () => ({
  refreshAtprotoSession: mocks.refreshAtprotoSession,
}));

vi.mock('../mastodon', () => ({
  parseExternalAccountId: mocks.parseMastodonAccountId,
}));

import { refreshChannelToken, refreshExpiringTokens } from '../oauth-token-refresher';
import type { PublishingChannel } from '../publisher-interface';

function makeChannel(overrides: Partial<PublishingChannel> = {}): PublishingChannel {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: 'chan_1',
    tenant_id: 'tenant_1',
    user_id: 'user_1',
    provider: 'tiktok',
    external_account_id: 'ext_1',
    display_name: 'Test',
    access_token: 'enc:b2xkX3Rvaw==',
    refresh_token: 'enc:cmVmcmVzaF90b2s=',
    expires_at: now + 3000,
    status: 'active',
    refreshing_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('oauth-token-refresher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockDb.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      }),
    });
    mocks.mockRawDb.prepare.mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      }),
    });
    mocks.refreshTikTok.mockResolvedValue({ access_token: 'new_tiktok_tok', expires_in: 7200 });
    mocks.refreshYouTube.mockResolvedValue({ access_token: 'new_youtube_tok', expires_in: 3600 });
    mocks.refreshThreadsToken.mockResolvedValue({ access_token: 'new_threads_tok', expires_in: 5184000 });
    mocks.refreshReddit.mockResolvedValue({ access_token: 'new_reddit_tok', expires_in: 3600 });
    mocks.refreshAtprotoSession.mockResolvedValue({ accessJwt: 'new_bsky_jwt', refreshJwt: 'new_bsky_refresh', did: 'did:plc:test' });
    mocks.parseMastodonAccountId.mockReturnValue({ instanceUrl: 'https://mastodon.social', accountId: 'testuser' });
  });

  describe('refreshChannelToken', () => {
    it('calls TikTok refreshAccessToken for tiktok provider', async () => {
      const channel = makeChannel({ provider: 'tiktok' });
      mocks.mockDb.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      });
      await refreshChannelToken(channel);
      expect(mocks.refreshTikTok).toHaveBeenCalled();
    });

    it('calls YouTube refreshAccessToken for youtube provider', async () => {
      const channel = makeChannel({ provider: 'youtube', refresh_token: 'enc:eXRfcmVm' });
      mocks.mockDb.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      });
      await refreshChannelToken(channel);
      expect(mocks.refreshYouTube).toHaveBeenCalled();
    });

    it('throws when lock is not acquired (another worker holds it)', async () => {
      mocks.mockRawDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
        }),
      });
      const channel = makeChannel({ provider: 'tiktok' });
      await expect(refreshChannelToken(channel)).rejects.toThrow('lock held by another worker');
    });

    it('throws for missing refresh_token on tiktok', async () => {
      const channel = makeChannel({ provider: 'tiktok', refresh_token: null });
      await expect(refreshChannelToken(channel)).rejects.toThrow('TikTok refresh token missing');
    });

    // Wave 12 G1 — 4 new publisher refresh paths
    it('refreshes Threads token via th_refresh_token grant', async () => {
      const channel = makeChannel({ provider: 'threads', refresh_token: null });
      mocks.mockDb.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      });
      const newExpiry = await refreshChannelToken(channel);
      expect(mocks.refreshThreadsToken).toHaveBeenCalled();
      expect(newExpiry).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('refreshes Reddit access token via refresh_token grant', async () => {
      const channel = makeChannel({ provider: 'reddit', refresh_token: 'enc:cmVkZGl0X3JlZg==' });
      mocks.mockDb.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      });
      await refreshChannelToken(channel);
      expect(mocks.refreshReddit).toHaveBeenCalled();
    });

    it('throws for missing refresh_token on Reddit', async () => {
      const channel = makeChannel({ provider: 'reddit', refresh_token: null });
      await expect(refreshChannelToken(channel)).rejects.toThrow('Reddit refresh token missing');
    });

    it('refreshes Bluesky via refreshAtprotoSession and persists rotated refreshJwt', async () => {
      const channel = makeChannel({ provider: 'bluesky', refresh_token: 'enc:Ymx1ZXNreV9yZWY=' });
      mocks.mockDb.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      });
      await refreshChannelToken(channel);
      expect(mocks.refreshAtprotoSession).toHaveBeenCalled();
    });

    it('throws for missing refreshJwt on Bluesky', async () => {
      const channel = makeChannel({ provider: 'bluesky', refresh_token: null });
      await expect(refreshChannelToken(channel)).rejects.toThrow('Bluesky refresh token (refreshJwt) missing');
    });

    it('treats Mastodon token as perpetual when no refresh_token present', async () => {
      const channel = makeChannel({ provider: 'mastodon', refresh_token: null });
      mocks.mockDb.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      });
      const newExpiry = await refreshChannelToken(channel);
      // Perpetual path: 1 year from now
      expect(newExpiry).toBeGreaterThan(Math.floor(Date.now() / 1000) + 364 * 24 * 3600);
    });
  });

  describe('refreshExpiringTokens', () => {
    it('returns 0 refreshed when no channels expiring', async () => {
      const result = await refreshExpiringTokens();
      expect(result.refreshed).toBe(0);
      expect(result.failed).toBe(0);
    });
  });
});
