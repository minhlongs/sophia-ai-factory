---
phase: 02
title: "API Endpoints for Analytics"
status: pending
effort: 2h
---

# Phase 02: API Endpoints for Analytics

## Context

**Related Files:**
- Usage Summary API: `src/app/api/usage/summary/route.ts`
- Admin Usage API: `src/app/api/admin/usage/reconciliation/route.ts`
- Polar Client: `src/lib/clients/polar-client.ts`
- Supabase Server: `src/lib/supabase/server.ts`

**Current State:**
- Usage endpoints exist but focus on raw metrics
- No dedicated analytics endpoints for revenue/ROI
- Polar webhook handler exists: `src/lib/payments/polar-webhook-handler.ts`

## Requirements

### Functional
1. GET `/api/analytics/revenue` - Revenue metrics endpoint
2. GET `/api/analytics/roi` - ROI metrics endpoint
3. GET `/api/analytics/cohorts` - Cohort analysis endpoint
4. POST `/api/analytics/reconciliation` - Manual reconciliation trigger
5. Admin-only endpoints for global analytics

### Non-Functional
1. RaaS license validation for premium endpoints
2. Rate limiting
3. Caching for expensive queries
4. TypeScript type safety

## Files to Create

1. `src/app/api/analytics/revenue/route.ts` - Revenue metrics
2. `src/app/api/analytics/roi/route.ts` - ROI metrics
3. `src/app/api/analytics/cohorts/route.ts` - Cohort analysis
4. `src/app/api/analytics/reconciliation/route.ts` - Reconciliation
5. `src/lib/analytics/revenue-service.ts` - Revenue service layer
6. `src/lib/analytics/roi-service.ts` - ROI service layer
7. `src/lib/analytics/cohort-service.ts` - Cohort service layer
8. `src/lib/analytics/analytics-types.ts` - Shared types

## Files to Modify

1. `src/types/index.ts` - Add analytics types
2. `src/middleware.ts` - Add analytics route protection (if needed)

## Implementation Steps

### Step 1: Create Analytics Types

```typescript
// src/lib/analytics/analytics-types.ts

export interface RevenueMetrics {
  licenseNonce: string;
  tenantId: string;
  periodType: 'hourly' | 'daily' | 'monthly';
  periodStart: Date;
  periodEnd: Date;
  grossRevenue: number;
  netRevenue: number;
  refunds: number;
  totalCreditsUsed: number;
  totalRequests: number;
  tier: string;
}

export interface ROIMetrics {
  licenseNonce: string;
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  subscriptionCost: number;
  apiCosts: number;
  totalInvestment: number;
  estimatedCampaignRevenue: number;
  videoViews: number;
  clickThroughs: number;
  conversions: number;
  roiPercentage: number;
  paybackPeriodDays: number | null;
}

export interface CohortData {
  userId: string;
  cohortMonth: Date;
  cohortTier: string;
  periodNumber: number;
  periodStart: Date;
  isActive: boolean;
  videoCount: number;
  revenueGenerated: number;
}

export interface RevenueReconciliationInput {
  source: 'polar' | 'stripe';
  externalOrderId: string;
  externalCustomerId: string;
  externalAmount: number;
  licenseNonce?: string;
  tenantId?: string;
}
```

### Step 2: Create Revenue Service

