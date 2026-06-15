import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MastodonPublisher, parseExternalAccountId } from '../mastodon';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('parseExternalAccountId', () => {
  it('splits instanceUrl and accountId on last |', () => {
    const { instanceUrl, accountId } = parseExternalAccountId('https://mastodon.social|12345');
    expect(instanceUrl).toBe('https://mastodon.social');
    expect(accountId).toBe('12345');
  });
  it('handles no separator with fallback', () => {
    const { accountId } = parseExternalAccountId('12345');
    expect(accountId).toBe('12345');
  });
});

describe('MastodonPublisher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.MASTODON_INSTANCE_URL;
  });
  afterEach(() => { delete process.env.MASTODON_INSTANCE_URL; });

  describe('mock mode', () => {
    it('returns mock_mastodon_ id when MASTODON_INSTANCE_URL absent', async () => {
      const p = new MastodonPublisher('tok', 'https://mastodon.social|u1');
      const id = await p.upload('https://v.mp4', { caption: 'hi', hashtags: [] });
      expect(id).toMatch(/^mock_mastodon_/);
    });
  });

  describe('real mode', () => {
    beforeEach(() => { process.env.MASTODON_INSTANCE_URL = 'https://mastodon.social'; });

    it('posts status and returns id', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'status_99', uri: 'https://mastodon.social/@user/99' }), { status: 200 }),
      );
      const p = new MastodonPublisher('tok', 'https://mastodon.social|user1');
      const id = await p.upload('https://v.mp4', { caption: 'test', hashtags: ['#ai'] });
      expect(id).toBe('status_99');
      fetchSpy.mockRestore();
    });

    it('throws when /api/v1/statuses fails', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));
      const p = new MastodonPublisher('tok', 'https://mastodon.social|user1');
      await expect(p.upload('https://v.mp4', { caption: 'x', hashtags: [] })).rejects.toThrow(/statuses failed/);
      fetchSpy.mockRestore();
    });

    it('getMetrics maps favourites, replies, reblogs', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 's1', favourites_count: 10, replies_count: 3, reblogs_count: 5 }), { status: 200 }),
      );
      const p = new MastodonPublisher('tok', 'https://mastodon.social|u1');
      const m = await p.getMetrics('s1');
      expect(m.likes).toBe(10);
      expect(m.comments).toBe(3);
      expect(m.shares).toBe(5);
      fetchSpy.mockRestore();
    });
  });
});
