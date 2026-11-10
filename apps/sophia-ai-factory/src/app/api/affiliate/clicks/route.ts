/**
 * GET /api/affiliate/clicks
 *
 * Returns click + conversion + EPC summary for the authenticated affiliate.
 * Query params: from (unix ts, default now-30d), to (unix ts, default now)
 *
 * @module app/api/affiliate/clicks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import { getAffiliateClickStats } from '@/land/affiliates/dashboard-stats';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const gate = await enforceCommercialFeatureForUser(
    user.id,
    'affiliate_attribution_payouts',
  );
  if (!gate.ok) {
    return NextResponse.json(
      { error: 'FEATURE_LOCKED', message: gate.error.message },
      { status: 403 },
    );
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

  const stats = await getAffiliateClickStats(user.id, user.id, fromTs, toTs);
  return NextResponse.json({
    affiliateId: user.id,
    from: fromTs,
    to: toTs,
    ...stats,
  });
}
