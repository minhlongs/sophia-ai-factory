/**
 * GET /api/auth/callback
 *
 * DEPRECATED — Better Auth handles magic link verification
 * via /api/auth/magic-link/verify automatically.
 * Kept as fallback redirect for old magic link emails.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.redirect(new URL('/login?error=missing_token', request.url));
    }
    // Old magic links cannot be verified — redirect to login
    return NextResponse.redirect(new URL('/login?error=expired_link', request.url));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    console.error('[auth/callback] GET error:', msg);
    return NextResponse.json({ error: 'Callback handling failed' }, { status: 500 });
  }
}
