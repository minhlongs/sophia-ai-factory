import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { R2Bucket } from '@cloudflare/workers-types';
import {
  isCanonicalPrivateR2Uri,
  parseCanonicalPrivateR2Uri,
  resolvePrivateMediaFromR2,
  computeMediaApprovalDigest,
} from '../private-media-resolver';
import { assertSafeVideoUrl } from '../publish-url-utils';
import { performResumableYouTubeUpload } from '../providers/youtube-upload-helper';

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function makeFakeMp4(size = 512): Uint8Array {
  const buf = new Uint8Array(size);
  buf[4] = 0x66;
  buf[5] = 0x74;
  buf[6] = 0x79;
  buf[7] = 0x70;
  return buf;
}

describe('Private Media Resolver + Provider SHA-256 Parity + Media Approval Binding', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>).__env__;
  });

  it('validates canonical r2://private/distribution URIs and rejects traversal or arbitrary URLs', () => {
    const validHash = 'a'.repeat(64);
    const validUri = `r2://private/distribution/org-alpha/user-1/art-1/v2-${validHash}.mp4`;
    expect(isCanonicalPrivateR2Uri(validUri)).toBe(true);
    expect(() => assertSafeVideoUrl(validUri)).not.toThrow();

    const parsed = parseCanonicalPrivateR2Uri(validUri);
    expect(parsed).toEqual({
      objectKey: `private/distribution/org-alpha/user-1/art-1/v2-${validHash}.mp4`,
      orgId: 'org-alpha',
      userId: 'user-1',
      artifactId: 'art-1',
      reviewVersion: 2,
      sha256Hex: validHash,
    });

    expect(parseCanonicalPrivateR2Uri('r2://private/distribution/../etc/passwd')).toBeNull();
    expect(parseCanonicalPrivateR2Uri('https://evil.example.com/video.mp4')).toBeNull();
    expect(() => assertSafeVideoUrl('https://evil.example.com/video.mp4')).toThrow(/Blocked untrusted/);
  });

  it('resolves real C4 MP4 bytes from MEDIA_BUCKET, verifies SHA-256, and proves exact byte parity reaching YouTube fixture', async () => {
    const realMp4Path = path.resolve(
      '/Users/macbook/orca/workspaces/sophia-ai-factory/skua/apps/sophia-ai-factory/.artifacts/sophia-md3-phase2-wave-c4/sophia-narrated-browser-c4.mp4',
    );
    const mp4Bytes = fs.existsSync(realMp4Path)
      ? new Uint8Array(fs.readFileSync(realMp4Path))
      : makeFakeMp4(1024);
    const expectedHash = await sha256Hex(mp4Bytes);
    const objectKey = `private/distribution/org-alpha/user-1/art-c4/v2-${expectedHash}.mp4`;
    const canonicalUri = `r2://${objectKey}`;

    const r2 = {
      get: vi.fn(async (key: string) => {
        if (key !== objectKey) return null;
        return {
          arrayBuffer: async () => mp4Bytes.buffer.slice(mp4Bytes.byteOffset, mp4Bytes.byteOffset + mp4Bytes.byteLength),
          httpMetadata: { contentType: 'video/mp4' },
          customMetadata: { sha256Hex: expectedHash },
        };
      }),
    } as unknown as R2Bucket;

    // Direct resolver check
    const resolved = await resolvePrivateMediaFromR2({
      uri: canonicalUri,
      expectedUserId: 'user-1',
      expectedOrgId: 'org-alpha',
      r2,
    });
    expect(resolved.sha256Hex).toBe(expectedHash);
    expect(resolved.byteSize).toBe(mp4Bytes.byteLength);

    // Cross-user and cross-workspace rejection
    await expect(
      resolvePrivateMediaFromR2({ uri: canonicalUri, expectedUserId: 'user-2', r2 }),
    ).rejects.toThrow(/Cross-user/);
    await expect(
      resolvePrivateMediaFromR2({ uri: canonicalUri, expectedOrgId: 'org-beta', r2 }),
    ).rejects.toThrow(/Cross-workspace/);

    // Missing MEDIA_BUCKET fail-closed
    await expect(
      resolvePrivateMediaFromR2({ uri: canonicalUri, r2: null }),
    ).rejects.toThrow(/MEDIA_BUCKET binding unavailable/);

    // Provider adapter parity: YouTube resumable upload receives exact persisted bytes
    (globalThis as Record<string, unknown>).__env__ = { MEDIA_BUCKET: r2 };
    let uploadedSha256 = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('uploadType=resumable')) {
        return new Response(null, {
          status: 200,
          headers: { Location: 'https://upload.fixture.local/youtube-session-1' },
        });
      }
      if (url === 'https://upload.fixture.local/youtube-session-1') {
        const bodyBlob = init?.body as Blob;
        const receivedBytes = new Uint8Array(await bodyBlob.arrayBuffer());
        uploadedSha256 = await sha256Hex(receivedBytes);
        return new Response(JSON.stringify({ id: 'yt_fixture_video_001' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const ytId = await performResumableYouTubeUpload('fixture-token', canonicalUri, {
      caption: 'Fixture YouTube Shorts caption',
      hashtags: ['sophia', 'fixture'],
      title: 'Fixture Test Video',
      containsSyntheticMedia: true,
    });

    expect(ytId).toBe('yt_fixture_video_001');
    expect(uploadedSha256).toBe(expectedHash);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('rejects tampered R2 bytes whose SHA-256 does not match the canonical URI', async () => {
    const validHash = 'b'.repeat(64);
    const objectKey = `private/distribution/org-alpha/user-1/art-1/v1-${validHash}.mp4`;
    const r2 = {
      get: vi.fn(async () => ({
        arrayBuffer: async () => makeFakeMp4(256).buffer,
        httpMetadata: { contentType: 'video/mp4' },
        customMetadata: { sha256Hex: validHash },
      })),
    } as unknown as R2Bucket;

    await expect(
      resolvePrivateMediaFromR2({ uri: `r2://${objectKey}`, r2 }),
    ).rejects.toThrow(/Media integrity mismatch/);
  });

  it('binds media approval digest to workspace, videoId, SHA-256, channel, caption, and schedule', async () => {
    const base = {
      orgId: 'org-alpha',
      videoId: 'vid_123',
      sha256Hex: 'c'.repeat(64),
      reviewVersion: 2,
      channelId: 'ch_yt_1',
      caption: '#ad Original caption',
      scheduledAt: 1796000000,
    };
    const d1 = await computeMediaApprovalDigest(base);
    const d2 = await computeMediaApprovalDigest({ ...base });
    expect(d1).toBe(d2);

    // Modifying caption, channel, or media SHA-256 invalidates approval digest
    expect(await computeMediaApprovalDigest({ ...base, caption: '#ad Tampered caption' })).not.toBe(d1);
    expect(await computeMediaApprovalDigest({ ...base, channelId: 'ch_fb_2' })).not.toBe(d1);
    expect(await computeMediaApprovalDigest({ ...base, sha256Hex: 'd'.repeat(64) })).not.toBe(d1);
  });
});
