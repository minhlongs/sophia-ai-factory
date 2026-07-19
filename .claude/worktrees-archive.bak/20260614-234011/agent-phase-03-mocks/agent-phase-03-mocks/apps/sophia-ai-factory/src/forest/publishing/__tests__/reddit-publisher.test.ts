import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RedditPublisher } from '../reddit';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('RedditPublisher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.REDDIT_CLIENT_ID;
  });
  afterEach(() => { delete process.env.REDDIT_CLIENT_ID; });

  describe('mock mode', () => {
    it('returns mock_reddit_ id when REDDIT_CLIENT_ID absent', async () => {
      const p = new RedditPublisher('tok', 'testuser');
      const id = await p.upload('https://v.mp4', { caption: 'hi', hashtags: [] });
      expect(id).toMatch(/^mock_reddit_/);
    });
  });

  describe('real mode', () => {
    beforeEach(() => { process.env.REDDIT_CLIENT_ID = 'cid'; });

    it('submits link and returns post name', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ json: { errors: [], data: { name: 't3_abc123' } } }), { status: 200 }),
      );
      const p = new RedditPublisher('tok', 'testuser');
      const id = await p.upload('https://v.mp4', { caption: 'test', hashtags: [] });
      expect(id).toBe('t3_abc123');
      fetchSpy.mockRestore();
    });

    it('throws when submit returns errors', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ json: { errors: [['RATELIMIT', 'take a break']] } }), { status: 200 }),
      );
      const p = new RedditPublisher('tok', 'testuser');
      await expect(p.upload('https://v.mp4', { caption: 'x', hashtags: [] })).rejects.toThrow(/RATELIMIT/);
      fetchSpy.mockRestore();
    });

    it('getMetrics maps ups and num_comments', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { children: [{ data: { ups: 42, num_comments: 5 } }] } }), { status: 200 }),
      );
      const p = new RedditPublisher('tok', 'testuser');
      const m = await p.getMetrics('t3_abc123');
      expect(m.likes).toBe(42);
      expect(m.comments).toBe(5);
      fetchSpy.mockRestore();
    });
  });
});
