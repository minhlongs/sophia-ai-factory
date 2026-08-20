/**
 * POST /api/auth/reset-password/request
 *
 * Accept email, look up user, generate HMAC-signed token (1h TTL),
 * send reset email via Resend. Always returns 200 to prevent email enumeration.
 *
 * Rate limited: 3 requests per 15 minutes per IP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { signResetToken } from '@/seed/auth/reset-password-token';
import { sendEmail } from '@/tree/email/sender';
import { logger } from '@/seed/utils/logger-utility';
import { checkRateLimit, getClientIdentifier as getD1ClientId } from '@/seed/security/sql-rate-limiter';
import { createRateLimitHeaders } from '@/forest/middleware/rate-limiter';
import { getD1 } from '@/seed/db/client';

export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.string().email(),
});

const BASE_URL =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://sophia.agencyos.network';

function buildResetEmailHtml(resetUrl: string): string {
  const safe =
    resetUrl.startsWith('https://') || resetUrl.startsWith('http://localhost')
      ? resetUrl.replace(/"/g, '&quot;').replace(/</g, '&lt;')
      : '#';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#6750A4">Reset Your Password · Đặt Lại Mật Khẩu</h2>
  <p>Click the button below to set a new password. The link is valid for 1 hour.</p>
  <a href="${safe}" style="display:inline-block;background:#6750A4;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
    Reset Password · Đặt Lại Mật Khẩu
  </a>
  <p style="font-size:13px;color:#666;">If you did not request this, please ignore this email.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
  <p>Nhấn nút bên trên để đặt mật khẩu mới. Link có hiệu lực trong 1 giờ.</p>
  <p style="font-size:13px;color:#666;">Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
</body></html>`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit: 3 per 15 minutes per client (D1-backed for cross-isolate enforcement, C2 fix 2026-07-01)
  const clientId = getD1ClientId(request);
  const rl = await checkRateLimit(clientId, { maxRequests: 3, windowSeconds: 15 * 60, identifier: 'auth' });
  if (!rl.success) {
    return new NextResponse(JSON.stringify({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((rl.reset - Date.now()) / 1000),
    }), {
      status: 429,
      headers: createRateLimitHeaders({
        allowed: false, remaining: 0, resetAt: rl.reset,
        retryAfter: Math.ceil((rl.reset - Date.now()) / 1000),
      }),
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    // Always 200 to prevent enumeration
    return NextResponse.json({ ok: true });
  }

  const email = parsed.data.email.toLowerCase().trim();

  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');

    // Look up user by email in Better Auth's "user" table
    const userRow = await db
      .prepare('SELECT id FROM user WHERE email = ?1 LIMIT 1')
      .bind(email)
      .first<{ id: string }>();

    if (!userRow) {
      logger.info('[reset-password/request] email not found (silent)', { email });
      return NextResponse.json({ ok: true });
    }

    const token = await signResetToken(userRow.id, db);
    const resetUrl = `${BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: email,
      subject: 'Reset your Sophia AI password · Đặt lại mật khẩu',
      html: buildResetEmailHtml(resetUrl),
      tags: [{ name: 'type', value: 'password-reset' }],
    });

    logger.info('[reset-password/request] reset email sent', { email });
  } catch (err) {
    // Log but still return 200 — never leak internals
    logger.error(
      '[reset-password/request] error',
      err instanceof Error ? err : new Error(String(err)),
    );
  }

  return NextResponse.json({ ok: true });
}
