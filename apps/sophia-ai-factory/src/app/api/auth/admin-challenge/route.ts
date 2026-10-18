/**
 * POST /api/auth/admin-challenge
 *
 * Re-authentication challenge for admin sessions (ASVS V3.5.1 / F02).
 * Verifies the current admin user's password or MFA code and mints a
 * short-lived `admin_challenge_token` cookie (5-min TTL).
 *
 * Protected admin mutations call requireRecentAuth() to consume this token.
 *
 * @module app/api/auth/admin-challenge
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { mintAdminChallengeToken } from '@/seed/auth/require-admin';
import { createServerClient } from '@/seed/db/client';
import {
  CHALLENGE_MAX_AGE_SECONDS,
  BodySchema,
  verifyAdminPasswordChallenge,
  verifyAdminMfaChallenge,
} from './admin-challenge-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Require active admin session
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', reason: 'no_session' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden', reason: 'not_admin' }, { status: 403 });
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { password, mfaCode } = parsed.data;
  if (!password && !mfaCode) {
    return NextResponse.json(
      { error: 'Provide password or mfaCode', reason: 'missing_input' },
      { status: 400 },
    );
  }

  const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const db = createServerClient();

  // 3a. Password verification path
  if (password) {
    const errRes = await verifyAdminPasswordChallenge(db, user.id, password);
    if (errRes) return errRes;
  } else if (mfaCode) {
    // 3b. MFA (TOTP) verification path
    const errRes = await verifyAdminMfaChallenge(db, user.id, mfaCode);
    if (errRes) return errRes;
  }

  // 4. Mint challenge token and set cookie
  const tokenValue = await mintAdminChallengeToken(user.id, secret);

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set('admin_challenge_token', tokenValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: CHALLENGE_MAX_AGE_SECONDS,
    path: '/',
  });

  return response;
}
