/**
 * Dedicated route verification tests for /api/health endpoint.
 * Verifies structured JSON response, checks payload, fail-closed DB behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const probeD1Mock = vi.fn();
const probeKvMock = vi.fn();
const probeR2Mock = vi.fn();
const getStateMock = vi.fn();
const getBuildMetadataMock = vi.fn();
const getEmitterHealthMock = vi.fn();

function installMocks() {
  vi.doMock('@/seed/health/probe-d1', () => ({
    probeD1: (...args: unknown[]) => probeD1Mock(...args),
  }));
  vi.doMock('@/seed/health/probe-kv', () => ({
    probeKv: (...args: unknown[]) => probeKvMock(...args),
  }));
  vi.doMock('@/seed/health/probe-r2', () => ({
    probeR2: (...args: unknown[]) => probeR2Mock(...args),
  }));
  vi.doMock('@/seed/health/build-metadata', () => ({
    getBuildMetadata: (...args: unknown[]) => getBuildMetadataMock(...args),
  }));
  vi.doMock('@/seed/security/circuit-breaker', () => ({
    getState: (...args: unknown[]) => getStateMock(...args),
  }));
  vi.doMock('@/seed/types/failure-kind', () => ({
    CircuitState: { CLOSED: 'CLOSED', DEGRADED: 'DEGRADED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' },
  }));
  vi.doMock('@/tree/performance/emitter-health', () => ({
    getEmitterHealth: (...args: unknown[]) => getEmitterHealthMock(...args),
  }));
  vi.doMock('@opennextjs/cloudflare', () => ({
    getCloudflareContext: vi.fn().mockRejectedValue(new Error('Not in CF context')),
  }));
}

function resetSpies() {
  probeD1Mock.mockReset();
  probeKvMock.mockReset();
  probeR2Mock.mockReset();
  getStateMock.mockReset();
  getBuildMetadataMock.mockReset();
  getEmitterHealthMock.mockReset();

  probeD1Mock.mockResolvedValue({ status: 'up', latency: 3 });
  probeKvMock.mockResolvedValue({ status: 'up', latency: 1 });
  probeR2Mock.mockResolvedValue({ status: 'up', latency: 2 });
  getStateMock.mockReturnValue({ state: 'CLOSED', failureCount: 0 });
  getBuildMetadataMock.mockReturnValue({
    sha: 'b77c5504deadbeef',
    deployedAt: '2026-09-10T12:00:00Z',
  });
  getEmitterHealthMock.mockResolvedValue({
    totalEventTypes: 13,
    wired: 11,
    deferred: 2,
    staleEmitterTypes: [],
    entries: [],
    maxLagMs: null,
  });
}

function importRoute() {
  vi.resetModules();
  return import('../route');
}

interface TestHealthBody {
  status: string;
  timestamp: string;
  version?: {
    shortSha: string;
    commitSha: string;
    deployedAt: string;
  };
  checks?: {
    database: string;
    kv: string;
  };
  components?: {
    database: { status: string; error?: string };
    kv: { status: string };
  };
  error?: string;
}

describe('/api/health route specification', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetSpies();
    installMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns HTTP 200 with structured checks and version when authorized', async () => {
    process.env.HEALTH_TOKEN = 'ops-secret-token';
    const { GET } = await importRoute();
    const req = new Request('http://localhost/api/health', {
      headers: { authorization: 'Bearer ops-secret-token' },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as TestHealthBody;
    expect(data.status).toBe('healthy');
    expect(typeof data.timestamp).toBe('string');
    expect(data.version).toEqual({
      shortSha: 'b77c5504',
      commitSha: 'b77c5504deadbeef',
      deployedAt: '2026-09-10T12:00:00Z',
    });
    expect(data.checks).toEqual({
      database: 'ok',
      kv: 'ok',
    });
    expect(data.components?.database.status).toBe('ok');
    expect(data.components?.kv.status).toBe('ok');
    expect(probeD1Mock).toHaveBeenCalled();
  });

  it('fails closed with HTTP 503 and degraded database check when D1 is down', async () => {
    process.env.HEALTH_TOKEN = 'ops-secret-token';
    probeD1Mock.mockResolvedValue({
      status: 'down',
      latency: 3000,
      error: 'D1 connection timeout',
    });

    const { GET } = await importRoute();
    const req = new Request('http://localhost/api/health', {
      headers: { authorization: 'Bearer ops-secret-token' },
    });

    const res = await GET(req);
    expect(res.status).toBe(503);

    const data = (await res.json()) as TestHealthBody;
    expect(data.status).toBe('unhealthy');
    expect(data.checks?.database).toBe('degraded');
    expect(data.checks?.kv).toBe('ok');
    expect(data.components?.database.status).toBe('error');
    expect(data.components?.database.error).toBe('D1 connection timeout');
  });

  it('marks kv as degraded when KV probe fails but keeps HTTP 200', async () => {
    process.env.HEALTH_TOKEN = 'ops-secret-token';
    probeKvMock.mockResolvedValue({
      status: 'down',
      latency: 1500,
      error: 'KV unreachable',
    });

    const { GET } = await importRoute();
    const req = new Request('http://localhost/api/health', {
      headers: { authorization: 'Bearer ops-secret-token' },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as TestHealthBody;
    expect(data.status).toBe('degraded');
    expect(data.checks?.kv).toBe('degraded');
    expect(data.checks?.database).toBe('ok');
  });

  it('rejects unauthenticated requests with 401 when HEALTH_TOKEN is set', async () => {
    process.env.HEALTH_TOKEN = 'ops-secret-token';
    const { GET } = await importRoute();
    const req = new Request('http://localhost/api/health');

    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = (await res.json()) as TestHealthBody;
    expect(data.error).toBe('Unauthorized');
  });
});
