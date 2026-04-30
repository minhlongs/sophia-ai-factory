/**
 * GDPR Account Deletion — DELETE /api/account
 * Phase 14: Launch Hardening
 *
 * Cascades deletion of all tenant-scoped data rows from D1.
 * Requires X-Confirm-Delete header. Authenticated via Better Auth session.
 *
 * @module app/api/account/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { getD1Raw } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

/** Tables to cascade-delete in dependency order (dependents first) */
const DELETE_ORDER = [
  'audit_log',
  'publishing_results',
  'publishing_jobs',
  'publishing_channels',
  'payout_batches',
  'commission_ledger',
  'conversion_events',
  'affiliate_links',
  'video_jobs',
  'sessions',
  'users',
] as const;

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const confirmHeader = request.headers.get('x-confirm-delete');
  if (confirmHeader !== 'DELETE_MY_ACCOUNT') {
    return NextResponse.json(
      { error: 'Missing confirmation. Set header X-Confirm-Delete: DELETE_MY_ACCOUNT' },
      { status: 400 },
    );
  }

  const tenantId = (user as Record<string, unknown>).tenantId as string ?? user.id;

  let db: D1Database;
  try {
    db = await getD1Raw();
  } catch (err) {
    logger.warn('[gdpr-delete] D1 unavailable', { error: String(err) });
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const deleted: Record<string, number> = {};
  let totalDeleted = 0;

  for (const table of DELETE_ORDER) {
    try {
      const result = await db
        .prepare(`DELETE FROM ${table} WHERE tenant_id = ?`)
        .bind(tenantId)
        .run();
      const count = result.meta?.rows_written ?? 0;
      deleted[table] = count;
      totalDeleted += count;
    } catch {
      deleted[table] = 0;
    }
  }

  logger.info('[gdpr-delete] account data deleted', { tenantId, totalDeleted });

  return NextResponse.json({
    ok: true,
    deletedAt: new Date().toISOString(),
    tenantId,
    totalRowsDeleted: totalDeleted,
    byTable: deleted,
  });
}
