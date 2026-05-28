import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockUpdateRepurposeClipStatus,
  mockIncrementRepurposeProgress,
  mockGenerateSubtitles,
  mockComposeFinalVideo,
  mockPrepare,
} = vi.hoisted(() => ({
  mockUpdateRepurposeClipStatus: vi.fn(),
  mockIncrementRepurposeProgress: vi.fn(),
  mockGenerateSubtitles: vi.fn(),
  mockComposeFinalVideo: vi.fn(),
  mockPrepare: vi.fn(),
}));

vi.mock('@/forest/inngest/client', () => ({
  inngest: {
    createFunction: (_cfg: unknown, _evt: unknown, handler: (...args: unknown[]) => unknown) => handler,
  },
}));

vi.mock('@/seed/db/repositories/repurpose-jobs-repo', () => ({
  updateRepurposeClipStatus: mockUpdateRepurposeClipStatus,
  incrementRepurposeProgress: mockIncrementRepurposeProgress,
}));

vi.mock('@/seed/db/client', () => ({
  getD1Raw: vi.fn(async () => ({
    prepare: mockPrepare,
  })),
}));

vi.mock('@/lib/video/subtitle-generator', () => ({
  generateSubtitles: mockGenerateSubtitles,
}));

vi.mock('@/lib/video/composer-ffmpeg', () => ({
  composeFinalVideo: mockComposeFinalVideo,
  applyBrandKit: vi.fn((_userId, input) => Promise.resolve(input)),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { repurposeClipGenerate } from './repurpose-clip-generate';

const handler = repurposeClipGenerate as unknown as (ctx: {
  event: { data: Record<string, unknown> };
  step: {
    run: ReturnType<typeof vi.fn>;
  };
}) => Promise<Record<string, unknown>>;

function buildStep() {
  return {
    run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
  };
}

describe('repurposeClipGenerate Inngest function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: fetches DB, calls generateSubtitles, applies brand kit, and composes video', async () => {
    // 1. Mock first DB call (job query)
    const mockFirstQuery = {
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ source_video_id: 'source-vid-1' }),
      }),
    };

    // 2. Mock second DB call (video query)
    const mockSecondQuery = {
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ video_url: 'https://r2.test/video.mp4', r2_key: 'video-jobs/source-vid-1/video.mp4' }),
      }),
    };

    mockPrepare
      .mockReturnValueOnce(mockFirstQuery)
      .mockReturnValueOnce(mockSecondQuery);

    mockGenerateSubtitles.mockResolvedValue({ srt: '1\n00:00:00,000 --> 00:00:05,000\nHello' });
    mockComposeFinalVideo.mockResolvedValue({ finalR2Key: 'tenants/user-1/videos/clip-1/final.mp4' });

    const step = buildStep();
    const result = await handler({
      event: {
        data: {
          clipId: 'clip-1',
          jobId: 'job-1',
          videoUrl: '',
          startMs: 2000,
          endMs: 8000,
          userId: 'user-1',
        },
      },
      step,
    });

    expect(result.clipId).toBe('clip-1');
    expect(result.outputVideoId).toBe('tenants/user-1/videos/clip-1/final.mp4');

    expect(mockUpdateRepurposeClipStatus).toHaveBeenCalledWith('clip-1', 'generating');
    expect(mockGenerateSubtitles).toHaveBeenCalledWith({
      audioR2Key: 'video-jobs/source-vid-1/audio.mp3',
      jobId: 'job-1',
    });
    expect(mockComposeFinalVideo).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'clip-1',
      tenantId: 'user-1',
      visualR2Key: 'video-jobs/source-vid-1/video.mp4',
      startSec: 2,
      endSec: 8,
      cropVertical: true,
    }));
    expect(mockUpdateRepurposeClipStatus).toHaveBeenCalledWith('clip-1', 'done', 'tenants/user-1/videos/clip-1/final.mp4');
    expect(mockIncrementRepurposeProgress).toHaveBeenCalledWith('job-1');
  });

  it('throws error if repurpose job is not found', async () => {
    const mockFirstQuery = {
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
      }),
    };

    mockPrepare.mockReturnValueOnce(mockFirstQuery);

    const step = buildStep();
    await expect(
      handler({
        event: {
          data: {
            clipId: 'clip-1',
            jobId: 'job-invalid',
            videoUrl: '',
            startMs: 2000,
            endMs: 8000,
            userId: 'user-1',
          },
        },
        step,
      })
    ).rejects.toThrow('Repurpose job job-invalid not found');

    expect(mockUpdateRepurposeClipStatus).toHaveBeenCalledWith('clip-1', 'generating');
    expect(mockComposeFinalVideo).not.toHaveBeenCalled();
  });

  it('throws error if source video is not found', async () => {
    const mockFirstQuery = {
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ source_video_id: 'source-missing' }),
      }),
    };
    const mockSecondQuery = {
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
      }),
    };

    mockPrepare
      .mockReturnValueOnce(mockFirstQuery)
      .mockReturnValueOnce(mockSecondQuery);

    const step = buildStep();
    await expect(
      handler({
        event: {
          data: {
            clipId: 'clip-1',
            jobId: 'job-1',
            videoUrl: '',
            startMs: 2000,
            endMs: 8000,
            userId: 'user-1',
          },
        },
        step,
      })
    ).rejects.toThrow('Source video source-missing not found');
  });
});
