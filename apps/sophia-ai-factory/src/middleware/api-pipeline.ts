import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateCronRequest } from '@/seed/security/csrf';
import { isSensitiveApiRoute } from './sensitive-routes';
import { requireAuth } from './auth';
import { enforceMfaGate } from './mfa';
import { withAuth, isPublicApiRoute } from '@/forest/middleware/auth-guard';
import { getSizeLimit, rejectOversizedRequest } from './request-size-limit';
import { handleApiRoute } from '../middleware-api-handler';
import { emitUsageEvent } from '@/forest/usage-metering';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
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
  if (sizeRejected) return sizeRejected;

  // Rate limiting, RaaS gate, tenant isolation, webhook pinning
  const blocked = await handleApiRoute(request, pathname, startTime);
  if (blocked) return blocked;

  // Auth guard for protected API routes
  if (!isPublicApiRoute(pathname)) {
    const authResponse = await withAuth(request);
    if (authResponse) return authResponse;
  }

  // MFA gate for sensitive API routes
  if (isSensitiveApiRoute(pathname)) {
    const authResult = await requireAuth(request, pathLocale ?? 'vi');
    if (authResult instanceof NextResponse) return authResult;
    const mfaResponse = await enforceMfaGate(authResult.session.session.id, pathname, request);
    if (mfaResponse) return mfaResponse;
  }

  // Build API response with usage headers
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const responseTimeMs = Date.now() - startTime;
  response.headers.set('X-Response-Time-Ms', String(responseTimeMs));
  const receiptHeader = request.headers.get('x-raas-receipt');
  if (receiptHeader) response.headers.set('X-RaaS-Receipt', receiptHeader);

  const quotaRemainingJson = request.headers.get('x-quota-remaining');
  if (quotaRemainingJson) {
    try {
      const remaining = JSON.parse(quotaRemainingJson);
      const resetTimestamp = Math.floor(Date.now() / 1000) + 3600;
      response.headers.set(
        'X-RateLimit-Limit',
        String(remaining.hourlyLimit ?? remaining.dailyLimit ?? remaining.hourlyCredits ?? remaining.dailyCredits),
      );
      response.headers.set('X-RateLimit-Remaining', String(remaining.hourlyCredits ?? remaining.dailyCredits));
      response.headers.set('X-RateLimit-Reset', String(resetTimestamp));
    } catch (error) {
      logger.error('[Proxy] Failed to parse quota remaining', toError(error));
    }
  }

  const raasTier = request.headers.get('x-raas-tier');
  emitUsageEvent(request, { status: response.status, headers: response.headers }, { tier: raasTier || 'BASIC' }).catch(
    (err) => {
      logger.error('[Proxy] Failed to emit success usage event', err);
    },
  );

  applySecurityHeaders(response, nonce, needsCsrfSeed);
  return response;
}
