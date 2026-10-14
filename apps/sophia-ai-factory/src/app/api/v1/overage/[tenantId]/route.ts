/**
 * GET /api/v1/overage/[tenantId] - Overage Events Endpoint
 *
 * Returns overage events and billing status for a tenant.
 * Protected by JWT + agency_id validation (RaaS Gateway).
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import {
  formatOverageEvents,
  calculateOverageTotals,
  type FormattedOverageEvent,
  type OverageTotals,
} from '@/land/billing/overage-formatter';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import {
  verifyTenantOverageAccess,
  fetchTenantOverageData,
} from './overage-route-helpers';

export { verifyTenantOverageAccess, fetchTenantOverageData };

/**
 * GET handler for overage events
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
): Promise<NextResponse> {
  const { tenantId } = await params;
  return withRateLimit(async (r: NextRequest) => {
    try {
      const authResult = await verifyTenantOverageAccess(r, tenantId);
      if (!authResult.authorized) {
        return authResult.response;
      }

      const { userId, rateLimitResult } = authResult;
      const dataResult = await fetchTenantOverageData(userId, tenantId);
      if (!dataResult.ok) {
        return NextResponse.json({ message: dataResult.message }, { status: dataResult.status });
      }

      const { tier, overageEvents } = dataResult.data;
      const events: FormattedOverageEvent[] = formatOverageEvents(overageEvents);
      const totals: OverageTotals = calculateOverageTotals(overageEvents);

      logger.debug('[Overage API] Overage events fetched', {
        userId,
        tenantId,
        eventCount: events.length,
        totalOverage: totals.totalOverage,
        rateLimitRemaining: rateLimitResult.remaining,
      });

      return NextResponse.json(
        { tenantId, tier, events, totals },
        {
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
          },
        }
      );
    } catch (error) {
      logger.error(
        '[Overage API] Error fetching overage events',
        error instanceof Error ? error : new Error(String(error))
      );
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 120 } })(request);
}
