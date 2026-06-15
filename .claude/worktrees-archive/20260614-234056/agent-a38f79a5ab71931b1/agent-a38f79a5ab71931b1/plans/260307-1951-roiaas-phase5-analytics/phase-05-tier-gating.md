---
title: "Phase 05 — Premium Tier Gating"
description: "Implement tier-gating cho analytics features: BASIC vs PREMIUM+ access levels"
status: pending
priority: P2
effort: 0.5h
---

# Phase 05 — Premium Tier Gating

**Context:**
- Existing RBAC: `src/lib/analytics/rbac.ts` (`getAnalyticsAccess`, `checkAdmin`)
- Existing tiers: BASIC, PREMIUM, ENTERPRISE, MASTER (src/types/index.ts)
- Polar config: `src/lib/polar-config.ts`

---

## Overview

Implement tier-gating cho analytics dashboard features, đảm bảo BASIC users bị giới hạn access, PREMIUM+ unlocked đầy đủ.

---

## Key Insights

1. **RBAC đã có** — `getAnalyticsAccess()` returns `AnalyticsFeatureAccess` interface
2. **Tier gating đã implement** — `UsageAnalyticsView` đã check `access.canView*`
3. **Missing:**
   - Revenue tab gating (ENTERPRISE+ only)
   - ROI calculator gating (PREMIUM+ only)
   - Export button disabled state với upgrade hint

---

## Requirements

### Feature Access Matrix

| Feature | BASIC | PREMIUM | ENTERPRISE | MASTER | Admin |
|---------|-------|---------|------------|--------|-------|
| Usage tab | ✅ | ✅ | ✅ | ✅ | ✅ |
| Revenue tab | ❌ | ❌ | ✅ | ✅ | ✅ |
| Licenses tab | ❌ | ❌ | ✅ | ✅ | ✅ |
| Custom date range | ❌ | ✅ | ✅ | ✅ | ✅ |
| Export CSV | ❌ | ✅ | ✅ | ✅ | ✅ |
| Export PNG | ❌ | ✅ | ✅ | ✅ | ✅ |
| ROI calculator | ❌ | ✅ | ✅ | ✅ | ✅ |
| Auto-refresh | ❌ | ❌ | ✅ | ✅ | ✅ |
| Tier breakdown | ❌ | ❌ | ✅ | ✅ | ✅ |
| Customer table | ❌ | ❌ | ❌ | ❌ | ✅ |

### Gating UI Patterns

1. **Hidden Tabs:** Revenue/Licenses tabs hidden cho BASIC/PREMIUM
2. **Disabled Buttons:** Export button disabled với tooltip upgrade hint
3. **Locked Content:** Blur effect với lock overlay cho premium features
4. **Upgrade CTAs:** Clear calls-to-action cho basic users

---

## Related Code Files

**Modify:**
- `src/lib/analytics/rbac.ts` — Verify access matrix correct
- `src/app/[locale]/dashboard/analytics/components/analytics-view.tsx` — Add tab gating
- `src/components/analytics/export-button.tsx` — Add disabled state
- `src/app/[locale]/dashboard/analytics/page.tsx` — Add tier checks

**Create:**
- `src/components/analytics/upgrade-cta.tsx` — Upgrade prompt component

---

## Implementation Steps

### Step 1: Verify RBAC Access Matrix

File: `src/lib/analytics/rbac.ts`

```typescript
export function getAnalyticsAccess(
  tier: Tier,
  isAdmin: boolean
): AnalyticsFeatureAccess {
  // Admin gets everything
  if (isAdmin) {
    return {
      canViewCustomDateRange: true,
      canViewTimeSeries: true,
      canViewTierBreakdown: true,
      canViewCustomerTable: true,
      canViewRevenue: true,
      canExport: true,
      canAutoRefresh: true,
      canViewRoi: true,
    };
  }

  // MASTER tier gets everything (except customer table)
  if (tier === 'MASTER') {
    return {
      canViewCustomDateRange: true,
      canViewTimeSeries: true,
      canViewTierBreakdown: true,
      canViewCustomerTable: false,
      canViewRevenue: true,
      canExport: true,
      canAutoRefresh: true,
      canViewRoi: true,
    };
  }

  // ENTERPRISE tier
  if (tier === 'ENTERPRISE') {
    return {
      canViewCustomDateRange: true,
      canViewTimeSeries: true,
      canViewTierBreakdown: true,
      canViewCustomerTable: false,
      canViewRevenue: true,
      canExport: true,
      canAutoRefresh: true,
      canViewRoi: true,
    };
  }

  // PREMIUM tier
  if (tier === 'PREMIUM') {
    return {
      canViewCustomDateRange: true,
      canViewTimeSeries: true,
      canViewTierBreakdown: false,
      canViewCustomerTable: false,
      canViewRevenue: false,
      canExport: true,
      canAutoRefresh: false,
      canViewRoi: true,
    };
  }

  // BASIC tier (default)
  return {
    canViewCustomDateRange: false,
    canViewTimeSeries: true,
    canViewTierBreakdown: false,
    canViewCustomerTable: false,
    canViewRevenue: false,
    canExport: false,
    canAutoRefresh: false,
    canViewRoi: false,
  };
}
```

