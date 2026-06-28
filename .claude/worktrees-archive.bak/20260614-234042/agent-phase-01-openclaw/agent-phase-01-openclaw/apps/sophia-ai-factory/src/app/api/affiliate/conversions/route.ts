/**
 * GET /api/affiliate/conversions
 *
 * Recent conversion feed for the authenticated affiliate, newest first.
 * Query params: limit (1-200, default 50), offset (>=0, default 0)
 *
 * @module app/api/affiliate/conversions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserOrOpenclawBearer } from '@/seed/auth/openclaw-token';
import { getRecentConversions } from '@/land/affiliates/dashboard-stats';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export async function GET(request: NextRequest) {
  const user = await getCurrentUserOrOpenclawBearer(request.headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  if (Number.isNaN(limit) || Number.isNaN(offset) || limit < 1 || offset < 0) {
    return NextResponse.json({ error: 'Invalid limit/offset' }, { status: 400 });
  }

  // Wrap data fetch so a missing affiliate table or empty-user state returns
  // an empty feed instead of bubbling a 500 to the caller. Browser bug-hunt
  // 2026-05-19 caught this for fresh signups whose affiliate_links/
  // conversion_events rows do not exist yet — same defensive pattern as
  // analytics/page.tsx (commit 03ce2b76).
  let conversions: Awaited<ReturnType<typeof getRecentConversions>> = [];
  let loadError: string | null = null;
  try {
    conversions = await getRecentConversions(user.id, user.id, limit, offset);
  } catch (err) {
    loadError = 'affiliate feed temporarily unavailable';
    logger.error('[api/affiliate/conversions] getRecentConversions failed', toError(err), {
      userId: user.id,
    });
  }

  return NextResponse.json({
    affiliateId: user.id,
    limit,
    offset,
    count: conversions.length,
    conversions,
    ...(loadError ? { loadError } : {}),
  });
}
