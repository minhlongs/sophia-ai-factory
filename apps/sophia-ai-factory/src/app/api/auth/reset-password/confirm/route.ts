/**
 * POST /api/auth/reset-password/confirm
 *
 * Accept token + newPassword. Verifies HMAC + one-time-use guard (consumeResetToken),
 * hashes new password, updates Better Auth account table via D1.
 *
 * Rate limited: 5 per 15 minutes per IP (brute-force protection).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { consumeResetToken } from '@/seed/auth/reset-password-token';
import { hashPassword } from '@/tree/crypto/password-hash';
import { logger } from '@/seed/utils/logger-utility';
import { checkRateLimit, getClientIdentifier as getD1ClientId } from '@/seed/security/sql-rate-limiter';
import { createRateLimitHeaders } from '@/forest/middleware/rate-limiter';
import { getD1 } from '@/seed/db/client';

export const dynamic = 'force-dynamic';

const Body = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const GENERIC_TOKEN_ERROR = { ok: false, error: 'Invalid or expired reset link' };

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit: 5 per 15 minutes (D1-backed for cross-isolate enforcement, C2 fix 2026-07-01)
  const clientId = getD1ClientId(request);
  const rl = await checkRateLimit(clientId, { maxRequests: 5, windowSeconds: 15 * 60, identifier: 'auth' });
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
    return NextResponse.json(
      { ok: false, error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { token, newPassword } = parsed.data;

  try {
    const db = getD1();
    if (!db) throw new Error('D1 database binding not available');

    // Verify HMAC + TTL + one-time-use guard (consumes jti atomically)
    const userId = await consumeResetToken(token, db);
    if (!userId) {
      return NextResponse.json(GENERIC_TOKEN_ERROR, { status: 400 });
    }

    // Hash new password using the same PBKDF2 algo as Better Auth setup
    const hashed = await hashPassword(newPassword);

    // Update Better Auth's account table (stores password hash in "password" column)
    const result = await db
      .prepare(
        `UPDATE account
         SET password = ?1, updated_at = ?2
         WHERE account_id = ?3 AND provider_id = 'credential'`,
      )
      .bind(hashed, new Date().toISOString(), userId)
      .run();

    if ((result.meta?.changes ?? 0) === 0) {
      // No credential account — return same generic error to avoid leaking account state
      logger.warn('[reset-password/confirm] no credential account to update', { userId });
      return NextResponse.json(GENERIC_TOKEN_ERROR, { status: 400 });
    }

    logger.info('[reset-password/confirm] password updated', { userId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[reset-password/confirm] error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
