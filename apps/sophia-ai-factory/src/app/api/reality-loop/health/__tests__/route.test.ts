/**
 * Tests for /api/reality-loop/health — emitter health endpoint.
 *
 * Covers:
 * - Public response (no/invalid bearer): omits entries, staleEmitterTypes, maxLagMs
 * - Authenticated response (valid HEALTH_TOKEN bearer): includes full detail
 * - Token configured but request omits bearer: stays public (no leak)
 * - Token absent: public (graceful degradation)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('/api/reality-loop/health', () => {
  const originalEnv = process.env;
  let freshRoute: typeof import('../route');

  beforeEach(async () => {
    process.env = { ...originalEnv };
    vi.resetModules();
    freshRoute = await import('../route');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function buildRequest(authHeader?: string): Request {
    const headers: Record<string, string> = {};
    if (authHeader) headers.authorization = authHeader;
    return new Request('http://localhost/api/reality-loop/health', { headers });
  }

  it('public response omits detail when no bearer is presented', async () => {
    process.env.HEALTH_TOKEN = 'secret-123';
    const resp = await freshRoute.GET(buildRequest());
    const body = (await resp.json()) as Record<string, unknown>;

    expect(resp.status).toBe(200);
    expect(typeof body.status).toBe('string');
    expect(body.wired).toBe(11);
    expect(body.deferred).toBe(2);
    expect(body.totalEventTypes).toBe(13);
    expect(body.entries).toBeUndefined();
    expect(body.staleEmitterTypes).toBeUndefined();
    expect(body.maxLagMs).toBeUndefined();
  });

  it('public response omits detail when bearer is wrong', async () => {
    process.env.HEALTH_TOKEN = 'secret-123';
    const resp = await freshRoute.GET(buildRequest('Bearer wrong-token'));
    const body = (await resp.json()) as Record<string, unknown>;

    expect(body.entries).toBeUndefined();
    expect(body.staleEmitterTypes).toBeUndefined();
  });

  it('authenticated response includes detail when valid bearer presented', async () => {
    process.env.HEALTH_TOKEN = 'secret-123';
    const resp = await freshRoute.GET(buildRequest('Bearer secret-123'));
    const body = (await resp.json()) as Record<string, unknown>;

    expect(body.entries).toBeDefined();
    expect(Array.isArray(body.entries)).toBe(true);
    expect(body.staleEmitterTypes).toBeDefined();
    expect(body.maxLagMs).toBeDefined();
  });

  it('public response when HEALTH_TOKEN is absent (graceful degradation)', async () => {
    delete process.env.HEALTH_TOKEN;
    const resp = await freshRoute.GET(buildRequest());
    const body = (await resp.json()) as Record<string, unknown>;

    expect(resp.status).toBe(200);
    expect(body.wired).toBe(11);
    expect(body.deferred).toBe(2);
    expect(body.entries).toBeUndefined();
  });

  it('returns no-cache headers', async () => {
    const resp = await freshRoute.GET(buildRequest());
    expect(resp.headers.get('cache-control')).toContain('no-cache');
  });
});
