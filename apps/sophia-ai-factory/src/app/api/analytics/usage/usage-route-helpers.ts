/**
 * Query validation and RBAC license resolution helpers for /api/analytics/usage.
 * @module app/api/analytics/usage/usage-route-helpers
 */

import { NextResponse } from 'next/server';
import { verifyLicenseAccess, getUserLicenseNonce, checkAdmin } from '@/land/analytics/rbac';
import { analyticsUsageQuerySchema } from '@/land/validation/services';
import type { UsageMetrics } from '@/land/analytics/types';

export function emptyUsageMetrics(): UsageMetrics {
  return {
    summary: {
      totalRequests: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalCredits: 0,
      avgResponseTimeMs: 0,
      errorRate: 0,
    },
    timeSeries: [],
    serviceBreakdown: [],
  };
}

export function parseUsageQueryParams(searchParams: URLSearchParams):
  | {
      ok: true;
      data: {
        license_nonce?: string;
        startTimestamp: number;
        endTimestamp: number;
        granularity: 'hour' | 'day';
        service?: 'heygen' | 'elevenlabs' | 'openrouter';
      };
    }
  | { ok: false; response: NextResponse } {
  const validation = analyticsUsageQuerySchema.safeParse({
    license_nonce: searchParams.get('license_nonce') ?? undefined,
    start: searchParams.get('start'),
    end: searchParams.get('end'),
    granularity: searchParams.get('granularity') ?? undefined,
    service: searchParams.get('service') ?? undefined,
  });

  if (!validation.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid query params', details: validation.error.flatten() },
        { status: 400 },
      ),
    };
  }

  const { license_nonce, start, end, granularity, service } = validation.data;

  if (!start || !end || isNaN(start) || isNaN(end)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid start/end timestamps - must be valid Unix seconds' },
        { status: 400 },
      ),
    };
  }

  if (start > end) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'start must be before end' }, { status: 400 }),
    };
  }

  const maxRange = 90 * 86400;
  if (end - start > maxRange) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Date range exceeds maximum of 90 days', suggestion: 'Split into smaller ranges' },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    data: {
      license_nonce,
      startTimestamp: start,
      endTimestamp: end,
      granularity,
      service,
    },
  };
}

export async function resolveUsageQueryRbac(
  userId: string,
  requestedLicenseNonce?: string,
): Promise<
  | { ok: true; isAdmin: boolean; queryLicenseNonce?: string }
  | { ok: false; response: NextResponse }
> {
  let queryLicenseNonce: string | undefined = requestedLicenseNonce || undefined;
  const isAdmin = await checkAdmin(userId);

  if (!isAdmin) {
    if (requestedLicenseNonce) {
      const access = await verifyLicenseAccess(userId, requestedLicenseNonce, isAdmin);
      if (!access.allowed) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: access.error || 'Access denied' },
            { status: 403 },
          ),
        };
      }
    } else {
      queryLicenseNonce = (await getUserLicenseNonce(userId)) || undefined;
    }
  }

  return { ok: true, isAdmin, queryLicenseNonce };
}
