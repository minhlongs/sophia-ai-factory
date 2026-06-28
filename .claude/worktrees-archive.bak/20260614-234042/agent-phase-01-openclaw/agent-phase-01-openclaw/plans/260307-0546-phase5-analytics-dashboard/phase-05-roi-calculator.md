---
phase: 05
title: "ROI Calculator Component"
status: pending
effort: 2h
---

# Phase 05: ROI Calculator Component

## Context

**Related Files:**
- ROI Service: `src/lib/analytics/roi-service.ts` (Phase 02)
- ROI Gauge: `src/app/[locale]/dashboard/analytics/components/roi-gauge.tsx` (Phase 03)
- Pricing Tiers: `docs/pricing-and-tiers.md`

**Current State:**
- ROI metrics stored in database (Phase 01)
- ROI gauge displays current ROI (Phase 03)
- Missing: Interactive calculator for projections

## Requirements

### Functional
1. Input: Subscription cost, API costs, expected revenue
2. Calculate: ROI %, payback period, break-even point
3. Compare: Projected vs Actual ROI
4. Visualize: ROI projection chart (12 months)
5. Export: ROI report as PDF/CSV

### Non-Functional
1. Real-time calculations (reactive forms)
2. Save projections to database
3. License-gated premium features

## Files to Create

1. `src/app/[locale]/dashboard/analytics/components/roi-calculator.tsx`
2. `src/lib/analytics/roi-calculator-service.ts`
3. `src/app/[locale]/dashboard/analytics/hooks/use-roi-calculator.ts`

## Files to Modify

1. `src/app/[locale]/dashboard/analytics/page.tsx` - Add calculator section
2. `messages/vi.json` - Add calculator i18n keys
3. `messages/en.json` - Add calculator i18n keys

## Implementation Steps

### Step 1: Create ROI Calculator Service

```typescript
// src/lib/analytics/roi-calculator-service.ts

interface ROIProjectionInput {
  subscriptionCost: number; // Monthly subscription
  apiCosts: number; // Monthly API spending
  expectedRevenue: number; // Monthly expected revenue from campaigns
  videoCount: number; // Videos per month
  avgViewsPerVideo: number;
  conversionRate: number; // Percentage
  avgOrderValue: number; // Revenue per conversion
}

interface ROIProjectionResult {
  monthlyInvestment: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  roiPercentage: number;
  paybackPeriodDays: number;
  breakEvenVideos: number;
  twelveMonthProjection: MonthProjection[];
}

interface MonthProjection {
  month: number;
  cumulativeInvestment: number;
  cumulativeRevenue: number;
  cumulativeProfit: number;
  roiPercentage: number;
}

export const roiCalculatorService = {
  /**
   * Calculate ROI projection
   */
  calculateROI(input: ROIProjectionInput): ROIProjectionResult {
    const monthlyInvestment = input.subscriptionCost + input.apiCosts;
    const monthlyRevenue = input.expectedRevenue;
    const monthlyProfit = monthlyRevenue - monthlyInvestment;

    const roiPercentage = monthlyInvestment > 0
      ? (monthlyProfit / monthlyInvestment) * 100
      : 0;

    const paybackPeriodDays = monthlyProfit > 0
      ? Math.ceil(monthlyInvestment / (monthlyProfit / 30))
      : Infinity;

    // Calculate break-even video count
    const revenuePerVideo = input.avgViewsPerVideo * (input.conversionRate / 100) * input.avgOrderValue;
    const breakEvenVideos = revenuePerVideo > 0
      ? Math.ceil(monthlyInvestment / revenuePerVideo)
      : 0;

    // 12-month projection
    const twelveMonthProjection: MonthProjection[] = [];
    let cumulativeInvestment = 0;
    let cumulativeRevenue = 0;

    for (let month = 1; month <= 12; month++) {
      cumulativeInvestment += monthlyInvestment;
      cumulativeRevenue += monthlyRevenue;
      const cumulativeProfit = cumulativeRevenue - cumulativeInvestment;
      const roiPercentage = cumulativeInvestment > 0
        ? (cumulativeProfit / cumulativeInvestment) * 100
        : 0;

      twelveMonthProjection.push({
        month,
        cumulativeInvestment,
        cumulativeRevenue,
        cumulativeProfit,
        roiPercentage,
      });
    }

    return {
      monthlyInvestment,
      monthlyRevenue,
      monthlyProfit,
      roiPercentage,
      paybackPeriodDays,
      breakEvenVideos,
      twelveMonthProjection,
    };
  },

  /**
   * Save projection to database
   */
  async saveProjection(
    tenantId: string,
    licenseNonce: string,
    input: ROIProjectionInput,
    result: ROIProjectionResult
  ): Promise<void> {
    const supabase = require('@/lib/supabase/admin').createAdminClient();

    const { error } = await supabase
      .from('analytics_roi_projections')
      .insert({
        tenant_id: tenantId,
        license_nonce: licenseNonce,
        subscription_cost: input.subscriptionCost,
        api_costs: input.apiCosts,
        expected_revenue: input.expectedRevenue,
        video_count: input.videoCount,
        avg_views_per_video: input.avgViewsPerVideo,
        conversion_rate: input.conversionRate,
        avg_order_value: input.avgOrderValue,
        calculated_roi: result.roiPercentage,
        payback_period_days: result.paybackPeriodDays === Infinity ? null : result.paybackPeriodDays,
        projection_data: JSON.stringify(result.twelveMonthProjection),
      });

    if (error) throw error;
  },

  /**
   * Get saved projections for tenant
   */
  async getProjections(tenantId: string, limit: number = 5) {
    const supabase = require('@/lib/supabase/admin').createAdminClient();

    const { data, error } = await supabase
      .from('analytics_roi_projections')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }
};
```

