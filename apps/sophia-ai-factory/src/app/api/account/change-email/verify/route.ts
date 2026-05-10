/**
 * GET /api/account/change-email/verify?token=<>&userId=<>
 * Wave 20 Phase 04 (7B): finalize email-change flow.
 *
 * Validates token from `verification` table, updates `user.email`, deletes the
 * verification row, and redirects back to `/dashboard/account?ok=email-changed`.
 *
 * @module app/api/account/change-email/verify/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

interface VerificationRow {
  id: string;
  value: string;
  expiresAt: string;
}

interface UserIdRow {
  id: string;
}

function failureRedirect(reason: string): NextResponse {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
  return NextResponse.redirect(`${baseUrl}/dashboard/account?error=${encodeURIComponent(reason)}`, 302);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get('token');
  const userId = req.nextUrl.searchParams.get('userId');
  if (!token || !userId) return failureRedirect('email-change-invalid');

  let db: D1Database;
  try {
    db = await getD1Raw();
  } catch (err) {
    logger.warn('[change-email/verify] D1 unavailable', { error: String(err) });
    return failureRedirect('email-change-unavailable');
  }

  const identifier = `email-change:${userId}`;
  const row = await db
    .prepare(`SELECT id, value, expiresAt FROM verification WHERE identifier = ? LIMIT 1`)
    .bind(identifier)
    .first<VerificationRow>();

  if (!row) return failureRedirect('email-change-invalid');

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    await db.prepare(`DELETE FROM verification WHERE id = ?`).bind(row.id).run();
    return failureRedirect('email-change-expired');
  }

  const sepIndex = row.value.lastIndexOf(':');
  if (sepIndex < 0) return failureRedirect('email-change-invalid');
  const newEmail = row.value.slice(0, sepIndex);
  const storedToken = row.value.slice(sepIndex + 1);
  if (storedToken !== token) return failureRedirect('email-change-invalid');

  // Race-safety: verify the new email isn't already claimed.
  const existing = await db
    .prepare(`SELECT id FROM user WHERE LOWER(email) = ? AND id != ? LIMIT 1`)
    .bind(newEmail.toLowerCase(), userId)
    .first<UserIdRow>();
  if (existing) {
    await db.prepare(`DELETE FROM verification WHERE id = ?`).bind(row.id).run();
    return failureRedirect('email-change-conflict');
  }

  const nowIso = new Date().toISOString();
  await db
    .prepare(`UPDATE user SET email = ?, updatedAt = ? WHERE id = ?`)
    .bind(newEmail, nowIso, userId)
    .run();

  await db.prepare(`DELETE FROM verification WHERE id = ?`).bind(row.id).run();

  logger.info('[change-email/verify] email updated', { userId });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
  return NextResponse.redirect(`${baseUrl}/dashboard/account?ok=email-changed`, 302);
}
