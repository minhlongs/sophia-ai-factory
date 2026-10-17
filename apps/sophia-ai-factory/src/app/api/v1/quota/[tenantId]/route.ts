/**
 * GET /api/v1/quota/[tenantId] - Quota Status Endpoint
 *
 * Returns current quota limits, usage, and status for a tenant.
 * Protected by JWT + agency_id validation (RaaS Gateway).
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { getQuotaStatus } from '@/forest/quota/quota-enforcer';
import { formatQuotaResponse } from '@/tree/quota/quota-api-helpers';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { authorizeQuotaRequest, fetchActiveTenantLicense } from './quota-request-guard';

/**
 * GET handler for quota status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
): Promise<NextResponse> {
  const { tenantId } = await params;
  return withRateLimit(
    async (r: NextRequest) => {
      try {
        const authCheck = await authorizeQuotaRequest(r, tenantId);
        if (!authCheck.ok) {
          return authCheck.response;
        }

        const { userId, rateLimitRemaining, rateLimitResetAt } = authCheck.context;

        const typedLicense = await fetchActiveTenantLicense(tenantId);
        if (!typedLicense) {
          logger.warn('[Quota API] No active license found for tenant', {
            tenantId,
            userId,
          });
          return NextResponse.json(
            { message: 'Tenant not found or no active license' },
            { status: 404 }
          );
        }

        const quotaStatus = await getQuotaStatus(
          userId,
          typedLicense.nonce,
          typedLicense.tier
        );

        const formattedResponse = formatQuotaResponse(
          quotaStatus.usage,
          { ...quotaStatus.limits, tier: typedLicense.tier },
          typedLicense.tier
        );

        logger.debug('[Quota API] Quota status fetched', {
          userId,
          tenantId,
          status: quotaStatus.status,
          rateLimitRemaining,
        });

        return NextResponse.json(
          {
            tenantId,
            tier: typedLicense.tier,
            ...formattedResponse,
          },
          {
            headers: {
              'X-RateLimit-Remaining': rateLimitRemaining.toString(),
              'X-RateLimit-Reset': new Date(rateLimitResetAt).toISOString(),
            },
          }
        );
      } catch (error) {
        logger.error(
          '[Quota API] Error fetching quota status',
          error instanceof Error ? error : new Error(String(error))
        );
        return NextResponse.json(
          { message: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 120 } }
  )(request);
}
