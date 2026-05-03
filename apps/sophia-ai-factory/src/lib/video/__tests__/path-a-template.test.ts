/**
 * Path A Template Tests
 * Verifies: mock fetch, R2 write attempted, cost recorded.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules before importing SUT
vi.mock('@/lib/video/r2-binding', () => ({
  tenantScopedKey: (tenantId: string, jobId: string, stage: string) =>
    `tenants/${tenantId}/videos/${jobId}/${stage}`,
  getVideoBucket: vi.fn(),
}));

vi.mock('@/lib/video/cost-ledger', () => ({
  recordCost: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { renderTemplateVideo } from '../path-a-template';
import { getVideoBucket } from '@/lib/video/r2-binding';
import { recordCost } from '@/lib/video/cost-ledger';
import type { R2BucketRef } from '@/lib/video/r2-binding';

const mockPut = vi.fn().mockResolvedValue(undefined);
const mockBucketRef = { bucket: { put: mockPut }, publicBaseUrl: null } as unknown as R2BucketRef;

describe('renderTemplateVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVideoBucket).mockResolvedValue(mockBucketRef);
    delete process.env.MOVIEPY_FLY_URL;
  });

  afterEach(() => {
    delete process.env.MOVIEPY_FLY_URL;
  });

  it('returns stub mp4 and skips cost when MOVIEPY_FLY_URL not set', async () => {
    const result = await renderTemplateVideo({
      jobId: 'job-1',
      tenantId: 'tenant-1',
      templateId: 'default',
      audioR2Key: 'tenants/t/videos/j/audio.wav',
      scenes: [{ index: 0, description: 'A product showcase' }],
    });

    expect(result.visualR2Key).toBe('tenants/tenant-1/videos/job-1/visual.mp4');
    expect(result.costUsd).toBe(0);
    expect(mockPut).toHaveBeenCalledOnce();
    expect(recordCost).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'visual', provider: 'moviepy', costUsd: 0 }),
    );
  });

  it('calls MoviePy service and writes to R2 when MOVIEPY_FLY_URL set', async () => {
    process.env.MOVIEPY_FLY_URL = 'http://moviepy.test';
    const mockVideoBytes = new ArrayBuffer(100);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockVideoBytes),
    } as unknown as Response);

    const result = await renderTemplateVideo({
      jobId: 'job-2',
      tenantId: 'tenant-2',
      templateId: 'promo',
      audioR2Key: 'tenants/t/videos/j/audio.wav',
      scenes: [{ index: 0, description: 'Scene A' }],
    });

    expect(result.visualR2Key).toBe('tenants/tenant-2/videos/job-2/visual.mp4');
    expect(result.costUsd).toBe(0.25);
    expect(mockPut).toHaveBeenCalledOnce();
    expect(recordCost).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'visual', costUsd: 0.25 }),
    );
  });

  it('throws when MoviePy service returns non-ok', async () => {
    process.env.MOVIEPY_FLY_URL = 'http://moviepy.test';
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as unknown as Response);

    await expect(
      renderTemplateVideo({
        jobId: 'job-3',
        tenantId: 'tenant-3',
        templateId: 'default',
        audioR2Key: 'audio.wav',
        scenes: [{ index: 0, description: 'scene' }],
      }),
    ).rejects.toThrow('MoviePy render failed');
  });
});
