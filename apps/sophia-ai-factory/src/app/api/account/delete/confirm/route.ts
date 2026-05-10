/**
 * GET /api/account/delete/confirm?token=&userId=
 * Wave 21 Phase 02: account self-delete stage 2 (apply 7-day cooldown).
 *
 * Validates token from email, marks request as confirmed.
 * Does NOT auth-check the session because the user might be on a different
 * device than where they requested. Token-only auth is the same pattern as
 * change-email/verify (Wave 20).
 *
 * Redirects to /account?ok=delete-confirmed or ?error=...
 *
 * @module app/api/account/delete/confirm/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

interface DeletionRow {
  user_id: string;
  confirmation_token: string;
  confirmed_at: number | null;
  cancelled_at: number | null;
  scheduled_at: number;
}

const REDIRECT_BASE = '/account';

function redirectTo(req: NextRequest, query: string): NextResponse {
  const origin = req.nextUrl?.origin || new URL(req.url).origin;
  const url = new URL(`${REDIRECT_BASE}${query}`, origin);
  return NextResponse.redirect(url, 307);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get('token');
  const userId = req.nextUrl.searchParams.get('userId');
  if (!token || !userId) {
    return redirectTo(req, '?error=delete-confirm-missing');
  }

  let db: D1Database;
  try {
    db = await getD1Raw();
  } catch (err) {
    logger.warn('[acct-delete-confirm] D1 unavailable', { error: String(err) });
    return redirectTo(req, '?error=delete-confirm-db');
  }

  const row = await db
    .prepare(
      `SELECT user_id, confirmation_token, confirmed_at, cancelled_at, scheduled_at
       FROM account_deletion_requests
       WHERE user_id = ?`,
    )
    .bind(userId)
    .first<DeletionRow>();
  if (!row) {
    return redirectTo(req, '?error=delete-confirm-notfound');
  }
  if (row.cancelled_at !== null) {
    return redirectTo(req, '?error=delete-confirm-cancelled');
  }
  if (row.confirmed_at !== null) {
    return redirectTo(req, '?ok=delete-confirmed');
  }
  if (row.confirmation_token !== token) {
    return redirectTo(req, '?error=delete-confirm-invalid');
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `UPDATE account_deletion_requests
       SET confirmed_at = ?
       WHERE user_id = ? AND confirmed_at IS NULL`,
    )
    .bind(now, userId)
    .run();

  logger.info('[acct-delete-confirm] confirmed', { userId, scheduledAt: row.scheduled_at });

  return redirectTo(req, '?ok=delete-confirmed');
}
