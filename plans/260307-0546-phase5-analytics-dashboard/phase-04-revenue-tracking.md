---
phase: 04
title: "Revenue Tracking Module"
status: pending
effort: 2h
---

# Phase 04: Revenue Tracking Module

## Context

**Related Files:**
- Polar Webhook Handler: `src/lib/payments/polar-webhook-handler.ts`
- Polar Types: `src/lib/payments/polar-types.ts`
- Polar Client: `src/lib/clients/polar-client.ts`
- Revenue Service: `src/lib/analytics/revenue-service.ts` (Phase 02)

**Current State:**
- Polar webhooks processed in `src/app/api/webhooks/polar/route.ts`
- Order events handled but not linked to analytics
- Subscription events update user tier but no revenue tracking

## Requirements

### Functional
1. Track revenue on Polar order.completed
2. Handle refunds on order.refunded
3. Reconcile subscription renewals
4. Link revenue to license/tier
5. Calculate MRR/ARR automatically

### Non-Functional
1. Idempotent webhook processing
2. Transaction-safe database operations
3. Audit logging for reconciliation

## Files to Create

1. `src/lib/analytics/revenue-tracker.ts` - Revenue tracking service
2. `src/lib/analytics/reconciliation-service.ts` - Revenue reconciliation

## Files to Modify

1. `src/lib/payments/polar-webhook-handler.ts` - Add revenue tracking calls
2. `src/app/api/webhooks/polar/route.ts` - Add reconciliation logging

## Implementation Steps

### Step 1: Create Revenue Tracker Service

```typescript
// src/lib/analytics/revenue-tracker.ts

import { createAdminClient } from '@/lib/supabase/admin';
import type { PolarOrder, PolarSubscription } from '../payments/polar-types';

interface RevenueRecord {
  licenseNonce: string;
  tenantId: string;
  periodType: 'monthly' | 'yearly';
  periodStart: Date;
  periodEnd: Date;
  grossRevenue: number;
  tier: string;
  polarOrderId?: string;
  polarSubscriptionId?: string;
}

export const revenueTracker = {
  /**
   * Record revenue from Polar order
   */
  async recordOrderRevenue(
    order: PolarOrder,
    licenseNonce: string,
    tenantId: string,
    tier: string
  ): Promise<void> {
    const supabase = createAdminClient();

    const periodStart = new Date(order.created_at);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const revenueData: RevenueRecord = {
      licenseNonce,
      tenantId,
      periodType: 'monthly',
      periodStart,
      periodEnd,
      grossRevenue: order.total_amount / 100, // Convert cents to dollars
      tier,
      polarOrderId: order.id,
    };

    const { error } = await supabase
      .from('analytics_revenue_metrics')
      .upsert(revenueData, {
        onConflict: 'license_nonce,period_type,period_start',
      });

    if (error) {
      console.error('Failed to record order revenue:', error);
      throw error;
    }

    console.log(`Recorded revenue: $${revenueData.grossRevenue} for ${tenantId}`);
  },

  /**
   * Record subscription revenue (renewal)
   */
  async recordSubscriptionRevenue(
    subscription: PolarSubscription,
    licenseNonce: string,
    tenantId: string,
    tier: string
  ): Promise<void> {
    const supabase = createAdminClient();

    const periodStart = new Date(subscription.current_period_start);
    const periodEnd = new Date(subscription.current_period_end);

    const revenueData: RevenueRecord = {
      licenseNonce,
      tenantId,
      periodType: 'monthly',
      periodStart,
      periodEnd,
      grossRevenue: subscription.amount / 100,
      tier,
      polarSubscriptionId: subscription.id,
    };

    const { error } = await supabase
      .from('analytics_revenue_metrics')
      .upsert(revenueData);

    if (error) {
      console.error('Failed to record subscription revenue:', error);
      throw error;
    }
  },

  /**
   * Handle refund - reverse revenue
   */
  async recordRefund(
    orderId: string,
    refundAmount: number
  ): Promise<void> {
    const supabase = createAdminClient();

    // Find original revenue record
    const { data: originalRevenue } = await supabase
      .from('analytics_revenue_metrics')
      .select('*')
      .eq('polar_order_id', orderId)
      .single();

    if (!originalRevenue) {
      console.warn(`No revenue record found for order ${orderId}`);
      return;
    }

    // Update with refund
    const { error } = await supabase
      .from('analytics_revenue_metrics')
      .update({
        refunds: refundAmount / 100,
        net_revenue: Number(originalRevenue.gross_revenue) - (refundAmount / 100),
      })
      .eq('id', originalRevenue.id);

    if (error) {
      console.error('Failed to record refund:', error);
      throw error;
    }
  },

  /**
   * Calculate MRR (Monthly Recurring Revenue)
   */
  async calculateMRR(): Promise<number> {
    const supabase = createAdminClient();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data } = await supabase
      .from('analytics_revenue_metrics')
      .select('gross_revenue')
      .eq('period_type', 'monthly')
      .gte('period_start', startOfMonth.toISOString());

    if (!data) return 0;

    return data.reduce((sum, r) => sum + Number(r.gross_revenue), 0);
  },

  /**
   * Calculate ARR (Annual Recurring Revenue)
   */
  async calculateARR(): Promise<number> {
    const mrr = await this.calculateMRR();
    return mrr * 12;
  },

  /**
   * Calculate MoM growth rate
   */
  async calculateGrowthRate(): Promise<number> {
    const supabase = createAdminClient();

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Current month revenue
    const { data: currentData } = await supabase
      .from('analytics_revenue_metrics')
      .select('gross_revenue')
      .eq('period_type', 'monthly')
      .gte('period_start', currentMonthStart.toISOString())
      .lt('period_start', currentMonthStart.toISOString());

    // Last month revenue
    const { data: lastData } = await supabase
      .from('analytics_revenue_metrics')
      .select('gross_revenue')
      .eq('period_type', 'monthly')
      .gte('period_start', lastMonthStart.toISOString())
      .lt('period_start', currentMonthStart.toISOString());

    const currentRevenue = currentData?.reduce((sum, r) => sum + Number(r.gross_revenue), 0) || 0;
    const lastRevenue = lastData?.reduce((sum, r) => sum + Number(r.gross_revenue), 0) || 0;

    if (lastRevenue === 0) return currentRevenue > 0 ? 100 : 0;

    return ((currentRevenue - lastRevenue) / lastRevenue) * 100;
  }
};
```

