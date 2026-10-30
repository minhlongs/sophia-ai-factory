/**
 * Boundary tests for the OPC render adapter (SSRF / TOCTOU / media proof).
 *
 * Proves: provider-host allowlist, https-only, redirect rejection, size cap,
 * content-type + magic-byte verification, checksum determinism, and HeyGen
 * status parsing. No network: fetch is stubbed.
 *
 * @module land/video/render/__tests__/render-adapter.test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MAX_RENDER_BYTES,
  assertProviderMediaUrl,
  hasMediaMagicBytes,
  heyGenRenderAdapter,
  sha256Hex,
} from '../render-adapter';

const MP4_PREFIX = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
]);

function mp4Bytes(extra = 32): Uint8Array {
  const out = new Uint8Array(MP4_PREFIX.length + extra);
  out.set(MP4_PREFIX, 0);
  for (let i = MP4_PREFIX.length; i < out.length; i += 1) out[i] = i % 251;
  return out;
}

describe('assertProviderMediaUrl (SSRF guard)', () => {
  it('accepts heygen media hosts over https', () => {
    expect(assertProviderMediaUrl('https://cdn.heygen.ai/renders/a.mp4').hostname).toBe(
      'cdn.heygen.ai',
    );
    expect(assertProviderMediaUrl('https://files.heygen.com/v/a.mp4').hostname).toBe(
      'files.heygen.com',
    );
  });

  it('rejects http, evil hosts, lookalikes, and garbage', () => {
    expect(() => assertProviderMediaUrl('http://cdn.heygen.ai/a.mp4')).toThrow(
      'RENDER_MEDIA_URL_INVALID',
    );
    expect(() => assertProviderMediaUrl('https://evil.example.com/a.mp4')).toThrow(
      'RENDER_MEDIA_HOST_NOT_ALLOWLISTED',
    );
    expect(() => assertProviderMediaUrl('https://heygen.ai.evil.com/a.mp4')).toThrow(
      'RENDER_MEDIA_HOST_NOT_ALLOWLISTED',
    );
    expect(() => assertProviderMediaUrl('https://169.254.169.254/meta')).toThrow(
      'RENDER_MEDIA_HOST_NOT_ALLOWLISTED',
    );
    expect(() => assertProviderMediaUrl('not-a-url')).toThrow('RENDER_MEDIA_URL_INVALID');
  });
});

describe('hasMediaMagicBytes', () => {
  it('accepts ftyp (mp4/mov) and EBML (webm) prefixes', () => {
    expect(hasMediaMagicBytes(mp4Bytes())).toBe(true);
    expect(hasMediaMagicBytes(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(
      true,
    );
  });

  it('rejects html/json/text masquerading as media', () => {
    const html = new TextEncoder().encode('<html><body>nope</body></html>padding...');
    expect(hasMediaMagicBytes(html)).toBe(false);
    expect(hasMediaMagicBytes(new Uint8Array(4))).toBe(false);
  });
});

describe('sha256Hex', () => {
  it('is deterministic and matches the known digest', async () => {
    const bytes = new TextEncoder().encode('sophia-render-proof');
    const a = await sha256Hex(bytes);
    const b = await sha256Hex(bytes);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    // Independent recomputation via subtle directly.
    const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
    const expected = [...new Uint8Array(digest)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('');
    expect(a).toBe(expected);
  });
});

describe('heyGenRenderAdapter.downloadBytes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(
    impl: (url: string, init?: RequestInit) => Promise<Response>,
  ): void {
    vi.stubGlobal('fetch', vi.fn(impl));
  }

  it('downloads allowlisted media and enforces redirect=error', async () => {
    const body = mp4Bytes();
    let seenInit: RequestInit | undefined;
    stubFetch(async (url: string, init?: RequestInit) => {
      seenInit = init;
      expect(url).toBe('https://cdn.heygen.ai/renders/a.mp4');
      return new Response(body as BodyInit, {
        status: 200,
        headers: { 'content-type': 'video/mp4', 'content-length': String(body.length) },
      });
    });
    const out = await heyGenRenderAdapter.downloadBytes('https://cdn.heygen.ai/renders/a.mp4');
    expect(out).toEqual(body);
    expect(seenInit?.redirect).toBe('error');
    expect(seenInit?.signal).toBeDefined();
  });

  it('rejects non-2xx, wrong content-type, empty, and oversize bodies', async () => {
    stubFetch(async () => new Response('nope', { status: 404 }));
    await expect(
      heyGenRenderAdapter.downloadBytes('https://cdn.heygen.ai/renders/a.mp4'),
    ).rejects.toThrow('RENDER_DOWNLOAD_FAILED');

    stubFetch(
      async () =>
        new Response(mp4Bytes() as BodyInit, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    );
    await expect(
      heyGenRenderAdapter.downloadBytes('https://cdn.heygen.ai/renders/a.mp4'),
    ).rejects.toThrow('RENDER_DOWNLOAD_UNEXPECTED_CONTENT_TYPE');

    stubFetch(
      async () =>
        new Response(new Uint8Array(0) as BodyInit, {
          status: 200,
          headers: { 'content-type': 'video/mp4' },
        }),
    );
    await expect(
      heyGenRenderAdapter.downloadBytes('https://cdn.heygen.ai/renders/a.mp4'),
    ).rejects.toThrow('RENDER_DOWNLOAD_EMPTY');

    stubFetch(
      async () =>
        new Response('x' as BodyInit, {
          status: 200,
          headers: {
            'content-type': 'video/mp4',
            'content-length': String(MAX_RENDER_BYTES + 1),
          },
        }),
    );
    await expect(
      heyGenRenderAdapter.downloadBytes('https://cdn.heygen.ai/renders/a.mp4'),
    ).rejects.toThrow('RENDER_DOWNLOAD_OVERSIZE');
  });

  it('rejects non-media bytes even with a video content-type', async () => {
    const html = new TextEncoder().encode('<html>phishing video page</html>......');
    stubFetch(
      async () =>
        new Response(html as BodyInit, {
          status: 200,
          headers: { 'content-type': 'video/mp4' },
        }),
    );
    await expect(
      heyGenRenderAdapter.downloadBytes('https://cdn.heygen.ai/renders/a.mp4'),
    ).rejects.toThrow('RENDER_DOWNLOAD_NOT_MEDIA');
  });

  it('surfaces redirect attempts as errors (no silent follow)', async () => {
    stubFetch(async () => {
      // redirect:'error' makes fetch itself reject on 3xx.
      throw new TypeError('fetch failed: redirect mode is "error"');
    });
    await expect(
      heyGenRenderAdapter.downloadBytes('https://cdn.heygen.ai/renders/a.mp4'),
    ).rejects.toThrow();
  });
});

describe('heyGenRenderAdapter.fetchStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses completed/failed/processing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ data: { status: 'completed', video_url: 'https://cdn.heygen.ai/a.mp4', duration: 9 } }),
      ),
    );
    const done = await heyGenRenderAdapter.fetchStatus('vid_1', 'key_test');
    expect(done).toEqual({
      status: 'completed',
      mediaUrl: 'https://cdn.heygen.ai/a.mp4',
      durationSec: 9,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ data: { status: 'failed', error: { message: 'avatar busy' } } }),
      ),
    );
    const failed = await heyGenRenderAdapter.fetchStatus('vid_1', 'key_test');
    expect(failed.status).toBe('failed');
    expect(failed.errorMessage).toBe('avatar busy');

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { status: 'processing' } })));
    const pending = await heyGenRenderAdapter.fetchStatus('vid_1', 'key_test');
    expect(pending).toEqual({ status: 'processing' });
  });
});
