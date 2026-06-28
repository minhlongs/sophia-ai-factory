/**
 * withEdgeCache — runtime detection + cache hit/miss/bypass semantics.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withEdgeCache } from '../edge-cache';

interface CfCacheStub {
  match: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
}

let originalCaches: unknown;

function installCachesStub(cached?: Response): CfCacheStub {
  const stub: CfCacheStub = {
    match: vi.fn().mockResolvedValue(cached),
    put: vi.fn().mockResolvedValue(undefined),
  };
  (globalThis as unknown as { caches?: { default: CfCacheStub } }).caches = {
    default: stub,
  };
  return stub;
}

function clearCaches(): void {
  delete (globalThis as Record<string, unknown>).caches;
}

beforeEach(() => {
  originalCaches = (globalThis as Record<string, unknown>).caches;
  clearCaches();
});

afterEach(() => {
  if (originalCaches !== undefined) {
    (globalThis as Record<string, unknown>).caches = originalCaches;
  } else {
    clearCaches();
  }
  vi.clearAllMocks();
});

function buildRequest(method = 'GET'): Request {
  return new Request('https://example.test/api/version', { method });
}

describe('withEdgeCache', () => {
  it('returns build() output with x-edge-cache: BYPASS when caches unavailable', async () => {
    clearCaches();
    let buildCalls = 0;
    const resp = await withEdgeCache(buildRequest(), 60, async () => {
      buildCalls++;
      return new Response('fresh', { status: 200 });
    });
    expect(buildCalls).toBe(1);
    expect(resp.headers.get('x-edge-cache')).toBe('BYPASS');
    expect(await resp.text()).toBe('fresh');
  });

  it('returns build() output and writes cache on MISS', async () => {
    const stub = installCachesStub(undefined);
    const resp = await withEdgeCache(buildRequest(), 60, async () =>
      new Response('hello', { status: 200 }),
    );
    expect(stub.match).toHaveBeenCalledOnce();
    expect(stub.put).toHaveBeenCalledOnce();
    expect(resp.headers.get('x-edge-cache')).toBe('MISS');
    expect(await resp.text()).toBe('hello');
  });

  it('returns cached response with x-edge-cache: HIT', async () => {
    const cached = new Response('old', { status: 200 });
    const stub = installCachesStub(cached);
    const resp = await withEdgeCache(buildRequest(), 60, async () => {
      throw new Error('builder should not be called on HIT');
    });
    expect(stub.match).toHaveBeenCalledOnce();
    expect(stub.put).not.toHaveBeenCalled();
    expect(resp.headers.get('x-edge-cache')).toBe('HIT');
    expect(await resp.text()).toBe('old');
  });

  it('sets default Cache-Control header on MISS when builder did not', async () => {
    installCachesStub(undefined);
    const resp = await withEdgeCache(buildRequest(), 60, async () =>
      new Response('x', { status: 200 }),
    );
    expect(resp.headers.get('cache-control')).toMatch(/s-maxage=60/);
    expect(resp.headers.get('cache-control')).toMatch(/stale-while-revalidate=120/);
  });

  it('preserves builder-supplied Cache-Control header', async () => {
    installCachesStub(undefined);
    const resp = await withEdgeCache(buildRequest(), 60, async () =>
      new Response('x', {
        status: 200,
        headers: { 'cache-control': 'public, max-age=999' },
      }),
    );
    expect(resp.headers.get('cache-control')).toBe('public, max-age=999');
  });

  it('bypasses cache for non-GET requests', async () => {
    const stub = installCachesStub(undefined);
    const resp = await withEdgeCache(buildRequest('POST'), 60, async () =>
      new Response('y', { status: 200 }),
    );
    expect(stub.match).not.toHaveBeenCalled();
    expect(stub.put).not.toHaveBeenCalled();
    // Bypassed path doesn't decorate headers — the response is whatever build returned.
    expect(resp.headers.get('x-edge-cache')).toBeNull();
    expect(await resp.text()).toBe('y');
  });
});
