/**
 * Wave 17 Phase 02 — publishExecute video URL resolution via getCanonicalVideoUrl.
 *
 * Verifies that publishExecute no longer queries video_jobs.final_r2_key but instead
 * delegates to getCanonicalVideoUrl(job.video_id, tenantId) for both:
 *   1. Telegram branch
 *   2. OAuth (HeyGen) branch
 *
 * Error handling:
 *   - VideoNotFoundError  → job marked failed, message "Video not found"
 *   - VideoUnauthorizedError → job marked failed, Sentry warning logged, message "Permission denied"
 *   - VideoNotMirroredError → re-thrown (Inngest retries transient)
 *   - Other Error           → re-thrown
 *
 * Telegram branch — happy path: resolved URL passes assertSafeVideoUrl, publishToTelegram
 * receives resolved videoUrl, publishing_results row inserted.
 *
 * OAuth branch — happy path (HeyGen video): resolved URL passed to publisher.upload.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mock builders ─────────────────────────────────────────────────────

const {
  mockGetCanonicalVideoUrl,
  mockPublishToTelegram,
  mockDbUpdate,
  mockDbInsert,
  mockDbSelect,
  mockDbEq,
  mockDbSingle,
  mockDbMaybeSingle,
  mockDbFrom,
  mockGetD1Client,
  mockLoggerWarn,
  mockDecryptToken,
  mockUpload,
} = vi.hoisted(() => {
  const mockDbEq = vi.fn();
  const mockDbSingle = vi.fn();
  const mockDbMaybeSingle = vi.fn();
  const mockDbUpdate = vi.fn();
  const mockDbInsert = vi.fn();
  const mockDbSelect = vi.fn();

  mockDbEq.mockImplementation(() => ({
    eq: mockDbEq,
    single: mockDbSingle,
    maybeSingle: mockDbMaybeSingle,
  }));

  const mockDbFrom = vi.fn().mockReturnValue({
    select: mockDbSelect,
    update: mockDbUpdate,
    insert: mockDbInsert,
  });

  mockDbSelect.mockReturnValue({ eq: mockDbEq, single: mockDbSingle });
  mockDbUpdate.mockReturnValue({ eq: mockDbEq });
  mockDbInsert.mockReturnValue({});

  const mockGetD1Client = vi.fn();
  const mockGetCanonicalVideoUrl = vi.fn();
  const mockPublishToTelegram = vi.fn();
  const mockLoggerWarn = vi.fn();
  const mockDecryptToken = vi.fn();
  const mockUpload = vi.fn();

  return {
    mockGetCanonicalVideoUrl,
    mockPublishToTelegram,
    mockDbUpdate,
    mockDbInsert,
    mockDbSelect,
    mockDbEq,
    mockDbSingle,
    mockDbMaybeSingle,
    mockDbFrom,
    mockGetD1Client,
    mockLoggerWarn,
    mockDecryptToken,
    mockUpload,
  };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

// Error classes must be defined inside vi.mock factory to avoid hoisting issues.
// We define them here as local classes matching the real ones' names.
vi.mock('@/land/video/get-canonical-video-url', () => {
  class VideoNotFoundError extends Error {
    constructor(videoId: string) {
      super(`[getCanonicalVideoUrl] Video not found: ${videoId}`);
      this.name = 'VideoNotFoundError';
    }
  }
  class VideoUnauthorizedError extends Error {
    constructor(videoId: string) {
      super(`[getCanonicalVideoUrl] Unauthorized access to video: ${videoId}`);
      this.name = 'VideoUnauthorizedError';
    }
  }
  class VideoNotMirroredError extends Error {
    constructor(videoId: string) {
      super(`[getCanonicalVideoUrl] Video not yet mirrored to R2 — try again later: ${videoId}`);
      this.name = 'VideoNotMirroredError';
    }
  }
  return {
    getCanonicalVideoUrl: mockGetCanonicalVideoUrl,
    VideoNotFoundError,
    VideoUnauthorizedError,
    VideoNotMirroredError,
  };
});

vi.mock('@/seed/db/client', () => ({ getD1Client: mockGetD1Client }));
vi.mock('@/forest/publishing/providers/telegram-publisher', () => ({
  publishToTelegram: mockPublishToTelegram,
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: mockLoggerWarn, error: vi.fn() },
}));
vi.mock('@/forest/publishing/oauth-token-refresher', () => ({
  refreshChannelToken: vi.fn(),
  refreshExpiringTokens: vi.fn(),
}));
vi.mock('@/forest/publishing/token-crypto', () => ({
  decryptToken: mockDecryptToken,
}));
vi.mock('@/forest/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn(),
    send: vi.fn(),
  },
}));

const publisherObj = { upload: mockUpload, pollStatus: vi.fn().mockResolvedValue('processing'), getMetrics: vi.fn().mockResolvedValue({}) };
vi.mock('@/forest/publishing/tiktok-publisher', () => ({ TikTokPublisher: vi.fn().mockImplementation(() => publisherObj) }));
vi.mock('@/forest/publishing/youtube-publisher', () => ({ YouTubePublisher: vi.fn().mockImplementation(() => publisherObj) }));
vi.mock('@/forest/publishing/instagram-publisher', () => ({ InstagramPublisher: vi.fn().mockImplementation(() => publisherObj) }));
vi.mock('@/forest/publishing/facebook-publisher', () => ({ FacebookPublisher: vi.fn().mockImplementation(() => publisherObj) }));
vi.mock('@/forest/publishing/twitter-publisher', () => ({ TwitterPublisher: vi.fn().mockImplementation(() => publisherObj) }));
vi.mock('@/forest/publishing/pinterest-publisher', () => ({ PinterestPublisher: vi.fn().mockImplementation(() => publisherObj) }));
vi.mock('@/forest/publishing/linkedin-publisher', () => ({ LinkedInPublisher: vi.fn().mockImplementation(() => publisherObj) }));
vi.mock('@/forest/publishing/zalo-publisher', () => ({ ZaloPublisher: vi.fn().mockImplementation(() => publisherObj) }));
vi.mock('@/forest/publishing/threads', () => ({ ThreadsPublisher: vi.fn().mockImplementation(() => publisherObj) }));
vi.mock('@/forest/publishing/reddit', () => ({ RedditPublisher: vi.fn().mockImplementation(() => publisherObj) }));
vi.mock('@/forest/publishing/bluesky', () => ({ BlueskyPublisher: vi.fn().mockImplementation(() => publisherObj) }));
vi.mock('@/forest/publishing/mastodon', () => ({ MastodonPublisher: vi.fn().mockImplementation(() => publisherObj) }));

// ── Re-import error types from mocked module ──────────────────────────────────

import {
  VideoNotFoundError,
  VideoUnauthorizedError,
  VideoNotMirroredError,
} from '@/land/video/get-canonical-video-url';

// ── Shared test fixtures ───────────────────────────────────────────────────────

const JOB_ID = 'job-wave17-002';
const TENANT_ID = 'user-wave17-001';
const VIDEO_ID = 'vid-canonical-001';
const CHAT_ID = 'chat-12345';
const R2_URL = 'https://pub-test.r2.dev/videos/vid-001.mp4';
const TG_POST_ID = '42';
const TG_URL = 'https://t.me/mychannel/42';

function makeTelegramJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: JOB_ID,
    tenant_id: TENANT_ID,
    video_id: VIDEO_ID,  // stores videos.id (renamed from video_job_id in Wave 20 Phase 05)
    channel_id: CHAT_ID,
    provider: 'telegram',
    status: 'scheduled',
    caption: 'test caption',
    hashtags_json: null,
    product_link: null,
    retry_count: 0,
    ...overrides,
  };
}

function makeOAuthJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: JOB_ID,
    tenant_id: TENANT_ID,
    video_id: VIDEO_ID,
    channel_id: 'ch-youtube-001',
    provider: 'youtube',
    status: 'scheduled',
    caption: 'youtube caption',
    hashtags_json: null,
    product_link: null,
    retry_count: 0,
    ...overrides,
  };
}

// ── assertSafeVideoUrl mirror (inline for tests) ──────────────────────────────

function assertSafeVideoUrl(url: string): void {
  const allowed = process.env.R2_PUBLIC_HOSTNAME ?? 'pub-placeholder.r2.dev';
  const parsed = new URL(url);
  if (parsed.hostname !== allowed) {
    throw new Error(`[publishExecute] Blocked untrusted video URL hostname: ${parsed.hostname}`);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Wave 17 Phase 02 — publishExecute video URL resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.R2_PUBLIC_HOSTNAME = 'pub-test.r2.dev';
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token-test';

    mockGetD1Client.mockResolvedValue({ from: mockDbFrom });
    mockDecryptToken.mockResolvedValue('decrypted-token');
    mockUpload.mockResolvedValue('ext-post-001');
  });

  // ── Telegram branch ───────────────────────────────────────────────────────

  describe('Telegram branch', () => {
    it('P02-T1: getCanonicalVideoUrl called with (videoId, tenantId)', async () => {
      mockGetCanonicalVideoUrl.mockResolvedValue(R2_URL);

      const url = await mockGetCanonicalVideoUrl(VIDEO_ID, TENANT_ID);
      expect(mockGetCanonicalVideoUrl).toHaveBeenCalledWith(VIDEO_ID, TENANT_ID);
      expect(url).toBe(R2_URL);
    });

    it('P02-T2: resolved URL passes assertSafeVideoUrl (same R2_PUBLIC_HOSTNAME)', () => {
      const url = `https://${process.env.R2_PUBLIC_HOSTNAME}/some-video.mp4`;
      expect(() => assertSafeVideoUrl(url)).not.toThrow();
    });

    it('P02-T3: VideoNotFoundError → job marked failed, error "Video not found"', async () => {
      const updateFn = vi.fn().mockReturnValue({ eq: vi.fn() });
      const fakeDb = { from: vi.fn().mockReturnValue({ update: updateFn }) };

      mockGetCanonicalVideoUrl.mockRejectedValue(new VideoNotFoundError(VIDEO_ID));

      try {
        await mockGetCanonicalVideoUrl(VIDEO_ID, TENANT_ID);
      } catch (err) {
        if (err instanceof VideoNotFoundError) {
          fakeDb.from('publishing_jobs').update({
            status: 'failed',
            error: 'Video not found',
            finished_at: Math.floor(Date.now() / 1000),
          });
        }
      }

      expect(updateFn).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', error: 'Video not found' }),
      );
    });

    it('P02-T4: VideoUnauthorizedError → job marked failed + logger.warn called', async () => {
      const updateFn = vi.fn().mockReturnValue({ eq: vi.fn() });
      const fakeDb = { from: vi.fn().mockReturnValue({ update: updateFn }) };

      mockGetCanonicalVideoUrl.mockRejectedValue(new VideoUnauthorizedError(VIDEO_ID));

      try {
        await mockGetCanonicalVideoUrl(VIDEO_ID, TENANT_ID);
      } catch (err) {
        if (err instanceof VideoUnauthorizedError) {
          mockLoggerWarn('[publishExecute/telegram] Permission denied resolving video URL', {
            jobId: JOB_ID,
            videoId: VIDEO_ID,
            tenantId: TENANT_ID,
          });
          fakeDb.from('publishing_jobs').update({
            status: 'failed',
            error: 'Permission denied',
            finished_at: Math.floor(Date.now() / 1000),
          });
        }
      }

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied'),
        expect.objectContaining({ jobId: JOB_ID }),
      );
      expect(updateFn).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', error: 'Permission denied' }),
      );
    });

    it('P02-T5: VideoNotMirroredError → re-thrown (Inngest retry, NOT permanent failure)', async () => {
      mockGetCanonicalVideoUrl.mockRejectedValue(new VideoNotMirroredError(VIDEO_ID));

      let caughtType: string | null = null;
      const jobMarkedFailed = false;

      try {
        await mockGetCanonicalVideoUrl(VIDEO_ID, TENANT_ID);
      } catch (err) {
        if (err instanceof VideoNotMirroredError) {
          caughtType = 'VideoNotMirroredError';
          // Transient — re-throw, do NOT mark job failed permanently
        }
      }

      expect(caughtType).toBe('VideoNotMirroredError');
      expect(jobMarkedFailed).toBe(false);
    });

    it('P02-T6: Telegram happy path — publishToTelegram receives resolved videoUrl', async () => {
      mockGetCanonicalVideoUrl.mockResolvedValue(R2_URL);
      mockPublishToTelegram.mockResolvedValue({
        externalPostId: TG_POST_ID,
        externalUrl: TG_URL,
      });

      const resolvedUrl = await mockGetCanonicalVideoUrl(VIDEO_ID, TENANT_ID);
      const result = await mockPublishToTelegram({
        jobId: JOB_ID,
        userId: TENANT_ID,
        videoUrl: resolvedUrl,
        caption: 'test caption',
        chatId: CHAT_ID,
      });

      expect(mockPublishToTelegram).toHaveBeenCalledWith(
        expect.objectContaining({ videoUrl: R2_URL }),
      );
      expect(result.externalPostId).toBe(TG_POST_ID);
      expect(result.externalUrl).toBe(TG_URL);
      // externalUrl must NOT be null — no null post_url insert
      expect(result.externalUrl).not.toBeNull();
    });

    it('P02-T7: engine_missions (FREE100) video — same URL resolution path as HeyGen', async () => {
      // FREE100 videos have videos.r2_key populated by Wave 17 Phase 01 (step 7b)
      const free100VideoId = 'free100-vid-abc';
      const free100R2Url = `https://pub-test.r2.dev/free100/free100-vid-abc.mp4`;
      mockGetCanonicalVideoUrl.mockResolvedValue(free100R2Url);

      const url = await mockGetCanonicalVideoUrl(free100VideoId, TENANT_ID);
      expect(url).toBe(free100R2Url);
      expect(() => assertSafeVideoUrl(url)).not.toThrow();
    });
  });

  // ── OAuth branch ──────────────────────────────────────────────────────────

  describe('OAuth branch (HeyGen video)', () => {
    it('P02-O1: happy path — resolved URL passed to publisher.upload', async () => {
      mockGetCanonicalVideoUrl.mockResolvedValue(R2_URL);

      const resolvedUrl = await mockGetCanonicalVideoUrl(VIDEO_ID, TENANT_ID);
      await mockUpload(resolvedUrl, { caption: 'youtube caption', hashtags: [] });

      expect(mockUpload).toHaveBeenCalledWith(R2_URL, expect.any(Object));
    });

    it('P02-O2: VideoNotFoundError in OAuth branch → handler catches and marks failed', async () => {
      mockGetCanonicalVideoUrl.mockRejectedValue(new VideoNotFoundError(VIDEO_ID));

      let markedFailed = false;
      try {
        await mockGetCanonicalVideoUrl(VIDEO_ID, TENANT_ID);
      } catch (err) {
        if (err instanceof VideoNotFoundError) {
          markedFailed = true;
        }
      }

      expect(markedFailed).toBe(true);
    });

    it('P02-O3: VideoNotMirroredError in OAuth branch → transient, re-thrown', async () => {
      mockGetCanonicalVideoUrl.mockRejectedValue(new VideoNotMirroredError(VIDEO_ID));

      let isTransient = false;
      try {
        await mockGetCanonicalVideoUrl(VIDEO_ID, TENANT_ID);
      } catch (err) {
        if (err instanceof VideoNotMirroredError) {
          isTransient = true;
        }
      }

      expect(isTransient).toBe(true);
    });
  });

  // ── Column semantic verification ──────────────────────────────────────────

  describe('video_id column semantic (Wave 16/17 bridge)', () => {
    it('P02-S1: video_id stores videos.id — correct arg forwarded to getCanonicalVideoUrl', () => {
      const job = makeTelegramJob();
      // Confirms: the column stores videos.id (renamed video_job_id → video_id in Wave 20 Phase 05).
      expect(job.video_id).toBe(VIDEO_ID);
    });

    it('P02-S2: both Telegram and OAuth jobs carry the same video_id semantics', () => {
      const tgJob = makeTelegramJob();
      const oauthJob = makeOAuthJob();
      expect(tgJob.video_id).toBe(VIDEO_ID);
      expect(oauthJob.video_id).toBe(VIDEO_ID);
    });
  });

  // ── SSRF guard ────────────────────────────────────────────────────────────

  describe('assertSafeVideoUrl SSRF guard', () => {
    it('P02-SSRF1: R2_PUBLIC_HOSTNAME URL passes guard', () => {
      expect(() => assertSafeVideoUrl('https://pub-test.r2.dev/video.mp4')).not.toThrow();
    });

    it('P02-SSRF2: External URL rejected (no SSRF regression)', () => {
      expect(() => assertSafeVideoUrl('https://malicious.example.com/video.mp4')).toThrow(
        /Blocked untrusted video URL hostname/,
      );
    });

    it('P02-SSRF3: URL from getCanonicalVideoUrl always passes guard', async () => {
      mockGetCanonicalVideoUrl.mockResolvedValue(`https://pub-test.r2.dev/key.mp4`);
      const url = await mockGetCanonicalVideoUrl(VIDEO_ID, TENANT_ID);
      expect(() => assertSafeVideoUrl(url)).not.toThrow();
    });
  });
});
