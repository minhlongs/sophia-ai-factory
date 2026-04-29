/**
 * POST /api/auth/mfa/verify
 *
 * Activates MFA after user provides the first valid TOTP code.
 * Also generates and returns 8 backup codes (shown once, then hashed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';
import {
  verifyTotp,
  generateBackupCodes,
  hashBackupCodesToJson,
} from '@/lib/auth/mfa/totp-service';
import { createServerClient } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = createServerClient();
  const row = await db
    .from('mfa_secrets')
    .select('totp_secret_enc, totp_enabled')
    .eq('user_id', user.id)
    .single();

  if (!row.data) {
    return NextResponse.json({ error: 'MFA not set up' }, { status: 404 });
  }

  if (row.data.totp_enabled) {
    return NextResponse.json({ error: 'MFA already active' }, { status: 409 });
  }

  const valid = verifyTotp(row.data.totp_secret_enc as string, parsed.data.code);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid TOTP code' }, { status: 422 });
  }

  const plainCodes = generateBackupCodes();
  const hashedJson = await hashBackupCodesToJson(plainCodes);
  const now = Math.floor(Date.now() / 1000);

  await db
    .from('mfa_secrets')
    .update({
      totp_enabled: 1,
      backup_codes_json: hashedJson,
      updated_at: now,
    })
    .eq('user_id', user.id);

  return NextResponse.json({ backupCodes: plainCodes });
}
