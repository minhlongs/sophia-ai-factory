/**
 * GET /api/admin/funnel
 *
 * Admin-only activation funnel: signup → first-login → first-video → conversion.
 * Query params: from (unix s, default now-30d), to (unix s, default now).
 *
 * @module app/api/admin/funnel/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getActivationFunnel } from '@/land/analytics/funnel-stats';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const now = Math.floor(Date.now() / 1000);
  const fromTs = fromParam ? parseInt(fromParam, 10) : now - 30 * 86400;
  const toTs = toParam ? parseInt(toParam, 10) : now;

  if (Number.isNaN(fromTs) || Number.isNaN(toTs) || fromTs > toTs) {
    return NextResponse.json({ error: 'Invalid from/to parameters' }, { status: 400 });
  }

  try {
    const funnel = await getActivationFunnel(fromTs, toTs);
    return NextResponse.json(funnel);
  } catch (err) {
    logger.warn('[admin/funnel] query failed', { error: String(err) });
    return NextResponse.json({ error: 'Funnel query failed' }, { status: 500 });
  }
}
