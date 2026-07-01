/**
 * POST /api/auth/logout
 *
 * M11 fix (2026-07-01): Now calls Better Auth session revocation before
 * clearing cookies. Previous behavior only deleted client cookies, leaving
 * the server-side session valid (session token could be reused).
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { getAuth } from '@/seed/auth/better-auth-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Revoke session server-side via Better Auth
    try {
      const auth = getAuth();
      const sessionToken = request.cookies.get('better-auth.session_token')?.value;
      if (sessionToken) {
        await auth.api.revokeSession({
          body: { token: sessionToken },
          headers: request.headers,
        });
      }
    } catch (revokeErr) {
      // Non-fatal: session may already be expired
      logger.warn('[auth/logout] Session revocation failed (non-fatal)', revokeErr instanceof Error ? revokeErr : undefined);
    }

    const response = NextResponse.json({ message: 'Logged out successfully' });
    response.cookies.delete('auth-token');
    response.cookies.delete('better-auth.session_token');
    return response;
  } catch (error) {
    logger.error('[auth/logout] POST error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
