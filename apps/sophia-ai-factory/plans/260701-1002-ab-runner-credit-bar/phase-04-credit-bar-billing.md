---
title: "Phase 04 — Credit Bar: Billing page video count"
description: "Render CreditBar component on billing page showing 'X of Y videos this month'"
status: pending
priority: P1
effort: 1.5h
phase: 4
---

## Context Links
- Billing client: `src/app/[locale]/dashboard/billing/billing-client.tsx` l.47-254
- CreditBar: `src/app/[locale]/dashboard/billing/credit-bar.tsx` l.30-126
- Usage API: `src/app/api/billing/usage-summary/route.ts` l.100-205
- Types: `src/app/[locale]/dashboard/billing/billing-page-types.ts` l.3-28 `UsageSummaryResponse`
- Tier limits: `src/seed/config/tiers/unified-limits.ts` l.64 `campaignsPerMonth`
- Helper: `src/seed/config/tiers/campaign-limit.ts` (created in Phase 01)
- i18n: `messages/en.json` l.4906-4915 `billing.creditBar` namespace

## Overview
Render the existing `CreditBar` component at the top of the billing page, showing video campaign count for the current month vs. the tier's monthly limit.

The `UsageSummaryResponse` from `/api/billing/usage-summary` currently has `videoGenerations: 0` hardcoded (usage-summary route line 57-62). We need to make the API return actual video generation counts AND the billing page render a CreditBar.

## Key Insights
- The `CreditBar` component is already built and i18n-ready with `billing.creditBar` namespace
- Current CreditBar props: `usedCredits`, `totalCredits`, `overageAvailable?`, `topUpUrl?`
- For video count: `usedCredits` = campaigns created this month, `totalCredits` = tier.campaignsPerMonth
- **Two changes needed**: (1) API returns real video count, (2) billing-client renders CreditBar
- The API already has a `usage.videoGenerations` field — it's just hardcoded to 0
- Counting campaigns: query `campaigns` table `WHERE user_id = ? AND created_at >= startOfMonth`
- The existing check in `createCampaign` already counts campaigns — we reuse the same pattern
- **File ownership**: Phase 04 touches `billing-client.tsx` and `usage-summary/route.ts`. No conflict with Phase 02/03 (campaigns.ts, Inngest functions). No conflict with Phase 05 (sidebar widget).

## Requirements
1. `/api/billing/usage-summary` returns actual `videoGenerations` count (campaigns this month)
2. `UsageSummaryResponse.usage.videoGenerations` reflects real count
3. `billing-client.tsx` renders a `CreditBar` component in the top section
4. CreditBar shows "X of Y videos this month" using `billing.creditBar.videoLabel` + `billing.creditBar.videosThisMonth`
5. CreditBar colors reflect usage percentage (green <80%, yellow 80-99%, red 100%+)
6. Master tier shows "unlimited" (999 → no progress bar or special handling)
7. Works correctly for all tiers

## Architecture

### API change: count real video generations
```
GET /api/billing/usage-summary
  ├─ existing: usage.videoGenerations = 0 (hardcoded)
  ├─ NEW: query campaigns table COUNT WHERE user_id AND created_at >= startOfMonth
  ├─ NEW: usage.videoGenerations = count
  └─ NEW: limits.videoGenerations = getCampaignLimit(tier)
```

### UI: CreditBar placement
```
billing-client.tsx
  <h1>Billing</h1>
  <CreditBar                                    ← NEW (after page header, before BillingChargeSummary)
    usedCredits={usageData.usage.videoGenerations}
    totalCredits={usageData.limits.videoGenerations}
    topUpUrl="/dashboard/billing?tab=topup"
  />
  <DunningStatusBanner />
  <BillingChargeSummary ... />
  ... existing content
```

### CreditBar adaptation
The existing `CreditBar` uses `billing.creditBar.thisMonth` which says "MCU this month". We have two options:
- **Option A (recommended)**: Add `metricLabel` prop to CreditBar to override the label. Defaults to `thisMonth` (MCU), but pass `videosThisMonth` for video count. This keeps the component generic.
- **Option B**: Create a new `VideoCreditBar` wrapper. KISS violation — just add a prop.

Option A is simpler and more maintainable.

## Related Code Files

| Action | File | Lines |
|--------|------|-------|
| MODIFY | `src/app/api/billing/usage-summary/route.ts` | l.57-62 (usage + limits), l.172-181 (response builder) |
| MODIFY | `src/app/[locale]/dashboard/billing/billing-client.tsx` | l.108-165 (top section + quota section) |
| MODIFY | `src/app/[locale]/dashboard/billing/credit-bar.tsx` | l.19-28 (props), l.62 (label text) |
| MODIFY | `src/app/[locale]/dashboard/billing/billing-page-types.ts` | l.4-6 (optional: video limit type) |