### Step 2: Create ROI Calculator Component

```typescript
// src/app/[locale]/dashboard/analytics/components/roi-calculator.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { roiCalculatorService } from '@/lib/analytics/roi-calculator-service';
import { Lock, Save, TrendingUp } from 'lucide-react';
import { useROIProjection } from '../hooks/use-roi-calculator';

interface ROICalculatorProps {
  userTier: string;
}

export function ROICalculator({ userTier }: ROICalculatorProps) {
  const t = useTranslations('dashboard.analytics.roi.calculator');
  const isPremium = userTier === 'PREMIUM' || userTier === 'ENTERPRISE' || userTier === 'MASTER';

  const [inputs, setInputs] = useState({
    subscriptionCost: 399,
    apiCosts: 100,
    expectedRevenue: 2500,
    videoCount: 20,
    avgViewsPerVideo: 5000,
    conversionRate: 3,
    avgOrderValue: 50,
  });

  const [result, setResult] = useState<any>(null);

  // Calculate on input change
  useEffect(() => {
    const projection = roiCalculatorService.calculateROI(inputs);
    setResult(projection);
  }, [inputs]);

  if (!isPremium) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg gap-4">
            <Lock className="h-8 w-8" />
            <div className="text-center">
              <p className="font-semibold">{t('premium_feature')}</p>
              <p className="text-sm">{t('upgrade_message')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="subscriptionCost">{t('subscription_cost')}</Label>
            <Input
              id="subscriptionCost"
              type="number"
              value={inputs.subscriptionCost}
              onChange={(e) => setInputs({ ...inputs, subscriptionCost: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiCosts">{t('api_costs')}</Label>
            <Input
              id="apiCosts"
              type="number"
              value={inputs.apiCosts}
              onChange={(e) => setInputs({ ...inputs, apiCosts: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedRevenue">{t('expected_revenue')}</Label>
            <Input
              id="expectedRevenue"
              type="number"
              value={inputs.expectedRevenue}
              onChange={(e) => setInputs({ ...inputs, expectedRevenue: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoCount">{t('video_count')}</Label>
            <Input
              id="videoCount"
              type="number"
              value={inputs.videoCount}
              onChange={(e) => setInputs({ ...inputs, videoCount: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{t('roi_percentage')}</p>
                <p className={`text-2xl font-bold ${result.roiPercentage >= 100 ? 'text-green-500' : result.roiPercentage >= 0 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {result.roiPercentage.toFixed(1)}%
                </p>
              </div>

              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{t('payback_period')}</p>
                <p className="text-2xl font-bold">
                  {result.paybackPeriodDays === Infinity ? 'N/A' : `${result.paybackPeriodDays} ${t('days')}`}
                </p>
              </div>

              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{t('monthly_profit')}</p>
                <p className="text-2xl font-bold text-green-500">
                  ${result.monthlyProfit.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Save Projection Button */}
            <Button onClick={() => saveProjection()} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {t('save_projection')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 3: Create ROI Projection Table

```typescript
// Add to analytics schema migration

CREATE TABLE IF NOT EXISTS analytics_roi_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  license_nonce TEXT NOT NULL,

  -- Inputs
  subscription_cost DECIMAL(12,2) NOT NULL,
  api_costs DECIMAL(12,2) DEFAULT 0,
  expected_revenue DECIMAL(12,2) NOT NULL,
  video_count INTEGER DEFAULT 0,
  avg_views_per_video INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  avg_order_value DECIMAL(12,2) DEFAULT 0,

  -- Calculated
  calculated_roi DECIMAL(8,2) DEFAULT 0,
  payback_period_days INTEGER,
  projection_data JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roi_projections_tenant
  ON analytics_roi_projections(tenant_id, created_at DESC);
```

### Step 4: Add i18n Keys

```json
// messages/vi.json
{
  "dashboard": {
    "analytics": {
      "roi": {
        "calculator": {
          "title": "Tính toán ROI",
          "premium_feature": "Tính năng cao cấp",
          "upgrade_message": "Nâng cấp lên Growth hoặc cao hơn để sử dụng",
          "subscription_cost": "Chi phí subscription ($/tháng)",
          "api_costs": "Chi phí API ($/tháng)",
          "expected_revenue": "Doanh thu dự kiến ($/tháng)",
          "video_count": "Số video/tháng",
          "avg_views_per_video": "Lượt xem trung bình/video",
          "conversion_rate": "Tỷ lệ chuyển đổi (%)",
          "avg_order_value": "Giá trị đơn hàng trung bình ($)",
          "roi_percentage": "Tỷ suất ROI",
          "payback_period": "Thời gian hoàn vốn",
          "monthly_profit": "Lợi nhuận tháng",
          "days": "ngày",
          "save_projection": "Lưu dự đoán"
        }
      }
    }
  }
}
```

## Success Criteria

- [ ] Calculator inputs reactively update results
- [ ] ROI % calculated correctly
- [ ] Payback period shows days to break-even
- [ ] 12-month projection chart displays
- [ ] Projections save to database
- [ ] Premium gating works (BASIC users see lock screen)

## ROI Formula Reference

```
Monthly Investment = Subscription Cost + API Costs
Monthly Profit = Monthly Revenue - Monthly Investment
ROI % = (Monthly Profit / Monthly Investment) × 100
Payback Period (days) = Monthly Investment / (Monthly Profit / 30)
Break-even Videos = Monthly Investment / Revenue per Video
```

## Risks

- **Risk**: Users may input unrealistic values
- **Mitigation**: Add validation, show industry benchmarks

## Next Steps

After ROI calculator:
1. Add premium visualizations (Phase 06)
2. Final integration testing
