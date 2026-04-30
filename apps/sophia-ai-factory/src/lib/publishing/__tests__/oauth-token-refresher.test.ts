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
        eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
      }),
    }),
  };
  return {
    mockDb,
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    refreshTikTok: vi.fn().mockResolvedValue({ access_token: 'new_tiktok_tok', expires_in: 7200 }),
    refreshYouTube: vi.fn().mockResolvedValue({ access_token: 'new_youtube_tok', expires_in: 3600 }),
  };
});

vi.mock('@/lib/utils/logger-utility', () => ({
  logger: mocks.logger,
}));

vi.mock('../token-crypto', () => ({
  encryptToken: (t: string) => `enc:${t}`,
  decryptToken: (t: string) => (t.startsWith('enc:') ? t.slice(4) : t),
}));

vi.mock('@/lib/db/client', () => ({
  getD1Client: vi.fn().mockResolvedValue(mocks.mockDb),
}));

vi.mock('@/lib/tiktok/tiktok-token-manager', () => ({
  refreshAccessToken: mocks.refreshTikTok,
}));

vi.mock('@/lib/youtube/youtube-oauth-client', () => ({
  refreshAccessToken: mocks.refreshYouTube,
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
    access_token: 'enc:old_tok',
    refresh_token: 'enc:refresh_tok',
    expires_at: now + 3000,
    status: 'active',
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
        eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
      }),
    });
    // Re-bind after clearAllMocks
    mocks.refreshTikTok.mockResolvedValue({ access_token: 'new_tiktok_tok', expires_in: 7200 });
    mocks.refreshYouTube.mockResolvedValue({ access_token: 'new_youtube_tok', expires_in: 3600 });
  });

  describe('refreshChannelToken', () => {
    /** Build update chain with .or() for acquireRefreshLock compatibility */
    function makeUpdateChain(changes = 1) {
      const orMock = vi.fn().mockResolvedValue({ meta: { changes } });
      const eqInnerMock = vi.fn().mockReturnValue({ or: orMock });
      const eqOuterMock = vi.fn().mockReturnValue({ or: orMock, eq: eqInnerMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqOuterMock });
      return { updateMock };
    }

    it('calls TikTok refreshAccessToken for tiktok provider', async () => {
      const channel = makeChannel({ provider: 'tiktok', refresh_token: 'enc:ref_tok' });
      const { updateMock } = makeUpdateChain();
      mocks.mockDb.from.mockReturnValue({ update: updateMock });

      await refreshChannelToken(channel);
      expect(mocks.refreshTikTok).toHaveBeenCalledWith('ref_tok');
    });

    it('calls YouTube refreshAccessToken for youtube provider', async () => {
      const channel = makeChannel({ provider: 'youtube', refresh_token: 'enc:yt_ref' });
      const { updateMock } = makeUpdateChain();
      mocks.mockDb.from.mockReturnValue({ update: updateMock });

      await refreshChannelToken(channel);
      expect(mocks.refreshYouTube).toHaveBeenCalledWith('yt_ref');
    });

    it('throws for missing refresh_token on tiktok', async () => {
      const channel = makeChannel({ provider: 'tiktok', refresh_token: null });
      const { updateMock } = makeUpdateChain();
      mocks.mockDb.from.mockReturnValue({ update: updateMock });
      await expect(refreshChannelToken(channel)).rejects.toThrow('TikTok refresh token missing');
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
