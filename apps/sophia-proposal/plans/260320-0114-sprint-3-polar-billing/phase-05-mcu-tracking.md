---
title: "Phase 5 — MCU Tracking + Balance Checker"
priority: P1
status: completed
effort: 2h
completed_at: 2026-03-20
---

# PHASE 5 — MCU TRACKING + BALANCE CHECKER

## Overview

Implement MCU usage tracking, balance checking middleware, and HTTP 402 handling for zero balance scenarios.

## Files to Create

### lib/billing/usage-tracker.ts

```typescript
/**
 * Usage Tracker
 *
 * Logs MCU consumption for billable features.
 */

import { createServerClient } from '@/lib/supabase/client';
import { calculateMcuCost } from './mcu-pricing';

export interface UsageEvent {
  orgId: string;
  feature: string;
  metadata?: Record<string, unknown>;
  tierName?: string;
}

export interface UsageLog {
  id: string;
  org_id: string;
  feature: string;
  mcu_cost: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Log usage and deduct MCU balance atomically
 *
 * @returns true if successful, false if insufficient balance
 */
export async function logUsage(event: UsageEvent): Promise<{
  success: boolean;
  mcuCost: number;
  remainingBalance?: number;
  error?: string;
}> {
  const supabase = createServerClient();

  try {
    // Calculate MCU cost for this feature
    const mcuCost = calculateMcuCost(event.feature, event.tierName);

    if (mcuCost <= 0) {
      // Free feature, just log it
      await supabase.from('usage_logs').insert({
        org_id: event.orgId,
        feature: event.feature,
        mcu_cost: 0,
        metadata: event.metadata || {},
      });

      return { success: true, mcuCost: 0 };
    }

    // Use database function to atomically check and deduct
    const { data, error } = await supabase.rpc('deduct_mcu_balance', {
      p_org_id: event.orgId,
      p_amount: mcuCost,
      p_feature: event.feature,
      p_metadata: event.metadata || {},
    });

    if (error) {
      console.error('Usage tracking error:', error);
      return {
        success: false,
        mcuCost,
        error: error.message,
      };
    }

    // Get updated balance
    const { data: balanceData } = await supabase
      .from('org_balances')
      .select('balance')
      .eq('org_id', event.orgId)
      .single();

    return {
      success: data, // RPC returns true if successful
      mcuCost,
      remainingBalance: balanceData?.balance,
    };
  } catch (error) {
    console.error('Unexpected usage tracking error:', error);
    return {
      success: false,
      mcuCost: 0,
      error: 'Internal error tracking usage',
    };
  }
}

/**
 * Get usage history for an organization
 */
export async function getUsageHistory(
  orgId: string,
  limit: number = 100,
  offset: number = 0
): Promise<UsageLog[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('usage_logs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Failed to fetch usage history:', error);
    return [];
  }

  return data || [];
}

/**
 * Get usage summary with aggregations
 */
export async function getUsageSummary(
  orgId: string,
  days: number = 30
): Promise<{
  totalMcuUsed: number;
  totalCost: number;
  byFeature: Array<{ feature: string; count: number; mcuUsed: number }>;
  dailyUsage: Array<{ date: string; mcuUsed: number }>;
}> {
  const supabase = createServerClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get raw usage data
  const { data: logs } = await supabase
    .from('usage_logs')
    .select('feature, mcu_cost, created_at')
    .eq('org_id', orgId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  if (!logs) {
    return {
      totalMcuUsed: 0,
      totalCost: 0,
      byFeature: [],
      dailyUsage: [],
    };
  }

  // Aggregate by feature
  const byFeatureMap = new Map<
    string,
    { count: number; mcuUsed: number }
  >();

  // Aggregate by day
  const dailyMap = new Map<string, number>();

  let totalMcuUsed = 0;

  for (const log of logs) {
    totalMcuUsed += log.mcu_cost;

    // By feature
    const feature = log.feature;
    const existing = byFeatureMap.get(feature) || { count: 0, mcuUsed: 0 };
    existing.count++;
    existing.mcuUsed += log.mcu_cost;
    byFeatureMap.set(feature, existing);

    // By day
    const date = new Date(log.created_at).toISOString().split('T')[0];
    dailyMap.set(date, (dailyMap.get(date) || 0) + log.mcu_cost);
  }

  return {
    totalMcuUsed,
    totalCost: totalMcuUsed, // MCU = cost in this model
    byFeature: Array.from(byFeatureMap.entries()).map(([feature, data]) => ({
      feature,
      count: data.count,
      mcuUsed: data.mcuUsed,
    })),
    dailyUsage: Array.from(dailyMap.entries())
      .map(([date, mcuUsed]) => ({ date, mcuUsed }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
```

### lib/billing/balance-checker.ts

