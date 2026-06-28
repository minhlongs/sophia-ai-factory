/**
 * GET /api/auth/sign-in
 *
 * Compatibility endpoint for E2E tests.
 * Sets a CSRF cookie (better-auth.csrf) and returns 200.
 * Better Auth itself does not provide a GET sign-in endpoint; this shim
 * allows tests to obtain a CSRF token prior to sign-up/sign-in POSTs.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function generateCsrfToken(): string {
  // 32 random bytes as hex string (64 chars)
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function GET(request: NextRequest): Promise<Response> {
  const token = generateCsrfToken();
  // Set Secure flag only if the request is over HTTPS
  const isSecure = request.url.startsWith('https://');
  const cookieOptions = [
    `better-auth.csrf=${token}`,
    'Path=/',
    'SameSite=Strict',
    isSecure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');

  const response = NextResponse.json({ ok: true });
  response.headers.append('Set-Cookie', cookieOptions);
  return response;
}
