/**
 * POST /api/auth/mfa/setup
 *
 * Initiates MFA setup for the authenticated user.
 * Returns a new TOTP secret and otpauth:// URI for QR rendering.
 * Does NOT activate MFA — user must verify with /api/auth/mfa/verify first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import {
  generateTotpSecret,
  generateOtpauthUri,
} from '@/seed/auth/mfa/totp-service';
import { createServerClient } from '@/seed/db/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = generateTotpSecret();
  const otpauthUri = generateOtpauthUri(user.email, secret);

  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  // Upsert pending secret (totp_enabled = 0 until verified)
  const existing = await db
    .from('mfa_secrets')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (existing.data) {
    await db
      .from('mfa_secrets')
      .update({ totp_secret_enc: secret, totp_enabled: 0, updated_at: now })
      .eq('user_id', user.id);
  } else {
    await db
      .from('mfa_secrets')
      .insert({
        user_id: user.id,
        totp_secret_enc: secret,
        totp_enabled: 0,
        created_at: now,
        updated_at: now,
      });
  }

  return NextResponse.json({ secret, otpauthUri });
}
