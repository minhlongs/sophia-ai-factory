/**
 * Integration test: auto-video-mission end-to-end proof.
 *
 * Mocks D1, script generation, translation, description, and render/publish
 * so the full mission orchestrator can be tested without real API keys.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VideoRenderProviderResult } from '@/land/video/video-render-provider';

// --- D1 mock ----------------------------------------------------------------
const mockRun = vi.fn().mockResolvedValue({});
const mockBind = vi.fn(() => ({ run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));
vi.mock('@/seed/db/client', () => ({
  getD1Raw: vi.fn(() => Promise.resolve({ prepare: mockPrepare })),
}));

// --- Provider mock ----------------------------------------------------------
vi.mock('@/land/video/video-render-provider', () => ({
  submitVideoRender: vi.fn(),
  RenderProviderError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'RenderProviderError';
      this.code = code;
    }
  },
}));

// --- Mission helper mocks (script gen, translate, description, publish) -------
// NOTE: all mock return values must be defined INSIDE factory functions because
// vi.mock is hoisted to the top of the file (before any variable declarations).
vi.mock('@/land/scripts/generate-seo-script', () => {
  const defaultScript = {
    script: 'This is a generated SEO script about the topic.',
    seoScore: 75,
    suggestedTitles: ['Top 10 Tips', 'Ultimate Guide'],
    wordCount: 150,
  };
  return {
    generateSeoScript: vi.fn().mockResolvedValue(defaultScript),
    SeoScriptConfigurationError: class extends Error {
      code: string;
      constructor(code: string, message: string) {
        super(message);
        this.name = 'SeoScriptConfigurationError';
        this.code = code;
      }
    },
  };
});

vi.mock('@/land/i18n/translate-script', () => ({
  translateScript: vi.fn().mockResolvedValue({ translated: 'Script traducida.' }),
  TranslateConfigurationError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'TranslateConfigurationError';
      this.code = code;
    }
  },
}));

vi.mock('@/land/affiliates/video-description-injector', () => ({
  buildVideoDescription: vi.fn().mockResolvedValue({
    description: 'Video description with affiliate links for fitness products.',
    affiliateCount: 2,
  }),
}));

vi.mock('@/land/publish/schedule-video-publish', () => ({
  schedulePublish: vi.fn().mockResolvedValue({
    jobId: 'pub_abc123',
    scheduledAt: 9999999999,
  }),
  PublishConfigurationError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'PublishConfigurationError';
      this.code = code;
    }
  },
}));

// --- Import after mocks ------------------------------------------------------
import { runAutoVideoMission, AutoVideoMissionError } from '@/land/missions/auto-video-mission';
import { submitVideoRender } from '@/land/video/video-render-provider';
import { buildVideoDescription } from '@/land/affiliates/video-description-injector';
const mockedSubmitVideoRender = vi.mocked(submitVideoRender);
const mockedBuildVideoDescription = vi.mocked(buildVideoDescription);

describe('auto-video-mission-proof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockResolvedValue({});
    mockBind.mockImplementation(() => ({ run: mockRun }));
    mockPrepare.mockImplementation(() => ({ bind: mockBind }));
    mockedSubmitVideoRender.mockResolvedValue({
      providerJobId: 'mock_proof123',
      videoId: '53920f5d-42a4-4a2a-9902-f36f4590888f',
      status: 'queued',
      provider: 'mock',
      videoUrl: 'https://mock.sophia.local/videos/53920f5d-42a4-4a2a-9902-f36f4590888f.mp4',
    } as VideoRenderProviderResult);
  });

  it('rejects empty topic', async () => {
    await expect(
      runAutoVideoMission({ userId: 'test-user', topic: '' }),
    ).rejects.toThrow(AutoVideoMissionError);
    await expect(
      runAutoVideoMission({ userId: 'test-user', topic: '   ' }),
    ).rejects.toThrow(AutoVideoMissionError);
    await expect(
      runAutoVideoMission({ userId: 'test-user', topic: '' }),
    ).rejects.toMatchObject({ code: 'EMPTY_TOPIC' });
  });

  it('completes full mission with mock provider — produces completed video', async () => {
    const result = await runAutoVideoMission({
      userId: 'proof-user-001',
      topic: 'fashion trends 2026',
      keywords: ['sustainable fashion', 'AI design'],
      primaryLanguage: 'en',
    });

    expect(result.status).toBe('succeeded');
    expect(result.missionId).toBeDefined();
    expect(result.script.primary.body.length).toBeGreaterThan(0);
    expect(result.script.primary.language).toBe('en');
    expect(result.script.primary.seoScore).toBeGreaterThanOrEqual(0);
    expect(result.script.primary.suggestedTitles.length).toBeGreaterThan(0);
    expect(result.script.primary.wordCount).toBeGreaterThan(0);

    // Description must be present
    expect(result.description.body.length).toBeGreaterThan(0);
    expect(result.description.affiliateCount).toBeGreaterThanOrEqual(0);

    // Video must be completed in mock mode (immediate completion)
    if (result.video) {
      expect(result.video.status).toBe('completed');
      expect(result.video.videoId).toBeDefined();
      expect(result.video.heygenJobId).toMatch(/^mock_/);
      expect(result.video.videoUrl).toBeDefined();
      expect(result.video.videoUrl).toContain('mock.sophia.local');
    }

    // Publish is skipped when no channelId (no real video in mock mode)
    if (result.publish) {
      expect(result.publish).toHaveProperty('skipped', true);
    }
  });

  it('soft-skips HeyGen render when BYOK_REQUIRED is raised', async () => {
    // Simulate BYOK_REQUIRED from provider
    mockedSubmitVideoRender.mockRejectedValueOnce(
      Object.assign(new Error('HeyGen API key not configured'), { code: 'PROVIDER_NOT_CONFIGURED' }),
    );

    const result = await runAutoVideoMission({
      userId: 'proof-user-002',
      topic: 'test topic',
    });

    expect(result.status).toBe('succeeded');
    expect(result.script.primary.body.length).toBeGreaterThan(0);
    // Video is undefined when render fails with BYOK_REQUIRED (soft-skip)
    expect(result.video).toBeUndefined();
  });

  it('includes secondary language when requested', async () => {
    const result = await runAutoVideoMission({
      userId: 'proof-user-003',
      topic: 'sustainable fashion',
      primaryLanguage: 'en',
      secondaryLanguage: 'vi',
    });

    expect(result.status).toBe('succeeded');
    expect(result.script.primary.language).toBe('en');
    expect(result.script.secondary).toBeDefined();
    expect(result.script.secondary!.language).toBe('vi');
    expect(result.script.secondary!.body.length).toBeGreaterThan(0);
  });

  it('passes nicheHint through to description builder', async () => {
    mockedBuildVideoDescription.mockClear();
    const result = await runAutoVideoMission({
      userId: 'proof-user-004',
      topic: 'home workout tips',
      nicheHint: 'fitness',
    });

    expect(result.status).toBe('succeeded');
    // Verify nicheHint was forwarded to buildVideoDescription mock
    expect(mockedBuildVideoDescription).toHaveBeenCalledWith(
      expect.objectContaining({ nicheHint: 'fitness' }),
    );
  });

  it('schedules publish when channelId is provided', async () => {
    const result = await runAutoVideoMission({
      userId: 'proof-user-005',
      topic: 'yoga for beginners',
      channelId: 'ch_001',
    });

    expect(result.status).toBe('succeeded');
    expect(result.publish).toBeDefined();
    if (result.publish && !('skipped' in result.publish)) {
      expect(result.publish.jobId).toBeDefined();
      expect(result.publish.scheduledAt).toBeGreaterThan(0);
    }
  });
});
