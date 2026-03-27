import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLink } from '@/lib/db/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/callback?token=<magic_link_token>
 * Verifies magic link token and sets auth cookie
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing_token', request.url));
  }

  const { user, authToken, error } = await verifyMagicLink(token);

  if (error || !user || !authToken) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error ?? 'invalid_token')}`, request.url)
    );
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  response.cookies.set('auth-token', authToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}
