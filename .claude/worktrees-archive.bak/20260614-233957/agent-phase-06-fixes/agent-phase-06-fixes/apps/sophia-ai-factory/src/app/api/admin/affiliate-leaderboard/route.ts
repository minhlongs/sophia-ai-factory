/**
 * GET /api/admin/affiliate-leaderboard
 *
 * Admin-only top affiliates by EPC / conversions / commission within a window.
 * Query params:
 *   - sortBy: epc | conversions | commission (default: epc)
 *   - limit:  1-100 (default: 25)
 *   - from:   unix s (default: now - 30d)
 *   - to:     unix s (default: now)
 *
 * @module app/api/admin/affiliate-leaderboard/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  getTopAffiliates,
  type LeaderboardSortBy,
} from '@/land/affiliates/leaderboard';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

const VALID_SORT: ReadonlyArray<LeaderboardSortBy> = ['epc', 'conversions', 'commission'];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sortRaw = searchParams.get('sortBy');
  const sortBy: LeaderboardSortBy = VALID_SORT.includes(sortRaw as LeaderboardSortBy)
    ? (sortRaw as LeaderboardSortBy)
    : 'epc';

  const limit = parseInt(searchParams.get('limit') ?? '25', 10);
  const now = Math.floor(Date.now() / 1000);
  const fromTs = searchParams.get('from')
    ? parseInt(searchParams.get('from')!, 10)
    : now - 30 * 86400;
  const toTs = searchParams.get('to') ? parseInt(searchParams.get('to')!, 10) : now;

  if (
    Number.isNaN(limit) || limit < 1 ||
    Number.isNaN(fromTs) || Number.isNaN(toTs) || fromTs > toTs
  ) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  try {
    const rows = await getTopAffiliates(fromTs, toTs, limit, sortBy);
    return NextResponse.json({ sortBy, fromTs, toTs, count: rows.length, rows });
  } catch (err) {
    logger.warn('[admin/affiliate-leaderboard] query failed', { error: String(err) });
    return NextResponse.json({ error: 'Leaderboard query failed' }, { status: 500 });
  }
}
