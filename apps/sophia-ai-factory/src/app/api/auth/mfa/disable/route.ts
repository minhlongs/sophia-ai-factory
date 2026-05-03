/**
 * POST /api/auth/mfa/disable
 *
 * Disables MFA for the authenticated user.
 * Requires a valid current TOTP code for confirmation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { verifyTotp } from '@/seed/auth/mfa/totp-service';
import { createServerClient } from '@/seed/db/client';

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

  if (!row.data || !row.data.totp_enabled) {
    return NextResponse.json({ error: 'MFA not active' }, { status: 404 });
  }

  const valid = verifyTotp(row.data.totp_secret_enc as string, parsed.data.code);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid TOTP code' }, { status: 422 });
  }

  await db
    .from('mfa_secrets')
    .update({
      totp_enabled: 0,
      backup_codes_json: null,
      updated_at: Math.floor(Date.now() / 1000),
    })
    .eq('user_id', user.id);

  return NextResponse.json({ disabled: true });
}
