/**
 * GET /api/metrics
 * Returns per-route p50/p95/p99 percentiles from in-memory ring buffer.
 * Auth: Bearer ${INTROSPECT_TOKEN} (same token as /api/version full SHA — P1).
 * Format: JSON array (NOT Prometheus — CF Workers, no text/plain scraper).
 * RED-TEAM #10: requires INTROSPECT_TOKEN; 401 if missing/wrong.
 */

import { NextRequest, NextResponse } from 'next/server';
import { snapshot } from '@/lib/telemetry/metrics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const introspectToken = process.env.INTROSPECT_TOKEN;
  const auth = request.headers.get('authorization');

  if (!introspectToken || auth !== `Bearer ${introspectToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = snapshot();
  return NextResponse.json(
    { ok: true, ts: Date.now(), metrics: data },
    { status: 200 }
  );
}
