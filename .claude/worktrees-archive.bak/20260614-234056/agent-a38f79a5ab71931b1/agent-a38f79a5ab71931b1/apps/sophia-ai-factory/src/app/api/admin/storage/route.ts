/**
 * GET /api/admin/storage
 *
 * Admin-only R2 storage usage snapshot.
 * Query params: limit (1-100, default 25)
 *
 * @module app/api/admin/storage/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getStorageSnapshot } from '@/land/observability/storage-usage-stats';
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
  const limit = parseInt(searchParams.get('limit') ?? '25', 10);
  if (Number.isNaN(limit) || limit < 1) {
    return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
  }

  try {
    const snapshot = await getStorageSnapshot(limit);
    return NextResponse.json(snapshot);
  } catch (err) {
    logger.warn('[admin/storage] query failed', { error: String(err) });
    return NextResponse.json({ error: 'Storage query failed' }, { status: 500 });
  }
}
