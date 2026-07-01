/**
 * POST /api/auth/admin-challenge
 *
 * Re-authentication challenge for admin sessions (ASVS V3.5.1 / F02).
 * Verifies the current admin user's password or MFA code and mints a
 * short-lived `admin_challenge_token` cookie (5-min TTL).
 *
 * Protected admin mutations call requireRecentAuth() to consume this token.
 *
 * Body (at least one required):
 *   { password?: string; mfaCode?: string }
 *
 * Response 200:
 *   { ok: true }  + Set-Cookie: admin_challenge_token (HttpOnly, Secure, SameSite=Strict)
 *
 * Response 401:
 *   { error: string; reason: 'wrong_password' | 'wrong_mfa' | 'missing_input' |
 *                             'no_session' | 'not_admin' | 'no_password_stored' }
 *
 * @module app/api/auth/admin-challenge
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { mintAdminChallengeToken } from '@/seed/auth/require-admin';

// NOTE(F02): Better Auth does not expose a public verify-only password API.
// We resolve the stored credential hash from the D1 `account` table directly
// (providerId = 'credential', password column holds the PBKDF2 hash written by
// our own hashPassword() in tree/crypto/password-hash.ts).
// If Better Auth adds an official verifyPassword() API in a future release,
// replace the direct DB lookup below with that call.
import { verifyPassword } from '@/tree/crypto/password-hash';
import { createServerClient } from '@/seed/db/client';
import { verifyTotp } from '@/seed/auth/mfa/totp-service';
import { decryptToken } from '@/seed/crypto/token-crypto';

export const dynamic = 'force-dynamic';

const CHALLENGE_MAX_AGE_SECONDS = 5 * 60; // 5 minutes

const BodySchema = z.object({
  password: z.string().min(1).optional(),
  mfaCode: z.string().length(6).regex(/^\d{6}$/).optional(),
});

/** Row shape from `account` table (Better Auth credential provider). */
interface AccountRow {
  password: string | null;
}

/** Row shape from `mfa_secrets` table. */
interface MfaSecretsRow {
  totp_secret: string | null;
  totp_secret_enc: string | null;
  totp_enabled: number;
  is_encrypted: number;
}

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
    const accountResult = await db
      .from('account')
      .select('password')
      .eq('userId', user.id)
      .eq('providerId', 'credential')
      .single();

    const accountRow = accountResult.data as AccountRow | null;
    if (!accountRow?.password) {
      return NextResponse.json(
        { error: 'No password credential found', reason: 'no_password_stored' },
        { status: 401 },
      );
    }

    const passwordOk = await verifyPassword(password, accountRow.password);
    if (!passwordOk) {
      return NextResponse.json(
        { error: 'Password incorrect', reason: 'wrong_password' },
        { status: 401 },
      );
    }
  } else if (mfaCode) {
    // 3b. MFA (TOTP) verification path
    const mfaResult = await db
      .from('mfa_secrets')
      .select('totp_secret, totp_secret_enc, totp_enabled, is_encrypted')
      .eq('user_id', user.id)
      .single();

    const mfaRow = mfaResult.data as MfaSecretsRow | null;
    if (!mfaRow || mfaRow.totp_enabled !== 1) {
      return NextResponse.json(
        { error: 'MFA not configured for this user', reason: 'no_mfa_configured' },
        { status: 401 },
      );
    }

    // H2 fix (2026-07-01): Use totp_secret_enc (encrypted) when is_encrypted=1.
    // Previous code read totp_secret (plaintext old column) and never decrypted.
    let mfaOk = false;
    if (mfaRow.is_encrypted === 1 && mfaRow.totp_secret_enc) {
      const decrypted = await decryptToken(mfaRow.totp_secret_enc);
      mfaOk = verifyTotp(decrypted, mfaCode);
    } else {
      mfaOk = verifyTotp(mfaRow.totp_secret ?? '', mfaCode);
    }
    if (!mfaOk) {
      return NextResponse.json(
        { error: 'MFA code incorrect', reason: 'wrong_mfa' },
        { status: 401 },
      );
    }
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
