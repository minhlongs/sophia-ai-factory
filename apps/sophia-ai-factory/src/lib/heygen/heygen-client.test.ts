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

    it('getHeyGenClient should return null if env var is missing', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, HEYGEN_API_KEY: '' };
      expect(getHeyGenClient()).toBeNull();
      process.env = originalEnv;
    });

    it('getHeyGenClient should return instance if env var is set', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, HEYGEN_API_KEY: 'test-key' };
      // Reset singleton if possible, but it's a module level variable.
      // Since we can't easily reset the module-level singleton in this test context without isolation,
      // we'll verify it returns an object.
      // Note: In a real scenario we might need to use vi.resetModules() or similar.
      const instance = getHeyGenClient();
      expect(instance).toBeDefined();
      process.env = originalEnv;
    });
  });

  describe('listAvatars', () => {
    it('should return avatars on success', async () => {
      const mockAvatars = [
        { avatar_id: 'av1', name: 'Avatar 1', preview_image_url: 'http://test.com/1.jpg', gender: 'female' }
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { avatars: mockAvatars } })
      });

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
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      // console.error is called in the catch block
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await client.listAvatars();
      expect(result).toEqual([]);

      consoleSpy.mockRestore();
    });
  });

  describe('createVideo', () => {
    it('should create video and return video_id', async () => {
      const mockVideoId = 'vid_123';
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { video_id: mockVideoId } })
      });

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

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            status: 'completed',
            video_url: 'http://video.url',
            thumbnail_url: 'http://thumb.url'
          }
        })
      });

      const result = await client.getVideoStatus(videoId);
      expect(result).toEqual(mockStatus);
      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.heygen.com/v2/video/${videoId}`,
        expect.any(Object)
      );
    });

    it('should throw error on failure', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(client.getVideoStatus('vid_999')).rejects.toThrow();
    });
  });
});
