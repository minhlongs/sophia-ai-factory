/**
 * Tests for synthetic-media disclosure, pre-breaker provenance gating, and
 * non-retriable OpenClaw policy on the YouTube OAuth upload path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const breakerSpies = vi.hoisted(() => ({
  shouldAllowRequest: vi.fn(() => true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: breakerSpies.shouldAllowRequest,
  recordSuccess: breakerSpies.recordSuccess,
  recordFailure: breakerSpies.recordFailure,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createServerClient } from '@/seed/db/client';
import { uploadVideo, refreshAccessToken } from '@/land/youtube/youtube-oauth-client';
import { YouTubeChannelAdapter } from '@/tree/gateway/adapters/youtube-channel-adapter';
import { publishWithRetry } from '@/tree/gateway/openclaw/circuit-breaker-client';
import { selfHealDistribution } from '@/tree/gateway/openclaw/openclaw-self-heal';
import type { GatewayChannel } from '@/tree/gateway/gateway-types';
import { PROVENANCE_BLOCKED_PREFIX } from '@/tree/publishing/synthetic-media-disclosure';

const mockFetch = vi.fn();

function makeUploadFetchSequence(videoId = 'YT_OK_1'): void {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'video/mp4' }),
      blob: () => Promise.resolve(new Blob(['bytes'], { type: 'video/mp4' })),
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({}),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ Location: 'https://upload.example/resumable-1' }),
      blob: () => Promise.resolve(new Blob()),
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({}),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      blob: () => Promise.resolve(new Blob()),
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({ id: videoId }),
    });
}

describe('YouTube OAuth upload provenance & synthetic-media gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    breakerSpies.shouldAllowRequest.mockReturnValue(true);
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('YOUTUBE_CLIENT_ID', 'test-client-id');
    vi.stubEnv('YOUTUBE_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('YOUTUBE_REDIRECT_URI', 'http://localhost/callback');
    vi.mocked(createServerClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  api_keys: {
                    youtube: {
                      refresh_token: 'rt-1',
                      access_token: 'at-1',
                      expires_at: Math.floor(Date.now() / 1000) + 3600,
                    },
                  },
                },
                error: null,
              }),
          }),
        }),
      }),
    } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sets status.containsSyntheticMedia = true by default on resumable initiation', async () => {
    makeUploadFetchSequence('YT_SYNTH_TRUE');

    const watchUrl = await uploadVideo({
      accessToken: 'at-1',
      videoUrl: 'https://r2.example/video.mp4',
      title: 'Clean Guide',
      description: 'Narrative walkthrough',
      tags: ['guide'],
    });

    expect(watchUrl).toBe('https://www.youtube.com/watch?v=YT_SYNTH_TRUE');
    const initBody = JSON.parse(mockFetch.mock.calls[1]![1].body as string);
    expect(initBody.status).toEqual({
      privacyStatus: 'public',
      containsSyntheticMedia: true,
    });
    expect(breakerSpies.recordSuccess).toHaveBeenCalledWith('youtube');
    expect(breakerSpies.recordFailure).not.toHaveBeenCalled();
  });

  it('honors explicit provenance.containsSyntheticMedia = false when no unresolved claims exist', async () => {
    makeUploadFetchSequence('YT_SYNTH_FALSE');

    await uploadVideo({
      accessToken: 'at-1',
      videoUrl: 'https://r2.example/video.mp4',
      title: 'Live Camera Recording',
      description: 'Unaltered camera clip',
      tags: ['vlog'],
      provenance: { containsSyntheticMedia: false },
    });

    const initBody = JSON.parse(mockFetch.mock.calls[1]![1].body as string);
    expect(initBody.status.containsSyntheticMedia).toBe(false);
  });

  it('blocks unresolved provenance claims before shouldAllowRequest, fetch, or recordFailure', async () => {
    await expect(
      uploadVideo({
        accessToken: 'at-1',
        videoUrl: 'https://r2.example/video.mp4',
        title: 'Unverified Claim',
        description: 'Body',
        tags: [],
        provenance: {
          claims: [{ text: 'Boost conversions by 85% overnight', status: 'pending' }],
        },
      }),
    ).rejects.toThrow(new RegExp(`^${PROVENANCE_BLOCKED_PREFIX}`));

    expect(breakerSpies.shouldAllowRequest).not.toHaveBeenCalled();
    expect(breakerSpies.recordFailure).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('short-circuits publishWithRetry and selfHealDistribution on PROVENANCE_BLOCKED without retrying', async () => {
    const adapter = new YouTubeChannelAdapter({ uploadVideo, refreshAccessToken }, 'user-1');
    const publishSpy = vi.spyOn(adapter, 'publish');
    const youtubeChannel: GatewayChannel = {
      id: 'youtube',
      name: 'YouTube',
      adapter,
      enabled: true,
      rateLimitPerHour: 6,
    };

    const tiktokPublish = vi
      .fn()
      .mockResolvedValueOnce({ channelId: 'tiktok', success: false, error: '503 upstream timeout' })
      .mockResolvedValueOnce({
        channelId: 'tiktok',
        success: true,
        publishedUrl: 'https://tiktok.com/@u/video/1',
      });
    const tiktokChannel: GatewayChannel = {
      id: 'tiktok',
      name: 'TikTok',
      adapter: {
        publish: tiktokPublish,
        getStatus: async () => ({ channelId: 'tiktok', healthy: true, queueSize: 0 }),
        healthCheck: async () => true,
      },
      enabled: true,
      rateLimitPerHour: 10,
    };

    const blockedContent = {
      campaignId: 'camp-blocked',
      videoUrl: 'https://r2.example/video.mp4',
      title: 'Blocked Video',
      description: 'Body',
      tags: ['ai'],
      provenance: {
        claims: [{ text: 'Earn $10,000 passive income guaranteed', status: 'pending' }],
      },
    };

    const firstAttempt = await publishWithRetry(youtubeChannel, blockedContent, {
      maxRetries: 3,
      baseDelayMs: 1,
      maxDelayMs: 5,
    });

    expect(firstAttempt.success).toBe(false);
    expect(firstAttempt.error?.startsWith(PROVENANCE_BLOCKED_PREFIX)).toBe(true);
    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();

    const firstTikTok = await tiktokChannel.adapter.publish(blockedContent);
    const channels = new Map<string, GatewayChannel>([
      ['youtube', youtubeChannel],
      ['tiktok', tiktokChannel],
    ]);

    const healed = await selfHealDistribution(channels, blockedContent, {
      campaignId: 'camp-blocked',
      allSucceeded: false,
      results: [firstAttempt, firstTikTok],
    });

    // YouTube was NOT retried during self-heal; transient TikTok failure WAS healed.
    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(tiktokPublish).toHaveBeenCalledTimes(2);
    expect(healed.healed).toBe(1);
    expect(healed.failed).toBe(1);
    expect(healed.allSucceeded).toBe(false);
    expect(healed.errors[0]?.startsWith(PROVENANCE_BLOCKED_PREFIX)).toBe(true);
  });
});
