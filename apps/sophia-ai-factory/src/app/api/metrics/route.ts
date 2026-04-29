/**
 * GET /api/metrics
 * Returns per-route p50/p95/p99 percentiles from in-memory ring buffer.
 * Auth: Bearer ${METRICS_BEARER_TOKEN} — constant-time compare (timing-safe).
 * Format: JSON array (NOT Prometheus — CF Workers, no text/plain scraper).
 * Fetch: curl -H "Authorization: Bearer <METRICS_BEARER_TOKEN>" /api/metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { snapshot } from '@/lib/telemetry/metrics';

export const dynamic = 'force-dynamic';

/** Constant-time compare — prevents timing-based token enumeration. */
function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let mismatch = a.length !== b.length ? 1 : 0;
  for (let i = 0; i < maxLen; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const metricsToken = process.env.METRICS_BEARER_TOKEN;
  const auth = request.headers.get('authorization') ?? '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!metricsToken || !timingSafeEqual(provided, metricsToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = snapshot();
  return NextResponse.json(
    { ok: true, ts: Date.now(), metrics: data },
    { status: 200 }
  );
}
