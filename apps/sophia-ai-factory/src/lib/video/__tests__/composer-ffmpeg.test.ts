/**
 * Composer FFmpeg Tests
 * Verifies: service call, R2 write, cost logging.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/video/r2-binding', () => ({
  tenantScopedKey: (tenantId: string, jobId: string, stage: string) =>
    `tenants/${tenantId}/videos/${jobId}/${stage}`,
  getVideoBucket: vi.fn(),
}));

vi.mock('@/lib/video/cost-ledger', () => ({
  recordCost: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { composeFinalVideo } from '../composer-ffmpeg';
import { getVideoBucket } from '@/lib/video/r2-binding';
import { recordCost } from '@/lib/video/cost-ledger';
import type { R2BucketRef } from '@/lib/video/r2-binding';

const mockPut = vi.fn().mockResolvedValue(undefined);
const mockBucketRef = { bucket: { put: mockPut }, publicBaseUrl: null } as unknown as R2BucketRef;

describe('composeFinalVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVideoBucket).mockResolvedValue(mockBucketRef);
    delete process.env.MOVIEPY_FLY_URL;
  });

  afterEach(() => {
    delete process.env.MOVIEPY_FLY_URL;
  });

  it('returns stub final mp4 and writes to R2 when service not configured', async () => {
    const result = await composeFinalVideo({
      jobId: 'job-1',
      tenantId: 'tenant-1',
      audioR2Key: 'audio.wav',
      visualR2Key: 'visual.mp4',
      subtitleSrt: '1\n00:00:00,000 --> 00:00:05,000\nHello world',
    });

    expect(result.finalR2Key).toBe('tenants/tenant-1/videos/job-1/final.mp4');
    expect(result.costUsd).toBe(0.05);
    expect(mockPut).toHaveBeenCalledOnce();
    expect(recordCost).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'compose', provider: 'moviepy-ffmpeg', costUsd: 0.05 }),
    );
  });

  it('calls /compose endpoint when MOVIEPY_FLY_URL set', async () => {
    process.env.MOVIEPY_FLY_URL = 'http://moviepy.test';
    const mockBytes = new ArrayBuffer(300);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockBytes),
    } as unknown as Response);

    const result = await composeFinalVideo({
      jobId: 'job-2',
      tenantId: 'tenant-2',
      audioR2Key: 'audio.wav',
      visualR2Key: 'visual.mp4',
    });

    expect(result.finalR2Key).toBe('tenants/tenant-2/videos/job-2/final.mp4');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://moviepy.test/compose',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mockPut).toHaveBeenCalledOnce();
  });

  it('throws when MoviePy compose returns error', async () => {
    process.env.MOVIEPY_FLY_URL = 'http://moviepy.test';
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as unknown as Response);

    await expect(
      composeFinalVideo({
        jobId: 'job-3',
        tenantId: 'tenant-3',
        audioR2Key: 'audio.wav',
        visualR2Key: 'visual.mp4',
      }),
    ).rejects.toThrow('MoviePy compose failed');
  });
});
