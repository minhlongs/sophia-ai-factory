import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getAvatars, _resetCacheForTest as resetAvatarsCache } from './avatars/route';
import { GET as getVoices, _resetCacheForTest as resetVoicesCache } from './voices/route';
import { GET as getStatus } from './status/[id]/route';

// Mock better-auth-session (used by heygen routes for auth)
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

// Mock ServiceFactory (used by all heygen routes)
vi.mock('@/lib/services/factory', () => ({
  ServiceFactory: {
    getVideoService: vi.fn(),
  },
}));


// Mock D1 client — INSERT/UPDATE side-effect should not affect status
vi.mock('@/seed/db/client', () => {
  const buildChain = () => {
    const chain: Record<string, unknown> = {};
    chain.insert = vi.fn(() => Promise.resolve({ data: null, error: null }));
    chain.update = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    chain.then = (
      onfulfilled: (v: { data: null; error: null }) => unknown
    ) => Promise.resolve({ data: null, error: null }).then(onfulfilled);
    return chain;
  };
  return {
    createServerClient: vi.fn(() => ({
      from: vi.fn(() => buildChain()),
    })),
    getD1Raw: vi.fn(),
  };
});

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { ServiceFactory } from '@/lib/services/factory';

describe('HeyGen API Routes', () => {
  const mockVideoService = {
    listAvatars: vi.fn(),
    listVoices: vi.fn(),
    getVideoStatus: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(ServiceFactory.getVideoService).mockResolvedValue(mockVideoService as never);
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com' } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetAvatarsCache();
    resetVoicesCache();
  });

  describe('GET /api/heygen/avatars', () => {
    it('should return avatars when client is configured', async () => {
      const mockAvatars = [{ avatar_id: '1', name: 'Test Avatar' }];
      mockVideoService.listAvatars.mockResolvedValue(mockAvatars);

      const response = await getAvatars();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ avatars: mockAvatars });
    });

    it('should return empty list when service returns empty', async () => {
      mockVideoService.listAvatars.mockResolvedValue([]);

      const response = await getAvatars();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ avatars: [] });
    });

    it('should handle errors gracefully', async () => {
      mockVideoService.listAvatars.mockRejectedValue(new Error('API Error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await getAvatars();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to fetch avatars' });

      consoleSpy.mockRestore();
    });

    it('cache: second call within TTL returns cached data without re-fetching', async () => {
      const mockAvatars = [{ avatar_id: 'cached-1', name: 'Cached Avatar' }];
      mockVideoService.listAvatars.mockResolvedValue(mockAvatars);

      // First call — populates cache
      const res1 = await getAvatars();
      expect(res1.status).toBe(200);
      expect(mockVideoService.listAvatars).toHaveBeenCalledTimes(1);

      // Second call — cache hit (module-level cache still warm within same isolate)
      const res2 = await getAvatars();
      const data2 = await res2.json();
      expect(res2.status).toBe(200);
      expect(data2).toEqual({ avatars: mockAvatars });
      // Service should NOT be called a second time if cache is warm
      // Note: module-level cache persists within same test module execution
      expect(mockVideoService.listAvatars).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/heygen/voices', () => {
    it('should return voices when client is configured', async () => {
      const mockVoices = [{ voice_id: 'v1', name: 'Test Voice' }];
      mockVideoService.listVoices.mockResolvedValue(mockVoices);

      const response = await getVoices();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ voices: mockVoices });
    });
  });

  describe('GET /api/heygen/status/[id]', () => {
    it('should return status', async () => {
      const mockStatus = { status: 'completed', video_url: 'http://url' };
      mockVideoService.getVideoStatus.mockResolvedValue(mockStatus);

      const req = new NextRequest('http://localhost');
      const params = Promise.resolve({ id: 'vid_123' });

      const response = await getStatus(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ status: 'completed', video_url: 'http://url', thumbnail_url: null, duration_sec: null, error: null });
      expect(mockVideoService.getVideoStatus).toHaveBeenCalledWith('vid_123');
    });

    it('should return 500 if service unavailable', async () => {
      vi.mocked(ServiceFactory.getVideoService).mockRejectedValue(new Error('No video service'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const req = new NextRequest('http://localhost');
      const params = Promise.resolve({ id: 'vid_123' });

      const response = await getStatus(req, { params });
      expect(response.status).toBe(500);
      consoleSpy.mockRestore();
    });

    it('should handle errors', async () => {
      mockVideoService.getVideoStatus.mockRejectedValue(new Error('Failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const req = new NextRequest('http://localhost');
      const params = Promise.resolve({ id: 'vid_123' });

      const response = await getStatus(req, { params });
      expect(response.status).toBe(500);
      consoleSpy.mockRestore();
    });
  });
});

// ── Webhook tests (separate describe block — needs env mock) ──────────────────
describe('HeyGen Webhook — missing secret fallback', () => {
  beforeEach(() => {
    // Ensure secret is NOT set for these tests
    delete process.env.HEYGEN_WEBHOOK_SECRET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.HEYGEN_WEBHOOK_SECRET;
  });

  it('should return 200 with cron-poll fallback when HEYGEN_WEBHOOK_SECRET is missing', async () => {
    // Returning 200 prevents HeyGen retry storm; cron polling handles status updates.
    const { POST: webhookHandler } = await import('../webhooks/heygen/route');
    const req = new NextRequest('http://localhost/api/webhooks/heygen', {
      method: 'POST',
      body: JSON.stringify({ video_id: 'test', status: 'completed' }),
    });

    const response = await webhookHandler(req);
    const data = await response.json() as Record<string, string>;

    expect(response.status).toBe(200);
    expect(data.mode).toBe('cron-poll-fallback');
  });

  it('x-signature header is accepted (alias for x-heygen-signature)', async () => {
    // When secret is missing the route returns 200 regardless of headers.
    // This test verifies the fallback path still works with x-signature header present
    // (header variant acceptance is exercised in full in route unit tests).
    const { POST: webhookHandler } = await import('../webhooks/heygen/route');
    const req = new NextRequest('http://localhost/api/webhooks/heygen', {
      method: 'POST',
      headers: { 'x-signature': 'some-sig' },
      body: JSON.stringify({ video_id: 'v1', status: 'completed' }),
    });

    const response = await webhookHandler(req);
    const data = await response.json() as Record<string, string>;

    // Without secret configured: always 200 cron-poll-fallback
    expect(response.status).toBe(200);
    expect(data.mode).toBe('cron-poll-fallback');
  });
});
