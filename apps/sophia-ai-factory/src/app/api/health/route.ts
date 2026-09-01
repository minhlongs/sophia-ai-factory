/**
 * Health endpoint — component-level health checks for Cloudflare Workers runtime.
 *
 * Two response modes:
 * - Public (no token): { status, timestamp, environment } — backward compatible
 * - Authenticated (HEALTH_TOKEN bearer): + version, components (DB, KV, R2, circuit breaker)
 *
 * Component checks are non-blocking — failure of one does not block others.
 * Used by uptime monitors, load balancers, deploy scripts.
 */
export const dynamic = 'force-dynamic';

interface ComponentStatus {
  status: 'ok' | 'error' | 'unknown';
  latencyMs?: number;
  error?: string;
}

interface RealityLoopComponentStatus {
  status: 'ok' | 'degraded' | 'unknown';
  wired: number;
  deferred: number;
  totalEventTypes: number;
  /** Wired emitters with events ever emitted whose last emit is within 24h but lagging — informational. */
  lagging: string[];
  /** Wired emitters with no event in the trailing 24h (or never emitted). */
  staleEmitterTypes: string[];
  maxLagMs: number | null;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  version?: { shortSha: string; deployedAt: string };
  components?: {
    database: ComponentStatus;
    kv: ComponentStatus;
    r2: ComponentStatus;
    circuitBreaker: { status: string; openServices: string[] };
    realityLoop: RealityLoopComponentStatus;
  };
}

type AggregateStatus = 'healthy' | 'degraded' | 'unhealthy';

/** Resolve D1 database binding from CF Workers env */
function getD1Binding(): import('@cloudflare/workers-types').D1Database | null {
  try {
    const env = (globalThis as Record<string, unknown>).__env as Record<string, unknown> | undefined;
    if (env?.DB) return env.DB as import('@cloudflare/workers-types').D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB;
    return (globalDb as import('@cloudflare/workers-types').D1Database) ?? null;
  } catch {
    return null;
  }
}

/** Resolve KV binding from CF Workers env */
function getKvBinding(): import('@cloudflare/workers-types').KVNamespace | null {
  try {
    const kv = (globalThis as Record<string, unknown>)['EXPERIMENT_KV'];
    if (kv) return kv as import('@cloudflare/workers-types').KVNamespace;
    const env = (globalThis as Record<string, unknown>).__env as Record<string, unknown> | undefined;
    if (env?.EXPERIMENT_KV) return env.EXPERIMENT_KV as import('@cloudflare/workers-types').KVNamespace;
    return null;
  } catch {
    return null;
  }
}

/** Resolve R2 bucket binding from CF Workers env */
function getR2Binding(): import('@cloudflare/workers-types').R2Bucket | null {
  try {
    const bucket = (globalThis as Record<string, unknown>)['NEXT_INC_CACHE_R2_BUCKET'];
    if (bucket) return bucket as import('@cloudflare/workers-types').R2Bucket;
    const env = (globalThis as Record<string, unknown>).__env as Record<string, unknown> | undefined;
    if (env?.NEXT_INC_CACHE_R2_BUCKET) return env.NEXT_INC_CACHE_R2_BUCKET as import('@cloudflare/workers-types').R2Bucket;
    return null;
  } catch {
    return null;
  }
}

/**
 * Check database connectivity — non-blocking, returns component status.
 * Returns error status if binding is unavailable or probe fails.
 */
