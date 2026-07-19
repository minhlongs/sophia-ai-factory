import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeyGenClient, getHeyGenClient } from './heygen-client';

// Mock global fetch
const globalFetch = global.fetch;

describe('HeyGenClient', () => {
  let client: HeyGenClient;
  const apiKey = 'test-api-key';

  beforeEach(() => {
    client = new HeyGenClient(apiKey);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = globalFetch;
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with api key', () => {
      expect(client).toBeDefined();
    });

    it('getHeyGenClient should return null if env var is missing', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, HEYGEN_API_KEY: '' };
      const result = await getHeyGenClient();
      expect(result).toBeNull();
      process.env = originalEnv;
    });

    it('getHeyGenClient should return instance if env var is set', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, HEYGEN_API_KEY: 'test-key' };
      const instance = await getHeyGenClient();
      expect(instance).toBeDefined();
      process.env = originalEnv;
    });
  });

  describe('listAvatars', () => {
    it('should return avatars on success', async () => {
      const mockAvatars = [
        { avatar_id: 'av1', name: 'Avatar 1', preview_image_url: 'http://test.com/1.jpg', gender: 'female' }
      ];

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { avatars: mockAvatars } })
      } as Response);

      const result = await client.listAvatars();
      expect(result).toEqual(mockAvatars);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.heygen.com/v2/avatars',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Api-Key': apiKey
          })
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      } as Response);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await client.listAvatars();
      expect(result).toEqual([]);

      consoleSpy.mockRestore();
    });
  });

  describe('createVideo', () => {
    it('should create video and return video_id', async () => {
      const mockVideoId = 'vid_123';
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { video_id: mockVideoId } })
      } as Response);

      const params = {
        avatarId: 'av1',
        voiceId: 'v1',
        script: 'Hello world',
        title: 'Test Video'
      };

      const result = await client.createVideo(params);
      expect(result).toBe(mockVideoId);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.heygen.com/v2/video/generate',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Hello world')
        })
      );
    });
  });

  describe('getVideoStatus', () => {
    it('should return video status', async () => {
      const videoId = 'vid_123';
      const mockStatus = {
        id: videoId,
        status: 'completed',
        video_url: 'http://video.url',
        thumbnail_url: 'http://thumb.url',
        error: undefined
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            status: 'completed',
            video_url: 'http://video.url',
            thumbnail_url: 'http://thumb.url'
          }
        })
      } as Response);

      const result = await client.getVideoStatus(videoId);
      expect(result).toEqual(mockStatus);
      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.heygen.com/v2/video/${videoId}`,
        expect.any(Object)
      );
    });

    it('should throw error on failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      await expect(client.getVideoStatus('vid_999')).rejects.toThrow();
    });
  });
});
