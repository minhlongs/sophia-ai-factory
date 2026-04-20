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
import { logger } from '@/lib/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = getAuth();
    const { GET: handler } = toNextJsHandler(auth);
    return handler(request);
  } catch (error) {
    logger.error('[auth/all] GET error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Authentication service error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuth();
    const { POST: handler } = toNextJsHandler(auth);
    return handler(request);
  } catch (error) {
    logger.error('[auth/all] POST error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Authentication service error' }, { status: 500 });
  }
}
