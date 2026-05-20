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

const mockRun = vi.fn().mockResolvedValue({});
const mockBind = vi.fn(() => ({ run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));
vi.mock('@/seed/db/client', () => ({
  getD1Raw: vi.fn(() => Promise.resolve({ prepare: mockPrepare })),
}));

import { generateSeoScript, SeoScriptConfigurationError } from '@/land/scripts/generate-seo-script';
import { translateScript } from '@/land/i18n/translate-script';
import { buildVideoDescription } from '@/land/affiliates/video-description-injector';
import { schedulePublish, PublishConfigurationError } from '@/land/publish/schedule-video-publish';
import {
  runAutoVideoMission,
  AutoVideoMissionError,
} from '@/land/missions/auto-video-mission';

const mockedGenerateSeoScript = vi.mocked(generateSeoScript);
const mockedTranslateScript = vi.mocked(translateScript);
const mockedBuildVideoDescription = vi.mocked(buildVideoDescription);
const mockedSchedulePublish = vi.mocked(schedulePublish);

describe('runAutoVideoMission', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRun.mockResolvedValue({});
    mockBind.mockImplementation(() => ({ run: mockRun }));
    mockPrepare.mockImplementation(() => ({ bind: mockBind }));
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

  it('schedules publish when channelId is supplied', async () => {
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
  });

  it('soft-fails publish when video row not yet created', async () => {
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
    mockedSchedulePublish.mockRejectedValue(
      new PublishConfigurationError('VIDEO_NOT_FOUND', 'no video row'),
    );

    const result = await runAutoVideoMission({
      userId: 'u',
      topic: 't',
      channelId: 'ch',
    });

    expect(result.status).toBe('succeeded');
    expect(result.publish).toBeUndefined();
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
});
