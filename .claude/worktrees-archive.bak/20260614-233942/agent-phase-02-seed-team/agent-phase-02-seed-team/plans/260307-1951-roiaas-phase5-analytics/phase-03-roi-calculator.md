---
title: "Phase 03 — ROI Calculator Implementation"
description: "Implement ROI calculator với projected annual, payback period, cost per usage"
status: pending
priority: P2
effort: 2h
---

# Phase 03 — ROI Calculator Implementation

**Context:**
- Existing: `src/lib/analytics/roi-calculator.ts` (đã có logic cơ bản)
- Existing: `src/lib/analytics/graphql-resolvers.ts` (ROI resolver đã có)
- Research: `plans/reports/researcher-260307-1943-roiaas-analytics.md` (ROI calculation questions)

---

## Overview

ROI Calculator tính toán ROI metrics cho license holders: projected annual revenue, actual YTD, payback period, và cost per usage.

---

## Key Insights

1. **ROI Calculator đã tồn tại** — `calculateRoiMetrics()` và `calculateAggregateRoi()` đã implement
2. **Logic hiện tại:**
   - Projected annual = (actual YTD / months since creation) × 12
   - Actual YTD = total credits × $0.01 (baseline value)
   - Payback months = license cost / (projected annual / 12)
   - Cost per usage = license cost / total credits
3. **Vấn đề:** $0.01/credit là hard-coded — cần config từ admin hoặc user input

---

## Requirements

### Functional

1. **ROI Metrics Calculation**
   - Input: License nonce hoặc user ID
   - Output: `ROIMetrics` interface với:
     - `projectedAnnual`: Projected annual revenue
     - `actualYTD`: Actual year-to-date value
     - `paybackMonths`: Months to break even
     - `costPerUsage`: Cost per credit/request

2. **ROI API Endpoint** (mới)
   - `GET /api/analytics/roi?licenseNonce={nonce}`
   - Response: ROI metrics + license details
   - RBAC: User chỉ xem ROI của license mình

3. **ROI UI Component** (mới)
   - Hiển thị ROI % = (projectedAnnual - licenseCost) / licenseCost × 100
   - Payback period visualization
   - Cost breakdown (license cost, usage credits, API costs)

4. **Configurable Value Per Credit**
   - Admin setting: `analytics.default_value_per_credit` (default: $0.01)
   - User override: Custom value input trong ROI calculator

### Non-Functional

- Calculation time < 100ms
- Accurate to 2 decimal places
- Handle edge cases (zero credits, new license)

---

## Related Code Files

**Modify:**
- `src/lib/analytics/roi-calculator.ts` — Enhance calculation logic
- `src/lib/analytics/graphql-resolvers.ts` — Update ROI resolver

**Create:**
- `src/app/api/analytics/roi/route.ts` — ROI API endpoint
- `src/components/analytics/roi-calculator.tsx` — ROI UI component
- `src/components/analytics/roi-metrics-card.tsx` — ROI display card

---

## Implementation Steps

### Step 1: Enhance ROI Calculator Logic

File: `src/lib/analytics/roi-calculator.ts`

