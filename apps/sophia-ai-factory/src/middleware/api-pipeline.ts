import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateCronRequest } from '@/seed/security/csrf';
import { isSensitiveApiRoute } from './sensitive-routes';
import { requireAuth } from './auth';
import { enforceMfaGate } from './mfa';
import { withAuth, isPublicApiRoute } from '@/forest/middleware/auth-guard';
import { getSizeLimit, rejectOversizedRequest } from './request-size-limit';
import { handleApiRoute } from './api-handler';
import { emitUsageEvent } from '@/tree/usage-metering';
import { logger } from '@/seed/utils/logger-utility';
import { applySecurityHeaders } from './middleware-shared-config';

export async function handleApiPipeline(
  request: NextRequest,
  pathname: string,
  pathLocale: string | undefined,
  startTime: number,
  requestHeaders: Headers,
  nonce: string,
  needsCsrfSeed: boolean,
): Promise<NextResponse | null> {
  if (!pathname.startsWith('/api')) return null;

  // Cron secret validation
  if (pathname.startsWith('/api/cron') && !validateCronRequest(request)) {
    return NextResponse.json(
      { error: 'Cron authentication failed', detail: 'Invalid or missing cron secret' },
      { status: 403 },
    );
  }

  // Request size limit
  const sizeRejected = rejectOversizedRequest(request, getSizeLimit(pathname));
  if (sizeRejected) {
    emitUsageEvent(request, { status: sizeRejected.status, headers: sizeRejected.headers }, { tier: request.headers.get('x-user-tier') || 'BASIC' }).catch(
      (err) => { logger.error('[Proxy] Failed to emit size limit usage event', err); },
    );
    return sizeRejected;
  }

  // Rate limiting, auth guard, tenant isolation, webhook pinning
  const blocked = await handleApiRoute(request, pathname, startTime);
  if (blocked) return blocked;

  // Propagate authenticated user session and tier to requestHeaders for downstream routes
  const userId = request.headers.get('x-user-id');
  const userTier = request.headers.get('x-user-tier') || 'BASIC';
  if (userId) {
    requestHeaders.set('x-user-id', userId);
  }
  const userRole = request.headers.get('x-user-role');
  if (userRole) {
    requestHeaders.set('x-user-role', userRole);
  }
  requestHeaders.set('x-user-tier', userTier);

  // Propagate AGY tenant isolation headers
  const agencyId = request.headers.get('x-agency-id');
  if (agencyId) {
    requestHeaders.set('x-agency-id', agencyId);
  }
  const agencySlug = request.headers.get('x-agency-slug');
  if (agencySlug) {
    requestHeaders.set('x-agency-slug', agencySlug);
  }
  const isolationStatus = request.headers.get('x-tenant-isolation-status');
  if (isolationStatus) {
    requestHeaders.set('x-tenant-isolation-status', isolationStatus);
  }

  // Auth guard for protected API routes: avoid redundant session lookup if already verified by handleApiRoute
  if (!isPublicApiRoute(pathname) && !userId) {
    const authResponse = await withAuth(request);
    if (authResponse) {
      emitUsageEvent(request, { status: authResponse.status, headers: authResponse.headers }, { tier: userTier }).catch(
        (err) => { logger.error('[Proxy] Failed to emit auth failure usage event', err); },
      );
      return authResponse;
    }
  }

  // MFA gate for sensitive API routes
  if (isSensitiveApiRoute(pathname)) {
    const authResult = await requireAuth(request, pathLocale ?? 'vi');
    if (authResult instanceof NextResponse) {
      emitUsageEvent(request, { status: authResult.status, headers: authResult.headers }, { tier: request.headers.get('x-user-tier') || 'BASIC' }).catch(
        (err) => { logger.error('[Proxy] Failed to emit MFA auth failure usage event', err); },
      );
      return authResult;
    }
    const mfaResponse = await enforceMfaGate(authResult.session.session.id, pathname, request);
    if (mfaResponse) {
      emitUsageEvent(request, { status: mfaResponse.status, headers: mfaResponse.headers }, { tier: request.headers.get('x-user-tier') || 'BASIC' }).catch(
        (err) => { logger.error('[Proxy] Failed to emit MFA gate failure usage event', err); },
      );
      return mfaResponse;
    }
  }

  // Build API response with usage headers
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const responseTimeMs = Date.now() - startTime;
  response.headers.set('X-Response-Time-Ms', String(responseTimeMs));

  emitUsageEvent(request, { status: response.status, headers: response.headers }, { tier: userTier }).catch(
    (err) => {
      logger.error('[Proxy] Failed to emit success usage event', err);
    },
  );

  applySecurityHeaders(response, nonce, needsCsrfSeed);
  return response;
}
