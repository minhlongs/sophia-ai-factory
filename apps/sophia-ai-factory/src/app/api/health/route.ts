/**
 * Health endpoint — component-level health checks for Cloudflare Workers runtime.
 * Two response modes:
 * - Public: { status, timestamp, environment }
 * - Authenticated (HEALTH_TOKEN bearer): + version, checks (DB, KV), components
 * Layer: App Router API Route.
 */
import type { HealthResponse } from './health-types';
import { checkDatabase, probeBinding, checkCircuitBreaker, checkRealityLoop } from './health-probes';
import { verifyHealthToken } from './health-auth';

export const dynamic = 'force-dynamic';

export async function GET(req?: Request) {
  try {
    let env: Record<string, unknown> | undefined;
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      env = (await getCloudflareContext({ async: true })).env as Record<string, unknown> | undefined;
    } catch { env = undefined; }

    const healthToken = (env?.HEALTH_TOKEN as string | undefined) ?? process.env.HEALTH_TOKEN;
    const isAuthorized = verifyHealthToken(req, healthToken);

    // Public mode: run only minimal DB + circuit-breaker probes (no KV/R2/RealityLoop amplification)
    if (!isAuthorized) {
      const [database, circuitBreaker] = await Promise.all([
        checkDatabase(),
        checkCircuitBreaker(),
      ]);
      const publicStatus: 'healthy' | 'degraded' | 'unhealthy' =
        database.status === 'error'
          ? 'unhealthy'
          : circuitBreaker.status === 'degraded'
            ? 'degraded'
            : 'healthy';
      const publicBody: HealthResponse = {
        status: publicStatus,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV ?? 'unknown',
      };
      return new Response(JSON.stringify(publicBody), {
        status: publicStatus === 'unhealthy' ? 503 : 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Vary': 'Authorization',
        },
      });
    }

    const [database, kv, r2, circuitBreaker, realityLoop] = await Promise.all([
      checkDatabase(), probeBinding('kv'), probeBinding('r2'), checkCircuitBreaker(), checkRealityLoop(),
    ]);

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (database.status === 'error') {
      status = 'unhealthy';
    } else if (circuitBreaker.status === 'degraded' || kv.status === 'error') {
      status = 'degraded';
    }

    const { getBuildMetadata } = await import('@/seed/health/build-metadata');
    const build = getBuildMetadata();
    const shortSha = build.sha?.slice(0, 8) ?? 'unknown';

    const body: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'unknown',
      version: { shortSha, commitSha: build.sha ?? shortSha, deployedAt: build.deployedAt },
      checks: { database: database.status === 'ok' ? 'ok' : 'degraded', kv: kv.status === 'ok' ? 'ok' : 'degraded' },
      components: { database, kv, r2, circuitBreaker, realityLoop },
    };

    return new Response(JSON.stringify(body), {
      status: status === 'unhealthy' ? 503 : 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Vary': 'Authorization',
      },
    });
  } catch {
    return new Response(JSON.stringify({ status: 'unhealthy', error: 'Service temporarily unavailable' }), {
      status: 503, headers: { 'Content-Type': 'application/json', 'Vary': 'Authorization' },
    });
  }
}
