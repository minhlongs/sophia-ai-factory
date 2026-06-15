/**
 * POST /api/auth/mfa/challenge
 *
 * Validates a TOTP code (or backup code) for a session in MFA-pending state.
 * On success: clears the pending flag so normal access resumes.
 * On failure: returns 401 with {error: 'invalid_code'}.
 *
 * Backup codes: 9-char XXXX-XXXX format. Consumed on use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth } from '@/seed/auth/better-auth-server';
import { createServerClient } from '@/seed/db/client';
import { verifyTotp, verifyBackupCode, consumeBackupCode } from '@/seed/auth/mfa/totp-service';
import { clearSessionMfaPending } from '@/seed/auth/mfa/login-challenge';
import { decryptToken } from '@/tree/crypto/token-crypto';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  code: z.string().min(6).max(9),
});

interface MfaSecretsRow {
  totp_secret_enc: string;
  backup_codes_json: string | null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ error: 'auth_unavailable' }, { status: 503 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id || !session?.session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = createServerClient();
  const result = await db
    .from('mfa_secrets')
    .select('totp_secret_enc, backup_codes_json')
    .eq('user_id', session.user.id)
    .single();

  const row = result.data as MfaSecretsRow | null;
  if (!row) {
    return NextResponse.json({ error: 'mfa_not_configured' }, { status: 404 });
  }

  const { code } = parsed.data;
  const sessionId = session.session.id;

  // Backup code path: XXXX-XXXX = 9 chars
  if (code.length === 9) {
    if (!row.backup_codes_json) {
      return NextResponse.json({ error: 'invalid_code' }, { status: 401 });
    }
    const idx = await verifyBackupCode(code.toUpperCase(), row.backup_codes_json);
    if (idx === -1) {
      return NextResponse.json({ error: 'invalid_code' }, { status: 401 });
    }
    // Consume the backup code so it cannot be reused
    const updatedJson = consumeBackupCode(row.backup_codes_json, idx);
    const now = Math.floor(Date.now() / 1000);
    await db
      .from('mfa_secrets')
      .update({ backup_codes_json: updatedJson, updated_at: now })
      .eq('user_id', session.user.id);

    await clearSessionMfaPending(sessionId);
    return NextResponse.json({ ok: true });
  }

  // TOTP 6-digit path — decrypt at-rest secret first.
  const secretPlain = await decryptToken(row.totp_secret_enc);
  const valid = verifyTotp(secretPlain, code);
  if (!valid) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 401 });
  }

  await clearSessionMfaPending(sessionId);
  return NextResponse.json({ ok: true });
}
