// Health Worker — standalone, no Next.js dependencies
// This bypasses OpenNext bundling to avoid module factory errors

export interface Env {
  COMMIT_SHA?: string;
  DEPLOYED_AT?: string;
  HEALTH_CHECK_SECRET?: string;
  DB?: D1Database;
  NEXT_INC_CACHE_R2_BUCKET?: R2Bucket;
  EXPERIMENT_KV?: KVNamespace;
  [key: string]: unknown;
}

// Simple rate limiting (in-memory, per-isolate)
const rateLimitMap = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT_MAX = 300;
const RATE_LIMIT_WINDOW = 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(key, { count: 1, reset: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
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

    const healthStatus: Record<string, unknown> = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sha: env.COMMIT_SHA ?? 'unknown',
      deployedAt: env.DEPLOYED_AT ?? 'unknown',
    };

    // D1 probe
    if (env.DB) {
      try {
        const t0 = Date.now();
        await env.DB.prepare('SELECT 1').run();
        const latency = Date.now() - t0;
        if (isAuthorized) (healthStatus.services as Record<string, unknown>).d1 = { status: 'up', latency };
      } catch (e) {
        if (isAuthorized) (healthStatus.services as Record<string, unknown>).d1 = { status: 'down', error: String(e) };
        healthStatus.status = 'degraded';
      }
    }

    // R2 probe
    if (env.NEXT_INC_CACHE_R2_BUCKET) {
      try {
        const t0 = Date.now();
        await env.NEXT_INC_CACHE_R2_BUCKET.head('health-check.txt');
        const latency = Date.now() - t0;
        if (isAuthorized) (healthStatus.services as Record<string, unknown>).r2 = { status: 'up', latency };
      } catch {
        if (isAuthorized) (healthStatus.services as Record<string, unknown>).r2 = { status: 'down' };
        healthStatus.status = 'degraded';
      }
    }

    // KV probe
    if (env.EXPERIMENT_KV) {
      try {
        const t0 = Date.now();
        await env.EXPERIMENT_KV.get('health:ping');
        const latency = Date.now() - t0;
        if (isAuthorized) (healthStatus.services as Record<string, unknown>).kv = { status: 'up', latency };
      } catch {
        if (isAuthorized) (healthStatus.services as Record<string, unknown>).kv = { status: 'down' };
        healthStatus.status = 'degraded';
      }
    }

    // Config checks (auth, APIs)
    if (isAuthorized) {
      const configs = [
        { key: 'NEXT_PUBLIC_SUPABASE_URL', name: 'supabase' },
        { key: 'UPSTASH_REDIS_REST_URL', name: 'redis' },
        { key: 'OPENROUTER_API_KEY', name: 'openrouter' },
        { key: 'ELEVENLABS_API_KEY', name: 'elevenlabs' },
        { key: 'HEYGEN_API_KEY', name: 'heygen' },
        { key: 'TELEGRAM_BOT_TOKEN', name: 'telegram' },
        { key: 'NEXT_PUBLIC_SENTRY_DSN', name: 'sentry' },
        { key: 'INNGEST_EVENT_KEY', name: 'inngest' },
      ];
      configs.forEach(({ key, name }) => {
        (healthStatus.services as Record<string, unknown>)[name] = { status: env[key] ? 'configured' : 'missing_config' };
      });
    }

    const responseStatus = healthStatus.status === 'healthy' ? 200 : 503;

    if (!isAuthorized) {
      const publicBody = { status: healthStatus.status, timestamp: healthStatus.timestamp, sha: healthStatus.sha };
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
