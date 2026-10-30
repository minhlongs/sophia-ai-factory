/**
 * Tests for the verified media store: tenant-scoped keys, checksum-from-bytes,
 * and fail-loud behavior without R2.
 *
 * @module land/video/storage/__tests__/verified-media-store.test
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/land/video/storage/r2-binding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/land/video/storage/r2-binding')>();
  return { ...actual, getVideoBucket: vi.fn(async () => null) };
});

import { storeVerifiedMedia } from '../verified-media-store';
import { sha256Hex } from '@/land/video/render/render-adapter';

function mp4Bytes(): Uint8Array {
  return new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 1, 2, 3, 4, 5, 6]);
}

describe('storeVerifiedMedia', () => {
  it('puts bytes under a tenant-scoped key with a checksum computed from the bytes', async () => {
    const puts: Array<{ key: string; body: Uint8Array; contentType: string }> = [];
    const bytes = mp4Bytes();
    const result = await storeVerifiedMedia('ws_1', 'run_1', bytes, {
      put: async (key, body, contentType) => {
        puts.push({ key, body, contentType });
      },
    });

    expect(result.storageKey).toBe('tenants/ws_1/videos/run_1/final.mp4');
    expect(result.byteSize).toBe(bytes.byteLength);
    // Independent recomputation proves the checksum came from the bytes.
    expect(result.checksumSha256).toBe(await sha256Hex(bytes));
    expect(puts).toHaveLength(1);
    expect(puts[0]?.key).toBe('tenants/ws_1/videos/run_1/final.mp4');
    expect(puts[0]?.body).toBe(bytes);
    expect(puts[0]?.contentType).toBe('video/mp4');
  });

  it('fails loud without R2 (no silent CDN fallback on the OPC path)', async () => {
    await expect(storeVerifiedMedia('ws_1', 'run_1', mp4Bytes())).rejects.toThrow(
      'VERIFIED_MEDIA_STORAGE_UNAVAILABLE',
    );
  });

  it('rejects missing/default tenant and empty bytes', async () => {
    const bucket = { put: vi.fn(async () => {}) };
    await expect(storeVerifiedMedia('', 'run_1', mp4Bytes(), bucket)).rejects.toThrow(
      'VERIFIED_MEDIA_TENANT_REQUIRED',
    );
    await expect(storeVerifiedMedia('default', 'run_1', mp4Bytes(), bucket)).rejects.toThrow(
      'VERIFIED_MEDIA_TENANT_REQUIRED',
    );
    await expect(storeVerifiedMedia('ws_1', 'run_1', new Uint8Array(0), bucket)).rejects.toThrow(
      'VERIFIED_MEDIA_EMPTY_BYTES',
    );
    expect(bucket.put).not.toHaveBeenCalled();
  });
});
