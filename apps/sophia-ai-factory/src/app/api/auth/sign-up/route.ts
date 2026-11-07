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
  let auth;
  try {
    auth = await getAuth();
  } catch {
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
  }
  if (!auth) {
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
  }

  const { POST: handler } = toNextJsHandler(auth);

  // Rewrite URL to the actual Better Auth sign-up/email endpoint. The body is
  // buffered first: forwarding `request.body` into a new Request makes Node
  // demand `duplex: 'half'`, which this route cannot declare, and consuming the
  // original stream directly would break the rewritten request.
  const url = new URL(request.url);
  url.pathname = '/api/auth/sign-up/email';
  const body = await request.arrayBuffer();
  const headers = new Headers(request.headers);
  headers.set('content-length', String(body.byteLength));
  const rewritten = new NextRequest(url, {
    method: 'POST',
    headers,
    body,
  });

  return handler(rewritten);
}
