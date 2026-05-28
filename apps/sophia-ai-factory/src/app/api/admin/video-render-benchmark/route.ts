/**
 * GET /api/admin/video-render-benchmark — P27 honest measurement endpoint.
 *
 * Computes p50/p95/p99 render durations from `video_jobs` over a configurable
 * look-back window. Surfaces sample size + low_confidence flag so admins know
 * when not to publish externally.
 *
 * Query params:
 *   - window=<seconds> — defaults to 7 days
 *   - tier=BASIC|PREMIUM|ENTERPRISE|MASTER — optional filter
 *
 * Guard: CRON_SECRET Bearer token (same pattern as llm-cache-stats).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1Raw } from '@/seed/auth/resolve-org-id';
import { computeVideoRenderBenchmark } from '@/lib/analytics/video-render-benchmark';
import { getErrorMessage } from '@/seed/utils/to-error';
import { timingSafeEqual } from '@/seed/security/crypto-utils';

export const dynamic = 'force-dynamic';

function verifyCronSecret(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  return timingSafeEqual(provided, expected);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ts = new Date().toISOString();
  const { searchParams } = new URL(request.url);
  const windowSecondsRaw = searchParams.get('window');
  const tier = searchParams.get('tier') ?? undefined;
  const windowSeconds = windowSecondsRaw ? Math.max(60, Number(windowSecondsRaw)) : undefined;

  try {
    const d1 = getD1Raw();
    if (!d1) {
      return NextResponse.json({ ok: false, reason: 'D1_UNAVAILABLE', ts }, { status: 200 });
    }
    const summary = await computeVideoRenderBenchmark(d1, { windowSeconds, tier });
    return NextResponse.json({ ok: true, ts, summary }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, reason: 'D1_ERROR', error: getErrorMessage(err), ts },
      { status: 200 },
    );
  }
}
