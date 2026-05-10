/**
 * GDPR Account Deletion — DELETE /api/account
 * Phase 14: Launch Hardening
 * Wave 21 Phase 02: gated by 7-day cooldown + double-confirm flow.
 *
 * Cascades deletion of all tenant-scoped data rows from D1.
 * REQUIRES `account_deletion_requests` row with `confirmed_at IS NOT NULL`,
 * `cancelled_at IS NULL`, AND `scheduled_at <= now`.
 * Also requires header `X-Confirm-Delete: DELETE_MY_ACCOUNT` for backwards compat.
 *
 * To bypass cooldown for testing/admin, also accepts header
 * `X-Override-Cooldown: I_KNOW_WHAT_IM_DOING` (validated against env flag).
 *
 * @module app/api/account/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

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

interface CooldownRow {
  confirmed_at: number | null;
  cancelled_at: number | null;
  scheduled_at: number;
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
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

  const overrideCooldown =
    request.headers.get('x-override-cooldown') === 'I_KNOW_WHAT_IM_DOING' &&
    process.env.ALLOW_COOLDOWN_OVERRIDE === '1';

  const tenantId = (user as Record<string, unknown>).tenantId as string ?? user.id;

  let db: D1Database;
  try {
    db = await getD1Raw();
  } catch (err) {
    logger.warn('[gdpr-delete] D1 unavailable', { error: String(err) });
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  if (!overrideCooldown) {
    const gate = await checkCooldown(db, user.id);
    if (gate) return gate;
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

  // Clean up the cooldown row regardless of outcome.
  try {
    await db
      .prepare(`DELETE FROM account_deletion_requests WHERE user_id = ?`)
      .bind(user.id)
      .run();
  } catch {
    /* non-fatal */
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

async function checkCooldown(db: D1Database, userId: string): Promise<NextResponse | null> {
  const row = await db
    .prepare(
      `SELECT confirmed_at, cancelled_at, scheduled_at
       FROM account_deletion_requests
       WHERE user_id = ?`,
    )
    .bind(userId)
    .first<CooldownRow>();
  const now = Math.floor(Date.now() / 1000);

  if (!row || row.cancelled_at !== null) {
    return NextResponse.json(
      {
        error: 'No active deletion request',
        hint: 'POST /api/account/delete/request first, then click email confirmation, then wait 7 days.',
      },
      { status: 412 },
    );
  }
  if (row.confirmed_at === null) {
    return NextResponse.json(
      { error: 'Deletion request not yet confirmed via email link' },
      { status: 412 },
    );
  }
  if (row.scheduled_at > now) {
    return NextResponse.json(
      {
        error: 'Cooldown period not yet elapsed',
        scheduledAt: row.scheduled_at,
        secondsRemaining: row.scheduled_at - now,
      },
      { status: 412 },
    );
  }
  return null;
}
