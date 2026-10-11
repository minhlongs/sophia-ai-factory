/**
 * GET /api/admin/ops/snapshot
 *
 * Admin-only: real-time ops health snapshot for the go-live dashboard.
 * Returns deployment version, cron runs, queue counts, recent failures,
 * reconciliation stats, HeyGen health, and circuit breaker state.
 *
 * @module app/api/admin/ops/snapshot/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { buildOpsSnapshot, type OpsSnapshotResponse } from './service';

export const dynamic = 'force-dynamic';

export type { OpsSnapshotResponse };

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  let db: D1Database;
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 database binding not available');
    db = _db;
  } catch (err) {
    logger.error('[OpsSnapshot] D1 unavailable', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const snapshot = await buildOpsSnapshot(db);
    return NextResponse.json(snapshot);
  } catch (err) {
    logger.error('[OpsSnapshot] Query failed', err instanceof Error ? err : undefined, {
      adminUserId: auth.user.id,
    });
    return NextResponse.json(
      { error: 'Snapshot query failed', details: getErrorMessage(err) },
      { status: 500 },
    );
  }
}
