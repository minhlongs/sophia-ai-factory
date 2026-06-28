/**
 * GET /api/auth/mfa/status
 * Reports whether the current user has TOTP enabled (post-verify).
 * Used by /settings/security/mfa to render initial UI state correctly —
 * without this the page assumed `enabled=false` on every refresh and pressing
 * Setup would overwrite an already-active TOTP secret (lockout risk).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';

export const dynamic = 'force-dynamic';

interface MfaSecretsRow {
  totp_enabled: number | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = createServerClient();
    const row = await db
      .from('mfa_secrets')
      .select('totp_enabled')
      .eq('user_id', user.id)
      .single();
    const enabled = (row.data as MfaSecretsRow | null)?.totp_enabled === 1;
    return NextResponse.json({ enabled });
  } catch {
    // No row = not set up.
    return NextResponse.json({ enabled: false });
  }
}