### Step 2: Update Polar Webhook Handler

```typescript
// src/lib/payments/polar-webhook-handler.ts

import { revenueTracker } from '@/lib/analytics/revenue-tracker';
import { polarService } from './polar-subscription-service';

export async function handlePolarWebhook(
  eventType: string,
  data: any
): Promise<void> {
  try {
    switch (eventType) {
      case 'order.paid':
        await handleOrderPaid(data);
        break;
      case 'order.refunded':
        await handleOrderRefunded(data);
        break;
      case 'subscription.active':
        await handleSubscriptionActive(data);
        break;
      case 'subscription.renewed':
        await handleSubscriptionRenewed(data);
        break;
      // ... existing handlers ...
    }
  } catch (error) {
    console.error('Error handling Polar webhook:', error);
    throw error;
  }
}

async function handleOrderPaid(order: PolarOrder) {
  // Get user info from order metadata
  const { licenseNonce, tenantId, tier } = extractOrderMetadata(order);

  if (!licenseNonce || !tenantId) {
    console.warn('Order missing license metadata:', order.id);
    return;
  }

  // Record revenue
  await revenueTracker.recordOrderRevenue(
    order,
    licenseNonce,
    tenantId,
    tier
  );

  // Update user tier (existing logic)
  await polarService.updateUserTier(tenantId, tier);
}

async function handleOrderRefunded(order: PolarOrder) {
  const refundAmount = order.refund_amount || 0;
  await revenueTracker.recordRefund(order.id, refundAmount);
}

async function handleSubscriptionActive(subscription: PolarSubscription) {
  const { licenseNonce, tenantId, tier } = extractSubscriptionMetadata(subscription);

  if (!licenseNonce || !tenantId) return;

  await revenueTracker.recordSubscriptionRevenue(
    subscription,
    licenseNonce,
    tenantId,
    tier
  );
}

async function handleSubscriptionRenewed(subscription: PolarSubscription) {
  // Same as active - record renewal revenue
  await handleSubscriptionActive(subscription);
}

function extractOrderMetadata(order: PolarOrder) {
  // Extract from order metadata or custom fields
  return {
    licenseNonce: order.metadata?.license_nonce,
    tenantId: order.metadata?.tenant_id,
    tier: order.metadata?.tier || 'BASIC',
  };
}

function extractSubscriptionMetadata(subscription: PolarSubscription) {
  return {
    licenseNonce: subscription.metadata?.license_nonce,
    tenantId: subscription.metadata?.tenant_id,
    tier: subscription.metadata?.tier || 'BASIC',
  };
}
```