```typescript
// src/lib/analytics/revenue-service.ts

import { createAdminClient } from '@/lib/supabase/admin';
import type { RevenueMetrics } from './analytics-types';

export const revenueService = {
  /**
   * Get revenue metrics for a tenant
   */
  async getRevenueByTenant(
    tenantId: string,
    periodType: 'daily' | 'monthly' = 'daily',
    limit: number = 30
  ): Promise<RevenueMetrics[]> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('analytics_revenue_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('period_type', periodType)
      .order('period_start', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * Get revenue metrics by license
   */
  async getRevenueByLicense(
    licenseNonce: string,
    limit: number = 30
  ): Promise<RevenueMetrics[]> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('analytics_revenue_metrics')
      .select('*')
      .eq('license_nonce', licenseNonce)
      .order('period_start', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * Record revenue metric (called by webhook/hourly rollup)
   */
  async recordRevenue(metrics: Omit<RevenueMetrics, 'id'>): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('analytics_revenue_metrics')
      .upsert(metrics, {
        onConflict: 'license_nonce,period_type,period_start',
        ignoreDuplicates: false
      });

    if (error) throw error;
  },

  /**
   * Get total revenue by tier
   */
  async getRevenueByTier(
    periodStart: Date,
    periodEnd: Date
  ): Promise<{ tier: string; totalRevenue: number }[]> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('analytics_revenue_metrics')
      .select('tier, gross_revenue')
      .gte('period_start', periodStart.toISOString())
      .lte('period_end', periodEnd.toISOString());

    if (error) throw error;

    // Aggregate by tier
    const byTier = new Map<string, number>();
    data?.forEach(row => {
      const current = byTier.get(row.tier) || 0;
      byTier.set(row.tier, current + Number(row.gross_revenue));
    });

    return Array.from(byTier.entries()).map(([tier, totalRevenue]) => ({
      tier,
      totalRevenue
    }));
  }
};
```

### Step 3: Create Revenue API Route

```typescript
// src/app/api/analytics/revenue/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { revenueService } from '@/lib/analytics/revenue-service';
import { raasGate } from '@/lib/raas-gate';

export async function GET(request: NextRequest) {
  try {
    // RaaS license validation
    const raasResult = await raasGate(request);
    if (!raasResult.valid) {
      return raasResult.response!;
    }

    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const periodType = (searchParams.get('periodType') as 'daily' | 'monthly') || 'daily';
    const limit = parseInt(searchParams.get('limit') || '30');

    // Get revenue metrics
    const metrics = await revenueService.getRevenueByTenant(
      session.user.id,
      periodType,
      limit
    );

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Revenue API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Step 4: Create ROI Service

```typescript
// src/lib/analytics/roi-service.ts

import { createAdminClient } from '@/lib/supabase/admin';
import type { ROIMetrics } from './analytics-types';

export const roiService = {
  /**
   * Calculate ROI for a tenant
   */
  async calculateROI(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<ROIMetrics | null> {
    const supabase = createAdminClient();

    // Get investment (subscription cost + API costs)
    const investment = await this.getInvestment(tenantId, periodStart, periodEnd);

    // Get returns (estimated campaign revenue)
    const returns = await this.getCampaignReturns(tenantId, periodStart, periodEnd);

    if (!investment) return null;

    const roiPercentage = investment.totalInvestment > 0
      ? ((returns.totalRevenue - investment.totalInvestment) / investment.totalInvestment) * 100
      : 0;

    return {
      tenantId,
      licenseNonce: investment.licenseNonce,
      periodStart,
      periodEnd,
      ...investment,
      ...returns,
      roiPercentage
    };
  },

  async getInvestment(tenantId: string, periodStart: Date, periodEnd: Date) {
    const supabase = createAdminClient();

    // Get subscription cost from revenue metrics
    const { data } = await supabase
      .from('analytics_revenue_metrics')
      .select('license_nonce, gross_revenue')
      .eq('tenant_id', tenantId)
      .gte('period_start', periodStart.toISOString())
      .lte('period_end', periodEnd.toISOString())
      .single();

    if (!data) return null;

    return {
      licenseNonce: data.license_nonce,
      subscriptionCost: Number(data.gross_revenue),
      apiCosts: 0, // TODO: Calculate from usage
      totalInvestment: Number(data.gross_revenue)
    };
  },

  async getCampaignReturns(tenantId: string, periodStart: Date, periodEnd: Date) {
    // TODO: Integrate with campaign performance data
    // For now, return placeholder
    return {
      estimatedCampaignRevenue: 0,
      videoViews: 0,
      clickThroughs: 0,
      conversions: 0
    };
  },

  async saveROIMetrics(metrics: ROIMetrics): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('analytics_roi_metrics')
      .upsert(metrics);

    if (error) throw error;
  }
};
```

### Step 5: Create Cohort Service

```typescript
// src/lib/analytics/cohort-service.ts

