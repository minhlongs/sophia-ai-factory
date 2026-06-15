/**
 * GET /api/account/delete/status
 * Wave 21 Phase 02: read current deletion-request state.
 *
 * Response shape:
 *   { state: 'none' | 'pending' | 'confirmed' | 'cancelled', scheduledAt?, requestedAt? }
 *
 * @module app/api/account/delete/status/route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

interface DeletionRow {
  requested_at: number;
  scheduled_at: number;
  confirmed_at: number | null;
  cancelled_at: number | null;
}

export type DeletionState = 'none' | 'pending' | 'confirmed' | 'cancelled';

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let db: D1Database;
  try {
    db = await getD1Raw();
  } catch (err) {
    logger.warn('[acct-delete-status] D1 unavailable', { error: String(err) });
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const row = await db
    .prepare(
      `SELECT requested_at, scheduled_at, confirmed_at, cancelled_at
       FROM account_deletion_requests
       WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(user.id)
    .first<DeletionRow>();
  if (!row) {
    return NextResponse.json({ state: 'none' as DeletionState });
  }

  let state: DeletionState;
  if (row.cancelled_at !== null) {
    state = 'cancelled';
  } else if (row.confirmed_at !== null) {
    state = 'confirmed';
  } else {
    state = 'pending';
  }

  return NextResponse.json({
    state,
    requestedAt: row.requested_at,
    scheduledAt: row.scheduled_at,
    confirmedAt: row.confirmed_at,
  });
}
