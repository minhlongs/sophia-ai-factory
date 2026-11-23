/**
 * Better Auth catch-all API handler.
 *
 * Handles: sign-in, sign-up, sign-out, get-session, magic-link, etc.
 * Existing specific routes (tiktok/callback, youtube/callback) take
 * precedence over this catch-all in Next.js routing.
 */

import { getAuth } from '@/seed/auth/better-auth-server';
import {
  enforcePilotAuthAllowlist,
  isGuardedPilotAuthPath,
} from '@/seed/pilot/pilot-auth-guard';
import {
  isEmailAllowedForPilot,
  isPilotInviteOnlyEnabled,
} from '@/seed/pilot/pilot-access-policy';
import { toNextJsHandler } from 'better-auth/next-js';
import { NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import '@/tree/email/sender';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
    }
    const pathname = new URL(request.url).pathname;
    if (isPilotInviteOnlyEnabled() && pathname === '/api/auth/get-session') {
      const session = await auth.api.getSession({ headers: request.headers });
      if (session?.user && !isEmailAllowedForPilot(session.user.email)) {
        return NextResponse.json(null, {
          status: 200,
          headers: { 'Cache-Control': 'private, no-store' },
        });
      }
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
    let forwardedRequest = request;
    const pathname = new URL(request.url).pathname;
    if (isPilotInviteOnlyEnabled() && isGuardedPilotAuthPath(pathname)) {
      const body = await request.arrayBuffer();
      const blocked = enforcePilotAuthAllowlist(pathname, new TextDecoder().decode(body));
      if (blocked) {
        return blocked;
      }
      const headers = new Headers(request.headers);
      headers.set('content-length', String(body.byteLength));
      forwardedRequest = new Request(request.url, {
        method: request.method,
        headers,
        body,
      });
    }

    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
    }
    const { POST: handler } = toNextJsHandler(auth);
    return handler(forwardedRequest);
  } catch (error) {
    logger.error('[auth/all] POST error', toError(error));
    return NextResponse.json({ error: 'Authentication service error' }, { status: 500 });
  }
}
