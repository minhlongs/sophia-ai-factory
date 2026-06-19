/**
 * Unit tests for the autonomous video-gen orchestrator.
 *
 * The orchestrator chains 4 land helpers. Every helper + the engine_missions
 * D1 writes are mocked so the test stays hermetic and never hits an
 * OpenRouter / ElevenLabs / Cloudflare edge.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/land/scripts/generate-seo-script', () => ({
  generateSeoScript: vi.fn(),
  SeoScriptConfigurationError: class extends Error {
    code: 'BYOK_REQUIRED' | 'EMPTY_TOPIC';
    constructor(code: 'BYOK_REQUIRED' | 'EMPTY_TOPIC', message: string) {
      super(message);
      this.code = code;
      this.name = 'SeoScriptConfigurationError';
    }
  },
}));

vi.mock('@/land/i18n/translate-script', () => ({
  translateScript: vi.fn(),
  TranslateConfigurationError: class extends Error {
    code: 'BYOK_REQUIRED' | 'BYOK_DISABLED' | 'EMPTY_TEXT';
    constructor(code: 'BYOK_REQUIRED' | 'BYOK_DISABLED' | 'EMPTY_TEXT', message: string) {
      super(message);
      this.code = code;
      this.name = 'TranslateConfigurationError';
    }
  },
}));

vi.mock('@/land/affiliates/video-description-injector', () => ({
  buildVideoDescription: vi.fn(),
}));

vi.mock('@/land/publish/schedule-video-publish', () => ({
  schedulePublish: vi.fn(),
  PublishConfigurationError: class extends Error {
    code: 'VIDEO_NOT_FOUND' | 'CHANNEL_NOT_FOUND' | 'FORBIDDEN' | 'SCHEDULED_IN_PAST' | 'INVALID_INPUT';
    constructor(code: 'VIDEO_NOT_FOUND' | 'CHANNEL_NOT_FOUND' | 'FORBIDDEN' | 'SCHEDULED_IN_PAST' | 'INVALID_INPUT', message: string) {
      super(message);
      this.code = code;
      this.name = 'PublishConfigurationError';
    }
  },
}));

vi.mock('@/land/video/generation/render-byok-video', () => ({
  submitByokVideo: vi.fn(),
  RenderByokVideoError: class extends Error {
    code: 'BYOK_REQUIRED' | 'EMPTY_SCRIPT' | 'HEYGEN_SUBMIT_FAILED' | 'PERSIST_FAILED';
    constructor(code: 'BYOK_REQUIRED' | 'EMPTY_SCRIPT' | 'HEYGEN_SUBMIT_FAILED' | 'PERSIST_FAILED', message: string) {
      super(message);
      this.code = code;
      this.name = 'RenderByokVideoError';
    }
  },
}));

const mockRun = vi.fn().mockResolvedValue({});
const mockBind = vi.fn(() => ({ run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(() => ({ prepare: mockPrepare })),
}));

import { generateSeoScript, SeoScriptConfigurationError } from '@/land/scripts/generate-seo-script';
import { translateScript } from '@/land/i18n/translate-script';
import { buildVideoDescription } from '@/land/affiliates/video-description-injector';
import { schedulePublish, PublishConfigurationError } from '@/land/publish/schedule-video-publish';
import { submitByokVideo, RenderByokVideoError } from '@/land/video/generation/render-byok-video';
import {
  runAutoVideoMission,
  AutoVideoMissionError,
} from '@/land/missions/auto-video-mission';

const mockedGenerateSeoScript = vi.mocked(generateSeoScript);
const mockedTranslateScript = vi.mocked(translateScript);
const mockedBuildVideoDescription = vi.mocked(buildVideoDescription);
const mockedSchedulePublish = vi.mocked(schedulePublish);
const mockedSubmitByokVideo = vi.mocked(submitByokVideo);

describe('runAutoVideoMission', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRun.mockResolvedValue({});
    mockBind.mockImplementation(() => ({ run: mockRun }));
    mockPrepare.mockImplementation(() => ({ bind: mockBind }));
    // Default: HeyGen key absent — orchestrator soft-skips render step.
    mockedSubmitByokVideo.mockRejectedValue(
      new RenderByokVideoError('BYOK_REQUIRED', 'no key'),
    );
  });

  it('chains script + description and returns mission row when no secondary lang / channel', async () => {
    mockedGenerateSeoScript.mockResolvedValue({
      script: '# Fashion Trends\n\nBody text.',
      suggestedTitles: ['Title A', 'Title B', 'Title C'],
      seoScore: 82,
      keywordCoverage: [],
      wordCount: 220,
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      source: 'user',
    });
    mockedBuildVideoDescription.mockResolvedValue({
      description: 'Body text.\n\n🔗 Resources mentioned:\n• Offer: https://x/?ref=abc',
      links: [],
      affiliateCount: 1,
      appliedNicheBoost: false,
    });

    const result = await runAutoVideoMission({
      userId: 'user_1',
      topic: 'fashion trends 2026',
    });

    expect(result.status).toBe('succeeded');
    expect(result.missionId).toMatch(/^[0-9a-f]{32}$/);
    expect(result.script.primary.seoScore).toBe(82);
    expect(result.script.secondary).toBeUndefined();
    expect(result.description.affiliateCount).toBe(1);
    expect(result.publish).toBeUndefined();
    expect(mockedSchedulePublish).not.toHaveBeenCalled();
  });

  it('translates when secondaryLanguage differs from primary', async () => {
    mockedGenerateSeoScript.mockResolvedValue({
      script: '# Title\n\nBody.',
      suggestedTitles: ['T'],
      seoScore: 70,
      keywordCoverage: [],
      wordCount: 100,
      model: 'm',
      source: 'user',
    });
    mockedTranslateScript.mockResolvedValue({
      translated: '# Tựa đề\n\nNội dung.',
      model: 'm',
      source: 'user',
      charsIn: 10,
      charsOut: 10,
    });
    mockedBuildVideoDescription.mockResolvedValue({
      description: 'Body.',
      links: [],
      affiliateCount: 0,
      appliedNicheBoost: false,
    });

    const result = await runAutoVideoMission({
      userId: 'user_1',
      topic: 'something',
      primaryLanguage: 'en',
      secondaryLanguage: 'vi',
    });

    expect(result.script.secondary?.language).toBe('vi');
    expect(result.script.secondary?.body).toBe('# Tựa đề\n\nNội dung.');
    expect(mockedTranslateScript).toHaveBeenCalledOnce();
  });

  it('schedules publish when channelId is supplied and HeyGen BYOK is configured', async () => {
    mockedGenerateSeoScript.mockResolvedValue({
      script: 'body',
      suggestedTitles: ['Hello world'],
      seoScore: 60,
      keywordCoverage: [],
      wordCount: 50,
      model: 'm',
      source: 'user',
    });
    mockedBuildVideoDescription.mockResolvedValue({
      description: 'd',
      links: [],
      affiliateCount: 0,
      appliedNicheBoost: false,
    });
    // HeyGen BYOK present — render succeeds with a real videoId
    mockedSubmitByokVideo.mockReset();
    mockedSubmitByokVideo.mockResolvedValue({
      videoId: 'vid_real_byok',
      heygenJobId: 'hg_job_1',
      status: 'processing',
    });
    mockedSchedulePublish.mockResolvedValue({
      jobId: 'job_abc',
      scheduledAt: 1234567890,
      status: 'scheduled',
    });

    const result = await runAutoVideoMission({
      userId: 'user_1',
      topic: 't',
      channelId: 'ch_yt',
      scheduledAt: 1234567890,
    });

    expect(result.publish).toEqual({ jobId: 'job_abc', scheduledAt: 1234567890 });
    expect(mockedSchedulePublish).toHaveBeenCalledOnce();
    const arg = mockedSchedulePublish.mock.calls[0][0];
    expect(arg.caption).toBe('Hello world');
    expect(arg.videoId).toBe('vid_real_byok');
  });

  it('skips publish and surfaces no_byok reason when HeyGen key absent (F6 fix)', async () => {
    // Default beforeEach: submitByokVideo rejects with BYOK_REQUIRED
    mockedGenerateSeoScript.mockResolvedValue({
      script: 'body',
      suggestedTitles: ['T'],
      seoScore: 60,
      keywordCoverage: [],
      wordCount: 50,
      model: 'm',
      source: 'user',
    });
    mockedBuildVideoDescription.mockResolvedValue({
      description: 'd',
      links: [],
      affiliateCount: 0,
      appliedNicheBoost: false,
    });

    const result = await runAutoVideoMission({
      userId: 'u',
      topic: 't',
      channelId: 'ch',
    });

    expect(result.status).toBe('succeeded');
    // schedulePublish MUST NOT be called when there is no real videoId
    expect(mockedSchedulePublish).not.toHaveBeenCalled();
    // publish field surfaces the skip reason
    expect(result.publish).toEqual({ skipped: true, reason: 'no_byok' });
  });

  it('rejects empty topic', async () => {
    await expect(runAutoVideoMission({ userId: 'u', topic: '   ' })).rejects.toMatchObject({
      code: 'EMPTY_TOPIC',
    });
  });

  it('marks mission failed with BYOK_REQUIRED when script step lacks key', async () => {
    mockedGenerateSeoScript.mockRejectedValue(
      new SeoScriptConfigurationError('BYOK_REQUIRED', 'add OpenRouter key in Setup Wizard'),
    );

    await expect(
      runAutoVideoMission({ userId: 'u', topic: 'x' }),
    ).rejects.toMatchObject({
      code: 'BYOK_REQUIRED',
      missionId: expect.stringMatching(/^[0-9a-f]{32}$/),
    });
  });

  it('propagates SCRIPT_FAILED on unexpected script error', async () => {
    mockedGenerateSeoScript.mockRejectedValue(new Error('network down'));

    await expect(
      runAutoVideoMission({ userId: 'u', topic: 'x' }),
    ).rejects.toBeInstanceOf(AutoVideoMissionError);
  });

  it('submits HeyGen render when BYOK key is configured + threads videoId into schedule', async () => {
    mockedGenerateSeoScript.mockResolvedValue({
      script: '# T\n\nBody.',
      suggestedTitles: ['Hello'],
      seoScore: 75,
      keywordCoverage: [],
      wordCount: 120,
      model: 'm',
      source: 'user',
    });
    mockedBuildVideoDescription.mockResolvedValue({
      description: 'd',
      links: [],
      affiliateCount: 0,
      appliedNicheBoost: false,
    });
    mockedSubmitByokVideo.mockReset();
    mockedSubmitByokVideo.mockResolvedValue({
      videoId: 'vid_real',
      heygenJobId: 'hg_job',
      status: 'processing',
    });
    mockedSchedulePublish.mockResolvedValue({
      jobId: 'job_xyz',
      scheduledAt: 1234,
      status: 'scheduled',
    });

    const result = await runAutoVideoMission({
      userId: 'u',
      topic: 't',
      channelId: 'ch_yt',
      scheduledAt: 1234,
    });

    expect(result.video).toEqual({ videoId: 'vid_real', heygenJobId: 'hg_job', status: 'processing' });
    // Narrow union: this branch always has jobId (BYOK key present → schedulePublish succeeded)
    const pub = result.publish as { jobId: string; scheduledAt: number } | undefined;
    expect(pub?.jobId).toBe('job_xyz');
    const scheduleCall = mockedSchedulePublish.mock.calls[0][0];
    expect(scheduleCall.videoId).toBe('vid_real');
  });

  it('fails the mission with VIDEO_RENDER_FAILED on HeyGen submit error', async () => {
    mockedGenerateSeoScript.mockResolvedValue({
      script: 'body',
      suggestedTitles: ['T'],
      seoScore: 60,
      keywordCoverage: [],
      wordCount: 50,
      model: 'm',
      source: 'user',
    });
    mockedBuildVideoDescription.mockResolvedValue({
      description: 'd',
      links: [],
      affiliateCount: 0,
      appliedNicheBoost: false,
    });
    mockedSubmitByokVideo.mockReset();
    mockedSubmitByokVideo.mockRejectedValue(
      new RenderByokVideoError('HEYGEN_SUBMIT_FAILED', '402 payment required'),
    );

    await expect(
      runAutoVideoMission({ userId: 'u', topic: 't' }),
    ).rejects.toMatchObject({ code: 'VIDEO_RENDER_FAILED' });
  });
});
