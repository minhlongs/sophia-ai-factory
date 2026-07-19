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
import { globalRateLimiter, getClientIdentifier, createRateLimitResponse } from '@/forest/middleware/rate-limiter';
import { getD1Raw } from '@/seed/db/client';

export const dynamic = 'force-dynamic';

const Body = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const GENERIC_TOKEN_ERROR = { ok: false, error: 'Invalid or expired reset link' };

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit: 5 per 15 minutes
  const rl = globalRateLimiter.checkLimit(
    getClientIdentifier(request),
    { intervalMs: 15 * 60_000, maxRequests: 5 },
  );
  if (!rl.allowed) return createRateLimitResponse(rl);

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
    const db = await getD1Raw();

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