async function checkDatabase(): Promise<ComponentStatus> {
  try {
    const { probeD1 } = await import('@/seed/health/probe-d1');
    const db = getD1Binding();
    if (!db) {
      return { status: 'unknown', error: 'D1 binding not available' };
    }
    const result = await probeD1(db);
    return {
      status: result.status === 'up' ? 'ok' : 'error',
      latencyMs: result.latency,
      ...(result.error ? { error: result.error } : {}),
    };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}

/** Check KV connectivity — non-blocking */
async function checkKV(): Promise<ComponentStatus> {
  try {
    const { probeKv } = await import('@/seed/health/probe-kv');
    const kv = getKvBinding();
    if (!kv) {
      return { status: 'unknown', error: 'KV binding not available' };
    }
    const result = await probeKv(kv);
    return {
      status: result.status === 'up' ? 'ok' : 'error',
      latencyMs: result.latency,
      ...(result.error ? { error: result.error } : {}),
    };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}

/** Check R2 connectivity — non-blocking */
async function checkR2(): Promise<ComponentStatus> {
  try {
    const { probeR2 } = await import('@/seed/health/probe-r2');
    const bucket = getR2Binding();
    if (!bucket) {
      return { status: 'unknown', error: 'R2 binding not available' };
    }
    const result = await probeR2(bucket);
    return {
      status: result.status === 'up' ? 'ok' : 'error',
      latencyMs: result.latency,
      ...(result.error ? { error: result.error } : {}),
    };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}

/** Check circuit breaker state — non-blocking, reads in-memory state */
async function checkCircuitBreaker(): Promise<{
  status: string;
  openServices: string[];
}> {
  try {
    const { getState } = await import('@/seed/security/circuit-breaker');
    const { CircuitState } = await import('@/seed/types/failure-kind');

    const knownServices = ['heygen-ping', 'openrouter', 'elevenlabs', 'd-id'];
    const openServices: string[] = [];

    for (const service of knownServices) {
      try {
        const state = getState(service);
        if (state.state === CircuitState.OPEN || state.state === CircuitState.DEGRADED) {
          openServices.push(service);
        }
      } catch {
        // Individual service state read failure — skip
      }
    }

    return {
      status: openServices.length > 0 ? 'degraded' : 'ok',
      openServices,
    };
  } catch {
    return { status: 'unknown', openServices: [] };
  }
}

/** Check Reality Loop emitter health — non-blocking, read-only D1 aggregate */
async function checkRealityLoop(): Promise<RealityLoopComponentStatus> {
  try {
    const { getEmitterHealth } = await import('@/tree/performance/emitter-health');
    const report = await getEmitterHealth();
    // lagging = wired emitters that HAVE emitted before but lag > 12h (info tier)
    const lagging = report.entries
      .filter((e) => e.wired && e.lagMs !== null && e.lagMs > 12 * 60 * 60 * 1000 && !e.stale)
      .map((e) => e.eventType);
    return {
      status: report.staleEmitterTypes.length > 0 ? 'degraded' : 'ok',
      wired: report.wired,
      deferred: report.deferred,
      totalEventTypes: report.totalEventTypes,
      lagging,
      staleEmitterTypes: report.staleEmitterTypes,
      maxLagMs: report.maxLagMs,
    };
  } catch {
    // D1 read failure → static wiring-only fallback (never fails health)
    return {
      status: 'unknown',
      wired: 11,
      deferred: 2,
      totalEventTypes: 13,
      lagging: [],
      staleEmitterTypes: [],
      maxLagMs: null,
    };
  }
}

/**
 * Constant-time comparison of the request's Authorization header against
 * the configured token. Returns true only when a token is configured AND
 * the request presents an exact `Bearer <token>` match.
 */
async function verifyHealthToken(request: Request | undefined, healthToken: string | undefined): Promise<boolean> {
  if (!request) return false;
  const trimmed = healthToken?.trim();
  if (!trimmed) return false;
  const auth = request.headers.get('authorization') ?? '';
  if (auth.length !== `Bearer ${trimmed}`.length) return false;
  // Simple constant-time compare (avoids importing crypto for this one check).
  let result = 0;
  const expected = `Bearer ${trimmed}`;
  for (let i = 0; i < expected.length; i += 1) {
    result |= expected.charCodeAt(i) ^ auth.charCodeAt(i);
  }
  return result === 0;
}

/** Compute aggregate status from individual component statuses */
function aggregateStatus(
  dbStatus: string,
  cbStatus: string,
  kvStatus: string,
  realityLoopStatus: 'ok' | 'degraded' | 'unknown',
): AggregateStatus {
  if (dbStatus === 'error') return 'unhealthy';
  if (cbStatus === 'degraded' || kvStatus === 'error' || realityLoopStatus === 'degraded') return 'degraded';
  return 'healthy';
}

export async function GET(req?: Request) {
  try {
    // Run all component checks concurrently — non-blocking
    const [database, kv, r2, circuitBreaker, realityLoop] = await Promise.all([
      checkDatabase(),
      checkKV(),
      checkR2(),
      checkCircuitBreaker(),
      checkRealityLoop(),
    ]);

    const status = aggregateStatus(
      database.status,
      circuitBreaker.status,
      kv.status,
      realityLoop.status,
    );

    const { getBuildMetadata } = await import('@/seed/health/build-metadata');
    const build = getBuildMetadata();
    const shortSha = build.sha?.slice(0, 8) ?? 'unknown';

    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    let env: Record<string, unknown> | undefined;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env as Record<string, unknown> | undefined;
    } catch {
      env = undefined;
    }

    const healthToken = env?.HEALTH_TOKEN as string | undefined
      ?? process.env.HEALTH_TOKEN;

    const isAuthorized = await verifyHealthToken(req, healthToken);

    // If HEALTH_TOKEN is configured but request is not authorized, return 401
    if (healthToken?.trim() && !isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    const body: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'unknown',
    };

    if (isAuthorized) {
      body.version = {
        shortSha,
        deployedAt: build.deployedAt,
      };
      body.components = {
        database,
        kv,
        r2,
        circuitBreaker,
        realityLoop,
      };
    }

    return new Response(JSON.stringify(body), {
      status: status === 'unhealthy' ? 503 : 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ status: 'unhealthy', error: 'Service temporarily unavailable' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