## Implementation Steps

### Step 1: Add `metricLabel` prop to CreditBar
In `credit-bar.tsx`:
```typescript
interface CreditBarProps {
  usedCredits: number;
  totalCredits: number;
  overageAvailable?: boolean;
  topUpUrl?: string;
  /** Override the "MCU this month" label. Defaults to "thisMonth" key. */
  metricLabelKey?: string;  // i18n key, defaults to 'thisMonth'
}
```
In render, line 62:
```typescript
{t('used')}: {usedCredits.toLocaleString()} {t('of')} {totalCredits.toLocaleString()} {t(metricLabelKey)}
```
Default `metricLabelKey = 'thisMonth'` in destructure.

### Step 2: Count campaigns in usage-summary API
In `usage-summary/route.ts`, after line 148:
```typescript
// Count campaigns created this month
const { count: videoGenCount } = await db
  .from('campaigns')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
const videoGenerations = videoGenCount ?? 0;
```

### Step 3: Set limits.videoGenerations in API response
```typescript
import { getCampaignLimit } from '@/seed/config/tiers/campaign-limit';

const campaignLimit = getCampaignLimit(tier as Tier);
// In buildBillingUsageSummary call:
limits: { apiCalls: ..., videoGenerations: campaignLimit, storage: 0 }
usage: { apiCalls: ..., videoGenerations, storage: 0 }
```

Also compute percentage + status for video:
```typescript
const videoGenPct = campaignLimit > 0 ? (videoGenerations / campaignLimit) * 100 : 0;
const videoGenStatus: BillingUsageStatus = videoGenPct >= 100 ? 'overage' : videoGenPct >= 90 ? 'critical' : videoGenPct >= 75 ? 'warning' : 'ok';
```

### Step 4: Render CreditBar in billing-client.tsx
After the page header section (line ~115), before `<DunningStatusBanner>`:
```tsx
<CreditBar
  usedCredits={usageData.usage.videoGenerations}
  totalCredits={usageData.limits.videoGenerations}
  metricLabelKey="videosThisMonth"
  topUpUrl="/dashboard/billing?tab=topup"
/>
```

### Step 5: Handle unlimited tier (MASTER)
When `usageData.limits.videoGenerations >= 999`:
- Option: don't render CreditBar (fallback to existing behavior)
- Or: render CreditBar with special "unlimited" handling (needs CreditBar change)
- **Decision**: Don't render when limit >= 999. MASTER tier already has enterprise features displayed; adding a 999-bar is noise.

```tsx
{usageData.limits.videoGenerations < 999 && (
  <CreditBar ... />
)}
```

## Todo List
- [ ] Add `metricLabelKey` prop to CreditBar (defaults to `'thisMonth'`)
- [ ] Count campaigns this month in usage-summary API
- [ ] Set `videoGenerations` limit from `getCampaignLimit(tier)`
- [ ] Compute video generation percentage + status
- [ ] Render CreditBar on billing page (above DunningStatusBanner)
- [ ] Hide CreditBar when limit >= 999 (MASTER tier)
- [ ] Test: BASIC tier shows 0/10, creates a campaign, shows 1/10

## Success Criteria
- Billing page shows "X of Y videos this month" bar at top
- Creating a campaign updates the count (after page refresh / query invalidation)
- Limit matches tier: BASIC=10, PREMIUM=50, ENTERPRISE=999, MASTER=999
- MASTER tier does not show the bar (unlimited)
- Colors: green <80%, yellow 80-99%, red 100%+
- i18n: "video tháng này" in Vietnamese, "videos this month" in English

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Campaign count query slow with many rows | Low | Low | Add index on `user_id, created_at` if needed; existing index likely exists |
| CreditBar MCU label leak (shows "MCU" for video) | Medium | Low | `metricLabelKey` prop defaults to `'thisMonth'` — existing MCU usage is backwards compatible |
| API break for callers expecting `videoGenerations = 0` | Low | Low | No callers depend on this field — it's only used in billing-client which we're updating |

## Security Considerations
- Campaign count uses `user_id` from auth session — no cross-tenant leak
- No new auth requirements — same auth guard as existing API route

## Next Steps
- Phase 05 (Credit bar: sidebar widget)
- Phase 06 (Integration tests)
