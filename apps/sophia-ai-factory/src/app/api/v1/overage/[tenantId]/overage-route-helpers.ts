/**
 * Auth validation and database helpers for the tenant overage endpoint.
 * @module app/api/v1/overage/[tenantId]/overage-route-helpers
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { validateJwt } from '@/seed/security/jwt-validator';
import { requireOrgMembership } from '@/seed/db/org-membership';
import { checkRateLimit as checkApiRateLimit } from '@/seed/security/rate-limiter';
import type { OverageEvent } from '@/seed/types/billing-contracts';

export interface TenantAuthSuccess {
  authorized: true;
  userId: string;
  rateLimitResult: {
    remaining: number;
    resetAt: number;
  };
}

export interface TenantAuthFailure {
  authorized: false;
  response: NextResponse;
}

export async function verifyTenantOverageAccess(
  r: NextRequest,
  tenantId: string,
): Promise<TenantAuthSuccess | TenantAuthFailure> {
  const authHeader = r.headers.get('authorization');
  const jwtResult = await validateJwt(authHeader);

  if (!jwtResult.valid) {
    logger.warn('[Overage API] JWT validation failed', { error: jwtResult.error, tenantId });
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }),
    };
  }

  const userId = jwtResult.payload?.sub;
  if (!userId) {
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Invalid JWT payload' }, { status: 401 }),
    };
  }

  const membershipResult = await requireOrgMembership(userId);
  if (!membershipResult.authorized) {
    logger.warn('[Overage API] User not in any org', { userId, tenantId });
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Forbidden' }, { status: 403 }),
    };
  }

  const agencyIdHeader = r.headers.get('x-raas-agency-id');
  if (agencyIdHeader && agencyIdHeader !== tenantId) {
    logger.warn('[Overage API] Cross-tenant access attempt blocked', {
      userId,
      requestedTenant: tenantId,
      agencyIdHeader,
    });
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Cross-tenant access denied' }, { status: 403 }),
    };
  }

  const rateLimitResult = await checkApiRateLimit(tenantId, 100);
  if (!rateLimitResult.allowed) {
    return {
      authorized: false,
      response: NextResponse.json(
        { message: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
          },
        },
      ),
    };
  }

  return {
    authorized: true,
    userId,
    rateLimitResult: {
      remaining: rateLimitResult.remaining,
      resetAt: rateLimitResult.resetAt,
    },
  };
}

export interface TenantOverageData {
  tier: string;
  overageEvents: OverageEvent[];
}

export async function fetchTenantOverageData(
  userId: string,
  tenantId: string,
): Promise<{ ok: true; data: TenantOverageData } | { ok: false; status: number; message: string }> {
  const db = createServerClient();
  const { data: license, error: licenseError } = await db
    .from('raas_licenses')
    .select('nonce, tier, agency_id')
    .eq('agency_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (licenseError || !license) {
    logger.warn('[Overage API] No active license found for tenant', { tenantId, userId });
    return { ok: false, status: 404, message: 'Tenant not found or no active license' };
  }

  const typedLicense = license as { nonce: string; tier: string; agency_id: string };

  const { data: overageEvents, error: overageError } = await db
    .from('overage_events')
    .select('*')
    .eq('user_id', userId)
    .eq('license_nonce', typedLicense.nonce)
    .order('created_at', { ascending: false })
    .limit(100);

  if (overageError) {
    logger.error('[Overage API] Failed to fetch overage events', {
      error: overageError.message,
      tenantId,
      userId,
    });
    return { ok: false, status: 500, message: 'Failed to fetch overage events' };
  }

  return {
    ok: true,
    data: {
      tier: typedLicense.tier,
      overageEvents: (overageEvents as unknown as OverageEvent[]) ?? [],
    },
  };
}
