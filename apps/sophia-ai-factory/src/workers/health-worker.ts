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

async function probeD1(
  db: D1Database | undefined,
  isAuthorized: boolean,
  services: Record<string, unknown>,
): Promise<'healthy' | 'degraded'> {
  if (!db) return 'healthy';
  try {
    const t0 = Date.now();
    await db.prepare('SELECT 1').run();
    const latency = Date.now() - t0;
    if (isAuthorized) services.d1 = { status: 'up', latency };
    return 'healthy';
  } catch (e) {
    if (isAuthorized) services.d1 = { status: 'down', error: String(e) };
    return 'degraded';
  }
}

async function probeR2(
  bucket: R2Bucket | undefined,
  isAuthorized: boolean,
  services: Record<string, unknown>,
): Promise<'healthy' | 'degraded'> {
  if (!bucket) return 'healthy';
  try {
    const t0 = Date.now();
    await bucket.head('health-check.txt');
    const latency = Date.now() - t0;
    if (isAuthorized) services.r2 = { status: 'up', latency };
    return 'healthy';
  } catch {
    if (isAuthorized) services.r2 = { status: 'down' };
    return 'degraded';
  }
}

async function probeKV(
  kv: KVNamespace | undefined,
  isAuthorized: boolean,
  services: Record<string, unknown>,
): Promise<'healthy' | 'degraded'> {
  if (!kv) return 'healthy';
  try {
    const t0 = Date.now();
    await kv.get('health:ping');
    const latency = Date.now() - t0;
    if (isAuthorized) services.kv = { status: 'up', latency };
    return 'healthy';
  } catch {
    if (isAuthorized) services.kv = { status: 'down' };
    return 'degraded';
  }
}

function checkEnvConfigs(env: Env, services: Record<string, unknown>): void {
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
  for (const { key, name } of configs) {
    services[name] = { status: env[key] ? 'configured' : 'missing_config' };
  }
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
