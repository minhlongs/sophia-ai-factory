/**
 * Reality Loop Health — /api/reality-loop/health
 *
 * P3.D.9: Emitter health + event-lag for the 13 canonical Reality Loop events.
 * Two response modes:
 * - Public (no/invalid token): { status, wired, deferred, timestamp }
 * - Authenticated (valid HEALTH_TOKEN bearer): + entries, staleEmitterTypes, maxLagMs
 *
 * Auth: when HEALTH_TOKEN is configured, the request must present it via
 * `Authorization: Bearer <HEALTH_TOKEN>`. When absent, the endpoint stays
 * public (graceful degradation for test/local contexts).
 *
 * Read-only. Never mutates. Never throws (degrades to static wiring report).
 */

export const dynamic = 'force-dynamic';

import { getEmitterHealth, type EmitterHealthEntry } from '@/tree/performance/emitter-health';

interface RealityLoopHealthResponse {
  status: 'healthy' | 'degraded';
  timestamp: string;
  wired: number;
  deferred: number;
  totalEventTypes: number;
  entries?: EmitterHealthEntry[];
  staleEmitterTypes?: string[];
  maxLagMs?: number | null;
}

/** Resolve HEALTH_TOKEN from CF env or process.env. */
async function resolveHealthToken(): Promise<string | undefined> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    const env = ctx.env as Record<string, unknown> | undefined;
    const fromCf = env?.HEALTH_TOKEN as string | undefined;
    if (fromCf) return fromCf;
  } catch {
    // Not in CF context — fall through to process.env.
  }
  return process.env.HEALTH_TOKEN ?? undefined;
}

/**
 * Constant-time comparison of the request's Authorization header against
 * the configured token. Returns true only when a token is configured AND
 * the request presents an exact `Bearer <token>` match.
 */
async function isAuthorized(request: Request | undefined): Promise<boolean> {
  if (!request) return false;
  const healthToken = await resolveHealthToken();
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

export async function GET(req?: Request): Promise<Response> {
  const report = await getEmitterHealth();
  const authorized = await isAuthorized(req);

  const body: RealityLoopHealthResponse = {
    status: report.staleEmitterTypes.length > 0 ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    wired: report.wired,
    deferred: report.deferred,
    totalEventTypes: report.totalEventTypes,
  };

  if (authorized) {
    body.entries = report.entries;
    body.staleEmitterTypes = report.staleEmitterTypes;
    body.maxLagMs = report.maxLagMs;
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
