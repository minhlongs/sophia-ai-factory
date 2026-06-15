/**
 * Path B Cinematic Tests
 * Verifies: Runpod submit + poll flow, stub fallback, idempotent retry.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/land/video/r2-binding', () => ({
  tenantScopedKey: (tenantId: string, jobId: string, stage: string) =>
    `tenants/${tenantId}/videos/${jobId}/${stage}`,
  getVideoBucket: vi.fn(),
}));

vi.mock('@/land/video/cost-ledger', () => ({
  recordCost: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { renderCinematicVideo } from '../path-b-cinematic';
import { getVideoBucket } from '@/land/video/r2-binding';
import { recordCost } from '@/land/video/cost-ledger';
import type { R2BucketRef } from '@/land/video/r2-binding';

const mockPut = vi.fn().mockResolvedValue(undefined);
const mockBucketRef = { bucket: { put: mockPut }, publicBaseUrl: null } as unknown as R2BucketRef;

describe('renderCinematicVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVideoBucket).mockResolvedValue(mockBucketRef);
    delete process.env.RUNPOD_API_KEY;
    delete process.env.RUNPOD_ENDPOINT_ID;
  });

  afterEach(() => {
    delete process.env.RUNPOD_API_KEY;
    delete process.env.RUNPOD_ENDPOINT_ID;
  });

  it('returns stub when env vars not set', async () => {
    const result = await renderCinematicVideo({
      jobId: 'job-1',
      tenantId: 'tenant-1',
      scenes: [{ index: 0, description: 'A scene' }],
    });

    expect(result.visualR2Key).toBe('tenants/tenant-1/videos/job-1/visual.mp4');
    expect(result.runpodJobId).toBeNull();
    expect(result.costUsd).toBe(0);
    expect(mockPut).toHaveBeenCalledOnce();
    expect(recordCost).not.toHaveBeenCalled();
  });

  it('submits job, polls, downloads, uploads to R2', async () => {
    process.env.RUNPOD_API_KEY = 'test-key';
    process.env.RUNPOD_ENDPOINT_ID = 'ep-123';

    // Mock setTimeout to resolve immediately (avoid 10s poll delay)
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: TimerHandler) => {
      if (typeof fn === 'function') fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    const videoBytes = new ArrayBuffer(200);
    global.fetch = vi.fn()
      // submit
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'rp-job-1', status: 'IN_QUEUE' }),
      } as unknown as Response)
      // poll → IN_PROGRESS
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'rp-job-1', status: 'IN_PROGRESS' }),
      } as unknown as Response)
      // poll → COMPLETED
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ id: 'rp-job-1', status: 'COMPLETED', output: { download_url: 'http://dl.test/vid.mp4' } }),
      } as unknown as Response)
      // download video
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(videoBytes),
      } as unknown as Response);

    const result = await renderCinematicVideo({
      jobId: 'job-2',
      tenantId: 'tenant-2',
      scenes: [{ index: 0, description: 'Cinematic scene' }],
    });

    vi.restoreAllMocks();
    vi.mocked(getVideoBucket).mockResolvedValue(mockBucketRef);

    expect(result.runpodJobId).toBe('rp-job-1');
    expect(result.visualR2Key).toBe('tenants/tenant-2/videos/job-2/visual.mp4');
    expect(result.costUsd).toBe(8.0);
    expect(mockPut).toHaveBeenCalledOnce();
    expect(recordCost).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'visual', provider: 'runpod-hunyuan' }),
    );
  });

  it('throws when Runpod job fails', async () => {
    process.env.RUNPOD_API_KEY = 'test-key';
    process.env.RUNPOD_ENDPOINT_ID = 'ep-123';

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'rp-fail', status: 'IN_QUEUE' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'rp-fail', status: 'FAILED', error: 'OOM' }),
      } as unknown as Response);

    const promise = renderCinematicVideo({
      jobId: 'job-3',
      tenantId: 'tenant-3',
      scenes: [{ index: 0, description: 'scene' }],
    });

    await expect(promise).rejects.toThrow('FAILED');
  });
});
