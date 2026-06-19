import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockDetectScenes,
  mockScoreHighlights,
  mockMergeClipBoundaries,
  mockInsertRepurposeClips,
  mockUpdateRepurposeJobStatus,
} = vi.hoisted(() => ({
  mockDetectScenes: vi.fn(),
  mockScoreHighlights: vi.fn(),
  mockMergeClipBoundaries: vi.fn(),
  mockInsertRepurposeClips: vi.fn(),
  mockUpdateRepurposeJobStatus: vi.fn(),
}));

vi.mock('@/forest/inngest/client', () => ({
  inngest: {
    createFunction: (_cfg: unknown, _evt: unknown, handler: (...args: unknown[]) => unknown) => handler,
  },
}));

vi.mock('@/land/video/templates/scene-detector', () => ({ detectScenes: mockDetectScenes }));
vi.mock('@/land/video/generation/highlight-scorer', () => ({ scoreHighlights: mockScoreHighlights }));
vi.mock('@/land/video/assembly/clip-boundary-merger', () => ({
  mergeClipBoundaries: mockMergeClipBoundaries,
}));
vi.mock('@/seed/db/repositories/repurpose-jobs-repo', () => ({
  insertRepurposeClips: mockInsertRepurposeClips,
  updateRepurposeJobStatus: mockUpdateRepurposeJobStatus,
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { repurposeAnalyze } from './repurpose-analyze';

const handler = repurposeAnalyze as unknown as (ctx: {
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

describe('repurposeAnalyze Inngest function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectScenes.mockResolvedValue([{ timestamp_ms: 1000 }]);
    mockScoreHighlights.mockResolvedValue([{ start_ms: 0, end_ms: 5000, score: 0.9, title: 'Highlight' }]);
    mockMergeClipBoundaries.mockResolvedValue([{ start_ms: 0, end_ms: 5000, score: 0.9, title: 'Merged' }]);
  });

  it('runs steps in parallel and saves manifest', async () => {
    const step = buildStep();
    const result = await handler({
      event: {
        data: {
          jobId: 'job-rep-1',
          userId: 'user-rep-1',
          videoUrl: 'https://r2.test/video.mp4',
          transcript: [
            { text: 'Hello', start_ms: 0, end_ms: 1000 }
          ]
        }
      },
      step,
    });

    expect(result.jobId).toBe('job-rep-1');
    expect(result.clipCount).toBe(1);
    expect(mockDetectScenes).toHaveBeenCalledOnce();
    expect(mockScoreHighlights).toHaveBeenCalledOnce();
    expect(mockMergeClipBoundaries).toHaveBeenCalledOnce();
    expect(mockInsertRepurposeClips).toHaveBeenCalledOnce();
    expect(mockUpdateRepurposeJobStatus).toHaveBeenCalledWith('job-rep-1', 'clips_ready', expect.any(Object));
  });
});
