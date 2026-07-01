---
title: "Phase 05 — Credit Bar: Sidebar widget video count"
description: "Add compact video generation count to sidebar quota widget"
status: pending
priority: P1
effort: 1h
phase: 5
---

## Context Links
- Sidebar widget: `src/forest/components/dashboard/sidebar-quota-widget.tsx` l.35-108
- Quota API: `/api/quota/status` (used by widget, fetch `QuotaStatusResponse`)
- Tier limits: `src/seed/config/tiers/campaign-limit.ts` (Phase 01)
- i18n: `messages/en.json` l.769-773 `dashboard.sidebar.quotaWidget`
- Billing API: `src/app/api/billing/usage-summary/route.ts` (Phase 04 adds video count)

## Overview
Add a compact "X videos / Y limit" display to the existing `SidebarQuotaWidget`. The widget already shows "MCU credits used / limit" with a progress bar. We add a second row showing campaign/video count.

## Key Insights
- The sidebar widget currently fetches from `/api/quota/status` which returns `QuotaStatusResponse` (MCU credits data)
- **Option A** (recommended): The billing `/api/billing/usage-summary` already returns `videoGenerations` after Phase 04. Switch the widget to also use this endpoint (or add a lighter endpoint). But the widget currently uses `/api/quota/status` — we could add video count to that endpoint.
- **Option B** (KISS): Add a separate lightweight query to count campaigns this month. Since the widget is client-side, we need an API route or a TanStack Query to `/api/billing/usage-summary`.
- **Decision (KISS)**: The simplest approach is to add a second useQuery in the sidebar widget that fetches from `/api/billing/usage-summary` and extracts just `usage.videoGenerations` + `limits.videoGenerations`. TanStack Query handles deduplication automatically — if the billing page already fetched it, it's cached.
- **Alternative (even simpler)**: Add `videoGenerations` + `videoGenerationsLimit` fields to the existing `/api/quota/status` endpoint. The sidebar widget already queries it. This is the cleanest approach — single fetch, no duplicate queries.

**Final approach**: Add `videoGenerations` field to `/api/quota/status` response.

## Requirements
1. Sidebar widget shows compact video count below existing MCU quota bar
2. Format: "Videos: X / Y" or "X / Y videos"
3. Follows same progress bar logic (green/yellow/red) as MCU bar
4. MASTER tier shows "Videos: X / unlimited" with infinity icon
5. Hidden when loading/error/no data (same as existing widget behavior)
6. Uses i18n keys from Phase 01

## Architecture

### Option A: Add to /api/quota/status (RECOMMENDED)
```
/api/quota/status
  ├─ existing: { license, quota: { usage, limits, percentages, status } }
  ├─ NEW: video: { used: number, limit: number }
  └─ SidebarQuotaWidget reads + renders
```

### Option B: Dual query in widget
```
SidebarQuotaWidget
  ├─ useQuery('/api/quota/status') — existing
  ├─ useQuery('/api/billing/usage-summary') — NEW, extract videoGenerations
  └─ render video row from billing data
```

### Implementation (Option A)

#### Step 1: Scout `/api/quota/status` route
Find the route handler and its response builder:
```bash
find src -path "*/api/quota/status*" -type f
```

#### Step 2: Add video count to quota status response
Add a `video` field to the response type:
```typescript
interface QuotaStatusResponse {
  // ... existing
  video: {
    used: number;
    limit: number;
  };
}
```
In the route handler, query `campaigns` table for count this month, same pattern as Phase 04.

#### Step 3: Render video row in SidebarQuotaWidget
After the existing MCU quota bar (line 73):
```tsx
{/* Video generation count — NEW */}
<div className="mt-2 pt-2 border-t border-border/40">
  <div className="flex items-center gap-2 mb-1.5">
    <Film className="h-3.5 w-3.5 text-muted-foreground" />
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {t('videos')}
    </span>
  </div>
  {isUnlimited ? (
    <div className="flex items-baseline gap-1.5">
      <span className="text-sm font-semibold tabular-nums">{videoUsed}</span>
      <span className="text-xs text-muted-foreground">/</span>
      <InfinityIcon className="h-4 w-4 text-amber-400" />
    </div>
  ) : (
    <QuotaBar used={videoUsed} limit={videoLimit} />
  )}
</div>
```

