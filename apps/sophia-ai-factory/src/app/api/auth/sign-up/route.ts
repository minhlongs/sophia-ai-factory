/**
 * POST /api/auth/sign-up
 *
 * Compatibility endpoint for E2E tests and legacy clients.
 * Forwards the request to Better Auth's /api/auth/sign-up/email handler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/seed/auth/better-auth-server';
import { toNextJsHandler } from 'better-auth/next-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  const auth = getAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
  }

  const { POST: handler } = toNextJsHandler(auth);

  // Rewrite URL to the actual Better Auth sign-up/email endpoint
  const url = new URL(request.url);
  url.pathname = '/api/auth/sign-up/email';
  const rewritten = new NextRequest(url, {
    method: 'POST',
    headers: request.headers,
    body: request.body,
  });

  return handler(rewritten);
}
