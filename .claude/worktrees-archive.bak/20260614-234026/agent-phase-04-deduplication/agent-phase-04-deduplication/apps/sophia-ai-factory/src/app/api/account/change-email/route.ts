/**
 * POST /api/account/change-email
 * Wave 20 Phase 04 (7B): start email-change flow.
 *
 * Auth required. Validates the new email, ensures it differs from current and
 * is not already in use, then issues a single-use token via Better Auth's
 * `verification` table. A verification link is mailed to the NEW address —
 * confirming ownership before we mutate `user.email`.
 *
 * Token format stored in `verification.value`: `<newEmail>:<token>`
 * Identifier: `email-change:<userId>` (one outstanding request per user).
 *
 * @module app/api/account/change-email/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1Raw } from '@/seed/db/client';
import { sendEmail } from '@/forest/email/sender';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { sha256Hex } from '@/seed/security/token-hash';
import { buildChangeEmailHtml } from './email-template';

const TOKEN_TTL_MS = 60 * 60 * 1000;

const bodySchema = z.object({
  newEmail: z.string().email().max(254),
});

interface UserEmailRow {
  id: string;
  email: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request body', details: err instanceof Error ? err.message : 'unknown' },
      { status: 400 },
    );
  }

  const newEmail = parsed.newEmail.toLowerCase().trim();
  const currentEmail = (user.email ?? '').toLowerCase().trim();

  if (newEmail === currentEmail) {
    return NextResponse.json({ error: 'New email matches current email' }, { status: 400 });
  }

  let db: D1Database;
  try {
    db = await getD1Raw();
  } catch (err) {
    logger.warn('[change-email] D1 unavailable', { error: String(err) });
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // Reject if email already taken by another user.
  const existing = await db
    .prepare(`SELECT id, email FROM user WHERE LOWER(email) = ? LIMIT 1`)
    .bind(newEmail)
    .first<UserEmailRow>();
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
  }

  const token = randomUUID();
  const tokenHash = await sha256Hex(token);
  const identifier = `email-change:${user.id}`;
  // Wave 22 P01: store sha256(token) instead of raw token. Email URL still
  // carries raw token; verify route hashes incoming and compares.
  const value = `${newEmail}:${tokenHash}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

  // Replace any pending request for the same user.
  await db
    .prepare(`DELETE FROM verification WHERE identifier = ?`)
    .bind(identifier)
    .run();

  await db
    .prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(randomUUID(), identifier, value, expiresAt.toISOString(), now.toISOString(), now.toISOString())
    .run();

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    logger.warn('[change-email] NEXT_PUBLIC_APP_URL not set; using fallback');
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
  const verifyUrl = `${baseUrl}/api/account/change-email/verify?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(user.id)}`;

  try {
    const html = buildChangeEmailHtml(verifyUrl, currentEmail, newEmail);
    await sendEmail({
      to: newEmail,
      subject: 'Confirm your new Sophia AI email · Xác nhận email mới',
      html,
      tags: [{ name: 'kind', value: 'email-change' }],
    });
  } catch (err) {
    logger.error('[change-email] template/send failed', toError(err));
    return NextResponse.json({ error: 'Failed to send verification email' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sentTo: newEmail });
}

