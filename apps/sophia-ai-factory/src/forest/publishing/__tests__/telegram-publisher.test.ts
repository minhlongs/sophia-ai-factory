import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn() },
}));

import { TelegramPublisher } from '@/land/video/publishing/providers/telegram-publisher';

function setupFetchMock(responses: Array<unknown>) {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  for (const r of responses) {
    fetchSpy.mockResolvedValueOnce(r as Response);
  }
  return fetchSpy;
}

describe('TelegramPublisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mock mode (no bot token)', () => {
    it('returns mock_telegram_ id when botToken is empty', async () => {
      const pub = new TelegramPublisher('', '-100123');
      const id = await pub.upload('https://example.com/v.mp4', {
        caption: 'hello',
        hashtags: ['#ai'],
      });
      expect(id).toMatch(/^mock_telegram_/);
    });

    it('pollStatus returns live for mock id', async () => {
      const pub = new TelegramPublisher('', '-100123');
      const s = await pub.pollStatus('mock_telegram_1');
      expect(s).toBe('live');
    });

    it('getMetrics returns zero metrics in mock mode', async () => {
      const pub = new TelegramPublisher('', '-100123');
      const m = await pub.getMetrics('mock_telegram_1');
      expect(m.views).toBe(0);
      expect(m.likes).toBe(0);
      expect(m.comments).toBe(0);
    });
  });

  describe('upload — video', () => {
    it('sends video via sendVideo and returns message_id', async () => {
      const fetchSpy = setupFetchMock([
        new Response(
          JSON.stringify({ ok: true, result: { message_id: 42 } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ]);

      const pub = new TelegramPublisher('TOKEN', '-100123');
      const id = await pub.upload('https://example.com/v.mp4', {
        caption: '#ad Test',
        hashtags: ['#ai'],
      });

      expect(id).toBe('42');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toContain('/sendVideo');
      fetchSpy.mockRestore();
    });

    it('falls back to sendMessage when videoUrl is empty', async () => {
      const fetchSpy = setupFetchMock([
        new Response(
          JSON.stringify({ ok: true, result: { message_id: 7 } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ]);

      const pub = new TelegramPublisher('TOKEN', '-100123');
      const id = await pub.upload('', { caption: 'text only', hashtags: [] });

      expect(id).toBe('7');
      expect(fetchSpy.mock.calls[0][0]).toContain('/sendMessage');
      fetchSpy.mockRestore();
    });

    it('throws on non-ok HTTP response', async () => {
      const fetchSpy = setupFetchMock([
        new Response(JSON.stringify({ description: 'chat not found' }), { status: 400 }),
      ]);

      const pub = new TelegramPublisher('TOKEN', '-100123');
      await expect(
        pub.upload('https://example.com/v.mp4', { caption: 'c', hashtags: [] }),
      ).rejects.toThrow('Telegram sendVideo failed: 400');
      fetchSpy.mockRestore();
    });

    it('throws when ok=false in response body', async () => {
      const fetchSpy = setupFetchMock([
        new Response(
          JSON.stringify({ ok: false, description: 'bad token' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ]);

      const pub = new TelegramPublisher('TOKEN', '-100123');
      await expect(
        pub.upload('https://example.com/v.mp4', { caption: 'c', hashtags: [] }),
      ).rejects.toThrow('ok=false');
      fetchSpy.mockRestore();
    });
  });

  describe('pollStatus', () => {
    it('returns failed for 404', async () => {
      const fetchSpy = setupFetchMock([new Response(null, { status: 404 })]);

      const pub = new TelegramPublisher('TOKEN', '-100123');
      const s = await pub.pollStatus('99');
      expect(s).toBe('failed');
      fetchSpy.mockRestore();
    });

    it('returns live for successful getMessage', async () => {
      const fetchSpy = setupFetchMock([
        new Response(
          JSON.stringify({ ok: true, result: { forward_date: 123 } }),
          { status: 200 },
        ),
      ]);

      const pub = new TelegramPublisher('TOKEN', '-100123');
      const s = await pub.pollStatus('99');
      expect(s).toBe('live');
      fetchSpy.mockRestore();
    });

    it('returns processing when result is missing', async () => {
      const fetchSpy = setupFetchMock([
        new Response(JSON.stringify({ ok: false }), { status: 200 }),
      ]);

      const pub = new TelegramPublisher('TOKEN', '-100123');
      const s = await pub.pollStatus('99');
      expect(s).toBe('processing');
      fetchSpy.mockRestore();
    });
  });

  describe('getMetrics', () => {
    it('returns view count from getMessage', async () => {
      const fetchSpy = setupFetchMock([
        new Response(
          JSON.stringify({ ok: true, result: { views: 150, forward_count: 12 } }),
          { status: 200 },
        ),
      ]);

      const pub = new TelegramPublisher('TOKEN', '-100123');
      const m = await pub.getMetrics('42');
      expect(m.views).toBe(150);
      expect(m.shares).toBe(12);
      expect(m.likes).toBe(0);
      expect(m.comments).toBe(0);
      fetchSpy.mockRestore();
    });

    it('returns zeros on non-ok response', async () => {
      const fetchSpy = setupFetchMock([new Response(null, { status: 404 })]);

      const pub = new TelegramPublisher('TOKEN', '-100123');
      const m = await pub.getMetrics('42');
      expect(m.views).toBe(0);
      expect(m.likes).toBe(0);
      fetchSpy.mockRestore();
    });

    it('returns zeros when result is missing', async () => {
      const fetchSpy = setupFetchMock([
        new Response(JSON.stringify({ ok: false }), { status: 200 }),
      ]);

      const pub = new TelegramPublisher('TOKEN', '-100123');
      const m = await pub.getMetrics('42');
      expect(m.views).toBe(0);
      fetchSpy.mockRestore();
    });
  });
});