```typescript
/**
 * Balance Checker
 *
 * Validates MCU balance and returns HTTP 402 response on zero/negative balance.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export interface BalanceStatus {
  orgId: string;
  balance: number;
  lifetimeCredits: number;
  lifetimeUsed: number;
  hasSufficientBalance: boolean;
}

/**
 * Check organization balance
 */
export async function checkBalance(orgId: string): Promise<BalanceStatus | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('org_balances')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    orgId: data.org_id,
    balance: data.balance,
    lifetimeCredits: data.lifetime_credits,
    lifetimeUsed: data.lifetime_used,
    hasSufficientBalance: data.balance > 0,
  };
}

/**
 * Middleware-style balance check
 * Returns 402 response if balance is zero or negative
 */
export function requireBalance(
  balance: BalanceStatus | null,
  message?: string
): NextResponse | null {
  if (!balance || !balance.hasSufficientBalance) {
    return NextResponse.json(
      {
        error: message || 'Insufficient MCU balance',
        code: 'INSUFFICIENT_BALANCE',
        currentBalance: balance?.balance || 0,
        requiredBalance: 1,
        rechargeUrl: '/billing/upgrade',
      },
      { status: 402 } // Payment Required
    );
  }

  return null; // Balance OK, continue
}

/**
 * Get or initialize balance for an organization
 */
export async function getOrInitializeBalance(
  orgId: string
): Promise<BalanceStatus> {
  const supabase = createServerClient();

  // Try to get existing balance
  const { data: existing } = await supabase
    .from('org_balances')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (existing) {
    return {
      orgId: existing.org_id,
      balance: existing.balance,
      lifetimeCredits: existing.lifetime_credits,
      lifetimeUsed: existing.lifetime_used,
      hasSufficientBalance: existing.balance > 0,
    };
  }

  // Initialize with zero balance
  await supabase.from('org_balances').insert({
    org_id: orgId,
    balance: 0,
    lifetime_credits: 0,
    lifetime_used: 0,
  });

  return {
    orgId,
    balance: 0,
    lifetimeCredits: 0,
    lifetimeUsed: 0,
    hasSufficientBalance: false,
  };
}

/**
 * Add bonus MCU (for promotions, referrals, etc.)
 */
export async function addBonusMcu(
  orgId: string,
  amount: number,
  reason: string
): Promise<boolean> {
  const supabase = createServerClient();

  const { error } = await supabase.rpc('credit_mcu_balance', {
    p_org_id: orgId,
    p_amount: amount,
    p_subscription_id: `bonus:${reason}`,
  });

  return !error;
}
```

### middleware.ts (Update existing)

```typescript
// Add to existing middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ... existing middleware code ...

/**
 * Check MCU balance for billable API routes
 */
async function checkMcuBalance(
  request: NextRequest,
  orgId: string
): Promise<NextResponse | null> {
  // Skip balance check for non-billable routes
  const billablePaths = [
    '/api/proposals/generate',
    '/api/proposals/',
    '/api/video/',
  ];

  const isBillablePath = billablePaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!isBillablePath) {
    return null;
  }

  // Import dynamically to avoid circular deps
  const { checkBalance, requireBalance } = await import(
    '@/lib/billing/balance-checker'
  );

  const balance = await checkBalance(orgId);
  return requireBalance(
    balance,
    'Insufficient MCU balance. Please add credits to continue.'
  );
}
```

## Implementation Steps

1. Create `lib/billing/usage-tracker.ts`
2. Create `lib/billing/balance-checker.ts`
3. Update middleware.ts to check balance on billable routes
4. Integrate usage tracking into AI proposal generation
5. Test HTTP 402 response on zero balance

## Integration Example

```typescript
// In app/api/proposals/generate/route.ts

import { logUsage } from '@/lib/billing/usage-tracker';
import { getOrInitializeBalance, requireBalance } from '@/lib/billing/balance-checker';

export async function POST(request: NextRequest) {
  // ... auth and org lookup ...

  // Check balance before generation
  const balance = await getOrInitializeBalance(orgId);
  const balanceError = requireBalance(balance);
  if (balanceError) {
    return balanceError; // Returns 402
  }

  // Generate proposal
  const proposal = await generateProposal(input);

  // Log usage after successful generation
  const usage = await logUsage({
    orgId,
    feature: 'proposal:text:advanced',
    metadata: { proposalId: proposal.id },
    tierName: subscription?.tier_name,
  });

  if (!usage.success) {
    console.warn('Failed to log usage:', usage.error);
  }

  return NextResponse.json({ ...proposal, mcuUsed: usage.mcuCost });
}
```

## Success Criteria

- [x] Usage tracker logs all billable events
- [x] Balance checker returns correct status
- [x] HTTP 402 returned on zero balance
- [x] MCU deducted after successful operations
- [x] Balance can go negative (for refunds)

**Completed:** 2026-03-20

## Related Files

- Usage Tracker: `lib/billing/usage-tracker.ts`
- Balance Checker: `lib/billing/balance-checker.ts`
- MCU Pricing: `lib/billing/mcu-pricing.ts`
- Middleware: `middleware.ts`
