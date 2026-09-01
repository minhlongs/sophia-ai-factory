/**
 * Tests for /api/health — component-level health endpoint.
 *
 * Covers:
 * - Public response (no HEALTH_TOKEN): backward-compatible shape
 * - Full response (with HEALTH_TOKEN): version + components
 * - Database failure -> unhealthy (503)
 * - KV failure -> degraded
 * - Circuit breaker open -> degraded
 * - Component isolation: one failing component does not block others
 *
 * Technique: Vitest spyTarget + resetModules forces fresh probe function
 * instances per test, bypassing the in-memory 30s cache that would otherwise
 * return stale results across tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Spies on the actual probe/circuit Breaker functions ─────────────────────
const probeD1Spy = vi.fn();
const probeKvSpy = vi.fn();
const probeR2Spy = vi.fn();
const getStateSpy = vi.fn();
const getBuildMetadataSpy = vi.fn();
const getEmitterHealthSpy = vi.fn();

function installRouteMocks() {
  vi.doMock('@/seed/health/probe-d1', () => ({
    probeD1: (...args: unknown[]) => probeD1Spy(...args),
  }));
  vi.doMock('@/seed/health/probe-kv', () => ({
    probeKv: (...args: unknown[]) => probeKvSpy(...args),
  }));
  vi.doMock('@/seed/health/probe-r2', () => ({
    probeR2: (...args: unknown[]) => probeR2Spy(...args),
  }));
  vi.doMock('@/seed/health/build-metadata', () => ({
    getBuildMetadata: (...args: unknown[]) => getBuildMetadataSpy(...args),
  }));
  vi.doMock('@/seed/security/circuit-breaker', () => ({
    getState: (...args: unknown[]) => getStateSpy(...args),
  }));
  vi.doMock('@/seed/types/failure-kind', () => ({
    CircuitState: {
      CLOSED: 'CLOSED',
      DEGRADED: 'DEGRADED',
      OPEN: 'OPEN',
      HALF_OPEN: 'HALF_OPEN',
    },
  }));
  vi.doMock('@/tree/performance/emitter-health', () => ({
    getEmitterHealth: (...args: unknown[]) => getEmitterHealthSpy(...args),
  }));
  vi.doMock('@opennextjs/cloudflare', () => ({
    getCloudflareContext: vi.fn().mockRejectedValue(new Error('Not in CF context')),
  }));
}

function resetAllSpies() {
  probeD1Spy.mockReset();
  probeKvSpy.mockReset();
  probeR2Spy.mockReset();
  getStateSpy.mockReset();
  getBuildMetadataSpy.mockReset();
  getEmitterHealthSpy.mockReset();

  // Default healthy responses
  probeD1Spy.mockResolvedValue({ status: 'up', latency: 2 });
  probeKvSpy.mockResolvedValue({ status: 'up', latency: 1 });
  probeR2Spy.mockResolvedValue({ status: 'up', latency: 3 });
  getStateSpy.mockReturnValue({ state: 'CLOSED', failureCount: 0 });
  getBuildMetadataSpy.mockReturnValue({
    sha: 'abc1234567890',
    deployedAt: '2026-08-16T00:00:00Z',
  });
  getEmitterHealthSpy.mockResolvedValue({
    totalEventTypes: 13,
    wired: 11,
    deferred: 2,
    staleEmitterTypes: [],
    entries: [],
    maxLagMs: null,
  });
}

function freshImportRoute() {
  vi.resetModules();
  return import('../route');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildRequest(): Request {
  return new Request('http://localhost/api/health');
}

function headersRecord(resp: Response): Record<string, string> {
  const out: Record<string, string> = {};
  resp.headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('/api/health', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Reset all mocks for clean state before each test
    resetAllSpies();
    // Install mocks and fresh import the route module
    installRouteMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('public path (no HEALTH_TOKEN)', () => {
    it('returns status, timestamp, and environment', async () => {
      delete process.env.HEALTH_TOKEN;
      const { GET } = await freshImportRoute();
      const resp = await GET(buildRequest());
      const body = (await resp.json()) as Record<string, unknown>;

      expect(resp.status).toBe(200);
      expect(body.status).toBe('healthy');
      expect(typeof body.timestamp).toBe('string');
      expect(typeof body.environment).toBe('string');
    });

    it('does not include version or components without token', async () => {
      delete process.env.HEALTH_TOKEN;
      const { GET } = await freshImportRoute();
      const resp = await GET(buildRequest());
      const body = (await resp.json()) as Record<string, unknown>;

      expect(body.version).toBeUndefined();
      expect(body.components).toBeUndefined();
    });

    it('returns no-cache headers', async () => {
      delete process.env.HEALTH_TOKEN;
      const { GET } = await freshImportRoute();
      const resp = await GET(buildRequest());
      const h = headersRecord(resp);
      expect(h['cache-control']).toContain('no-cache');
    });
  });

  describe('authenticated path (HEALTH_TOKEN set)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      process.env.HEALTH_TOKEN = 'test-token';
      const { GET } = await freshImportRoute();
      const req = new Request('http://localhost/api/health');
      const resp = await GET(req);

      expect(resp.status).toBe(401);
      const body = (await resp.json()) as Record<string, unknown>;
      expect(body.error).toBe('Unauthorized');
      expect(body.version).toBeUndefined();
      expect(body.components).toBeUndefined();
    });

    it('includes version and components when correct Bearer token provided', async () => {
      process.env.HEALTH_TOKEN = 'test-token';
      const { GET } = await freshImportRoute();
      const req = new Request('http://localhost/api/health', {
        headers: { authorization: 'Bearer test-token' },
      });
      const resp = await GET(req);
      const body = (await resp.json()) as Record<string, unknown>;

      expect(resp.status).toBe(200);
      expect(body.status).toBe('healthy');
      expect(body.version).toBeDefined();
      expect((body.version as Record<string, string>).shortSha).toBe('abc12345');
      expect(body.components).toBeDefined();

      const components = body.components as Record<string, Record<string, unknown>>;
      expect(components.database?.status).toBe('ok');
      expect(components.kv?.status).toBe('ok');
      expect(components.r2?.status).toBe('ok');
      expect(components.circuitBreaker?.status).toBe('ok');
    });

    it('returns 401 when Bearer token is incorrect', async () => {
      process.env.HEALTH_TOKEN = 'test-token';
      const { GET } = await freshImportRoute();
      const req = new Request('http://localhost/api/health', {
        headers: { authorization: 'Bearer wrong-token' },
      });
      const resp = await GET(req);

      expect(resp.status).toBe(401);
      const body = (await resp.json()) as Record<string, unknown>;
      expect(body.version).toBeUndefined();
      expect(body.components).toBeUndefined();
    });
  });

  describe('component failure scenarios', () => {
    it('returns unhealthy (503) when database is down', async () => {
      process.env.HEALTH_TOKEN = 'test-token';
      probeD1Spy.mockResolvedValue({
        status: 'down',
        latency: 3000,
        error: 'D1 connection refused',
      });

      const { GET } = await freshImportRoute();
      const req = new Request('http://localhost/api/health', {
        headers: { authorization: 'Bearer test-token' },
      });
      const resp = await GET(req);
      const body = (await resp.json()) as Record<string, unknown>;

      expect(resp.status).toBe(503);
      expect(body.status).toBe('unhealthy');
      const dbStatus = (body.components as Record<string, Record<string, unknown>>).database;
      expect(dbStatus.status).toBe('error');
      expect(dbStatus.error).toBe('D1 connection refused');
    });

    it('returns degraded when KV is down', async () => {
      process.env.HEALTH_TOKEN = 'test-token';
      probeKvSpy.mockResolvedValue({
        status: 'down',
        latency: 1500,
        error: 'KV probe timeout',
      });

      const { GET } = await freshImportRoute();
      const req = new Request('http://localhost/api/health', {
        headers: { authorization: 'Bearer test-token' },
      });
      const resp = await GET(req);
      const body = (await resp.json()) as Record<string, unknown>;

      expect(resp.status).toBe(200);
      expect(body.status).toBe('degraded');
      const kvStatus = (body.components as Record<string, Record<string, unknown>>).kv;
      expect(kvStatus.status).toBe('error');
    });

    it('returns degraded when circuit breaker has open services', async () => {
      process.env.HEALTH_TOKEN = 'test-token';
      getStateSpy.mockReturnValue({ state: 'OPEN', failureCount: 5 });

      const { GET } = await freshImportRoute();
      const req = new Request('http://localhost/api/health', {
        headers: { authorization: 'Bearer test-token' },
      });
      const resp = await GET(req);
      const body = (await resp.json()) as Record<string, unknown>;

      expect(resp.status).toBe(200);
      expect(body.status).toBe('degraded');
      const cb = (body.components as Record<string, Record<string, unknown>>).circuitBreaker;
      expect(cb.status).toBe('degraded');
      expect(cb.openServices).toContain('heygen-ping');
    });
  });

  describe('component failure isolation', () => {
    it('KV failure does not block DB or R2 checks', async () => {
      process.env.HEALTH_TOKEN = 'test-token';
      resetAllSpies();
      probeKvSpy.mockRejectedValue(new Error('KV module import failed'));

      const { GET } = await freshImportRoute();
      const req = new Request('http://localhost/api/health', {
        headers: { authorization: 'Bearer test-token' },
      });
      const resp = await GET(req);
      const body = (await resp.json()) as Record<string, unknown>;
      const components = body.components as Record<string, Record<string, unknown>>;

      expect(components.database.status).toBe('ok');
      expect(components.r2.status).toBe('ok');
      expect(components.kv.status).toBe('error');
      expect(components.kv.error).toBe('KV module import failed');
    });

    it('DB failure returns unhealthy without blocking other probes', async () => {
      process.env.HEALTH_TOKEN = 'test-token';
      resetAllSpies();
      probeD1Spy.mockRejectedValue(new Error('D1 import error'));

      const { GET } = await freshImportRoute();
      const req = new Request('http://localhost/api/health', {
        headers: { authorization: 'Bearer test-token' },
      });
      const resp = await GET(req);
      const body = (await resp.json()) as Record<string, unknown>;
      const components = body.components as Record<string, Record<string, unknown>>;

      expect(body.status).toBe('unhealthy');
      expect(components.database.status).toBe('error');
      expect(components.database.error).toBe('D1 import error');
      expect(components.kv.status).toBe('ok');
      expect(components.r2.status).toBe('ok');
    });

    it('multiple simultaneous failures — DB dominates to unhealthy', async () => {
      process.env.HEALTH_TOKEN = 'test-token';
      resetAllSpies();
      probeD1Spy.mockResolvedValue({ status: 'down', latency: 100, error: 'DB down' });
      probeKvSpy.mockResolvedValue({ status: 'down', latency: 50, error: 'KV down' });

      const { GET } = await freshImportRoute();
      const req = new Request('http://localhost/api/health', {
        headers: { authorization: 'Bearer test-token' },
      });
      const resp = await GET(req);
      const body = (await resp.json()) as Record<string, unknown>;

      expect(body.status).toBe('unhealthy');
      expect(resp.status).toBe(503);
      const components = body.components as Record<string, Record<string, unknown>>;
      expect(components.database.status).toBe('error');
      expect(components.kv.status).toBe('error');
    });
  });

  describe('error handling', () => {
    it('handles build-metadata error without taking down entire response', async () => {
      getBuildMetadataSpy.mockImplementation(() => {
        throw new Error('Fatal');
      });

      const { GET } = await freshImportRoute();
      const req = new Request('http://localhost/api/health', {
        headers: { authorization: 'Bearer test-token' },
      });
      const resp = await GET(req);

      expect(resp.status).toBe(503);
      const body = (await resp.json()) as Record<string, unknown>;
      expect(body.status).toBe('unhealthy');
    });
  });
});