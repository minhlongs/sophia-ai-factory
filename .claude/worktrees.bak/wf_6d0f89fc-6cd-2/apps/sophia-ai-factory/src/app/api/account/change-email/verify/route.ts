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
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { sha256Hex, safeCompareHex, isHashedToken } from '@/seed/security/token-hash';

interface VerificationRow {
  id: string;
  value: string;
  expiresAt: string;
}

interface UpdateMeta {
  meta?: { changes?: number };
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
    const _db = getD1();
    if (!_db) throw new Error('D1 database binding not available');
    db = _db;
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

  // Wave 22 P01: storedToken is sha256(token) for new rows; legacy in-flight
  // rows (pre-deploy, ≤1h TTL) carry the raw UUID and fall through to raw
  // safe-compare. Both paths use constant-time compare.
  let tokenOk: boolean;
  if (isHashedToken(storedToken)) {
    const incomingHash = await sha256Hex(token);
    tokenOk = safeCompareHex(incomingHash, storedToken);
  } else {
    tokenOk = safeCompareHex(token, storedToken);
    if (tokenOk) {
      logger.info('[change-email/verify] legacy token format accepted', { userId });
    }
  }
  if (!tokenOk) return failureRedirect('email-change-invalid');

  // Conditional UPDATE eliminates TOCTOU race. If another user claimed the
  // email between request and verify, NOT EXISTS fails and meta.changes === 0.
  const nowIso = new Date().toISOString();
  const result = (await db
    .prepare(
      `UPDATE user
       SET email = ?, updatedAt = ?
       WHERE id = ?
         AND NOT EXISTS (
           SELECT 1 FROM user WHERE LOWER(email) = ? AND id != ?
         )`,
    )
    .bind(newEmail, nowIso, userId, newEmail.toLowerCase(), userId)
    .run()) as UpdateMeta;

  const changes = result.meta?.changes ?? 0;
  if (changes === 0) {
    await db.prepare(`DELETE FROM verification WHERE id = ?`).bind(row.id).run();
    return failureRedirect('email-change-conflict');
  }

  await db.prepare(`DELETE FROM verification WHERE id = ?`).bind(row.id).run();

  logger.info('[change-email/verify] email updated', { userId });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
  return NextResponse.redirect(`${baseUrl}/dashboard/account?ok=email-changed`, 302);
}
