// Health Worker Probes — standalone, no Next.js dependencies

import type { Env } from './health-worker';

const rateLimitMap = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT_MAX = 300;
const RATE_LIMIT_WINDOW = 60_000;

export function checkRateLimit(key: string): boolean {
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

export async function probeD1(
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

export async function probeR2(
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

export async function probeKV(
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

export function checkEnvConfigs(env: Env, services: Record<string, unknown>): void {
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
