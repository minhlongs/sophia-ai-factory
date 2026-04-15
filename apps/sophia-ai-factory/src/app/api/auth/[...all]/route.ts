/**
 * Better Auth catch-all API handler.
 *
 * Handles: sign-in, sign-up, sign-out, get-session, magic-link, etc.
 * Existing specific routes (tiktok/callback, youtube/callback) take
 * precedence over this catch-all in Next.js routing.
 */

import { getAuth } from '@/lib/better-auth-server';
import { toNextJsHandler } from 'better-auth/next-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = getAuth();
    const { GET: handler } = toNextJsHandler(auth);
    return handler(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    console.error('[auth/all] GET error:', msg);
    return NextResponse.json({ error: 'Authentication service error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuth();
    const { POST: handler } = toNextJsHandler(auth);
    return handler(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    console.error('[auth/all] POST error:', msg);
    return NextResponse.json({ error: 'Authentication service error' }, { status: 500 });
  }
}