```typescript
/**
 * ROI Metrics result with enhanced fields
 */
export interface ROIMetrics {
  projectedAnnual: number;
  actualYTD: number;
  paybackMonths: number;
  costPerUsage: number;
  roiPercent: number;      // NEW: ROI percentage
  licenseCost: number;      // NEW: Original license cost
  totalCredits: number;     // NEW: Total credits used
}

/**
 * Calculate ROI metrics for a specific license
 *
 * @param licenseNonce - License nonce to calculate ROI for
 * @param valuePerCredit - Value per credit in USD (default: 0.01)
 */
export async function calculateRoiMetrics(
  licenseNonce: string,
  valuePerCredit: number = 0.01
): Promise<ROIMetrics> {
  const supabase = createAdminClient();

  // Get license details
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('tier, created_at, metadata')
    .eq('nonce', licenseNonce)
    .single() as any;

  if (!license) {
    throw new Error('License not found');
  }

  // Get license cost from metadata
  const metadata = license.metadata as any;
  const licenseCost = metadata?.amount_usd?.amount || metadata?.price || 0;

  // Get usage data (last 30 days for recent activity)
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);

  const { data: usageEvents } = await supabase
    .from('usage_events')
    .select('credits_used, created_at')
    .eq('license_nonce', licenseNonce)
    .gte('created_at', thirtyDaysAgo) as any;

  const totalCredits = usageEvents?.reduce((sum: any, e: any) => sum + (e.credits_used || 0), 0) || 0;

  // Get YTD usage
  const yearStart = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);

  const { data: ytdUsage } = await supabase
    .from('usage_events')
    .select('credits_used')
    .eq('license_nonce', licenseNonce)
    .gte('created_at', yearStart) as any;

  const ytdCredits = ytdUsage?.reduce((sum: any, e: any) => sum + (e.credits_used || 0), 0) || 0;

  // Calculate actual YTD value
  const actualYTD = ytdCredits * valuePerCredit;

  // Calculate projected annual
  const monthsSinceCreation = Math.max(
    1,
    Math.floor((Date.now() / 1000 - license.created_at) / (30 * 86400))
  );
  const projectedAnnual = (actualYTD / monthsSinceCreation) * 12;

  // Calculate ROI percentage
  const roiPercent = licenseCost > 0
    ? ((projectedAnnual - licenseCost) / licenseCost) * 100
    : 0;

  // Calculate payback period
  const paybackMonths = licenseCost > 0 && projectedAnnual > 0
    ? Math.ceil(licenseCost / (projectedAnnual / 12))
    : 0;

  // Calculate cost per usage
  const costPerUsage = totalCredits > 0 ? licenseCost / totalCredits : 0;

  return {
    projectedAnnual: Math.round(projectedAnnual * 100) / 100,
    actualYTD: Math.round(actualYTD * 100) / 100,
    paybackMonths: Math.max(1, paybackMonths),
    costPerUsage: Math.round(costPerUsage * 10000) / 10000,
    roiPercent: Math.round(roiPercent * 100) / 100,
    licenseCost: Math.round(licenseCost * 100) / 100,
    totalCredits,
  };
}
```

### Step 2: Create ROI API Endpoint

File: `src/app/api/analytics/roi/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/utils/logger-utility';
import { calculateRoiMetrics } from '@/lib/analytics/roi-calculator';
import { verifyLicenseAccess } from '@/lib/analytics/rbac';

/**
 * GET /api/analytics/roi
 *
 * Calculate ROI metrics for a specific license
 *
 * Query Params:
 * - licenseNonce - License nonce to calculate ROI for (required)
 * - valuePerCredit - Value per credit in USD (optional, default: 0.01)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const licenseNonce = searchParams.get('licenseNonce');
    const valuePerCreditParam = searchParams.get('valuePerCredit');

    if (!licenseNonce) {
      return NextResponse.json(
        { error: 'Missing required parameter: licenseNonce' },
        { status: 400 }
      );
    }

    const valuePerCredit = valuePerCreditParam
      ? parseFloat(valuePerCreditParam)
      : 0.01;

    if (isNaN(valuePerCredit) || valuePerCredit <= 0) {
      return NextResponse.json(
        { error: 'Invalid valuePerCredit - must be a positive number' },
        { status: 400 }
      );
    }

    // Verify user has access to this license
    const isAdmin = user.tier === 'MASTER'; // TODO: Proper admin check
    const access = await verifyLicenseAccess(user.id, licenseNonce, isAdmin);

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error || 'Access denied' },
        { status: 403 }
      );
    }

    // Calculate ROI metrics
    const metrics = await calculateRoiMetrics(licenseNonce, valuePerCredit);

    logger.info('[Analytics ROI] ROI calculated', {
      userId: user.id,
      licenseNonce,
      roiPercent: metrics.roiPercent,
      paybackMonths: metrics.paybackMonths,
    });

    return NextResponse.json({
      licenseNonce,
      metrics,
      metadata: {
        valuePerCredit,
        calculatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('[Analytics ROI] Critical error', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { error: 'Failed to calculate ROI metrics' },
      { status: 500 }
    );
  }
}
```