### Step 2: Add Tab Gating

File: `src/app/[locale]/dashboard/analytics/components/analytics-view.tsx`

```typescript
export function AnalyticsView({ campaigns, userTier, userId }: AnalyticsViewProps) {
  const t = useTranslations('dashboard.analytics');
  const access = getAnalyticsAccess(userTier, userTier === 'MASTER');

  return (
    <Tabs defaultValue="usage" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="usage" className="flex items-center gap-2">
          <BarChartIcon className="w-4 h-4" />
          {t('usage_tab')}
        </TabsTrigger>

        {/* Revenue tab - ENTERPRISE+ only */}
        {access.canViewRevenue && (
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            {t('revenue_tab')}
          </TabsTrigger>
        )}

        {/* Licenses tab - ENTERPRISE+ only */}
        {access.canViewTierBreakdown && (
          <TabsTrigger value="licenses" className="flex items-center gap-2">
            <KeyIcon className="w-4 h-4" />
            {t('licenses_tab')}
          </TabsTrigger>
        )}
      </TabsList>

      {/* Show upgrade hint for hidden tabs */}
      {!access.canViewRevenue && (
        <div className="mt-4 p-4 bg-muted rounded-lg border border-border">
          <Lock className="w-5 h-5 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">{t('revenue_locked')}</p>
          <p className="text-xs text-muted-foreground">{t('upgrade_for_revenue')}</p>
        </div>
      )}

      <TabsContent value="usage">
        <UsageAnalyticsView userTier={userTier} userId={userId} />
      </TabsContent>

      {access.canViewRevenue && (
        <TabsContent value="revenue">
          <RevenueAnalyticsView userTier={userTier} isAdmin={userTier === 'MASTER'} />
        </TabsContent>
      )}

      {access.canViewTierBreakdown && (
        <TabsContent value="licenses">
          <LicenseAnalyticsView userTier={userTier} isAdmin={userTier === 'MASTER'} />
        </TabsContent>
      )}
    </Tabs>
  );
}
```

### Step 3: Create Upgrade CTA Component

File: `src/components/analytics/upgrade-cta.tsx`

```typescript
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface UpgradeCTAProps {
  title: string;
  description: string;
  feature: string;
}

export function UpgradeCTA({ title, description, feature }: UpgradeCTAProps) {
  return (
    <Card className="border-dashed border-2 border-primary/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-muted-foreground" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Upgrade to unlock: {feature}</span>
          </div>

          <div className="flex gap-2">
            <Button asChild>
              <Link href="/pricing">
                Upgrade Now
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/pricing">
                View Plans
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 4: Add i18n Translations

Files: `messages/vi.json`, `messages/en.json`

```json
{
  "dashboard": {
    "analytics": {
      "usage_tab": "Usage",
      "revenue_tab": "Revenue",
      "licenses_tab": "Licenses",
      "revenue_locked": "Revenue Analytics Locked",
      "upgrade_for_revenue": "Upgrade to Premium or higher to view revenue metrics",
      "export_disabled_hint": "Export available for Premium+ tiers",
      "roi_locked": "ROI Calculator Locked",
      "upgrade_for_roi": "Upgrade to Premium to unlock ROI calculator",
      "advanced_analytics": "Advanced Analytics",
      "upgrade_for_details": "Upgrade to Premium for custom date ranges, exports, and more"
    }
  }
}
```

---

## Todo Checklist

- [ ] Verify `rbac.ts` access matrix correct
- [ ] Add tab gating trong `analytics-view.tsx`
- [ ] Create `upgrade-cta.tsx` component
- [ ] Add i18n translations (vi + en)
- [ ] Test gating cho all tiers (BASIC, PREMIUM, ENTERPRISE, MASTER)
- [ ] Test admin access (admin sees everything)

---

## Success Criteria

- [ ] BASIC users chỉ thấy Usage tab
- [ ] PREMIUM users thấy Usage + ROI, export enabled
- [ ] ENTERPRISE+ thấy tất cả tabs (trừ customer table)
- [ ] Admin thấy everything including customer table
- [ ] Upgrade CTAs hiển thị clear cho locked features
- [ ] Export button disabled với tooltip cho BASIC

---

## Security Considerations

1. **Server-Side RBAC:** API endpoints phải verify tier, không trust client
2. **Graceful Degradation:** Locked features show helpful messages, not errors
3. **Consistent UX:** Same gating logic across all components

---

## Testing Matrix

| Tier | Usage Tab | Revenue Tab | Licenses Tab | Export | ROI |
|------|-----------|-------------|--------------|--------|-----|
| BASIC | ✅ | ❌ | ❌ | ❌ | ❌ |
| PREMIUM | ✅ | ❌ | ❌ | ✅ | ✅ |
| ENTERPRISE | ✅ | ✅ | ✅ | ✅ | ✅ |
| MASTER | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Next Steps

→ Implementation complete! Test all phases end-to-end.

---

## Unresolved Questions

1. **Customer Table:** Có nên cho ENTERPRISE xem customer table không, hay chỉ admin?
2. **Trial Mode:** Có nên cho BASIC users trial PREMIUM features trong 7 days không?
3. **Custom Roles:** Có nên support custom roles (e.g., "analytics_viewer") không?
