/**
 * GET /api/v1/quota/[tenantId] - Quota Status Endpoint
 *
 * Returns current quota limits, usage, and status for a tenant.
 * Protected by JWT + agency_id validation (RaaS Gateway).
 *
 * Response:
 * {
 *   tenantId: string,
 *   tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER',
 *   limits: { hourlyCredits, dailyCredits, monthlyCredits, dailyRequests },
 *   usage: { hourly, daily, monthly, requests },
 *   percentages: { hourly, daily, monthly },
 *   status: 'ok' | 'warning' | 'critical',
 *   polarSynced: boolean,
 *   lastPolarSync?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { validateJwt } from '@/lib/security/jwt-validator';
import { getQuotaStatus } from '@/lib/quota/quota-enforcer';
import { checkRateLimit as checkApiRateLimit } from '@/lib/security/rate-limiter';
import { formatQuotaResponse } from '@/lib/quota/quota-api-helpers';

/**
 * GET handler for quota status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;

    // Step 1: Extract and validate JWT
    const authHeader = request.headers.get('authorization');
    const jwtResult = await validateJwt(authHeader);

    if (!jwtResult.valid) {
      logger.warn('[Quota API] JWT validation failed', {
        error: jwtResult.error,
        tenantId,
      });

      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = jwtResult.payload?.sub;
    if (!userId) {
      return NextResponse.json(
        { message: 'Invalid JWT payload' },
        { status: 401 }
      );
    }

    // Step 2: Validate agency_id (tenant isolation)
    const agencyIdHeader = request.headers.get('x-raas-agency-id');
    if (agencyIdHeader && agencyIdHeader !== tenantId) {
      logger.warn('[Quota API] Cross-tenant access attempt blocked', {
        userId,
        requestedTenant: tenantId,
        agencyIdHeader,
      });

      return NextResponse.json(
        { message: 'Cross-tenant access denied' },
        { status: 403 }
      );
    }

    // Step 3: Check rate limit (100 req/min per tenant)
    const rateLimitResult = await checkApiRateLimit(tenantId, 100);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
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
      );
    }

    // Step 4: Fetch license info for tenant
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
      logger.warn('[Quota API] No active license found for tenant', {
        tenantId,
        userId,
      });

      return NextResponse.json(
        { message: 'Tenant not found or no active license' },
        { status: 404 }
      );
    }

    const typedLicense = license as { nonce: string; tier: string; agency_id: string };

    // Step 5: Get quota status with Polar sync info
    const quotaStatus = await getQuotaStatus(
      userId,
      typedLicense.nonce,
      typedLicense.tier,
      undefined // polarCustomerId - can be added if needed
    );

    // Step 6: Format response
    const formattedResponse = formatQuotaResponse(
      quotaStatus.usage,
      quotaStatus.limits,
      typedLicense.tier,
      quotaStatus.polarSynced,
      quotaStatus.lastPolarSync
    );

    // Step 7: Log audit event
    logger.info('[Quota API] Quota status fetched', {
      userId,
      tenantId,
      status: quotaStatus.status,
      rateLimitRemaining: rateLimitResult.remaining,
    });

    return NextResponse.json(
      {
        tenantId,
        tier: typedLicense.tier,
        ...formattedResponse,
      },
      {
        headers: {
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
        },
      }
    );

  } catch (error) {
    logger.error('[Quota API] Error fetching quota status', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
