import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getAvatars } from './avatars/route';
import { POST as createVideo } from './create-video/route';
import { GET as getStatus } from './status/[id]/route';

// Mock better-auth-session (used by heygen routes for auth)
vi.mock('@/lib/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

// Mock ServiceFactory (used by all heygen routes)
vi.mock('@/lib/services/factory', () => ({
  ServiceFactory: {
    getVideoService: vi.fn(),
  },
}));

// Mock D1 client — INSERT/UPDATE side-effect should not affect status
vi.mock('@/lib/db/client', () => {
  const buildChain = () => {
    const chain: Record<string, unknown> = {};
    chain.insert = vi.fn(() => Promise.resolve({ data: null, error: null }));
    chain.update = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.then = (
      onfulfilled: (v: { data: null; error: null }) => unknown
    ) => Promise.resolve({ data: null, error: null }).then(onfulfilled);
    return chain;
  };
  return {
    createServerClient: vi.fn(() => ({
      from: vi.fn(() => buildChain()),
    })),
  };
});

import { getCurrentUser } from '@/lib/better-auth-session';
import { ServiceFactory } from '@/lib/services/factory';

describe('HeyGen API Routes', () => {
  const mockVideoService = {
    listAvatars: vi.fn(),
    listVoices: vi.fn(),
    createVideo: vi.fn(),
    getVideoStatus: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(ServiceFactory.getVideoService).mockReturnValue(mockVideoService as never);

    // Default: authenticated user for create-video tests
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com' } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
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
  });

  describe('POST /api/heygen/create-video', () => {
    it('should create video when valid data provided', async () => {
      mockVideoService.createVideo.mockResolvedValue('vid_123');

      const req = new NextRequest('http://localhost/api/heygen/create-video', {
        method: 'POST',
        body: JSON.stringify({
          avatarId: 'av1',
          voiceId: 'v1',
          script: 'test script'
        })
      });

      const response = await createVideo(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ videoId: 'vid_123' });
      expect(mockVideoService.createVideo).toHaveBeenCalledWith({
        avatarId: 'av1',
        voiceId: 'v1',
        script: 'test script',
        title: 'Video for test@test.com'
      });
    });

    it('should return 500 if service unavailable', async () => {
      vi.mocked(ServiceFactory.getVideoService).mockImplementation(() => {
        throw new Error('No video service');
      });
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
        body: JSON.stringify({
          avatarId: 'av1',
          voiceId: 'v1',
          script: 'test'
        })
      });

      const response = await createVideo(req);
      expect(response.status).toBe(500);
      consoleSpy.mockRestore();
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
      expect(data).toEqual(mockStatus);
      expect(mockVideoService.getVideoStatus).toHaveBeenCalledWith('vid_123');
    });

    it('should return 500 if service unavailable', async () => {
      vi.mocked(ServiceFactory.getVideoService).mockImplementation(() => {
        throw new Error('No video service');
      });
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
