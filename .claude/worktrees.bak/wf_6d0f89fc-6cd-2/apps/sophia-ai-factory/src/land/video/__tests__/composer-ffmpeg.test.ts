/**
 * Composer FFmpeg Tests
 * Verifies: service call, R2 write, cost logging.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/land/video/storage/r2-binding', () => ({
  tenantScopedKey: (tenantId: string, jobId: string, stage: string) =>
    `tenants/${tenantId}/videos/${jobId}/${stage}`,
  getVideoBucket: vi.fn(),
}));

vi.mock('@/land/video/templates/cost-ledger', () => ({
  recordCost: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { composeFinalVideo } from '../assembly/composer-ffmpeg';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { recordCost } from '@/land/video/templates/cost-ledger';
import type { R2BucketRef } from '@/land/video/storage/r2-binding';
import { resetBreaker } from '@/land/video/templates/circuit-breaker';

const mockPut = vi.fn().mockResolvedValue(undefined);
const mockBucketRef = { bucket: { put: mockPut }, publicBaseUrl: null } as unknown as R2BucketRef;

/** Build a minimal Response-like mock with Headers support so composer can read X-Sophia-* */
function mockOkResponse(bytes: ArrayBuffer, headerEntries: Record<string, string> = {}): Response {
  const headers = new Headers(headerEntries);
  return {
    ok: true,
    headers,
    arrayBuffer: () => Promise.resolve(bytes),
  } as unknown as Response;
}

describe('composeFinalVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVideoBucket).mockResolvedValue(mockBucketRef);
    delete process.env.MOVIEPY_FLY_URL;
    // Breaker is module-singleton state — reset between tests to avoid leakage.
    resetBreaker('moviepy-fly');
  });

  afterEach(() => {
    delete process.env.MOVIEPY_FLY_URL;
    resetBreaker('moviepy-fly');
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
    global.fetch = vi.fn().mockResolvedValue(mockOkResponse(mockBytes));

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
    ).rejects.toThrow(/MoviePy.*compose failed/);
  });

  it('calls /compose-rich endpoint when introR2Key or outroR2Key is set', async () => {
    process.env.MOVIEPY_FLY_URL = 'http://moviepy.test';
    const mockBytes = new ArrayBuffer(300);
    global.fetch = vi.fn().mockResolvedValue(mockOkResponse(mockBytes, {
      'X-Sophia-Metadata': JSON.stringify({ duration_seconds: 15, size_bytes: 1000, width: 1280, height: 720, codec_name: 'h264' })
    }));

    const result = await composeFinalVideo({
      jobId: 'job-4',
      tenantId: 'tenant-4',
      audioR2Key: 'audio.wav',
      visualR2Key: 'visual.mp4',
      introR2Key: 'intro-video.mp4',
    });

    expect(result.finalR2Key).toBe('tenants/tenant-4/videos/job-4/final.mp4');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://moviepy.test/compose-rich',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"intro_r2_key":"intro-video.mp4"')
      }),
    );
  });
});
