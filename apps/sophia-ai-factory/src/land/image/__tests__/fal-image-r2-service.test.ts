/**
 * fal-image-r2-service unit tests — deterministic, mock-based.
 *
 * Validates:
 * 1. Downloads CDN URL → R2.put → returns permanent URL with storageKey.
 * 2. R2 unavailable → graceful fallback to CDN URL, usedFallback=true.
 * 3. R2 circuit breaker open → throws.
 * 4. Download failure (non-200) → throws.
 * 5. R2 PUT failure → throws (caller must not mark completed).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { storeFalImageInR2 } from '../fal-image-r2-service';
import { shouldAllowRequest, recordSuccess, recordFailure, __testSetEntry } from '@/seed/security/circuit-breaker';
import { CircuitState } from '@/seed/types/failure-kind';

const CDN_URL = 'https://fal.ai/images/abc123.png';
const JOB_ID = 'fal-1700000000000-abc12345';

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer;

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPut = vi.fn();
const mockBucket = { put: mockPut } as unknown as R2Bucket;

vi.mock('@/land/video/storage/r2-binding', () => ({
  getVideoBucket: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getVideoBucket } from '@/land/video/storage/r2-binding';

const mockedGetBucket = vi.mocked(getVideoBucket);

describe('storeFalImageInR2', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
    __testSetEntry('r2', 'platform', { state: CircuitState.CLOSED, failureCount: 0, cooldownUntil: null });
    mockPut.mockReset();
    mockedGetBucket.mockReset();
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('downloads CDN image and stores in R2 with public URL', async () => {
    mockedGetBucket.mockResolvedValue({
      bucket: mockBucket,
      publicBaseUrl: 'https://cdn.sophia.agencyos.network',
    });
    mockPut.mockResolvedValueOnce(undefined);
    fetchMock.mockResolvedValueOnce(new Response(PNG_BYTES, { status: 200 }));

    const result = await storeFalImageInR2(CDN_URL, JOB_ID);

    expect(result.usedFallback).toBe(false);
    expect(result.storageKey).toBe(`media/fal/${JOB_ID}/image.png`);
    expect(result.bucket).toBe('VIDEO_BUCKET');
    expect(result.sizeBytes).toBe(8);
    expect(result.permanentUrl).toBe(`https://cdn.sophia.agencyos.network/media/fal/${JOB_ID}/image.png`);
    expect(mockPut).toHaveBeenCalledWith(
      `media/fal/${JOB_ID}/image.png`,
      expect.anything(),
      { httpMetadata: { contentType: 'image/png' } },
    );
  });

  it('falls back to CDN URL when R2 binding is null', async () => {
    mockedGetBucket.mockResolvedValue(null);

    const result = await storeFalImageInR2(CDN_URL, JOB_ID);

    expect(result.usedFallback).toBe(true);
    expect(result.permanentUrl).toBe(CDN_URL);
    expect(result.storageKey).toBe('');
    expect(result.bucket).toBe('none');
    expect(result.sizeBytes).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps CDN URL when publicBaseUrl is null (no custom domain)', async () => {
    mockedGetBucket.mockResolvedValue({ bucket: mockBucket, publicBaseUrl: null });
    mockPut.mockResolvedValueOnce(undefined);
    fetchMock.mockResolvedValueOnce(new Response(PNG_BYTES, { status: 200 }));

    const result = await storeFalImageInR2(CDN_URL, JOB_ID);

    expect(result.usedFallback).toBe(false);
    expect(result.permanentUrl).toBe(CDN_URL);
    expect(result.sizeBytes).toBe(8);
  });

  it('throws when R2 circuit breaker is open', async () => {
    mockedGetBucket.mockResolvedValue({
      bucket: mockBucket,
      publicBaseUrl: 'https://cdn.sophia.agencyos.network',
    });
    __testSetEntry('r2', 'platform', {
      state: CircuitState.OPEN,
      cooldownUntil: Date.now() + 300_000,
      failureCount: 5,
    });

    await expect(storeFalImageInR2(CDN_URL, JOB_ID)).rejects.toThrow(/circuit breaker open/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when download returns non-200', async () => {
    mockedGetBucket.mockResolvedValue({
      bucket: mockBucket,
      publicBaseUrl: 'https://cdn.sophia.agencyos.network',
    });
    fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

    await expect(storeFalImageInR2(CDN_URL, JOB_ID)).rejects.toThrow(/download failed: HTTP 404/i);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('throws when R2 PUT fails', async () => {
    mockedGetBucket.mockResolvedValue({
      bucket: mockBucket,
      publicBaseUrl: 'https://cdn.sophia.agencyos.network',
    });
    fetchMock.mockResolvedValueOnce(new Response(PNG_BYTES, { status: 200 }));
    mockPut.mockRejectedValueOnce(new Error('R2 internal error'));

    await expect(storeFalImageInR2(CDN_URL, JOB_ID)).rejects.toThrow(/R2 internal error/i);
  });
});
