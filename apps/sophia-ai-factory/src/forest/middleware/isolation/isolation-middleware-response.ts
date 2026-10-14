/**
 * HTTP response builder and Next.js Edge Middleware adapter for AGY Tenant Isolation.
 * @module forest/middleware/isolation/isolation-middleware-response
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { AgyTenantIsolationResult } from './types';

export function buildIsolationDeniedResponse(
  result: AgyTenantIsolationResult,
): NextResponse {
  const errorBody = {
    error:
      result.status === 429
        ? 'Too Many Requests'
        : result.status === 401
          ? 'Unauthorized'
          : 'Forbidden',
    message: result.reason || 'Access denied by AGY tenant isolation',
    code: result.errorCode || 'TENANT_ISOLATION_ERROR',
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Isolation-Status': 'denied',
    'X-Tenant-Isolation-Reason': result.errorCode || 'unknown',
  };

  if (result.rateLimit) {
    headers['X-Agency-RateLimit-Limit'] = String(result.rateLimit.limitRps);
    headers['X-Agency-RateLimit-Remaining'] = String(result.rateLimit.remaining);
    headers['X-Agency-RateLimit-Reset'] = String(result.rateLimit.resetMs);
    if (result.rateLimit.retryAfterSeconds && result.rateLimit.retryAfterSeconds > 0) {
      headers['Retry-After'] = String(result.rateLimit.retryAfterSeconds);
    }
  }

  return NextResponse.json(errorBody, {
    status: result.status,
    headers,
  });
}

export function applyIsolationHeaders(
  request: NextRequest,
  result: AgyTenantIsolationResult,
): void {
  if (result.context?.agencyId) {
    request.headers.set('x-agency-id', result.context.agencyId);
  }
  if (result.context?.agencySlug) {
    request.headers.set('x-agency-slug', result.context.agencySlug);
  }
  request.headers.set('x-tenant-isolation-status', 'verified');
}
