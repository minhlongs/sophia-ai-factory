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
  const identifier = `email-change:${user.id}`;
  const value = `${newEmail}:${token}`;
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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
  const verifyUrl = `${baseUrl}/api/account/change-email/verify?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(user.id)}`;

  try {
    await sendEmail({
      to: newEmail,
      subject: 'Confirm your new Sophia AI email · Xác nhận email mới',
      html: buildChangeEmailHtml(verifyUrl, currentEmail, newEmail),
      tags: [{ name: 'kind', value: 'email-change' }],
    });
  } catch (err) {
    logger.error('[change-email] sendEmail failed', toError(err));
    return NextResponse.json({ error: 'Failed to send verification email' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sentTo: newEmail });
}

function buildChangeEmailHtml(rawUrl: string, oldEmail: string, newEmail: string): string {
  const url =
    rawUrl.startsWith('https://') || rawUrl.startsWith('http://localhost')
      ? rawUrl.replace(/"/g, '&quot;').replace(/</g, '&lt;')
      : '#';
  const safeOld = String(oldEmail).replace(/</g, '&lt;');
  const safeNew = String(newEmail).replace(/</g, '&lt;');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#6750A4">Confirm your new email</h2>
  <p>You requested to change the email on your Sophia AI Factory account from
     <strong>${safeOld}</strong> to <strong>${safeNew}</strong>.</p>
  <p>Click the button below to confirm. The link is valid for 1 hour.</p>
  <a href="${url}" style="display:inline-block;background:#6750A4;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">Confirm new email · Xác nhận email mới</a>
  <p style="font-size:13px;color:#666;">If you did not request this change, ignore this email — your account is unchanged.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
  <h3 style="color:#6750A4;margin-bottom:8px;">Xác nhận email mới</h3>
  <p>Bạn vừa yêu cầu đổi email tài khoản Sophia AI từ <strong>${safeOld}</strong> sang <strong>${safeNew}</strong>.</p>
  <p>Nhấn nút phía trên để xác nhận. Link có hiệu lực trong 1 giờ.</p>
  <p style="font-size:13px;color:#666;">Nếu bạn không yêu cầu, vui lòng bỏ qua — tài khoản không thay đổi.</p>
</body></html>`;
}