import { createAdminClient } from '@/lib/supabase/admin';

export const cohortService = {
  /**
   * Get cohort retention data
   */
  async getCohortRetention(cohortMonth: Date) {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('analytics_user_cohorts')
      .select('*')
      .eq('cohort_month', cohortMonth.toISOString())
      .order('period_number');

    if (error) throw error;

    // Calculate retention rate per period
    const retentionByPeriod = new Map<number, { active: number; total: number }>();
    data?.forEach(row => {
      const period = retentionByPeriod.get(row.period_number) || { active: 0, total: 0 };
      period.total++;
      if (row.is_active) period.active++;
      retentionByPeriod.set(row.period_number, period);
    });

    return Array.from(retentionByPeriod.entries()).map(([period, data]) => ({
      period,
      retentionRate: (data.active / data.total) * 100,
      activeUsers: data.active,
      totalUsers: data.total
    }));
  },

  /**
   * Assign user to cohort (called on first purchase)
   */
  async assignToCohort(
    userId: string,
    tier: string,
    cohortMonth: Date
  ): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('analytics_user_cohorts')
      .insert({
        user_id: userId,
        cohort_month: cohortMonth.toISOString(),
        cohort_tier: tier,
        period_number: 0,
        period_start: cohortMonth.toISOString(),
        is_active: true
      });

    if (error) throw error;
  }
};
```

### Step 6: Create Cohorts API Route

```typescript
// src/app/api/analytics/cohorts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cohortService } from '@/lib/analytics/cohort-service';
import { raasGate } from '@/lib/raas-gate';

export async function GET(request: NextRequest) {
  try {
    // RaaS license validation for premium feature
    const raasResult = await raasGate(request);
    if (!raasResult.valid) {
      return raasResult.response!;
    }

    const { searchParams } = new URL(request.url);
    const cohortMonth = searchParams.get('month');

    if (!cohortMonth) {
      return NextResponse.json(
        { error: 'Missing cohort month parameter' },
        { status: 400 }
      );
    }

    const retention = await cohortService.getCohortRetention(new Date(cohortMonth));

    return NextResponse.json({ retention });
  } catch (error) {
    console.error('Cohorts API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Success Criteria

- [ ] All 4 API endpoints created
- [ ] Service layers implemented with error handling
- [ ] RaaS license validation working
- [ ] TypeScript types defined and used
- [ ] API tests pass

## API Response Examples

### GET /api/analytics/revenue?periodType=monthly&limit=12

```json
{
  "metrics": [
    {
      "licenseNonce": "abc123...",
      "tenantId": "user-uuid",
      "periodType": "monthly",
      "periodStart": "2026-03-01T00:00:00Z",
      "periodEnd": "2026-03-31T23:59:59Z",
      "grossRevenue": 399.00,
      "netRevenue": 359.10,
      "refunds": 0,
      "totalCreditsUsed": 5000,
      "totalRequests": 150,
      "tier": "PREMIUM"
    }
  ]
}
```

### GET /api/analytics/roi?periodStart=2026-03-01&periodEnd=2026-03-31

```json
{
  "metrics": {
    "licenseNonce": "abc123...",
    "tenantId": "user-uuid",
    "periodStart": "2026-03-01T00:00:00Z",
    "periodEnd": "2026-03-31T23:59:59Z",
    "subscriptionCost": 399.00,
    "apiCosts": 50.00,
    "totalInvestment": 449.00,
    "estimatedCampaignRevenue": 2500.00,
    "videoViews": 150000,
    "clickThroughs": 4500,
    "conversions": 180,
    "roiPercentage": 455.68,
    "paybackPeriodDays": 7
  }
}
```

## Risks

- **Risk**: API endpoints may be slow with large datasets
- **Mitigation**: Add caching, pagination, and query limits

## Next Steps

After APIs are created:
1. Build dashboard UI components (Phase 03)
2. Integrate revenue tracking with Polar webhooks (Phase 04)
