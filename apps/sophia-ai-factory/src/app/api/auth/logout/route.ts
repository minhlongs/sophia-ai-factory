/**
 * POST /api/auth/logout
 *
 * DEPRECATED — Better Auth handles sign-out via /api/auth/sign-out.
 * Kept as fallback that clears legacy cookies.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const response = NextResponse.json({ message: 'Logged out successfully' });
    response.cookies.delete('auth-token');
    response.cookies.delete('better-auth.session_token');
    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    console.error('[auth/logout] POST error:', msg);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
