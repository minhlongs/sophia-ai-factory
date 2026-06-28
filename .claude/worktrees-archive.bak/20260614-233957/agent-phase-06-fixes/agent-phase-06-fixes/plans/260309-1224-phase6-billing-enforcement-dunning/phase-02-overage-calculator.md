---
title: "Phase 2: Overage Usage Calculator Service"
description: "Service to calculate overage charges from usage events with tier-based pricing"
status: pending
priority: P2
effort: 2h
parent: ../plan.md
---

# Phase 2: Overage Usage Calculator Service

## Overview

Create a service that calculates overage charges from `usage_events` table, aggregating by billing period and applying tier-based pricing.

## Current State

**Existing:**
- `src/lib/billing/overage-billing-reconciler.ts` - Already has `calculateOverageCharges()` function
- `src/lib/billing/billing-types.ts` - Has `PRICING_TIERS` configuration
- `usage_events` table - Tracks all API usage

**Gap:** Need to aggregate usage from `usage_events` and detect overage before creating `overage_events`.

## Implementation Steps

### Step 1: Create Usage Aggregator Service

**File:** `src/lib/billing/usage-aggregator.ts` (NEW)

```typescript
/**
 * Usage Aggregator Service
 *
 * Aggregates usage events by period and calculates overage
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type { Tier } from '@/types';
import { QUOTA_LIMITS } from '@/lib/usage-metering/aggregator';

/**
 * Usage summary for a billing period
 */
export interface UsageSummary {
  userId: string;
  licenseNonce: string;
  tier: Tier;
  periodStart: number;
  periodEnd: number;

  // Hourly usage
  hourlyCredits: number;
  hourlyLimit: number;
  hourlyOverage: number;

  // Daily usage
  dailyCredits: number;
  dailyLimit: number;
  dailyOverage: number;

  // Monthly usage
  monthlyCredits: number;
  monthlyLimit: number;
  monthlyOverage: number;

  // Request count
  dailyRequests: number;
  dailyRequestLimit: number;
  dailyRequestOverage: number;
}

/**
 * Aggregate usage for a specific license
 */
export async function aggregateUsageForLicense(
  licenseNonce: string,
  periodStart?: number,
  periodEnd?: number
): Promise<UsageSummary | null> {
  const supabase = createAdminClient();

  // Get license info
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('created_by, tier')
    .eq('nonce', licenseNonce)
    .single();

  if (!license) {
    logger.warn('[Usage Aggregator] License not found', { licenseNonce });
    return null;
  }

  const userId = license.created_by;
  const tier = license.tier as Tier;

  // Calculate period boundaries
  const now = Math.floor(Date.now() / 1000);
  const hourStart = Math.floor(now / 3600) * 3600;
  const dayStart = Math.floor(now / 86400) * 86400;
  const monthStart = Math.floor(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000
  );

  // Fetch usage events
  const { data: events } = await supabase
    .from('usage_events')
    .select('credits_used, created_at')
    .eq('user_id', userId)
    .eq('license_nonce', licenseNonce)
    .gte('created_at', periodStart || monthStart);

  if (!events || events.length === 0) {
    return {
      userId,
      licenseNonce,
      tier,
      periodStart: periodStart || monthStart,
      periodEnd: periodEnd || now,
      hourlyCredits: 0,
      hourlyLimit: QUOTA_LIMITS[tier].hourlyCredits,
      hourlyOverage: 0,
      dailyCredits: 0,
      dailyLimit: QUOTA_LIMITS[tier].dailyCredits,
      dailyOverage: 0,
      monthlyCredits: 0,
      monthlyLimit: QUOTA_LIMITS[tier].monthlyCredits,
      monthlyOverage: 0,
      dailyRequests: 0,
      dailyRequestLimit: QUOTA_LIMITS[tier].dailyRequests,
      dailyRequestOverage: 0,
    };
  }

  // Aggregate by period
  let hourlyCredits = 0;
  let dailyCredits = 0;
  let monthlyCredits = 0;
  let dailyRequests = 0;

  for (const event of events) {
    const timestamp = event.created_at;
    const credits = event.credits_used || 1;

    if (timestamp >= hourStart) {
      hourlyCredits += credits;
    }
    if (timestamp >= dayStart) {
      dailyCredits += credits;
      dailyRequests++;
    }
    if (timestamp >= monthStart) {
      monthlyCredits += credits;
    }
  }

  // Get limits
  const limits = QUOTA_LIMITS[tier];

  return {
    userId,
    licenseNonce,
    tier,
    periodStart: periodStart || monthStart,
    periodEnd: periodEnd || now,
    hourlyCredits,
    hourlyLimit: limits.hourlyCredits,
    hourlyOverage: Math.max(0, hourlyCredits - limits.hourlyCredits),
    dailyCredits,
    dailyLimit: limits.dailyCredits,
    dailyOverage: Math.max(0, dailyCredits - limits.dailyCredits),
    monthlyCredits,
    monthlyLimit: limits.monthlyCredits,
    monthlyOverage: Math.max(0, monthlyCredits - limits.monthlyCredits),
    dailyRequests,
    dailyRequestLimit: limits.dailyRequests,
    dailyRequestOverage: Math.max(0, dailyRequests - limits.dailyRequests),
  };
}

/**
 * Detect overage events from usage summary
 */
export function detectOverageEvents(summary: UsageSummary): Array<{
  type: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  limit: number;
  current: number;
  exceededBy: number;
}> {
  const overages: Array<{
    type: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
    limit: number;
    current: number;
    exceededBy: number;
  }> = [];

  if (summary.hourlyOverage > 0) {
    overages.push({
      type: 'hourly_credits',
      limit: summary.hourlyLimit,
      current: summary.hourlyCredits,
      exceededBy: summary.hourlyOverage,
    });
  }

  if (summary.dailyOverage > 0) {
    overages.push({
      type: 'daily_credits',
      limit: summary.dailyLimit,
      current: summary.dailyCredits,
      exceededBy: summary.dailyOverage,
    });
  }

  if (summary.monthlyOverage > 0) {
    overages.push({
      type: 'monthly_credits',
      limit: summary.monthlyLimit,
      current: summary.monthlyCredits,
      exceededBy: summary.monthlyOverage,
    });
  }

  if (summary.dailyRequestOverage > 0) {
    overages.push({
      type: 'daily_requests',
      limit: summary.dailyRequestLimit,
      current: summary.dailyRequests,
      exceededBy: summary.dailyRequestOverage,
    });
  }

  return overages;
}

/**
 * Scan all active licenses for overage
 */
export async function scanAllLicensesForOverage(): Promise<UsageSummary[]> {
  const supabase = createAdminClient();

  // Get all active licenses (not revoked)
  const { data: licenses } = await supabase
    .from('raas_licenses')
    .select('nonce, tier, created_by')
    .eq('is_revoked', false);

  if (!licenses || licenses.length === 0) {
    logger.info('[Usage Aggregator] No active licenses found');
    return [];
  }

  // Aggregate usage for each license
  const summaries: UsageSummary[] = [];

  for (const license of licenses) {
    try {
      const summary = await aggregateUsageForLicense(license.nonce);
      if (summary) {
        summaries.push(summary);
      }
    } catch (error) {
      logger.error('[Usage Aggregator] Failed to aggregate usage', {
        licenseNonce: license.nonce.slice(0, 8),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info('[Usage Aggregator] Scanned licenses', {
    total: licenses.length,
    scanned: summaries.length,
  });

  return summaries;
}
```

