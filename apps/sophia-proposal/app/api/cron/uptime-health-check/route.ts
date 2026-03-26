/**
 * Cron endpoint — POST /api/cron/uptime-health-check
 *
 * Called periodically to verify system health and store results in D1.
 * Calls /api/health/deep internally and records latency + status.
 * Auth: requires CRON_SECRET header to prevent external abuse.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1Client } from '@/lib/db/client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function runHealthCheck(baseUrl: string, internalSecret: string): Promise<{
  status: 'ok' | 'degraded' | 'error';
  latency_ms: number;
  details: Record<string, unknown>;
}> {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/health/deep`, {
      headers: { 'x-internal-secret': internalSecret },
    });
    const latency_ms = Date.now() - start;
    const details = await res.json() as Record<string, unknown>;
    const status = res.ok
      ? (details?.sla as { status?: string })?.status === 'SLA_MET' ? 'ok' : 'degraded'
      : 'error';
    return { status, latency_ms, details };
  } catch (err) {
    return {
      status: 'error',
      latency_ms: Date.now() - start,
      details: { error: (err as Error).message },
    };
  }
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const provided = request.headers.get('x-cron-secret');

  if (cronSecret && provided !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!internalSecret) {
    return NextResponse.json({ error: 'INTERNAL_API_SECRET not configured' }, { status: 503 });
  }

  // Resolve base URL for internal fetch
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? `https://${request.headers.get('host')}`;

  const { status, latency_ms, details } = await runHealthCheck(baseUrl, internalSecret);

  logger.info('Uptime health check completed', { status, latency_ms });

  // Persist result to D1 for historical uptime tracking
  try {
    const db = await getD1Client();
    await db.from('health_checks').insert({
      status,
      latency_ms,
      details: JSON.stringify(details),
    });
  } catch (err) {
    // Non-fatal: log but don't fail the cron job
    logger.error('Failed to persist health check to D1', err);
  }

  return NextResponse.json({
    success: true,
    status,
    latency_ms,
    timestamp: new Date().toISOString(),
  });
}

// Support GET for Cloudflare cron triggers (which use GET by default)
export async function GET(request: NextRequest) {
  return POST(request);
}
