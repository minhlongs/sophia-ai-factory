/**
 * Better Auth catch-all API handler.
 *
 * Handles: sign-in, sign-up, sign-out, get-session, magic-link, etc.
 * Existing specific routes (tiktok/callback, youtube/callback) take
 * precedence over this catch-all in Next.js routing.
 */

import { getAuth } from '@/seed/auth/better-auth-server';
import {
  enforceAllowedRequestHost,
  resolvePublicRequestOrigin,
} from '@/seed/domain';
import { syncActiveBrandDomainsFromD1 } from '@/tree/brand-domains';
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

function normalizeAuthPathname(url: string): string {
  const raw = new URL(url).pathname.toLowerCase();
  return raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
}

async function checkRevokedPilotSession(
  auth: NonNullable<Awaited<ReturnType<typeof getAuth>>>,
  request: Request,
  normalizedPath: string,
): Promise<NextResponse | null> {
  if (!isPilotInviteOnlyEnabled() || normalizedPath === '/api/auth/sign-out') {
    return null;
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user && !isEmailAllowedForPilot(session.user.email)) {
    if (normalizedPath === '/api/auth/get-session') {
      return NextResponse.json(null, {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    return NextResponse.json(
      {
        code: 'PILOT_ACCESS_REVOKED',
        error:
          'Your pilot access is not active or has been revoked. / Quyền truy cập bản thử nghiệm của bạn chưa được kích hoạt hoặc đã bị thu hồi.',
      },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  return null;
}

export async function GET(request: Request) {
  try {
    if (!resolvePublicRequestOrigin(request)) {
      await syncActiveBrandDomainsFromD1();
      const hostBlocked = enforceAllowedRequestHost(request);
      if (hostBlocked) return hostBlocked;
    }
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
    }
    const normalizedPath = normalizeAuthPathname(request.url);
    const revokedRes = await checkRevokedPilotSession(auth, request, normalizedPath);
    if (revokedRes) {
      return revokedRes;
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
    if (!resolvePublicRequestOrigin(request)) {
      await syncActiveBrandDomainsFromD1();
      const hostBlocked = enforceAllowedRequestHost(request);
      if (hostBlocked) return hostBlocked;
    }
    let forwardedRequest = request;
    const normalizedPath = normalizeAuthPathname(request.url);
    if (isPilotInviteOnlyEnabled() && isGuardedPilotAuthPath(normalizedPath)) {
      const body = await request.arrayBuffer();
      const blocked = enforcePilotAuthAllowlist(normalizedPath, new TextDecoder().decode(body));
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
    const revokedRes = await checkRevokedPilotSession(auth, request, normalizedPath);
    if (revokedRes) {
      return revokedRes;
    }
    const { POST: handler } = toNextJsHandler(auth);
    return handler(forwardedRequest);
  } catch (error) {
    logger.error('[auth/all] POST error', toError(error));
    return NextResponse.json({ error: 'Authentication service error' }, { status: 500 });
  }
}
