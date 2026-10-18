// Health Worker — standalone, no Next.js dependencies
// This bypasses OpenNext bundling to avoid module factory errors

import {
  checkEnvConfigs,
  checkRateLimit,
  probeD1,
  probeKV,
  probeR2,
} from './health-worker-probes';

export interface Env {
  COMMIT_SHA?: string;
  DEPLOYED_AT?: string;
  HEALTH_CHECK_SECRET?: string;
  DB?: D1Database;
  NEXT_INC_CACHE_R2_BUCKET?: R2Bucket;
  EXPERIMENT_KV?: KVNamespace;
  [key: string]: unknown;
}

const healthWorker = {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    // Rate limiting
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ status: 'rate_limited', error: 'Too many requests' }), {
        status: 429,
        headers: { 'Retry-After': '60', 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const authHeader = request.headers.get('Authorization');
    const secret = env.HEALTH_CHECK_SECRET;
    const isAuthorized = !!secret && (token === secret || authHeader === `Bearer ${secret}`);

    const services: Record<string, unknown> = {};
    const d1Status = await probeD1(env.DB, isAuthorized, services);
    const r2Status = await probeR2(env.NEXT_INC_CACHE_R2_BUCKET, isAuthorized, services);
    const kvStatus = await probeKV(env.EXPERIMENT_KV, isAuthorized, services);

    const isDegraded = d1Status === 'degraded' || r2Status === 'degraded' || kvStatus === 'degraded';
    const status = isDegraded ? 'degraded' : 'healthy';

    if (isAuthorized) {
      checkEnvConfigs(env, services);
    }

    const healthStatus: Record<string, unknown> = {
      status,
      timestamp: new Date().toISOString(),
      sha: env.COMMIT_SHA ?? 'unknown',
      deployedAt: env.DEPLOYED_AT ?? 'unknown',
      ...(isAuthorized ? { services } : {}),
    };

    const responseStatus = status === 'healthy' ? 200 : 503;

    if (!isAuthorized) {
      const publicBody = { status, timestamp: healthStatus.timestamp, sha: healthStatus.sha };
      return new Response(JSON.stringify(publicBody), {
        status: responseStatus,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
        },
      });
    }

    return new Response(JSON.stringify(healthStatus), {
      status: responseStatus,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
  },
};

export default healthWorker;
