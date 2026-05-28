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
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mock functions (safe for use in vi.mock factories) ────────────────

const {
  mockGenerateSpeech,
  mockGenerateVideo,
  mockGetJobStatus,
  mockR2Put,
  mockRecordCost,
  mockGetD1Client,
  mockGetVideoBucket,
  mockGetBrandKit,
  mockGenerateSubtitles,
  mockComposeFinalVideo,
} = vi.hoisted(() => ({
  mockGenerateSpeech: vi.fn(),
  mockGenerateVideo: vi.fn(),
  mockGetJobStatus: vi.fn(),
  mockR2Put: vi.fn(),
  mockRecordCost: vi.fn(),
  mockGetD1Client: vi.fn(),
  mockGetVideoBucket: vi.fn(),
  mockGetBrandKit: vi.fn(),
  mockGenerateSubtitles: vi.fn(),
  mockComposeFinalVideo: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/forest/inngest/client', () => ({
  inngest: {
    createFunction: (_cfg: unknown, _evt: unknown, handler: (...args: unknown[]) => unknown) => handler,
  },
}));

vi.mock('@/seed/db/client', () => ({ getD1Client: mockGetD1Client }));
vi.mock('@/lib/video/r2-binding', () => ({ getVideoBucket: mockGetVideoBucket }));
vi.mock('@/lib/video/cost-ledger', () => ({ recordCost: mockRecordCost }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/video/wan21-client', () => {
  function MockWanVideoClient() {
    return { generateVideo: mockGenerateVideo, getJobStatus: mockGetJobStatus };
  }
  return {
    WanVideoClient: MockWanVideoClient,
    WanVideoClientError: class extends Error {},
  };
});

vi.mock('@/lib/video/fish-speech-client', () => {
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

vi.mock('@/lib/video/subtitle-generator', () => ({
  generateSubtitles: mockGenerateSubtitles,
}));

vi.mock('@/lib/video/composer-ffmpeg', () => ({
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
    mockGetD1Client.mockReset();
    mockGetVideoBucket.mockReset();
    mockGetBrandKit.mockReset();
    mockGenerateSubtitles.mockReset();
    mockComposeFinalVideo.mockReset();

    mockGetBrandKit.mockResolvedValue(null);
    mockGenerateSubtitles.mockResolvedValue({ srt: '1\n00:00:00,000 --> 00:00:05,000\nHello' });
    mockComposeFinalVideo.mockResolvedValue({ finalR2Key: 'final.mp4', costUsd: 0.07, metadata: { durationSeconds: 10 } });

    process.env.WAN_API_KEY = 'test-wan-key';
    process.env.FISH_SPEECH_API_KEY = 'test-fish-key';

    // D1 mock
    const dbMock = {
      from: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockGetD1Client.mockResolvedValue(dbMock);

    // R2 mock
    mockR2Put.mockResolvedValue(undefined);
    mockGetVideoBucket.mockResolvedValue({
      bucket: { put: mockR2Put },
      publicBaseUrl: null,
    });

    mockRecordCost.mockResolvedValue(undefined);

    // Fish Speech
    mockGenerateSpeech.mockResolvedValue({
      audioUrl: 'https://fal.media/audio.mp3',
      durationSec: 8,
    });

    // Wan
    mockGenerateVideo.mockResolvedValue({ jobId: 'pred-test-001', status: 'starting' });
    let pollCount = 0;
    mockGetJobStatus.mockImplementation(async () => {
      pollCount++;
      if (pollCount < 2) return { status: 'processing' };
      return { status: 'succeeded', videoUrl: 'https://cdn.replicate.delivery/final.mp4' };
    });

    // fetch for download
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));
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
