/**
 * POST /api/auth/logout
 *
 * DEPRECATED — Better Auth handles sign-out via /api/auth/sign-out.
 * Kept as fallback that clears legacy cookies.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out successfully' });
  response.cookies.delete('auth-token');
  response.cookies.delete('better-auth.session_token');
  return response;
}
