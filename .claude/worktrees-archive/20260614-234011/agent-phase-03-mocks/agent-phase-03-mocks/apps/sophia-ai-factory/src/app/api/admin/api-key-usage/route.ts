/**
 * GET /api/admin/api-key-usage
 *
 * Admin-only API key usage stats within a window.
 * Query params: from (unix s, default now-30d), to (unix s, default now),
 *               limit (1-200, default 50).
 *
 * @module app/api/admin/api-key-usage/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getApiKeyUsageStats } from '@/land/observability/api-key-usage-stats';
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
  const now = Math.floor(Date.now() / 1000);
  const fromTs = searchParams.get('from') ? parseInt(searchParams.get('from')!, 10) : now - 30 * 86400;
  const toTs = searchParams.get('to') ? parseInt(searchParams.get('to')!, 10) : now;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

  if (
    Number.isNaN(fromTs) || Number.isNaN(toTs) || fromTs > toTs ||
    Number.isNaN(limit) || limit < 1
  ) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  try {
    const rows = await getApiKeyUsageStats(fromTs, toTs, limit);
    return NextResponse.json({ fromTs, toTs, count: rows.length, rows });
  } catch (err) {
    logger.warn('[admin/api-key-usage] query failed', { error: String(err) });
    return NextResponse.json({ error: 'Usage query failed' }, { status: 500 });
  }
}
