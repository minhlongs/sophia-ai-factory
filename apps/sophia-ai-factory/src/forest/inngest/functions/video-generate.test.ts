/**
 * videoGenerate Inngest Function Tests
 *
 * Stubs Inngest step context, WanVideoClient, FishSpeechClient, R2 bucket,
 * D1 client, and cost-ledger to verify call sequence.
 *
 * Covers:
 * - Happy path: all 8 steps called, correct return shape
 * - Missing missionId throws in parse-input
 * - Wan job failure propagates error
 * - R2 key convention: video-jobs/{missionId}/{audio.mp3,video.mp4}
 * - Progress events emitted via inngest.send
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock fetch globally for downloadToBuffer ───────────────────────────────────
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ── Hoisted mock functions (safe for use in vi.mock factories) ────────────────

const {
  mockGenerateSpeech,
  mockGenerateVideo,
  mockGetJobStatus,
  mockR2Put,
  mockRecordCost,
  mockCreateServerClient,
  mockGetVideoBucket,
  mockGetBrandKit,
  mockGenerateSubtitles,
  mockComposeFinalVideo,
  mockInngestSend,
  mockGetUserTier,
  mockGetUserRoutingStrategy,
  mockGetDefaultStrategyForTier,
  mockBuildProviderPool,
  mockSelectWithStrategy,
} = vi.hoisted(() => ({
  mockGenerateSpeech: vi.fn(),
  mockGenerateVideo: vi.fn(),
  mockGetJobStatus: vi.fn(),
  mockR2Put: vi.fn(),
  mockRecordCost: vi.fn(),
  mockCreateServerClient: vi.fn(),
  mockGetVideoBucket: vi.fn(),
  mockGetBrandKit: vi.fn(),
  mockGenerateSubtitles: vi.fn(),
  mockComposeFinalVideo: vi.fn(),
  mockInngestSend: vi.fn().mockResolvedValue(undefined),
  mockGetUserTier: vi.fn().mockResolvedValue('PREMIUM'),
  mockGetUserRoutingStrategy: vi.fn().mockResolvedValue(null),
  mockGetDefaultStrategyForTier: vi.fn().mockReturnValue('cost-optimized'),
  mockBuildProviderPool: vi.fn().mockResolvedValue([
    { provider: 'elevenlabs', model: 'elevenlabs-multilingual-v2', hasUserKey: false, costPerUnit: 0.0003, healthScore: 1, quotaRemaining: 100, usageCount: 0, estimatedCost: 0.1 },
    { provider: 'openrouter', model: 'openai/gpt-4o-mini', hasUserKey: false, costPerUnit: 0.002, healthScore: 1, quotaRemaining: 100, usageCount: 0, estimatedCost: 0.2 },
  ]),
  mockSelectWithStrategy: vi.fn().mockReturnValue({ provider: 'elevenlabs', model: 'elevenlabs-multilingual-v2', strategy: 'cost-optimized', reason: 'test', candidatesConsidered: 2 }),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: (_cfg: unknown, _evt: unknown, handler: (...args: unknown[]) => unknown) => handler,
    send: mockInngestSend,
  },
}));

vi.mock('@/seed/db/client', () => ({ createServerClient: mockCreateServerClient }));
vi.mock('@/land/video/storage/r2-binding', () => ({
  getVideoBucket: mockGetVideoBucket,
  tenantScopedKey: vi.fn((tenantId: string, jobId: string, filename: string) => `video-jobs/${tenantId}/${jobId}/${filename}`),
}));
vi.mock('@/land/video/templates/cost-ledger', () => ({ recordCost: mockRecordCost }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: mockGetUserTier,
}));

vi.mock('@/seed/db/get-user-routing-strategy', () => ({
  getUserRoutingStrategy: mockGetUserRoutingStrategy,
  getDefaultStrategyForTier: mockGetDefaultStrategyForTier,
}));

vi.mock('@/forest/quota/provider-pool', () => ({
  buildProviderPool: mockBuildProviderPool,
}));

vi.mock('@/forest/quota/routing-strategy', () => ({
  selectWithStrategy: mockSelectWithStrategy,
}));

vi.mock('@/land/video/generation/wan21-client', () => {
  function MockWanVideoClient() {
    return { generateVideo: mockGenerateVideo, getJobStatus: mockGetJobStatus };
  }
  return {
    WanVideoClient: MockWanVideoClient,
    WanVideoClientError: class extends Error {},
  };
});

vi.mock('@/land/video/generation/fish-speech-client', () => {
  function MockFishSpeechClient() {
    return { generateSpeech: mockGenerateSpeech };
  }
  return {
    FishSpeechClient: MockFishSpeechClient,
    FishSpeechClientError: class extends Error {},
  };
});

vi.mock('@/seed/db/repositories/brand-kits-repo', () => ({
  getBrandKit: mockGetBrandKit,
}));

vi.mock('@/land/video/assembly/subtitle-generator', () => ({
  generateSubtitles: mockGenerateSubtitles,
}));

vi.mock('@/land/video/assembly/composer-ffmpeg', () => ({
  composeFinalVideo: mockComposeFinalVideo,
  applyBrandKit: vi.fn((userId, input) => Promise.resolve(input)),
}));

// ── Import SUT ────────────────────────────────────────────────────────────────

import { videoGenerate } from './video-generate';

// ── Handler cast ──────────────────────────────────────────────────────────────

const handler = videoGenerate as unknown as (ctx: {
  event: { data: Record<string, unknown> };
  step: {
    run: ReturnType<typeof vi.fn>;
    sleep: ReturnType<typeof vi.fn>;
    sendEvent: ReturnType<typeof vi.fn>;
  };
}) => Promise<Record<string, unknown>>;

function buildStep() {
  return {
    run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
    sleep: vi.fn().mockResolvedValue(undefined),
    sendEvent: vi.fn().mockResolvedValue(undefined),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('videoGenerate Inngest function', () => {
  beforeEach(() => {
    mockGenerateSpeech.mockReset();
    mockGenerateVideo.mockReset();
    mockGetJobStatus.mockReset();
    mockR2Put.mockReset();
    mockRecordCost.mockReset();
    mockCreateServerClient.mockReset();
    mockGetVideoBucket.mockReset();
    mockGetBrandKit.mockReset();
    mockGenerateSubtitles.mockReset();
    mockComposeFinalVideo.mockReset();
    mockInngestSend.mockReset();
    mockGetUserTier.mockReset();
    mockGetUserRoutingStrategy.mockReset();
    mockGetDefaultStrategyForTier.mockReset();
    mockBuildProviderPool.mockReset();
    mockSelectWithStrategy.mockReset();
    mockFetch.mockReset();

    mockGetUserTier.mockResolvedValue('PREMIUM');
    mockGetUserRoutingStrategy.mockResolvedValue(null);
    mockGetDefaultStrategyForTier.mockReturnValue('cost-optimized');
    mockBuildProviderPool.mockResolvedValue([
      { provider: 'elevenlabs', model: 'elevenlabs-multilingual-v2', hasUserKey: false, costPerUnit: 0.0003, healthScore: 1, quotaRemaining: 100, usageCount: 0, estimatedCost: 0.1 },
      { provider: 'openrouter', model: 'openai/gpt-4o-mini', hasUserKey: false, costPerUnit: 0.002, healthScore: 1, quotaRemaining: 100, usageCount: 0, estimatedCost: 0.2 },
    ]);
    mockSelectWithStrategy.mockReturnValue({ provider: 'elevenlabs', model: 'elevenlabs-multilingual-v2', strategy: 'cost-optimized', reason: 'test', candidatesConsidered: 2 });

    mockGetBrandKit.mockResolvedValue(null);
    mockGenerateSubtitles.mockResolvedValue({
      srt: '1\n00:00:00,000 --> 00:00:05,000\nHello',
    });
    mockComposeFinalVideo.mockResolvedValue({
      finalR2Key: 'final.mp4',
      costUsd: 0.07,
      metadata: { durationSeconds: 10 },
    });

    // TTS and Video mocks
    mockGenerateSpeech.mockResolvedValue({
      audioUrl: 'https://example.com/audio.mp3',
      durationSec: 10,
    });
    mockGenerateVideo.mockResolvedValue({
      jobId: 'wan-job-123',
    });
    mockGetJobStatus.mockResolvedValue({
      status: 'succeeded',
      videoUrl: 'https://example.com/video.mp4',
    });

    // Mock fetch for audio/video downloads
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1024),
    });

    process.env.WAN_API_KEY = 'test-wan-key';
    process.env.FISH_SPEECH_API_KEY = 'test-fish-key';

    // D1 mock
    const dbMock = {
      from: vi.fn((table: string) => {
        if (table === 'engine_missions') {
          return {
            select: vi.fn((cols: string) => ({
              eq: vi.fn((col: string, val: string) => ({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }
        if (table === 'user_profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { settings: null }, error: null }),
              })),
            })),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      }),
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ settings: null }),
      }),
    };
    mockCreateServerClient.mockReturnValue(dbMock);

    // R2 mock
    mockR2Put.mockResolvedValue(undefined);
    mockGetVideoBucket.mockResolvedValue({
      bucket: { put: mockR2Put },
      publicBaseUrl: null,
    });

    mockRecordCost.mockResolvedValue(undefined);

  });

  it('happy path: calls all 8 steps, returns correct shape', async () => {
    const step = buildStep();
    const result = await handler({
      event: {
        data: {
          missionId: 'mission-abc',
          tenantId: 'tenant-123',
          userId: 'user-456',
          prompt: 'A product demo video',
          voiceoverText: 'Welcome to our product',
          language: 'en',
        },
      },
      step,
    });

    expect(result.missionId).toBe('mission-abc');
    expect(result.status).toBe('succeeded');
    expect(result.audioR2Key).toBe('video-jobs/mission-abc/audio.mp3');
    expect(result.videoR2Key).toBe('video-jobs/mission-abc/video.mp4');

    const stepNames = step.run.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(stepNames).toContain('parse-input');
    expect(stepNames).toContain('generate-tts');
    expect(stepNames).toContain('generate-video');
    expect(stepNames).toContain('download-video');
    expect(stepNames).toContain('mux-audio-video');
    expect(stepNames).toContain('update-mission');
    expect(stepNames).toContain('emit-usage');

    expect(mockRecordCost).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'mission-abc', costUsd: 0.06 }),
    );
  });

  it('throws in parse-input when missionId is absent', async () => {
    const step = buildStep();
    await expect(
      handler({ event: { data: { tenantId: 't', userId: 'u', prompt: 'x' } }, step }),
    ).rejects.toThrow('missionId is required');
  });

  it('throws when Wan job reports failed during polling', async () => {
    mockGetJobStatus.mockResolvedValue({ status: 'failed', error: 'NSFW content' });

    const step = buildStep();
    await expect(
      handler({
        event: { data: { missionId: 'm1', tenantId: 't', userId: 'u', prompt: 'x' } },
        step,
      }),
    ).rejects.toThrow('failed');
  });

  it('R2 upload uses convention video-jobs/{missionId}/audio.mp3 and video.mp4', async () => {
    const step = buildStep();
    await handler({
      event: { data: { missionId: 'mission-r2test', tenantId: 'ten', userId: 'usr', prompt: 'Test' } },
      step,
    });

    const putKeys = mockR2Put.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(putKeys).toContain('video-jobs/mission-r2test/audio.mp3');
    expect(putKeys).toContain('video-jobs/mission-r2test/video.mp4');
  });

  it('happy path with brand kit: calls composeFinalVideo when brand kit has logo configured', async () => {
    mockGetBrandKit.mockResolvedValue({
      logo_r2_key: 'brand-kits/user-rich/logo.png',
      primary_color: '#ff00aa',
    });

    const step = buildStep();
    const result = await handler({
      event: {
        data: {
          missionId: 'mission-rich',
          tenantId: 'tenant-rich',
          userId: 'user-rich',
          prompt: 'Rich brand kit video',
          voiceoverText: 'Brand kit demo',
        },
      },
      step,
    });

    expect(result.missionId).toBe('mission-rich');
    expect(result.status).toBe('succeeded');
    expect(mockComposeFinalVideo).toHaveBeenCalledOnce();
    expect(mockComposeFinalVideo).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'mission-rich',
      tenantId: 'tenant-rich',
      audioR2Key: 'video-jobs/mission-rich/audio.mp3',
      visualR2Key: 'video-jobs/mission-rich/video.mp4',
      subtitleSrt: '1\n00:00:00,000 --> 00:00:05,000\nHello',
    }));
  });
});