#### Step 4: Add `Film` icon import
```typescript
import { Infinity as InfinityIcon, BarChart3, Film } from 'lucide-react';
```

## Related Code Files

| Action | File | Lines |
|--------|------|-------|
| MODIFY | `src/forest/components/dashboard/sidebar-quota-widget.tsx` | l.35-108 (component), l.23-31 (interface) |
| MODIFY | `/api/quota/status` route | TBD after scout |
| MODIFY | `messages/en.json` | Phase 01 already done |
| MODIFY | `messages/vi.json` | Phase 01 already done |

## Implementation Steps

### Step 1: Scout `/api/quota/status` route
```bash
find src -path "*/api/quota/status*" -type f
```

### Step 2: Add video count fields to quota status response type
In `sidebar-quota-widget.tsx`, extend `QuotaStatusResponse`:
```typescript
interface QuotaStatusResponse {
  license: { nonce: string; tier: string };
  quota: { /* existing */ };
  video?: {        // NEW
    used: number;
    limit: number;
  };
}
```

### Step 3: Add video count query to `/api/quota/status` route
```typescript
import { getCampaignLimit } from '@/seed/config/tiers/campaign-limit';
import { createServerClient } from '@/seed/db/client';

// In GET handler, after existing quota query:
const now = new Date();
const db = createServerClient();
const { count: videoCount } = await db
  .from('campaigns')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString());

const videoLimit = getCampaignLimit(tier as Tier);

return NextResponse.json({
  // ... existing fields
  video: { used: videoCount ?? 0, limit: videoLimit },
});
```

### Step 4: Add Video row to SidebarQuotaWidget
Insert after line 73 (closing `</Link>` parent or inside existing widget):
```tsx
{data.video && (
  <div className="mt-2 pt-2 border-t border-border/40">
    <div className="flex items-center gap-2 mb-1.5">
      <Film className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t('videos')}
      </span>
    </div>
    {videoLimit >= 999 ? (
      <div className="flex items-baseline gap-1.5 text-foreground">
        <span className="text-sm font-semibold tabular-nums">{data.video.used}</span>
        <span className="text-xs text-muted-foreground">/</span>
        <InfinityIcon className="h-4 w-4 text-amber-400" aria-label={t('unlimited')} />
      </div>
    ) : (
      <QuotaBar used={data.video.used} limit={data.video.limit} />
    )}
  </div>
)}
```

## Todo List
- [ ] Scout `/api/quota/status` route location
- [ ] Add `video: { used, limit }` to quota status response
- [ ] Query campaign count in quota status route
- [ ] Add `Film` icon import to sidebar widget
- [ ] Render video count row below MCU quota bar
- [ ] Handle unlimited tier (>= 999) with infinity icon
- [ ] Handle missing `data.video` (backwards compat if API not updated yet)

## Success Criteria
- Sidebar shows "Videos: X / Y" below MCU quota bar
- Count matches number of campaigns created this month
- Limit matches tier: BASIC=10, PREMIUM=50, ENTERPRISE=999, MASTER=999
- Unlimited tiers show infinity icon
- Hidden when data unavailable (no flash of empty state)
- i18n: "Video" in VI, "Videos" in EN

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `/api/quota/status` route not easily found | Low | Low | grep/find by path pattern; exists in quota module |
| Adding fields breaks existing consumers | Low | Med | New `video?` field is optional — old consumers ignore it |
| Double scroll on sidebar from too many widgets | Low | Low | Compact design (1 line + thin progress bar) |

## Security Considerations
- Same auth guard as existing `/api/quota/status` route
- Campaign count scoped to `user.id` — no cross-tenant data leak

## Next Steps
- Phase 06 (Integration tests + build gate)
