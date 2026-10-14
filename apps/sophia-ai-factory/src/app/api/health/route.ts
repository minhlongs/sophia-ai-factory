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
