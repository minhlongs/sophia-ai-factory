import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SophiaClient, SophiaApiError } from '../index';

describe('SophiaClient SDK', () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  // ─── 1. Initialization ────────────────────────────────────────────────────

  describe('Initialization', () => {
    it('initializes with options object and default baseUrl', () => {
      const client = new SophiaClient({ apiKey: 'mk_test_123' });
      expect(client).toBeInstanceOf(SophiaClient);
      expect(client.missions).toBeDefined();
      expect(client.credits).toBeDefined();
      expect(client.algorithms).toBeDefined();
    });

    it('initializes with string token and strips trailing slash from baseUrl', async () => {
      const client = new SophiaClient('token_abc', 'https://custom.api.io/');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credits_remaining: 100, credits_total_purchased: 100, credits_total_used: 0 }),
      });

      await client.credits.balance();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.api.io/api/v1/credits',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token_abc',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('accepts token property in options object as alias for apiKey', async () => {
      const client = new SophiaClient({ token: 'token_xyz' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credits_remaining: 50, credits_total_purchased: 50, credits_total_used: 0 }),
      });

      await client.credits.balance();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://sophia.agencyos.network/api/v1/credits',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token_xyz',
          }),
        }),
      );
    });
  });

  // ─── 2. Missions API ──────────────────────────────────────────────────────

  describe('Missions API', () => {
    const client = new SophiaClient({ apiKey: 'key_123', baseUrl: 'https://api.sophia.io' });

    it('creates a mission via POST /api/v1/missions', async () => {
      const mockMission = {
        id: 'msn_001',
        command: 'video:create',
        status: 'pending',
        credits_required: 5,
        credits_used: 0,
        params: { title: 'Test Video' },
        result: null,
        error: null,
        created_at: 1000,
        updated_at: 1000,
        completed_at: null,
        webhook_url: null,
        webhook_fired_at: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMission,
      });

      const res = await client.missions.create({
        command: 'video:create',
        params: { title: 'Test Video' },
      });

      expect(res).toEqual(mockMission);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sophia.io/api/v1/missions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ command: 'video:create', params: { title: 'Test Video' } }),
        }),
      );
    });

    it('retrieves a mission via GET /api/v1/missions/:id', async () => {
      const mockMission = {
        id: 'msn_001',
        command: 'video:create',
        status: 'succeeded',
        credits_used: 5,
        result: { videoUrl: 'https://cdn.example.com/v.mp4' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMission,
      });

      const res = await client.missions.get('msn_001');
      expect(res).toEqual(mockMission);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sophia.io/api/v1/missions/msn_001',
        expect.anything(),
      );
    });

    it('lists missions with query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ missions: [], has_more: false, next_cursor: null }),
      });

      await client.missions.list({
        status: 'running',
        command: 'video:create',
        limit: 20,
        cursor: 'cur_abc',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sophia.io/api/v1/missions?status=running&command=video%3Acreate&limit=20&cursor=cur_abc',
        expect.anything(),
      );
    });

    it('parses SSE events via stream() and streamEvents()', async () => {
      const ssePayload = [
        'event: status\n',
        'data: {"progress":50}\n\n',
        'event: message\n',
        'data: {"text":"Rendering"}\n\n',
        'event: done\n',
        'data: {"completed":true}\n\n',
      ].join('');

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(ssePayload));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const events: Array<{ event: string; data: Record<string, unknown> }> = [];
      for await (const ev of client.missions.streamEvents('msn_001')) {
        events.push(ev);
      }

      expect(events).toEqual([
        { event: 'status', data: { progress: 50 } },
        { event: 'message', data: { text: 'Rendering' } },
        { event: 'done', data: { completed: true } },
      ]);
    });

    it('stream() aliases streamEvents()', async () => {
      const ssePayload = 'event: done\ndata: {"status":"success"}\n\n';
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(ssePayload));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const events: Array<{ event: string; data: Record<string, unknown> }> = [];
      for await (const ev of client.missions.stream('msn_002')) {
        events.push(ev);
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ event: 'done', data: { status: 'success' } });
    });

    it('handles stream errors gracefully when SSE endpoint fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const generator = client.missions.stream('non_existent');
      await expect(generator.next()).rejects.toThrow(SophiaApiError);
    });
  });

  // ─── 3. Credits API ───────────────────────────────────────────────────────

  describe('Credits API', () => {
    const client = new SophiaClient({ apiKey: 'key_123', baseUrl: 'https://api.sophia.io' });

    it('checks balance via balance() and getBalance()', async () => {
      const balanceData = {
        credits_remaining: 150,
        credits_total_purchased: 200,
        credits_total_used: 50,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => balanceData,
      });

      const res1 = await client.credits.balance();
      expect(res1).toEqual(balanceData);

      const res2 = await client.credits.getBalance();
      expect(res2).toEqual(balanceData);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sophia.io/api/v1/credits',
        expect.anything(),
      );
    });

    it('consumes credits via POST /api/v1/credits/consume', async () => {
      const consumeData = {
        success: true,
        credits_remaining: 140,
        credits_consumed: 10,
        transaction_id: 'tx_123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => consumeData,
      });

      const res = await client.credits.consume({
        amount: 10,
        reason: 'video_generation',
        missionId: 'msn_abc',
      });

      expect(res).toEqual(consumeData);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sophia.io/api/v1/credits/consume',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ amount: 10, reason: 'video_generation', missionId: 'msn_abc' }),
        }),
      );
    });
  });

  // ─── 4. Algorithms API ────────────────────────────────────────────────────

  describe('Algorithms API', () => {
    const client = new SophiaClient({ apiKey: 'key_123', baseUrl: 'https://api.sophia.io' });

    it('calls affiliateDescription endpoint with query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ description: 'Enriched desc', affiliateCount: 3 }),
      });

      const res = await client.algorithms.affiliateDescription('vid_123', { niche: 'tech', max: 5 });
      expect(res).toEqual({ description: 'Enriched desc', affiliateCount: 3 });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sophia.io/api/videos/vid_123/description-enriched?niche=tech&max=5',
        expect.anything(),
      );

      // Verify direct delegate
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ description: 'Enriched desc', affiliateCount: 3 }),
      });
      const direct = await client.affiliateDescription('vid_123', { niche: 'tech' });
      expect(direct.description).toBe('Enriched desc');
    });

    it('calls translate endpoint via POST /api/translate', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ translated: 'Xin chào', model: 'gpt-4o' }),
      });

      const res = await client.algorithms.translate({
        text: 'Hello',
        fromLang: 'en',
        toLang: 'vi',
        tone: 'natural',
      });

      expect(res.translated).toBe('Xin chào');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sophia.io/api/translate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'Hello', fromLang: 'en', toLang: 'vi', tone: 'natural' }),
        }),
      );

      // Verify direct delegate
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ translated: 'Xin chào', model: 'gpt-4o' }),
      });
      const direct = await client.translate({ text: 'Hello', fromLang: 'en', toLang: 'vi' });
      expect(direct.translated).toBe('Xin chào');
    });

    it('calls cloneVoice endpoint via POST /api/voice/clone', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ voiceId: 'voice_abc', samplesUploaded: 2 }),
      });

      const res = await client.algorithms.cloneVoice({
        name: 'Narrator',
        audioUrls: ['https://cdn.example.com/audio1.mp3'],
      });

      expect(res.voiceId).toBe('voice_abc');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sophia.io/api/voice/clone',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('calls seoScript endpoint via POST /api/scripts/seo', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          script: 'Hook: Did you know...',
          seoScore: 92,
          suggestedTitles: ['Top 5 Tips'],
          keywordCoverage: [{ keyword: 'AI', hits: 4 }],
        }),
      });

      const res = await client.algorithms.seoScript({
        topic: 'AI Marketing',
        keywords: ['AI', 'SaaS'],
        language: 'en',
      });

      expect(res.seoScore).toBe(92);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sophia.io/api/scripts/seo',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('calls liveStats endpoint via GET /api/stats/live without auth headers required', async () => {
      const publicClient = new SophiaClient({ baseUrl: 'https://api.sophia.io' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          missionsCompleted: 1200,
          paidAgencies: 85,
          videosGenerated: 4500,
          generatedAt: 1700000000,
        }),
      });

      const stats = await publicClient.algorithms.liveStats();
      expect(stats.missionsCompleted).toBe(1200);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sophia.io/api/stats/live',
        expect.objectContaining({}),
      );
    });

    it('calls schedulePublish endpoint via POST /api/publish/quick-schedule', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job_456', scheduledAt: 1700005000, status: 'scheduled' }),
      });

      const res = await client.algorithms.schedulePublish({
        videoId: 'vid_123',
        channelId: 'ch_yt_1',
        scheduledAt: 1700005000,
        caption: 'Watch this now!',
      });

      expect(res.status).toBe('scheduled');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sophia.io/api/publish/quick-schedule',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('calls registerChannel endpoint via POST /api/publish/channels', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ channelId: 'ch_tiktok_1', provider: 'tiktok', status: 'active' }),
      });

      const res = await client.algorithms.registerChannel({
        provider: 'tiktok',
        externalAccountId: 'acc_tt_99',
        accessToken: 'oauth_token_val',
      });

      expect(res.channelId).toBe('ch_tiktok_1');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sophia.io/api/publish/channels',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  // ─── 5. Error & Envelope Handling ─────────────────────────────────────────

  describe('Error Handling and Envelopes', () => {
    const client = new SophiaClient({ apiKey: 'key_123', baseUrl: 'https://api.sophia.io' });

    it('throws SophiaApiError with status and message for 4xx errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: 'Unauthorized', detail: 'Invalid API key' }),
      });

      await expect(client.credits.balance()).rejects.toThrow(SophiaApiError);
      try {
        await client.credits.balance();
      } catch (err: unknown) {
        if (err instanceof SophiaApiError) {
          expect(err.status).toBe(401);
          expect(err.message).toContain('Sophia API error 401');
        }
      }
    });

    it('throws SophiaApiError with status and message for 5xx errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      });

      await expect(client.missions.get('msn_1')).rejects.toThrow(SophiaApiError);
    });

    it('respects external AbortSignal cancellation', async () => {
      const controller = new AbortController();
      controller.abort();

      mockFetch.mockImplementationOnce((_url, init) => {
        if (init?.signal?.aborted) {
          return Promise.reject(new DOMException('The user aborted a request.', 'AbortError'));
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      await expect(
        client.credits.balance({ signal: controller.signal }),
      ).rejects.toThrow();
    });

    it('handles per-request timeout options', async () => {
      const fastClient = new SophiaClient({ apiKey: 'key', baseUrl: 'https://api.sophia.io', timeoutMs: 50 });

      mockFetch.mockImplementationOnce((_url, init) => {
        return new Promise((resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('Request timeout after 50ms'));
          });
        });
      });

      await expect(fastClient.credits.balance()).rejects.toThrow('Request timeout');
    });
  });
});