### Step 3: Create ROI UI Component

File: `src/components/analytics/roi-calculator.tsx`

```typescript
'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, DollarSign, Clock, Calculator } from 'lucide-react';
import useSWR from 'swr';

interface ROIMetrics {
  projectedAnnual: number;
  actualYTD: number;
  paybackMonths: number;
  costPerUsage: number;
  roiPercent: number;
  licenseCost: number;
  totalCredits: number;
}

interface ROICalculatorProps {
  licenseNonce: string;
}

export function ROICalculator({ licenseNonce }: ROICalculatorProps) {
  const [valuePerCredit, setValuePerCredit] = useState(0.01);

  const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch ROI');
    return res.json();
  };

  const { data, error, mutate } = useSWR(
    `/api/analytics/roi?licenseNonce=${licenseNonce}&valuePerCredit=${valuePerCredit}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const handleCalculate = useCallback(() => {
    mutate();
  }, [mutate]);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ROI Calculator</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Error loading ROI data</p>
        </CardContent>
      </Card>
    );
  }

  const metrics: ROIMetrics | null = data?.metrics || null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          ROI Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input */}
        <div className="space-y-2">
          <Label htmlFor="valuePerCredit">Value per Credit (USD)</Label>
          <div className="flex gap-2">
            <Input
              id="valuePerCredit"
              type="number"
              step="0.001"
              value={valuePerCredit}
              onChange={(e) => setValuePerCredit(parseFloat(e.target.value) || 0)}
              className="w-[150px]"
            />
            <Button onClick={handleCalculate}>Calculate</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Estimated value you get per credit consumed
          </p>
        </div>

        {/* Metrics */}
        {metrics && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ROI</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${metrics.roiPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.roiPercent.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Return on Investment</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Payback Period</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.paybackMonths} months</div>
                <p className="text-xs text-muted-foreground">Time to break even</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Projected Annual</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${metrics.projectedAnnual.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Based on current usage</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cost per Credit</CardTitle>
                <Calculator className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${metrics.costPerUsage.toFixed(4)}</div>
                <p className="text-xs text-muted-foreground">License cost / credits used</p>
              </CardContent>
            </Card>
          </div>
        )}

        {!data && !error && (
          <div className="text-center text-muted-foreground py-8">
            Click Calculate to see ROI metrics
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Todo Checklist

- [ ] Enhance `roi-calculator.ts` với ROI % và additional fields
- [ ] Create `/api/analytics/roi/route.ts` endpoint
- [ ] Create `roi-calculator.tsx` UI component
- [ ] Create `roi-metrics-card.tsx` display card
- [ ] Add ROI calculator to dashboard (Revenue tab)
- [ ] Test với various license scenarios
- [ ] Add i18n translations

---

## Success Criteria

- [ ] ROI API returns accurate metrics
- [ ] ROI UI displays correctly với 4 metrics cards
- [ ] Value per credit configurable
- [ ] ROI % shows green (positive) or red (negative)
- [ ] Payback period calculated correctly
- [ ] RBAC: User chỉ xem ROI của license mình

---

## Security Considerations

1. **License Access Control:** `verifyLicenseAccess()` phải check user sở hữu license
2. **Input Validation:** Validate `valuePerCredit` > 0
3. **Rate Limiting:** Consider rate limit ROI calculations (10 req/min)

---

## Performance Notes

- Query optimization: Index on `usage_events(license_nonce, created_at)`
- Caching: SWR 5min cache cho ROI data (less frequent updates)
- Batch queries: Combine license + usage queries if possible

---

## Next Steps

→ Phase 04: Enhanced data visualizations với Recharts
→ Phase 05: Premium tier gating
