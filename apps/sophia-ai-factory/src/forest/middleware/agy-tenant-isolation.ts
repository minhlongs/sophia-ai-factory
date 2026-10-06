/**
 * Forest Layer: AGY Tenant Isolation Edge Middleware
 *
 * Enforces cross-tenant protection, token cryptographic validation,
 * sliding-window per-agency rate limiting, and request header decoration.
 *
 * Invariants:
 * - Edge runtime compliant: non-blocking, sub-millisecond execution.
 * - Layer: forest (imports only @/seed/* and @/tree/*).
 *
 * @module forest/middleware/agy-tenant-isolation
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AgencyTenantContext,
  RateLimitCheckResult,
} from '@/seed/types/agy-multitenancy';
import {
  classifySubdomain,
  normalizeHostname,
  resolveAgencySlugFromHostname,
} from '@/tree/agy/domain-router';
import {
  verifyTenantTokenSignature,
  validateTokenPermissions,
} from '@/tree/agy/tenant-token-engine';
import {
  checkRateLimitWindow,
  checkMonthlyQuota,
} from '@/tree/agy/agency-quota-engine';

export interface AgyTenantIsolationResult {
  allowed: boolean;
  status: number;
  reason?: string;
  errorCode?: string;
  context?: Partial<AgencyTenantContext>;
  rateLimit?: RateLimitCheckResult;
}

export interface AgyIsolationOptions {
  requireToken?: boolean;
  requiredPermission?: string;
  defaultRpsLimit?: number;
  defaultQuotaMcu?: number;
  secret?: string;
  nowMs?: number;
}

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
 * Extracts raw tenant token from Authorization header or custom headers
 */
export function extractTenantToken(request: NextRequest | Request): string | null {
  const headers = request.headers;

  // 1. Check x-tenant-token
  const customHeader = headers.get('x-tenant-token');
  if (customHeader) return customHeader.trim();

  // 2. Check Authorization Bearer
  const authHeader = headers.get('authorization');
  if (authHeader) {
    const trimmed = authHeader.trim();
    if (/^bearer\s+agy_tok_/i.test(trimmed)) {
      return trimmed.replace(/^bearer\s+/i, '').trim();
    }
  }

  return null;
}

/**
 * Extracts effective agency identifier or slug from headers or hostname
 */
export function extractAgencyIdentifier(request: NextRequest | Request): {
  agencyId: string | null;
  agencySlug: string | null;
} {
  const headers = request.headers;

  const agencyId =
    headers.get('x-agency-id') ||
    headers.get('x-raas-agency-id') ||
    null;

  let agencySlug = headers.get('x-agency-slug');

  if (!agencySlug) {
    const hostHeader = headers.get('x-forwarded-host') || headers.get('host');
    if (hostHeader) {
      agencySlug = resolveAgencySlugFromHostname(hostHeader);
    }
  }

  return { agencyId, agencySlug };
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

  let verifiedAgencyId: string | null = null;
  let tokenPermissions: string[] = [];

  // 2. Cryptographic token verification if present
  if (tokenString) {
    const currentTimeSec = Math.floor(nowMs / 1000);
    const verification = await verifyTenantTokenSignature(tokenString, secret, currentTimeSec);

    if (!verification.valid) {
      if (verification.errorCode === 'EXPIRED') {
        return {
          allowed: false,
          status: 401,
          reason: verification.reason || 'Tenant token expired',
          errorCode: 'TENANT_TOKEN_EXPIRED',
        };
      }
      return {
        allowed: false,
        status: 403,
        reason: verification.reason || 'Invalid tenant token signature',
        errorCode: 'INVALID_TENANT_TOKEN',
      };
    }

    if (verification.payload) {
      verifiedAgencyId = verification.payload.agencyId;
      tokenPermissions = verification.payload.permissions;
    }
  } else if (requireToken) {
    return {
      allowed: false,
      status: 401,
      reason: 'Tenant token required for this route',
      errorCode: 'MISSING_TENANT_TOKEN',
    };
  }

  // 3. Cross-tenant protection: check for conflicting agency claims
  const targetAgencyId = headerAgencyId || verifiedAgencyId;

  if (verifiedAgencyId && headerAgencyId && verifiedAgencyId !== headerAgencyId) {
    logger.warn('[AGY Tenant Isolation] Cross-tenant access attempted', {
      tokenAgency: verifiedAgencyId,
      headerAgency: headerAgencyId,
      path: pathname,
    });
    return {
      allowed: false,
      status: 403,
      reason: 'Cross-tenant access denied: Token agency does not match target agency',
      errorCode: 'CROSS_TENANT_ACCESS_DENIED',
    };
  }

  // Check header mismatch with target query param if specified (e.g. ?agency_id=...)
  const queryAgencyId = url.searchParams.get('agency_id');
  if (targetAgencyId && queryAgencyId && targetAgencyId !== queryAgencyId) {
    return {
      allowed: false,
      status: 403,
      reason: 'Cross-tenant access denied: Target parameter does not match active agency',
      errorCode: 'CROSS_TENANT_ACCESS_DENIED',
    };
  }

  // 4. Validate token permissions if required
  if (requiredPermission && tokenString) {
    const hasPermission = validateTokenPermissions(tokenPermissions, requiredPermission);
    if (!hasPermission) {
      return {
        allowed: false,
        status: 403,
        reason: `Insufficient tenant token permissions for ${requiredPermission}`,
        errorCode: 'INSUFFICIENT_PERMISSIONS',
      };
    }
  }

  // 5. Sliding-window rate-limiting per agency
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
