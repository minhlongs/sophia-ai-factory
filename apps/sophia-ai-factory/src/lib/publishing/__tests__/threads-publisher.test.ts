import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThreadsPublisher } from '../threads';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('ThreadsPublisher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.THREADS_APP_ID;
  });
  afterEach(() => { delete process.env.THREADS_APP_ID; });

  describe('mock mode', () => {
    it('returns mock_threads_ id when THREADS_APP_ID absent', async () => {
      const p = new ThreadsPublisher('tok', 'u123');
      const id = await p.upload('https://v.mp4', { caption: 'hi', hashtags: [] });
      expect(id).toMatch(/^mock_threads_/);
    });
    it('pollStatus returns live for mock id', async () => {
      const p = new ThreadsPublisher('tok', 'u123');
      expect(await p.pollStatus('mock_threads_1')).toBe('live');
    });
    it('getMetrics returns zeros for mock id', async () => {
      const p = new ThreadsPublisher('tok', 'u123');
      const m = await p.getMetrics('mock_threads_1');
      expect(m.views).toBe(0);
    });
  });

  describe('real mode', () => {
    beforeEach(() => { process.env.THREADS_APP_ID = 'app_id'; });

    it('creates container then publishes and returns post id', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'container_1' }), { status: 200 }),
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'post_42' }), { status: 200 }),
      );
      const p = new ThreadsPublisher('tok', 'u123');
      const id = await p.upload('https://v.mp4', { caption: 'test', hashtags: ['#ai'] });
      expect(id).toBe('post_42');
      expect(fetchSpy.mock.calls.length).toBe(2);
      fetchSpy.mockRestore();
    });

    it('throws when container creation fails', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(new Response('error', { status: 500 }));
      const p = new ThreadsPublisher('tok', 'u123');
      await expect(p.upload('https://v.mp4', { caption: 'x', hashtags: [] })).rejects.toThrow(/container creation failed/);
      fetchSpy.mockRestore();
    });

    it('pollStatus returns failed for 404', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(new Response('', { status: 404 }));
      const p = new ThreadsPublisher('tok', 'u123');
      expect(await p.pollStatus('post_404')).toBe('failed');
      fetchSpy.mockRestore();
    });
  });
});
