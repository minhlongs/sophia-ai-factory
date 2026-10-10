/**
 * Core enforcement logic for AGY Tenant Isolation
 * @module forest/middleware/isolation/isolation-enforcer
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimitWindow } from '@/tree/agy/agency-quota-engine';
import type { AgyIsolationOptions, AgyTenantIsolationResult } from './types';
import {
  extractTenantToken,
  extractAgencyIdentifier,
  validateTokenCredentials,
  checkCrossTenantConflict,
} from './tenant-validator';

/** In-memory sliding-window buckets per agencyId */
const RATE_LIMIT_CACHE = new Map<string, number[]>();
const MAX_RATE_LIMIT_ENTRIES = 2000;

/**
 * Clears rate limit cache (primarily for unit/integration testing)
 */
export function clearAgencyRateLimits(): void {
  RATE_LIMIT_CACHE.clear();
}

/**
 * Validates tenant isolation, verifies cryptographic tokens, and enforces
 * cross-tenant barriers and sliding-window rate limits.
 */
export async function validateAgyTenantIsolation(
  request: NextRequest | Request,
  options: AgyIsolationOptions = {}
): Promise<AgyTenantIsolationResult> {
  const {
    requireToken = false,
    requiredPermission,
    defaultRpsLimit = 100,
    secret = process.env.AGY_TOKEN_SECRET || process.env.AUTH_SECRET || 'sophia-agy-dev-secret-key-32b',
    nowMs = Date.now(),
  } = options;

  const url = new URL(request.url);
  const pathname = url.pathname;

  // 1. Extract identification signals
  const tokenString = extractTenantToken(request);
  const { agencyId: headerAgencyId, agencySlug: headerAgencySlug } = extractAgencyIdentifier(request);

  // 2. Validate token credentials and permissions
  const tokenResult = await validateTokenCredentials(
    tokenString,
    requireToken,
    secret,
    nowMs,
    requiredPermission
  );

  if (!tokenResult.valid) {
    return {
      allowed: false,
      status: tokenResult.status ?? 401,
      reason: tokenResult.reason,
      errorCode: tokenResult.errorCode,
    };
  }

  // 3. Cross-tenant protection
  const targetAgencyId = headerAgencyId || tokenResult.verifiedAgencyId || null;
  const conflict = checkCrossTenantConflict(
    tokenResult.verifiedAgencyId,
    headerAgencyId,
    pathname,
    url.searchParams.get('agency_id'),
    targetAgencyId
  );

  if (!conflict.allowed) {
    return {
      allowed: false,
      status: conflict.status ?? 403,
      reason: conflict.reason,
      errorCode: conflict.errorCode,
    };
  }

  // 4. Sliding-window rate-limiting per agency
  const effectiveAgency = targetAgencyId || headerAgencySlug || 'global_agency';
  const timestamps = RATE_LIMIT_CACHE.get(effectiveAgency) || [];

  const windowResult = checkRateLimitWindow({
    timestamps,
    nowMs,
    windowMs: 1000,
    maxRequests: defaultRpsLimit,
  });

  if (windowResult.allowed) {
    if (RATE_LIMIT_CACHE.size >= MAX_RATE_LIMIT_ENTRIES) {
      const oldestKey = RATE_LIMIT_CACHE.keys().next().value;
      if (oldestKey) RATE_LIMIT_CACHE.delete(oldestKey);
    }
    RATE_LIMIT_CACHE.set(effectiveAgency, windowResult.prunedTimestamps);
  } else {
    return {
      allowed: false,
      status: 429,
      reason: 'Agency request rate limit exceeded',
      errorCode: 'AGENCY_RATE_LIMIT_EXCEEDED',
      rateLimit: {
        allowed: false,
        agencyId: effectiveAgency,
        currentRps: windowResult.currentCount,
        limitRps: windowResult.limit,
        remaining: 0,
        resetMs: windowResult.resetMs,
        retryAfterSeconds: windowResult.retryAfterSeconds,
      },
    };
  }

  return {
    allowed: true,
    status: 200,
    context: {
      agencyId: targetAgencyId || undefined,
      agencySlug: headerAgencySlug || undefined,
      rateLimitRps: defaultRpsLimit,
    },
    rateLimit: {
      allowed: true,
      agencyId: effectiveAgency,
      currentRps: windowResult.currentCount,
      limitRps: windowResult.limit,
      remaining: windowResult.remaining,
      resetMs: windowResult.resetMs,
      retryAfterSeconds: 0,
    },
  };
}

/**
 * Next.js Edge Middleware for AGY Tenant Isolation.
 * Returns NextResponse (401, 403, 429) if blocked, or null to continue.
 * Decorates request headers with x-agency-id and x-agency-slug when permitted.
 */
export async function agyTenantIsolationMiddleware(
  request: NextRequest,
  options: AgyIsolationOptions = {}
): Promise<NextResponse | null> {
  const result = await validateAgyTenantIsolation(request, options);

  if (!result.allowed) {
    const errorBody = {
      error: result.status === 429 ? 'Too Many Requests' : result.status === 401 ? 'Unauthorized' : 'Forbidden',
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

  // Decorate request headers for downstream consumption
  if (result.context?.agencyId) {
    request.headers.set('x-agency-id', result.context.agencyId);
  }
  if (result.context?.agencySlug) {
    request.headers.set('x-agency-slug', result.context.agencySlug);
  }
  request.headers.set('x-tenant-isolation-status', 'verified');

  return null;
}
