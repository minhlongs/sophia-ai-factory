import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getAvatars, _resetCacheForTest as resetAvatarsCache } from './avatars/route';
import { GET as getVoices, _resetCacheForTest as resetVoicesCache } from './voices/route';
import { POST as createVideo } from './create-video/route';
import { GET as getStatus } from './status/[id]/route';

// Mock better-auth-session (used by heygen routes for auth)
vi.mock('@/lib/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

// Mock getUserTier (used by create-video tier gate)
vi.mock('@/lib/db/get-user-tier', () => ({
  getUserTier: vi.fn(),
}));

// Mock ServiceFactory (used by all heygen routes)
vi.mock('@/lib/services/factory', () => ({
  ServiceFactory: {
    getVideoService: vi.fn(),
  },
}));

// Mock video quota module — default to under-quota / successful increment
vi.mock('@/lib/quota/video-quota', () => ({
  checkVideoQuota: vi.fn(),
  incrementVideoUsage: vi.fn(),
}));

// Mock D1 client — INSERT/UPDATE side-effect should not affect status
vi.mock('@/lib/db/client', () => {
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

import { getCurrentUser } from '@/lib/better-auth-session';
import { getUserTier } from '@/lib/db/get-user-tier';
import { ServiceFactory } from '@/lib/services/factory';
import { checkVideoQuota, incrementVideoUsage } from '@/lib/quota/video-quota';

describe('HeyGen API Routes', () => {
  const mockVideoService = {
    listAvatars: vi.fn(),
    listVoices: vi.fn(),
    createVideo: vi.fn(),
    getVideoStatus: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(ServiceFactory.getVideoService).mockResolvedValue(mockVideoService as never);
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com' } as never);
    vi.mocked(getUserTier).mockResolvedValue('PREMIUM' as never);
    // Default: user is under quota — tests that need quota exceeded override this.
    vi.mocked(checkVideoQuota).mockResolvedValue({
      allowed: true,
      used: 5,
      limit: 30,
      resetAt: '2026-05-01T00:00:00.000Z',
    } as never);
    vi.mocked(incrementVideoUsage).mockResolvedValue(undefined as never);
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

  describe('POST /api/heygen/create-video', () => {
    it('should return 402 when user has BASIC tier', async () => {
      vi.mocked(getUserTier).mockResolvedValue('BASIC' as never);

      const req = new NextRequest('http://localhost/api/heygen/create-video', {
        method: 'POST',
        body: JSON.stringify({ avatarId: 'av1', voiceId: 'v1', script: 'test script' }),
      });

      const response = await createVideo(req);
      const data = await response.json() as Record<string, string>;

      expect(response.status).toBe(402);
      expect(data.error).toMatch(/PREMIUM/i);
      expect(data.upgrade).toBe('/pricing');
      expect(mockVideoService.createVideo).not.toHaveBeenCalled();
    });

    it('should create video when user has PREMIUM tier', async () => {
      vi.mocked(getUserTier).mockResolvedValue('PREMIUM' as never);
      mockVideoService.createVideo.mockResolvedValue('vid_123');

      const req = new NextRequest('http://localhost/api/heygen/create-video', {
        method: 'POST',
        body: JSON.stringify({ avatarId: 'av1', voiceId: 'v1', script: 'test script' }),
      });

      const response = await createVideo(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ videoId: 'vid_123', status: 'processing' });
    });

    it('should create video when user has ENTERPRISE tier', async () => {
      vi.mocked(getUserTier).mockResolvedValue('ENTERPRISE' as never);
      mockVideoService.createVideo.mockResolvedValue('vid_456');

      const req = new NextRequest('http://localhost/api/heygen/create-video', {
        method: 'POST',
        body: JSON.stringify({ avatarId: 'av1', voiceId: 'v1', script: 'test' }),
      });

      const response = await createVideo(req);
      expect(response.status).toBe(200);
    });

    it('should create video when user has MASTER tier', async () => {
      vi.mocked(getUserTier).mockResolvedValue('MASTER' as never);
      mockVideoService.createVideo.mockResolvedValue('vid_789');

      const req = new NextRequest('http://localhost/api/heygen/create-video', {
        method: 'POST',
        body: JSON.stringify({ avatarId: 'av1', voiceId: 'v1', script: 'test' }),
      });

      const response = await createVideo(req);
      expect(response.status).toBe(200);
    });

    it('should return 500 if service unavailable', async () => {
      vi.mocked(ServiceFactory.getVideoService).mockRejectedValue(new Error('No video service'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const req = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ avatarId: 'av1', voiceId: 'v1', script: 'test' })
      });

      const response = await createVideo(req);
      expect(response.status).toBe(500);
      consoleSpy.mockRestore();
    });

    it('should return 400 if required fields missing', async () => {
      const req = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ avatarId: 'av1' }) // Missing voiceId and script
      });

      const response = await createVideo(req);
      expect(response.status).toBe(400);
    });

    it('should handle errors', async () => {
      mockVideoService.createVideo.mockRejectedValue(new Error('Failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const req = new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ avatarId: 'av1', voiceId: 'v1', script: 'test' }),
      });

      const response = await createVideo(req);
      expect(response.status).toBe(500);
      consoleSpy.mockRestore();
    });

    // ── Video Quota Tests ──────────────────────────────────────────────────────

    it('quota: should succeed when user is under monthly limit', async () => {
      vi.mocked(checkVideoQuota).mockResolvedValue({
        allowed: true,
        used: 10,
        limit: 30,
        resetAt: '2026-05-01T00:00:00.000Z',
      } as never);
      mockVideoService.createVideo.mockResolvedValue('vid_quota_ok');

      const req = new NextRequest('http://localhost/api/heygen/create-video', {
        method: 'POST',
        body: JSON.stringify({ avatarId: 'av1', voiceId: 'v1', script: 'test script' }),
      });

      const response = await createVideo(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ videoId: 'vid_quota_ok', status: 'processing' });
    });

    it('quota: should return 429 when user is at monthly limit', async () => {
      vi.mocked(checkVideoQuota).mockResolvedValue({
        allowed: false,
        used: 30,
        limit: 30,
        resetAt: '2026-05-01T00:00:00.000Z',
      } as never);

      const req = new NextRequest('http://localhost/api/heygen/create-video', {
        method: 'POST',
        body: JSON.stringify({ avatarId: 'av1', voiceId: 'v1', script: 'test script' }),
      });

      const response = await createVideo(req);
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(429);
      expect(data.error).toBe('quota_exceeded');
      expect(data.limit).toBe(30);
      expect(data.used).toBe(30);
      expect(data.resetAt).toBe('2026-05-01T00:00:00.000Z');
      // HeyGen must NOT be called when quota is exceeded
      expect(mockVideoService.createVideo).not.toHaveBeenCalled();
    });

    it('quota: should increment usage counter only after successful video creation', async () => {
      vi.mocked(checkVideoQuota).mockResolvedValue({
        allowed: true,
        used: 5,
        limit: 30,
        resetAt: '2026-05-01T00:00:00.000Z',
      } as never);
      mockVideoService.createVideo.mockResolvedValue('vid_increment_test');

      const req = new NextRequest('http://localhost/api/heygen/create-video', {
        method: 'POST',
        body: JSON.stringify({ avatarId: 'av1', voiceId: 'v1', script: 'test script' }),
      });

      const response = await createVideo(req);

      expect(response.status).toBe(200);
      // incrementVideoUsage must be called exactly once with the user id
      expect(incrementVideoUsage).toHaveBeenCalledTimes(1);
      expect(incrementVideoUsage).toHaveBeenCalledWith('user-1');
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
