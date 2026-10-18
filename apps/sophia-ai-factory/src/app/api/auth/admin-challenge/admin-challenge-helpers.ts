/**
 * Internal helpers for POST /api/auth/admin-challenge
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPassword } from '@/tree/crypto/password-hash';
import { createServerClient } from '@/seed/db/client';
import { verifyTotp } from '@/seed/auth/mfa/totp-service';
import { decryptToken } from '@/seed/crypto/token-crypto';

export const CHALLENGE_MAX_AGE_SECONDS = 5 * 60; // 5 minutes

export const BodySchema = z.object({
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

type DbClient = ReturnType<typeof createServerClient>;

export async function verifyAdminPasswordChallenge(
  db: DbClient,
  userId: string,
  password: string,
): Promise<NextResponse | null> {
  const accountResult = await db
    .from('account')
    .select('password')
    .eq('userId', userId)
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

  return null;
}

export async function verifyAdminMfaChallenge(
  db: DbClient,
  userId: string,
  mfaCode: string,
): Promise<NextResponse | null> {
  const mfaResult = await db
    .from('mfa_secrets')
    .select('totp_secret, totp_secret_enc, totp_enabled, is_encrypted')
    .eq('user_id', userId)
    .single();

  const mfaRow = mfaResult.data as MfaSecretsRow | null;
  if (!mfaRow || mfaRow.totp_enabled !== 1) {
    return NextResponse.json(
      { error: 'MFA not configured for this user', reason: 'no_mfa_configured' },
      { status: 401 },
    );
  }

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

  return null;
}
