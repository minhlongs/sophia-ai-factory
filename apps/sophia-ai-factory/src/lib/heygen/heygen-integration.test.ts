import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeyGenClient } from './heygen-client';

// Mock global fetch
const globalFetch = global.fetch;

describe('HeyGen Integration Flow', () => {
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

  it('should complete a full video creation and status check lifecycle', async () => {
    // 1. List Avatars
    const mockAvatars = [{ avatar_id: 'av1', name: 'Avatar 1', preview_image_url: 'url', gender: 'female' }];
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { avatars: mockAvatars } })
    });

    const avatars = await client.listAvatars();
    expect(avatars).toHaveLength(1);
    expect(avatars[0].avatar_id).toBe('av1');

    // 2. Create Video
    const mockVideoId = 'vid_123';
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { video_id: mockVideoId } })
    });

    const videoId = await client.createVideo({
      avatarId: avatars[0].avatar_id,
      voiceId: 'voice_1',
      script: 'Hello'
    });
    expect(videoId).toBe(mockVideoId);

    // 3. Check Status (Pending)
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { status: 'pending', video_url: null, thumbnail_url: null } })
    });

    let status = await client.getVideoStatus(videoId);
    expect(status.status).toBe('pending');

    // 4. Check Status (Completed)
    const finalVideoUrl = 'https://heygen.com/video.mp4';
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          status: 'completed',
          video_url: finalVideoUrl,
          thumbnail_url: 'thumb.jpg'
        }
      })
    });

    status = await client.getVideoStatus(videoId);
    expect(status.status).toBe('completed');
    expect(status.video_url).toBe(finalVideoUrl);
  });
});
