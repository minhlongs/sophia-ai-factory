/**
 * GET /api/affiliate/conversions
 *
 * Recent conversion feed for the authenticated affiliate, newest first.
 * Query params: limit (1-200, default 50), offset (>=0, default 0)
 *
 * @module app/api/affiliate/conversions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getRecentConversions } from '@/land/affiliates/dashboard-stats';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  if (Number.isNaN(limit) || Number.isNaN(offset) || limit < 1 || offset < 0) {
    return NextResponse.json({ error: 'Invalid limit/offset' }, { status: 400 });
  }

  const conversions = await getRecentConversions(user.id, user.id, limit, offset);
  return NextResponse.json({
    affiliateId: user.id,
    limit,
    offset,
    count: conversions.length,
    conversions,
  });
}
