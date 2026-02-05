import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getAvatars } from './avatars/route';
import { POST as createVideo } from './create-video/route';
import { GET as getStatus } from './status/[id]/route';
// import { GET as getVoices } from './voices/route';
import * as heygenClientModule from '@/lib/heygen/heygen-client';

// Mock the heygen client module
vi.mock('@/lib/heygen/heygen-client', () => ({
  getHeyGenClient: vi.fn()
}));

describe('HeyGen API Routes', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      listAvatars: vi.fn(),
      listVoices: vi.fn(),
      createVideo: vi.fn(),
      getVideoStatus: vi.fn(),
    };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    (heygenClientModule.getHeyGenClient as any).mockReturnValue(mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/heygen/avatars', () => {
    it('should return avatars when client is configured', async () => {
      const mockAvatars = [{ avatar_id: '1', name: 'Test Avatar' }];
      mockClient.listAvatars.mockResolvedValue(mockAvatars);

      const response = await getAvatars();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ avatars: mockAvatars });
    });

    it('should return empty list when client is missing', async () => {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      (heygenClientModule.getHeyGenClient as any).mockReturnValue(null);

      const response = await getAvatars();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ avatars: [] });
    });

    it('should handle errors gracefully', async () => {
      mockClient.listAvatars.mockRejectedValue(new Error('API Error'));

      // Suppress console.error
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
      mockClient.createVideo.mockResolvedValue('vid_123');

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
      expect(mockClient.createVideo).toHaveBeenCalledWith({
        avatarId: 'av1',
        voiceId: 'v1',
        script: 'test script',
        title: undefined
      });
    });

    it('should return 503 if client missing', async () => {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      (heygenClientModule.getHeyGenClient as any).mockReturnValue(null);
      const req = new NextRequest('http://localhost', { method: 'POST' });

      const response = await createVideo(req);
      expect(response.status).toBe(503);
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
        mockClient.createVideo.mockRejectedValue(new Error('Failed'));
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
      mockClient.getVideoStatus.mockResolvedValue(mockStatus);

      const req = new NextRequest('http://localhost');
      const params = Promise.resolve({ id: 'vid_123' });

      const response = await getStatus(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockStatus);
      expect(mockClient.getVideoStatus).toHaveBeenCalledWith('vid_123');
    });

    it('should return 503 if client missing', async () => {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        (heygenClientModule.getHeyGenClient as any).mockReturnValue(null);
        const req = new NextRequest('http://localhost');
        const params = Promise.resolve({ id: 'vid_123' });

        const response = await getStatus(req, { params });
        expect(response.status).toBe(503);
    });

    it('should handle errors', async () => {
        mockClient.getVideoStatus.mockRejectedValue(new Error('Failed'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const req = new NextRequest('http://localhost');
        const params = Promise.resolve({ id: 'vid_123' });

        const response = await getStatus(req, { params });
        expect(response.status).toBe(500);
        consoleSpy.mockRestore();
    });
  });
});
