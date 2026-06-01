/**
 * GET /api/v1/overage/[tenantId] - Overage Events Endpoint
 *
 * Returns overage events and billing status for a tenant.
 * Protected by JWT + agency_id validation (RaaS Gateway).
 *
 * Response:
 * {
 *   tenantId: string,
 *   tier: string,
 *   events: Array<{
 *     id, exceededType, exceededLimit, exceededCurrent, exceededBy,
 *     requestedCredits, endpoint, service, action, billable, createdAt
 *   }>,
 *   totals: {
 *     totalOverage, billedOverage, unbilledOverage, totalEvents, billableEvents
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { validateJwt } from '@/seed/security/jwt-validator';
import { checkRateLimit as checkApiRateLimit } from '@/seed/security/rate-limiter';
import {
  formatOverageEvents,
  calculateOverageTotals,
  type FormattedOverageEvent,
  type OverageTotals,
} from '@/land/overage/overage-formatter';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import type { OverageEvent } from '@/seed/types/billing-contracts';

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
      // Step 1: Extract and validate JWT
      const authHeader = r.headers.get('authorization');
      const jwtResult = await validateJwt(authHeader);

      if (!jwtResult.valid) {
        logger.warn('[Overage API] JWT validation failed', {
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
      const agencyIdHeader = r.headers.get('x-raas-agency-id');
      if (agencyIdHeader && agencyIdHeader !== tenantId) {
        logger.warn('[Overage API] Cross-tenant access attempt blocked', {
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
        logger.warn('[Overage API] No active license found for tenant', {
          tenantId,
          userId,
        });

        return NextResponse.json(
          { message: 'Tenant not found or no active license' },
          { status: 404 }
        );
      }

      const typedLicense = license as { nonce: string; tier: string; agency_id: string };

      // Step 5: Fetch overage events for tenant
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

        return NextResponse.json(
          { message: 'Failed to fetch overage events' },
          { status: 500 }
        );
      }

      // Step 6: Format events and calculate totals
      const events: FormattedOverageEvent[] = overageEvents
        ? formatOverageEvents(overageEvents as unknown as OverageEvent[])
        : [];

      const totals: OverageTotals = overageEvents
        ? calculateOverageTotals(overageEvents as unknown as OverageEvent[])
        : {
            totalOverage: 0,
            billedOverage: 0,
            unbilledOverage: 0,
            totalEvents: 0,
            billableEvents: 0,
          };

      logger.debug('[Overage API] Overage events fetched', {
        userId,
        tenantId,
        eventCount: events.length,
        totalOverage: totals.totalOverage,
        rateLimitRemaining: rateLimitResult.remaining,
      });

      return NextResponse.json(
        {
          tenantId,
          tier: typedLicense.tier,
          events,
          totals,
        },
        {
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
          },
        }
      );

    } catch (error) {
      logger.error('[Overage API] Error fetching overage events', error instanceof Error ? error : new Error(String(error)));
      return NextResponse.json(
        { message: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 120 } })(request);
}
