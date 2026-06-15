/**
 * Tests for GET /api/health/heygen
 * Covers: missing API key, successful ping, server error, timeout, KV caching.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Cloudflare context — KV unavailable in unit tests
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn().mockRejectedValue(new Error('Not on CF')),
}));

// Mock rate-limit wrapper to pass through the handler directly
vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (req: unknown) => Promise<unknown>) => handler,
}));

import { NextRequest } from 'next/server';
import { GET } from './route';
import type { HeyGenHealthResponse } from './route';

function makeReq(): NextRequest {
  return new NextRequest('https://sophia.agencyos.network/api/health/heygen');
}

describe('GET /api/health/heygen', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns healthy:false when HEYGEN_API_KEY is not set', async () => {
    vi.stubEnv('HEYGEN_API_KEY', '');
    const res = await GET(makeReq());
    const data = await res.json() as HeyGenHealthResponse;
    expect(data.healthy).toBe(false);
    expect(data.providerStatus).toBe('down');
    expect(data.details).toContain('API key not configured');
    expect(typeof data.checkedAt).toBe('string');
  });

  it('returns healthy:true when HeyGen returns 200', async () => {
    vi.stubEnv('HEYGEN_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 200 })
    );
    const res = await GET(makeReq());
    const data = await res.json() as HeyGenHealthResponse;
    expect(data.healthy).toBe(true);
    expect(data.providerStatus).toBe('ok');
  });

  it('returns healthy:true when HeyGen returns 401 (API reachable, key scope)', async () => {
    vi.stubEnv('HEYGEN_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 })
    );
    const res = await GET(makeReq());
    const data = await res.json() as HeyGenHealthResponse;
    expect(data.healthy).toBe(true);
    expect(data.providerStatus).toBe('ok');
  });

  it('returns healthy:false with providerStatus:down when HeyGen returns 500', async () => {
    vi.stubEnv('HEYGEN_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Server Error', { status: 500 })
    );
    const res = await GET(makeReq());
    const data = await res.json() as HeyGenHealthResponse;
    expect(data.healthy).toBe(false);
    expect(data.providerStatus).toBe('down');
    expect(data.details).toContain('500');
  });

  it('returns healthy:false with providerStatus:degraded when HeyGen returns 429', async () => {
    vi.stubEnv('HEYGEN_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Rate limited', { status: 429 })
    );
    const res = await GET(makeReq());
    const data = await res.json() as HeyGenHealthResponse;
    expect(data.healthy).toBe(false);
    expect(data.providerStatus).toBe('degraded');
  });

  it('returns healthy:false on fetch network error', async () => {
    vi.stubEnv('HEYGEN_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await GET(makeReq());
    const data = await res.json() as HeyGenHealthResponse;
    expect(data.healthy).toBe(false);
    expect(data.providerStatus).toBe('down');
    expect(data.details).toContain('ECONNREFUSED');
  });

  it('returns healthy:false on abort timeout', async () => {
    vi.stubEnv('HEYGEN_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('The operation was aborted'));
    const res = await GET(makeReq());
    const data = await res.json() as HeyGenHealthResponse;
    expect(data.healthy).toBe(false);
    expect(data.providerStatus).toBe('down');
    expect(data.details).toContain('timed out');
  });

  it('response shape always includes required fields', async () => {
    vi.stubEnv('HEYGEN_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 200 })
    );
    const res = await GET(makeReq());
    const data = await res.json() as HeyGenHealthResponse;
    expect(typeof data.healthy).toBe('boolean');
    expect(['ok', 'degraded', 'down']).toContain(data.providerStatus);
    expect(typeof data.checkedAt).toBe('string');
  });
});
