/**
 * Resolve auth token from Authorization header or httpOnly auth-token cookie.
 * Dashboard users authenticate via cookie; external API callers use Bearer token.
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function resolveToken(request: NextRequest): Promise<string | undefined> {
  const headerToken = request.headers.get('authorization')?.split(' ')[1];
  if (headerToken) return headerToken;
  const cookieStore = await cookies();
  return cookieStore.get('auth-token')?.value;
}
