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
import { createServerClient, getD1 } from '@/seed/db/client';
import { verifyTotp, hashBackupCode } from '@/seed/auth/mfa/totp-service';
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
  // L5: Atomic consume with optimistic locking to prevent TOCTOU race.
  // Single UPDATE with WHERE backup_codes_json = old_value detects concurrent
  // consumption via meta.changes. If changes === 0, the code was already
  // consumed by another request.
  if (code.length === 9) {
    if (!row.backup_codes_json) {
      return NextResponse.json({ error: 'invalid_code' }, { status: 401 });
    }
    const hashedCode = await hashBackupCode(code.toUpperCase());
    const currentJson = row.backup_codes_json;
    const stored: string[] = JSON.parse(currentJson);
    const idx = stored.indexOf(hashedCode);
    if (idx === -1) {
      return NextResponse.json({ error: 'invalid_code' }, { status: 401 });
    }
    // Consume the backup code so it cannot be reused
    stored.splice(idx, 1);
    const updatedJson = JSON.stringify(stored);
    const now = Math.floor(Date.now() / 1000);

    // Atomic UPDATE with optimistic lock — only succeeds if backup_codes_json
    // hasn't changed since we read it (prevents double-use race).
    const d1Raw = await getD1();
    if (!d1Raw) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }
    const result = await d1Raw
      .prepare('UPDATE mfa_secrets SET backup_codes_json = ?, updated_at = ? WHERE user_id = ? AND backup_codes_json = ?')
      .bind(updatedJson, now, session.user.id, currentJson)
      .run();

    if (result.meta?.changes === 0) {
      // Optimistic lock failed — someone else already consumed this code.
      // The hashed code was in the original JSON, so this means a concurrent
      // request consumed it first. Treat as invalid.
      return NextResponse.json({ error: 'invalid_code' }, { status: 401 });
    }

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
