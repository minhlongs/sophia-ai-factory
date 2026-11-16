/**
 * Upload Executor — Labelled-fixture tests
 *
 * Every fetch here is a fake transport that returns a SHAPE-COPY of the
 * provider's documented response. No provider is contacted; no test asserts
 * an invented URL or an invented post id.
 *
 * The honesty contract under test: {@link executePlatformUpload} may only
 * return `{ platformPostId, publishedUrl }` when a real provider id appeared
 * in a real (simulated) response body — otherwise it throws.
 *
 * @module tree/social/publisher/__tests__/upload-executor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executePlatformUpload,
  ProviderResultUnverifiableError,
  type UploadExecutionInput,
} from '../upload-executor';
import { CreatorInfoUnavailableError } from '../tiktok-creator-info';
import * as circuitBreaker from '@/seed/security/circuit-breaker';

vi.mock('@/seed/security/circuit-breaker');

/** Minimal Response stand-in: the executor only reads `.ok`, `.json()`, and `.headers.get()`. */
function fixtureResponse(body: unknown, opts: { ok?: boolean; status?: number; location?: string } = {}): Response {
  const headers = new Headers();
  if (opts.location) headers.set('Location', opts.location);
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const baseInput: UploadExecutionInput = {
  platform: 'YOUTUBE_SHORTS',
  accessToken: 'fixture_token',
  videoUrl: 'https://fixtures.example.test/video.mp4',
  jobId: 'job_1',
  channelId: 'chan_1',
  title: 'Fixture Short',
  description: 'Fixture description',
  totalSizeBytes: 10 * 1024 * 1024,
};

describe('upload-executor (labelled fixtures)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `vi.mock` already stubs the module; these two calls are the observable
    // contract the executor must honour: ask permission before calling a
    // provider, and record success only after a real id was read.
    vi.mocked(circuitBreaker.shouldAllowRequest).mockReturnValue(true);
  });

  describe('YouTube Shorts', () => {
    it('returns the provider video id and url when the provider returns both', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(fixtureResponse({}, { location: 'https://fixtures.googleapis.test/session-abc' }))
        .mockResolvedValueOnce(fixtureResponse({ id: 'provider_video_id_123' }));

      const result = await executePlatformUpload({ ...baseInput, fetchImpl: fetchImpl as unknown as typeof fetch });

      expect(result.platformPostId).toBe('provider_video_id_123');
      expect(result.publishedUrl).toBe('https://www.youtube.com/shorts/provider_video_id_123');
      expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('social_upload:YOUTUBE_SHORTS');
    });

    /**
     * Reads the JSON body the executor sent on its init call. The YouTube
     * disclosure rides on that body, so a caller cannot disable it by not
     * supplying the field.
     */
    function youtubeInitBody(fetchImpl: ReturnType<typeof vi.fn>): { status: { containsSyntheticMedia?: boolean } } {
      const initCall = (fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>)[0];
      return JSON.parse(String(initCall[1].body)) as { status: { containsSyntheticMedia?: boolean } };
    }

    function youtubeFetch() {
      return vi
        .fn()
        .mockResolvedValueOnce(fixtureResponse({}, { location: 'https://fixtures.googleapis.test/session-abc' }))
        .mockResolvedValueOnce(fixtureResponse({ id: 'provider_video_id_123' }));
    }

    it('discloses synthetic media even when the caller omits the disclosure', async () => {
      const fetchImpl = youtubeFetch();

      await executePlatformUpload({ ...baseInput, fetchImpl: fetchImpl as unknown as typeof fetch });

      expect(youtubeInitBody(fetchImpl).status.containsSyntheticMedia).toBe(true);
    });

    it('forwards an explicit disclosure decision to the provider', async () => {
      const fetchImpl = youtubeFetch();

      await executePlatformUpload({
        ...baseInput,
        containsSyntheticMedia: false,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      expect(youtubeInitBody(fetchImpl).status.containsSyntheticMedia).toBe(false);
    });

    it('throws when the resumable handshake yields no session Location header', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(fixtureResponse({}));

      await expect(executePlatformUpload({ ...baseInput, fetchImpl: fetchImpl as unknown as typeof fetch }))
        .rejects.toThrow(ProviderResultUnverifiableError);
      expect(circuitBreaker.recordSuccess).not.toHaveBeenCalled();
    });

    it('throws when the media upload response carries no id', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(fixtureResponse({}, { location: 'https://fixtures.googleapis.test/session-abc' }))
        .mockResolvedValueOnce(fixtureResponse({ error: 'quotaExceeded' }));

      await expect(executePlatformUpload({ ...baseInput, fetchImpl: fetchImpl as unknown as typeof fetch }))
        .rejects.toThrow(ProviderResultUnverifiableError);
      expect(circuitBreaker.recordSuccess).not.toHaveBeenCalled();
    });

    it('propagates a transport HTTP failure without recording success', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(fixtureResponse({}, { ok: false, status: 401 }));

      await expect(executePlatformUpload({ ...baseInput, fetchImpl: fetchImpl as unknown as typeof fetch }))
        .rejects.toThrow('HTTP_401');
      expect(circuitBreaker.recordSuccess).not.toHaveBeenCalled();
      expect(circuitBreaker.recordFailure).toHaveBeenCalled();
    });

    it('blocks on an unresolved provenance claim before touching the circuit breaker or network', async () => {
      const fetchImpl = vi.fn();

      await expect(
        executePlatformUpload({
          ...baseInput,
          provenance: {
            claims: [
              {
                id: 'claim_1',
                text: 'Unverified return claim',
                riskLevel: 'high',
                sourceIds: [],
                status: 'unsupported',
              },
            ],
          },
          fetchImpl: fetchImpl as unknown as typeof fetch,
        }),
      ).rejects.toThrow(/PROVENANCE_BLOCKED/);

      expect(fetchImpl).not.toHaveBeenCalled();
      expect(circuitBreaker.shouldAllowRequest).not.toHaveBeenCalled();
      expect(circuitBreaker.recordFailure).not.toHaveBeenCalled();
      expect(circuitBreaker.recordSuccess).not.toHaveBeenCalled();
    });
  });

  describe('TikTok v2', () => {
    const ttInput: UploadExecutionInput = { ...baseInput, platform: 'TIKTOK_V2' };

    /**
     * The creator_info preflight always runs first, so every TikTok fixture
     * below begins with a creator capability response. `publicLevels` is
     * empty for an app that has not passed TikTok's audit.
     */
    function tiktokFetch(responses: Array<ReturnType<typeof fixtureResponse>>, publicLevels: boolean) {
      return vi
        .fn()
        .mockResolvedValueOnce(
          fixtureResponse({
            data: {
              privacy_level_options: publicLevels
                ? ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY']
                : ['SELF_ONLY'],
            },
          }),
        )
        .mockImplementation(async () => responses.shift() ?? fixtureResponse({}));
    }

    const ttFetch = (...responses: Array<ReturnType<typeof fixtureResponse>>) => tiktokFetch(responses, true);

    it('returns the provider publish_id once the provider reports SUCCESS_PUBLISH', async () => {
      const fetchImpl = ttFetch(
        fixtureResponse({ data: { publish_id: 'tt_publish_777' } }),
        fixtureResponse({ data: { status: 'SUCCESS_PUBLISH' } }),
      );

      const result = await executePlatformUpload({ ...ttInput, fetchImpl: fetchImpl as unknown as typeof fetch });

      expect(result.platformPostId).toBe('tt_publish_777');
      expect(result.publishedUrl).toContain('tt_publish_777');
      expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('social_upload:TIKTOK_V2');
    });

    it('sends SELF_ONLY to the provider when the creator is not allowed to go public', async () => {
      const fetchImpl = tiktokFetch(
        [
          fixtureResponse({ data: { publish_id: 'tt_publish_777' } }),
          fixtureResponse({ data: { status: 'SUCCESS_PUBLISH' } }),
        ],
        false,
      );

      await executePlatformUpload({ ...ttInput, fetchImpl: fetchImpl as unknown as typeof fetch });

      const initCall = (fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>)[1];
      const body = JSON.parse(String(initCall[1].body)) as { post_info: { privacy_level: string } };
      expect(body.post_info.privacy_level).toBe('SELF_ONLY');
    });

    it('sends PUBLIC_TO_EVERYONE when the creator reported that level', async () => {
      const fetchImpl = ttFetch(
        fixtureResponse({ data: { publish_id: 'tt_publish_777' } }),
        fixtureResponse({ data: { status: 'SUCCESS_PUBLISH' } }),
      );

      await executePlatformUpload({ ...ttInput, fetchImpl: fetchImpl as unknown as typeof fetch });

      const initCall = (fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>)[1];
      const body = JSON.parse(String(initCall[1].body)) as { post_info: { privacy_level: string } };
      expect(body.post_info.privacy_level).toBe('PUBLIC_TO_EVERYONE');
    });

    it('never contacts the provider when the creator_info preflight fails', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(fixtureResponse({ error: { code: 'access_token_invalid' } }));

      await expect(executePlatformUpload({ ...ttInput, fetchImpl: fetchImpl as unknown as typeof fetch }))
        .rejects.toThrow(CreatorInfoUnavailableError);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.recordSuccess).not.toHaveBeenCalled();
    });

    it('refuses an over-long video before spending the upload bytes', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(
          fixtureResponse({ data: { privacy_level_options: ['SELF_ONLY'], max_video_post_duration_sec: 60 } }),
        );

      await expect(executePlatformUpload({
        ...ttInput,
        durationSeconds: 120,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })).rejects.toThrow(CreatorInfoUnavailableError);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('throws while the provider is still processing — an unconfirmed publish is not a success', async () => {
      const fetchImpl = ttFetch(
        fixtureResponse({ data: { publish_id: 'tt_publish_777' } }),
        fixtureResponse({ data: { status: 'PROCESSING_UPLOAD' } }),
      );

      await expect(executePlatformUpload({ ...ttInput, fetchImpl: fetchImpl as unknown as typeof fetch }))
        .rejects.toThrow(ProviderResultUnverifiableError);
      // The preflight succeeded, but the publish never did: only the preflight
      // key may be recorded, never the platform-scoped one.
      expect(circuitBreaker.recordSuccess).not.toHaveBeenCalledWith('social_upload:TIKTOK_V2');
    });

    it('throws with the provider fail reason when the provider reports FAILED', async () => {
      const fetchImpl = ttFetch(
        fixtureResponse({ data: { publish_id: 'tt_publish_777' } }),
        fixtureResponse({ data: { status: 'FAILED', fail_reason: 'picture size check failed' } }),
      );

      await expect(executePlatformUpload({ ...ttInput, fetchImpl: fetchImpl as unknown as typeof fetch }))
        .rejects.toThrow(/picture size check failed/);
      expect(circuitBreaker.recordSuccess).not.toHaveBeenCalledWith('social_upload:TIKTOK_V2');
    });

    it('throws when the init response carries no publish_id', async () => {
      const fetchImpl = ttFetch(fixtureResponse({ data: {} }));

      await expect(executePlatformUpload({ ...ttInput, fetchImpl: fetchImpl as unknown as typeof fetch }))
        .rejects.toThrow(ProviderResultUnverifiableError);
    });
  });

  describe('Instagram Reels', () => {
    const igInput: UploadExecutionInput = { ...baseInput, platform: 'INSTAGRAM_REELS' };

    it('returns the provider creation id when the container and publish steps agree', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(fixtureResponse({ id: 'ig_container_555' }))
        .mockResolvedValueOnce(fixtureResponse({ id: 'ig_media_999' }));

      const result = await executePlatformUpload({ ...igInput, fetchImpl: fetchImpl as unknown as typeof fetch });

      expect(result.platformPostId).toBe('ig_media_999');
      expect(result.publishedUrl).toBe('https://www.instagram.com/reel/ig_media_999/');
      expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('social_upload:INSTAGRAM_REELS');
    });

    it('throws rather than presenting a container id as a published reel url', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(fixtureResponse({ id: 'ig_container_555' }))
        .mockResolvedValueOnce(fixtureResponse({}));

      await expect(executePlatformUpload({ ...igInput, fetchImpl: fetchImpl as unknown as typeof fetch }))
        .rejects.toThrow(/container id is not a live reel/);
      expect(circuitBreaker.recordSuccess).not.toHaveBeenCalled();
    });

    it('throws when no container creation id is returned', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(fixtureResponse({ error: { message: 'invalid token' } }));

      await expect(executePlatformUpload({ ...igInput, fetchImpl: fetchImpl as unknown as typeof fetch }))
        .rejects.toThrow(ProviderResultUnverifiableError);
      expect(circuitBreaker.recordSuccess).not.toHaveBeenCalled();
    });
  });

  describe('circuit breaker', () => {
    it('refuses to call the provider at all when the breaker is open', async () => {
      vi.mocked(circuitBreaker.shouldAllowRequest).mockReturnValue(false);
      const fetchImpl = vi.fn();

      await expect(executePlatformUpload({ ...baseInput, fetchImpl: fetchImpl as unknown as typeof fetch }))
        .rejects.toThrow('CIRCUIT_OPEN:YOUTUBE_SHORTS');
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(circuitBreaker.recordSuccess).not.toHaveBeenCalled();
    });

    it('asks the breaker for permission before every platform call', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(fixtureResponse({}, { location: 'https://fixtures.googleapis.test/session-abc' }))
        .mockResolvedValueOnce(fixtureResponse({ id: 'yt_fixture_1' }));

      await executePlatformUpload({ ...baseInput, fetchImpl: fetchImpl as unknown as typeof fetch });

      expect(circuitBreaker.shouldAllowRequest).toHaveBeenCalledWith('social_upload:YOUTUBE_SHORTS');
    });

    it('records the failure under the platform key, not the caller-supplied channel', async () => {
      const channelA = vi.fn().mockResolvedValue(fixtureResponse({}, { ok: false, status: 500 }));
      const channelB = vi.fn().mockResolvedValue(fixtureResponse({}, { ok: false, status: 500 }));

      await expect(executePlatformUpload({ ...baseInput, channelId: 'chan_a', fetchImpl: channelA as unknown as typeof fetch }))
        .rejects.toThrow('HTTP_500');
      await expect(executePlatformUpload({ ...baseInput, channelId: 'chan_b', fetchImpl: channelB as unknown as typeof fetch }))
        .rejects.toThrow('HTTP_500');

      // Both failures must land on the same key. Keying on channelId would
      // let a caller reset the breaker by supplying a new channel string.
      expect(circuitBreaker.recordFailure).toHaveBeenNthCalledWith(
        1, 'social_upload:YOUTUBE_SHORTS', expect.any(String),
      );
      expect(circuitBreaker.recordFailure).toHaveBeenNthCalledWith(
        2, 'social_upload:YOUTUBE_SHORTS', expect.any(String),
      );
    });
  });
});
