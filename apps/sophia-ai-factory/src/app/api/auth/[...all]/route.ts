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
import { toError } from '@/lib/utils/to-error';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = getAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
    }
    const { GET: handler } = toNextJsHandler(auth);
    return handler(request);
  } catch (error) {
    logger.error('[auth/all] GET error', toError(error));
    return NextResponse.json({ error: 'Authentication service error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
    }
    const { POST: handler } = toNextJsHandler(auth);
    return handler(request);
  } catch (error) {
    logger.error('[auth/all] POST error', toError(error));
    return NextResponse.json({ error: 'Authentication service error' }, { status: 500 });
  }
}
