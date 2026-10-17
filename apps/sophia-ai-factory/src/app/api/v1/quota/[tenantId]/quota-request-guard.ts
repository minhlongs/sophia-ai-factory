/**
 * Quota Status API request guard and license lookup helpers
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { validateJwt } from '@/seed/security/jwt-validator';
import { requireOrgMembership } from '@/seed/db/org-membership';
import { checkRateLimit as checkApiRateLimit } from '@/seed/security/rate-limiter';
import type { Tier } from '@/seed/types';

export interface AuthorizedQuotaContext {
  userId: string;
  rateLimitRemaining: number;
  rateLimitResetAt: number;
}

export async function authorizeQuotaRequest(
  r: NextRequest,
  tenantId: string
): Promise<{ ok: true; context: AuthorizedQuotaContext } | { ok: false; response: NextResponse }> {
  const authHeader = r.headers.get('authorization');
  const jwtResult = await validateJwt(authHeader);

  if (!jwtResult.valid) {
    logger.warn('[Quota API] JWT validation failed', {
      error: jwtResult.error,
      tenantId,
    });
    return {
      ok: false,
      response: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }),
    };
  }

  const userId = jwtResult.payload?.sub;
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ message: 'Invalid JWT payload' }, { status: 401 }),
    };
  }

  const membershipResult = await requireOrgMembership(userId);
  if (!membershipResult.authorized) {
    logger.warn('[Quota API] User not in any org', { userId, tenantId });
    return {
      ok: false,
      response: NextResponse.json({ message: 'Forbidden' }, { status: 403 }),
    };
  }

  const agencyIdHeader = r.headers.get('x-raas-agency-id');
  if (agencyIdHeader && agencyIdHeader !== tenantId) {
    logger.warn('[Quota API] Cross-tenant access attempt blocked', {
      userId,
      requestedTenant: tenantId,
      agencyIdHeader,
    });
    return {
      ok: false,
      response: NextResponse.json({ message: 'Cross-tenant access denied' }, { status: 403 }),
    };
  }

  const rateLimitResult = await checkApiRateLimit(tenantId, 100);
  if (!rateLimitResult.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          message: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
          },
        }
      ),
    };
  }

  return {
    ok: true,
    context: {
      userId,
      rateLimitRemaining: rateLimitResult.remaining,
      rateLimitResetAt: rateLimitResult.resetAt,
    },
  };
}

export async function fetchActiveTenantLicense(
  tenantId: string
): Promise<{ nonce: string; tier: Tier; agency_id: string } | null> {
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
    return null;
  }

  return license as { nonce: string; tier: Tier; agency_id: string };
}
