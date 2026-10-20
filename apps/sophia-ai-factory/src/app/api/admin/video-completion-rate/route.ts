/**
 * GET /api/admin/video-completion-rate — completion-lifecycle counterpart to the
 * render benchmark.
 *
 * The render benchmark reports how fast successes were. This reports whether
 * jobs finished at all: completed and permanently-failed counts over the same
 * look-back window, with in-flight work shown separately so a backlog is never
 * mistaken for a failure rate.
 *
 * Query params:
 *   - window=<seconds> — defaults to 7 days
 *
 * Guard: CRON_SECRET Bearer token (same pattern as the render benchmark).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/seed/db/client';
import { computeVideoCompletionRate } from '@/land/analytics/video-completion-rate';
import { getErrorMessage } from '@/seed/utils/to-error';
import { timingSafeEqual } from '@/seed/security/crypto-utils';

export const dynamic = 'force-dynamic';

function verifyCronSecret(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = request.headers.get('authorization') ?? '';
  return timingSafeEqual(provided, `Bearer ${secret}`);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ts = new Date().toISOString();
  const { searchParams } = new URL(request.url);
  const windowSecondsRaw = searchParams.get('window');
  const windowSeconds: number | undefined =
    windowSecondsRaw ? Math.max(60, Number(windowSecondsRaw)) : undefined;

  try {
    const d1 = await getD1();
    if (!d1) {
      return NextResponse.json({ ok: false, reason: 'D1_UNAVAILABLE', ts }, { status: 200 });
    }
    const summary = await computeVideoCompletionRate(d1, { windowSeconds });
    return NextResponse.json({ ok: true, ts, summary }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, reason: 'D1_ERROR', error: getErrorMessage(err), ts },
      { status: 200 },
    );
  }
}