### Step 2: Update Overage Reconciler to Use Aggregator

**File:** `src/lib/billing/overage-billing-reconciler.ts`

Add import and use the new aggregator:

```typescript
import {
  scanAllLicensesForOverage,
  detectOverageEvents,
  aggregateUsageForLicense,
} from './usage-aggregator';
```

Update `scanUnbilledOverageEvents()` to use aggregation:

```typescript
export async function scanUnbilledOverageEvents(
  config: OverageBillingConfig = DEFAULT_OVERAGE_BILLING_CONFIG
): Promise<UnbilledEventsByUser[]> {
  // NEW: Scan usage and detect overage
  const summaries = await scanAllLicensesForOverage();

  const groups: UnbilledEventsByUser[] = [];

  for (const summary of summaries) {
    const overages = detectOverageEvents(summary);

    for (const overage of overages) {
      groups.push({
        userId: summary.userId,
        licenseNonce: summary.licenseNonce,
        tier: summary.tier,
        externalCustomerId: summary.externalCustomerId,
        events: [], // Aggregated, no individual events
        totalOverageCredits: overage.exceededBy,
        periodStart: summary.periodStart,
        periodEnd: summary.periodEnd,
      });
    }
  }

  return groups;
}
```

### Step 3: Create API Endpoint for Usage Summary

