/**
 * Health endpoint — component-level health checks for Cloudflare Workers runtime.
 * Two response modes:
 * - Public: { status, timestamp, environment }
 * - Authenticated (HEALTH_TOKEN bearer): + version, checks (DB, KV), components
 * Layer: App Router API Route.
 */
export const dynamic = 'force-dynamic';

interface ComponentStatus {
  status: 'ok' | 'error' | 'unknown';
  latencyMs?: number;
  error?: string;
}

interface RealityLoopStatus {
  status: 'ok' | 'degraded' | 'unknown';
  wired: number;
  deferred: number;
  totalEventTypes: number;
  lagging: string[];
  staleEmitterTypes: string[];
  maxLagMs: number | null;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  version?: { shortSha: string; commitSha: string; deployedAt: string };
  checks?: { database: 'ok' | 'degraded'; kv: 'ok' | 'degraded' };
  components?: {
    database: ComponentStatus;
    kv: ComponentStatus;
    r2: ComponentStatus;
    circuitBreaker: { status: string; openServices: string[] };
    realityLoop: RealityLoopStatus;
  };
}

function getBinding<T>(key: string): T | null {
  try {
    const g = globalThis as Record<string, unknown>;
    if (g[key]) return g[key] as T;
    const env = g.__env as Record<string, unknown> | undefined;
    return (env?.[key] as T) ?? null;
  } catch {
    return null;
  }
}

async function checkDatabase(): Promise<ComponentStatus> {
  try {
    const { probeD1 } = await import('@/seed/health/probe-d1');
    const { getD1, createServerClient } = await import('@/seed/db/client');
    let db = getBinding<import('@cloudflare/workers-types').D1Database>('DB') ?? (await getD1());
    if (!db) {
      try {
        const client = createServerClient();
        if (client && typeof client.prepare === 'function') db = client as unknown as import('@cloudflare/workers-types').D1Database;
      } catch { /* ignore */ }
    }
    if (!db) return { status: 'unknown', error: 'D1 binding not available' };
    const res = await probeD1(db);
    return { status: res.status === 'up' ? 'ok' : 'error', latencyMs: res.latency, ...(res.error ? { error: res.error } : {}) };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'unknown' };
  }
}

async function probeBinding(type: 'kv' | 'r2'): Promise<ComponentStatus> {
  try {
    if (type === 'kv') {
      const { probeKv } = await import('@/seed/health/probe-kv');
      const kv = getBinding<import('@cloudflare/workers-types').KVNamespace>('EXPERIMENT_KV');
      if (!kv) return { status: 'unknown', error: 'KV binding not available' };
      const res = await probeKv(kv);
      return { status: res.status === 'up' ? 'ok' : 'error', latencyMs: res.latency, ...(res.error ? { error: res.error } : {}) };
    }
    const { probeR2 } = await import('@/seed/health/probe-r2');
    const b = getBinding<import('@cloudflare/workers-types').R2Bucket>('NEXT_INC_CACHE_R2_BUCKET');
    if (!b) return { status: 'unknown', error: 'R2 binding not available' };
    const res = await probeR2(b);
    return { status: res.status === 'up' ? 'ok' : 'error', latencyMs: res.latency, ...(res.error ? { error: res.error } : {}) };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'unknown' };
  }
}

async function checkCircuitBreaker(): Promise<{ status: string; openServices: string[] }> {
  try {
    const { getState } = await import('@/seed/security/circuit-breaker');
    const { CircuitState } = await import('@/seed/types/failure-kind');
    const open = ['heygen-ping', 'openrouter', 'elevenlabs', 'd-id'].filter((s) => {
      try {
        const st = getState(s).state;
        return st === CircuitState.OPEN || st === CircuitState.DEGRADED;
      } catch { return false; }
    });
    return { status: open.length > 0 ? 'degraded' : 'ok', openServices: open };
  } catch {
    return { status: 'unknown', openServices: [] };
  }
}

async function checkRealityLoop(): Promise<RealityLoopStatus> {
  try {
    const { getEmitterHealth } = await import('@/tree/performance/emitter-health');
    const r = await getEmitterHealth();
    const lagging = r.entries.filter((e) => e.wired && e.lagMs !== null && e.lagMs > 43200000 && !e.stale).map((e) => e.eventType);
    return { status: r.staleEmitterTypes.length > 0 ? 'degraded' : 'ok', wired: r.wired, deferred: r.deferred, totalEventTypes: r.totalEventTypes, lagging, staleEmitterTypes: r.staleEmitterTypes, maxLagMs: r.maxLagMs };
  } catch {
    return { status: 'unknown', wired: 11, deferred: 2, totalEventTypes: 13, lagging: [], staleEmitterTypes: [], maxLagMs: null };
  }
}

function verifyHealthToken(request: Request | undefined, healthToken: string | undefined): boolean {
  if (!request) return false;
  const trimmed = healthToken?.trim();
  if (!trimmed) return false;
  const auth = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${trimmed}`;
  if (auth.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i += 1) result |= expected.charCodeAt(i) ^ auth.charCodeAt(i);
  return result === 0;
}

export async function GET(req?: Request) {
  try {
    const [database, kv, r2, circuitBreaker, realityLoop] = await Promise.all([
      checkDatabase(), probeBinding('kv'), probeBinding('r2'), checkCircuitBreaker(), checkRealityLoop(),
    ]);

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (database.status === 'error') {
      status = 'unhealthy';
    } else if (circuitBreaker.status === 'degraded' || kv.status === 'error' || realityLoop.status === 'degraded') {
      status = 'degraded';
    }

    const { getBuildMetadata } = await import('@/seed/health/build-metadata');
    const build = getBuildMetadata();
    const shortSha = build.sha?.slice(0, 8) ?? 'unknown';

    let env: Record<string, unknown> | undefined;
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      env = (await getCloudflareContext()).env as Record<string, unknown> | undefined;
    } catch { env = undefined; }

    const healthToken = (env?.HEALTH_TOKEN as string | undefined) ?? process.env.HEALTH_TOKEN;
    const isAuthorized = verifyHealthToken(req, healthToken);

    if (healthToken?.trim() && !isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      });
    }

    const body: HealthResponse = { status, timestamp: new Date().toISOString(), environment: process.env.NODE_ENV ?? 'unknown' };

    if (isAuthorized) {
      body.version = { shortSha, commitSha: build.sha ?? shortSha, deployedAt: build.deployedAt };
      body.checks = { database: database.status === 'ok' ? 'ok' : 'degraded', kv: kv.status === 'ok' ? 'ok' : 'degraded' };
      body.components = { database, kv, r2, circuitBreaker, realityLoop };
    }

    return new Response(JSON.stringify(body), {
      status: status === 'unhealthy' ? 503 : 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
  } catch {
    return new Response(JSON.stringify({ status: 'unhealthy', error: 'Service temporarily unavailable' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}
