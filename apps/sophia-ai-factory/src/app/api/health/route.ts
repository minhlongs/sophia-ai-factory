import { NextRequest, NextResponse } from 'next/server';
import { getBuildMetadata } from '@/seed/health';
import type { D1Database, R2Bucket, KVNamespace } from '@cloudflare/workers-types';
import type { HealthResponse } from '@/seed/types/health';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

// Wrap handler with rate limiting (300 requests per minute for health checks).
//
// FAST-PATH for unauthenticated callers (uptime probes, LB checks, k6, public
// status page): short-circuit BEFORE probing D1/R2/KV/Supabase/Redis. The
// public response only needs to confirm the Worker is alive — deep service
// probes pay 2-3s cold-start latency that the unauth caller never sees in
// the response body anyway.
//
// Authenticated callers (admin debugging) still get the full probe sweep.
export const GET = withRateLimit(async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get('token');
    const authHeader = req.headers.get('authorization');
    const secret = process.env.HEALTH_CHECK_SECRET;
    let isAuthorized = !!(secret && (token === secret || authHeader === `Bearer ${secret}`));

    if (!isAuthorized) {
      try {
        const { getCurrentUserFromHeaders } = await import('@/seed/auth/better-auth-session');
        const user = await getCurrentUserFromHeaders(req.headers);
        if (user) isAuthorized = true;
      } catch { /* session check failed */ }
    }

    const { sha, deployedAt } = getBuildMetadata();

    // ── PROBE PATH: full service probe sweep below. ────────────────
    const { createServerClient } = await import('@/seed/db/client');
    const { redisHelpers } = await import('@/tree/clients/upstash-redis-client');
    const { probeD1, probeR2, probeKv } = await import('@/seed/health');

    const healthStatus: HealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sha,
      deployedAt,
      services: {},
    };

    // 1. CF bindings: D1, R2, KV (only available on Cloudflare Workers runtime)
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const cfCtx = await getCloudflareContext();
      const env = cfCtx.env as Record<string, unknown>;

      if (env.DB) {
        const d1Result = await probeD1(env.DB as D1Database);
        if (isAuthorized) {
          healthStatus.services.d1 = {
            status: d1Result.status,
            latency: d1Result.latency,
            ...(d1Result.error && { error: d1Result.error }),
          };
        }
        if (d1Result.status === 'down') healthStatus.status = 'degraded';
      }

      if (env.NEXT_INC_CACHE_R2_BUCKET) {
        const r2Result = await probeR2(env.NEXT_INC_CACHE_R2_BUCKET as R2Bucket);
        if (isAuthorized) {
          healthStatus.services.r2 = {
            status: r2Result.status,
            latency: r2Result.latency,
            ...(r2Result.error && { error: r2Result.error }),
          };
        }
      }

      if (env.EXPERIMENT_KV) {
        const kvResult = await probeKv(env.EXPERIMENT_KV as KVNamespace);
        if (isAuthorized) {
          healthStatus.services.kv = {
            status: kvResult.status,
            latency: kvResult.latency,
            ...(kvResult.error && { error: kvResult.error }),
          };
        }
      }
    } catch {
      // CF context unavailable (local dev) — skip cloud binding probes
    }

    // 2. Supabase (non-critical — profiles only)
    const supabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseConfigured) {
      const t0 = Date.now();
      try {
        const db = createServerClient();
        const { error } = await db.from('user_profiles').select('user_id').limit(1);
        if (isAuthorized) {
          healthStatus.services.supabase = {
            status: error ? 'degraded' : 'up',
            latency: Date.now() - t0,
            ...(error && { error: error.message }),
          };
        }
      } catch {
        if (isAuthorized) healthStatus.services.supabase = { status: 'degraded', latency: Date.now() - t0 };
      }
    } else if (isAuthorized) {
      healthStatus.services.supabase = { status: 'not_configured' };
    }

    // 3. Redis
    const redisConfigured = !!process.env.UPSTASH_REDIS_REST_URL;
    if (redisConfigured) {
      const t0 = Date.now();
      try {
        const isUp = await redisHelpers.ping();
        if (isAuthorized) healthStatus.services.redis = { status: isUp ? 'up' : 'down', latency: Date.now() - t0 };
        if (!isUp) healthStatus.status = 'degraded';
      } catch (err) {
        healthStatus.status = 'degraded';
        if (isAuthorized) {
          healthStatus.services.redis = {
            status: 'down',
            latency: Date.now() - t0,
            error: err instanceof Error ? err.message : 'unknown',
          };
        } else {
          healthStatus.services.redis = { status: 'down' };
        }
      }
    } else if (isAuthorized) {
      healthStatus.services.redis = { status: 'not_configured' };
    }

    // 4. Inngest + external services (config check only)
    if (isAuthorized) {
      const inngestOk = !!process.env.INNGEST_EVENT_KEY && !!process.env.INNGEST_SIGNING_KEY;
      healthStatus.services.inngest = { status: inngestOk ? 'configured' : 'not_configured' };
      for (const { key, name } of [
        { key: 'OPENROUTER_API_KEY', name: 'openrouter' },
        { key: 'ELEVENLABS_API_KEY', name: 'elevenlabs' },
        { key: 'HEYGEN_API_KEY', name: 'heygen' },
        { key: 'TELEGRAM_BOT_TOKEN', name: 'telegram' },
        { key: 'NEXT_PUBLIC_SENTRY_DSN', name: 'sentry' },
      ]) {
        healthStatus.services[name] = { status: process.env[key] ? 'configured' : 'missing_config' };
      }
    }

    // ── RESPONSES ─────────────────
    const responseStatus = healthStatus.status === 'healthy' ? 200 : 503;

    if (!isAuthorized) {
      return NextResponse.json(
        { 
          status: healthStatus.status, 
          timestamp: healthStatus.timestamp, 
          sha 
        },
        {
          status: responseStatus,
          headers: {
            'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
          },
        },
      );
    }

    return NextResponse.json(healthStatus, {
      status: responseStatus,
    });
  } catch (err) {
    console.error('Health check failed:', err);
    return NextResponse.json({ status: 'unhealthy', error: 'Health check failed' }, { status: 500 });
  }
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 300 } });
