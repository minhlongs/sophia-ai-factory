import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAdapter,
  getSupportedPlatforms,
  isPlatformSupported,
  executePublish,
  checkPublishStatus,
  refreshPlatformToken,
} from '../distribution-registry';
import type { Platform } from '../platform-adapter';
import { reset } from '@/seed/security/circuit-breaker';

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('distribution-registry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    reset('facebook');
  });
  afterEach(() => {
    reset('facebook');
  });

  it('registers exactly the platforms mapped in the adapter map', () => {
    const supported = getSupportedPlatforms();
    expect(supported).toEqual(['youtube', 'tiktok', 'instagram', 'facebook']);
  });

  it('isPlatformSupported is true for facebook and false for x/whatsapp/blog', () => {
    expect(isPlatformSupported('facebook')).toBe(true);
    expect(isPlatformSupported('x')).toBe(false);
    expect(isPlatformSupported('whatsapp')).toBe(false);
    expect(isPlatformSupported('blog')).toBe(false);
  });

  it('getAdapter throws for unknown platform (fail-loud, no silent fallback)', () => {
    expect(() => getAdapter('x' as Platform)).toThrow(/No adapter registered for platform 'x'/);
  });

  it('executePublish returns failure for unsupported platform', async () => {
    const r = await executePublish('x' as Platform, 'tok', {
      videoUrl: 'https://example.com/v.mp4',
      title: 't',
      description: '',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('UNSUPPORTED_PLATFORM');
    }
  });

  it('executePublish succeeds for facebook with mocked two-step flow', async () => {
    // Adapter makes 4 fetches: start, fetch video bytes, upload bytes, finish.
    const responses = [
      jsonRes({ video_id: 'fb-9', upload_url: 'https://upload.fb/9' }),
      new Response('binary', { status: 200 }),
      new Response('binary', { status: 200 }),
      jsonRes({ id: 'fb-9', status: 'published' }),
    ];
    let i = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => responses[i++] ?? responses[responses.length - 1]);

    const r = await executePublish('facebook', 'EAA_TOK', {
      videoUrl: 'https://example.com/v.mp4',
      title: 'Test',
      description: 'Desc',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.platformVideoId).toBe('fb-9');
      expect(r.value.status).toBe('processing');
    }
  });

  it('executePublish returns failure when upload throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('oops', { status: 500 }));
    const r = await executePublish('facebook', 'EAA_TOK', {
      videoUrl: 'https://example.com/v.mp4',
      title: 't',
      description: '',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('PUBLISH_FAILED');
      expect(r.error.message).toContain('Facebook upload start failed');
    }
  });

  it('checkPublishStatus returns failure for unsupported platform', async () => {
    const r = await checkPublishStatus('x' as Platform, 'tok', 'vid');
    expect(r.ok).toBe(false);
  });

  it('refreshPlatformToken returns failure for unsupported platform', async () => {
    const r = await refreshPlatformToken('x' as Platform, 'cid', 'csec', 'rtok');
    expect(r.ok).toBe(false);
  });
});