### Step 3: Create Reconciliation Service

```typescript
// src/lib/analytics/reconciliation-service.ts

import { createAdminClient } from '@/lib/supabase/admin';
import { polar } from '@/lib/polar';

export const reconciliationService = {
  /**
   * Reconcile Polar orders with internal records
   */
  async reconcilePolarOrders(): Promise<{
    matched: number;
    discrepancies: number;
    unlinked: number;
  }> {
    const supabase = createAdminClient();
    const result = { matched: 0, discrepancies: 0, unlinked: 0 };

    // Get recent Polar orders
    const polarOrders = await polar.orders.list({ limit: 100 });

    for (const order of polarOrders.items) {
      // Check if order exists in reconciliation table
      const { data: existing } = await supabase
        .from('analytics_revenue_reconciliation')
        .select('*')
        .eq('external_order_id', order.id)
        .single();

      if (existing) {
        result.matched++;
        continue;
      }

      // Try to link to internal license
      const { data: license } = await supabase
        .from('raas_licenses')
        .select('nonce, tenant_id')
        .eq('polar_customer_id', order.customer_id)
        .single();

      const internalAmount = license ? await getOrderAmount(license.nonce) : null;

      // Create reconciliation record
      await supabase.from('analytics_revenue_reconciliation').insert({
        source: 'polar',
        external_order_id: order.id,
        external_customer_id: order.customer_id,
        license_nonce: license?.nonce,
        tenant_id: license?.tenant_id,
        external_amount: order.total_amount / 100,
        internal_amount: internalAmount || 0,
        difference: internalAmount ? (order.total_amount / 100) - internalAmount : 0,
        status: license ? (internalAmount === order.total_amount / 100 ? 'matched' : 'discrepancy') : 'unlinked',
      });

      if (!license) {
        result.unlinked++;
      } else if (internalAmount !== order.total_amount / 100) {
        result.discrepancies++;
      } else {
        result.matched++;
      }
    }

    return result;
  },

  /**
   * Get reconciliation report
   */
  async getReconciliationReport(
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const supabase = createAdminClient();

    const { data } = await supabase
      .from('analytics_revenue_reconciliation')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    return data || [];
  }
};

async function getOrderAmount(licenseNonce: string): Promise<number | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('analytics_revenue_metrics')
    .select('gross_revenue')
    .eq('license_nonce', licenseNonce)
    .order('period_start', { ascending: false })
    .limit(1)
    .single();

  return data ? Number(data.gross_revenue) : null;
}
```

### Step 4: Create Reconciliation API Endpoint

```typescript
// src/app/api/admin/analytics/reconciliation/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { reconciliationService } from '@/lib/analytics/revenue-tracker';
import { verifyAdminAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify admin auth
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Run reconciliation
    const result = await reconciliationService.reconcilePolarOrders();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Reconciliation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = new Date(searchParams.get('start') || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(searchParams.get('end') || Date.now());

    const report = await reconciliationService.getReconciliationReport(startDate, endDate);

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Reconciliation report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Success Criteria

- [ ] Revenue recorded on Polar order.completed webhook
- [ ] Refunds handled correctly
- [ ] MRR/ARR calculations accurate
- [ ] Reconciliation identifies discrepancies
- [ ] Admin API endpoint secured with auth

## Integration Points

| Event | Source | Handler | Action |
|-------|--------|---------|--------|
| `order.paid` | Polar Webhook | `handleOrderPaid` | Record revenue |
| `order.refunded` | Polar Webhook | `handleOrderRefunded` | Reverse revenue |
| `subscription.active` | Polar Webhook | `handleSubscriptionActive` | Record recurring |
| `subscription.renewed` | Polar Webhook | `handleSubscriptionRenewed` | Update recurring |

## Risks

- **Risk**: Webhook duplicates may cause double-counting
- **Mitigation**: Idempotency keys, upsert operations

## Next Steps

After revenue tracking:
1. Build ROI calculator component (Phase 05)
2. Add premium visualizations (Phase 06)
