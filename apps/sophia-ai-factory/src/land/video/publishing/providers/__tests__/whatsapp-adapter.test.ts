import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsAppAdapter } from '../whatsapp-adapter';
import { reset } from '@/seed/security/circuit-breaker';

describe('WhatsAppAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.INSTAGRAM_APP_ID;
    reset('whatsapp');
  });

  describe('upload — mock mode', () => {
    it('returns stable mock id in mock mode', async () => {
      const adapter = new WhatsAppAdapter('123456789012345', 'EAA_TEST_TOKEN');
      const id = await adapter.upload('https://example.com/v.mp4', {
        caption: 'hello',
        hashtags: ['a', 'b'],
      });
      expect(id).toMatch(/^mock_whatsapp_upload_\d+$/);
    });
  });

  describe('upload — live Meta API', () => {
    beforeEach(() => {
      process.env.INSTAGRAM_APP_ID = 'real-app-id';
    });

    it('returns Meta message id on success', async () => {
      const adapter = new WhatsAppAdapter('123456789012345', 'EAA_TEST_TOKEN');
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ messages: [{ id: 'wa-msg-99' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const id = await adapter.upload('https://example.com/v.mp4', {
        caption: 'hello',
        hashtags: [],
      });

      expect(id).toBe('wa-msg-99');
      const [, opts] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse((opts.body ?? '{}') as string);
      expect(body.messaging_product).toBe('whatsapp');
      expect(body.recipient_type).toBe('individual');
      expect(body.to).toBe('');
    });

    it('falls back to mock id on rate-limit', async () => {
      const adapter = new WhatsAppAdapter('123456789012345', 'EAA_TEST_TOKEN');
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('rate limited', { status: 429 }));
      const id = await adapter.upload('https://example.com/v.mp4', { caption: '', hashtags: [] });
      expect(id).toMatch(/^mock_whatsapp_upload_\d+$/);
    });

    it('falls back to mock id on server error', async () => {
      const adapter = new WhatsAppAdapter('123456789012345', 'EAA_TEST_TOKEN');
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('oops', { status: 500 }));
      const id = await adapter.upload('https://example.com/v.mp4', { caption: '', hashtags: [] });
      expect(id).toMatch(/^mock_whatsapp_upload_\d+$/);
    });

    it('throws AUTH_FAILURE branch on 401', async () => {
      const adapter = new WhatsAppAdapter('123456789012345', 'EAA_TEST_TOKEN');
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'bad token' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      );
      await expect(adapter.upload('https://example.com/v.mp4', { caption: '', hashtags: [] })).rejects.toThrow(
        'WhatsApp publish failed (401)',
      );
    });

    it('falls back to mock id on non-retryable 400', async () => {
      const adapter = new WhatsAppAdapter('123456789012345', 'EAA_TEST_TOKEN');
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('bad request', { status: 400 }),
      );
      const id = await adapter.upload('https://example.com/v.mp4', { caption: '', hashtags: [] });
      expect(id).toMatch(/^mock_whatsapp_upload_\d+$/);
    });
  });

  describe('pollStatus', () => {
    it('returns live for mock or mock_ prefixed ids', async () => {
      const adapter = new WhatsAppAdapter('123456789012345', 'EAA_TEST_TOKEN');
      await expect(adapter.pollStatus('mock_abc')).resolves.toBe('live');
      await expect(adapter.pollStatus('real-wa-id')).resolves.toBe('live');
    });
  });

  describe('getMetrics', () => {
    it('returns zeroed metrics', async () => {
      const adapter = new WhatsAppAdapter('123456789012345', 'EAA_TEST_TOKEN');
      const m = await adapter.getMetrics('any-id');
      expect(m).toEqual({ views: 0, likes: 0, shares: 0, comments: 0, reach: 0 });
    });
  });

  describe('extractMessageId', () => {
    it('parses entries changes value messages[0].id', async () => {
      const adapter = new WhatsAppAdapter('123456789012345', 'EAA_TEST_TOKEN');
      process.env.INSTAGRAM_APP_ID = 'real-app-id';
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ entries: [{ changes: { value: { messages: [{ id: 'ext-1' }] } } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
      const id = await adapter.upload('https://example.com/v.mp4', { caption: '', hashtags: [] });
      expect(id).toBe('ext-1');
    });

    it('falls back to messages[0].id shape when primary path returns null', async () => {
      const adapter = new WhatsAppAdapter('123456789012345', 'EAA_TEST_TOKEN');
      process.env.INSTAGRAM_APP_ID = 'real-app-id';
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ messages: [{ id: 'ext-2' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      const id = await adapter.upload('https://example.com/v.mp4', { caption: '', hashtags: [] });
      expect(id).toBe('ext-2');
    });
  });
});