**File:** `src/app/api/usage/summary/route.ts` (NEW)

```typescript
/**
 * GET /api/usage/summary
 *
 * Get usage summary for authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { aggregateUsageForLicense } from '@/lib/billing/usage-aggregator';

export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get license nonce from query or header
    const licenseNonce = req.nextUrl.searchParams.get('license') ||
                         req.headers.get('x-license-nonce');

    if (!licenseNonce) {
      return NextResponse.json(
        { error: 'License nonce required' },
        { status: 400 }
      );
    }

    // Aggregate usage
    const summary = await aggregateUsageForLicense(licenseNonce);

    if (!summary) {
      return NextResponse.json(
        { error: 'License not found' },
        { status: 404 }
      );
    }

    // Only return if user owns the license
    if (summary.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      summary: {
        tier: summary.tier,
        periodStart: new Date(summary.periodStart * 1000).toISOString(),
        periodEnd: new Date(summary.periodEnd * 1000).toISOString(),
        hourly: {
          used: summary.hourlyCredits,
          limit: summary.hourlyLimit,
          overage: summary.hourlyOverage,
          percentage: Math.round((summary.hourlyCredits / summary.hourlyLimit) * 100),
        },
        daily: {
          used: summary.dailyCredits,
          limit: summary.dailyLimit,
          overage: summary.dailyOverage,
          percentage: Math.round((summary.dailyCredits / summary.dailyLimit) * 100),
        },
        monthly: {
          used: summary.monthlyCredits,
          limit: summary.monthlyLimit,
          overage: summary.monthlyOverage,
          percentage: Math.round((summary.monthlyCredits / summary.monthlyLimit) * 100),
        },
      },
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch usage summary' },
      { status: 500 }
    );
  }
}
```

## Database Changes

No new tables required. Uses existing:
- `usage_events` table
- `raas_licenses` table

## Testing

### Unit Tests

**File:** `src/lib/billing/usage-aggregator.test.ts`

```typescript
describe('UsageAggregator', () => {
  describe('aggregateUsageForLicense', () => {
    it('should aggregate usage for current period', async () => {
      const summary = await aggregateUsageForLicense('test-nonce');

      expect(summary).toBeDefined();
      expect(summary.hourlyCredits).toBeGreaterThanOrEqual(0);
      expect(summary.dailyCredits).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectOverageEvents', () => {
    it('should detect hourly overage', () => {
      const summary: UsageSummary = {
        // ... mock with hourlyOverage > 0
      };

      const overages = detectOverageEvents(summary);

      expect(overages.some(o => o.type === 'hourly_credits')).toBe(true);
    });
  });
});
```

## Success Criteria

- [ ] `usage-aggregator.ts` service created with all functions
- [ ] Overage reconciler uses aggregator for detection
- [ ] `/api/usage/summary` endpoint returns usage data
- [ ] Unit tests pass for aggregation logic
- [ ] No breaking changes to existing overage billing

## Related Files

- `src/lib/billing/usage-aggregator.ts` (NEW)
- `src/lib/billing/overage-billing-reconciler.ts` (modified)
- `src/app/api/usage/summary/route.ts` (NEW)
- `src/lib/usage-metering/aggregator.ts` (reference for QUOTA_LIMITS)

---

## Unresolved Questions

None - implementation builds on existing quota limit definitions.
