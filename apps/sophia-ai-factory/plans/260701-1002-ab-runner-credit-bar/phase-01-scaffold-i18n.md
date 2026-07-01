---
title: "Phase 01 — Scaffold & i18n"
description: "Add i18n keys for video credit bar and prepare shared helpers"
status: pending
priority: P1
effort: 1h
phase: 1
---

## Context Links
- i18n schema: `messages/en.json`, `messages/vi.json`
- Type defs: `src/seed/types/index.ts` `Tier`
- Limits: `src/seed/config/tiers/unified-limits.ts` `campaignsPerMonth`
- CreditBar: `src/app/[locale]/dashboard/billing/credit-bar.tsx`
- Sidebar: `src/forest/components/dashboard/sidebar-quota-widget.tsx`

## Overview
Phase 01 sets up the shared i18n strings and any small utility helpers both features need. No behavioral changes yet — pure setup.

## Key Insights
- The existing `CreditBar` component has a `billing.creditBar` namespace with `thisMonth`, `used`, `of` keys. We can **reuse this component directly** for video count by adding `videosThisMonth` and `videoLabel` keys.
- The sidebar widget uses `dashboard.sidebar.quotaWidget` namespace. We add a `videos` key for the compact label.
- `campaignsPerMonth` from `UNIFIED_TIERS` is the source of truth for video generation limits. We expose it via a simple helper in `seed/config/tiers/campaign-limit.ts` (YAGNI: single function, no barrel overhead).

## Requirements
1. Add `billing.creditBar.videoLabel` and `billing.creditBar.videosThisMonth` i18n keys (VI+EN)
2. Add `dashboard.sidebar.quotaWidget.videos` i18n key (VI+EN)
3. Add `dashboard.sidebar.quotaWidget.ofLimit` i18n key (VI+EN) for "X of Y videos" format
4. Expose a helper `getCampaignLimit(tier: Tier): number` to avoid importing `UNIFIED_TIERS` directly from UI components
5. Verify existing i18n:validate passes with new keys

## Related Code Files

| Action | File | Line |
|--------|------|------|
| MODIFY | `messages/en.json` | l.1306 (after `creditBar.atLimit`) |
| MODIFY | `messages/vi.json` | l.1306 (after `creditBar.atLimit`) |
| MODIFY | `messages/en.json` | l.775 (after `quotaWidget.viewBilling`) |
| MODIFY | `messages/vi.json` | l.775 (after `quotaWidget.viewBilling`) |
| MODIFY | `messages/en.json` | l.4916 (billing.creditBar block) |
| MODIFY | `messages/vi.json` | l.4922 (billing.creditBar block) |
| CREATE | `src/seed/config/tiers/campaign-limit.ts` | — |

## Implementation Steps

### Step 1: Add `getCampaignLimit()` helper
Create `src/seed/config/tiers/campaign-limit.ts`:
```typescript
import type { Tier } from '@/seed/types';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';

/** Returns campaign-per-month limit for a tier. 999 = effectively unlimited. */
export function getCampaignLimit(tier: Tier): number {
  return UNIFIED_TIERS[tier]?.campaignsPerMonth ?? 10;
}
```
Re-export from `src/seed/config/tiers/index.ts` if a barrel exists.

### Step 2: Add i18n keys for billing credit bar
In `messages/en.json` and `messages/vi.json`, add to `billing.creditBar` block:
```json
"videosThisMonth": "videos this month",
"videoLabel": "Videos"
```
Vietnamese:
```json
"videosThisMonth": "video tháng này",
"videoLabel": "Video"
```

### Step 3: Add i18n keys for sidebar widget
In `messages/en.json` and `messages/vi.json`, add to `dashboard.sidebar.quotaWidget`:
```json
"videos": "Videos",
"ofLimit": "of {limit}"
```
Vietnamese:
```json
"videos": "Video",
"ofLimit": "trên {limit}"
```

### Step 4: Run i18n validation
```bash
npm run pretest  # runs i18n:validate
```

## Todo List
- [ ] Create `src/seed/config/tiers/campaign-limit.ts` with `getCampaignLimit()`
- [ ] Re-export from barrel if one exists
- [ ] Add `billing.creditBar.videoLabel` + `billing.creditBar.videosThisMonth` to en.json and vi.json
- [ ] Add `dashboard.sidebar.quotaWidget.videos` + `dashboard.sidebar.quotaWidget.ofLimit` to en.json and vi.json
- [ ] Run `npm run pretest` to confirm i18n:validate passes

## Success Criteria
- `npm run pretest` passes with 0 i18n errors
- `getCampaignLimit('BASIC')` returns 10, `getCampaignLimit('MASTER')` returns 999

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| i18n key collision | Low | Low | Pre-existing keys checked; new keys are unique |
| Barrel file not found | Low | Med | Non-blocking — import directly from `campaign-limit.ts` |

## Security Considerations
- No auth needed — helper is pure computation, UI i18n is static

## Next Steps
- Phase 02 (AB: campaign creation wire-up)
- Phase 04 (Credit bar: billing page)
- Phase 05 (Credit bar: sidebar widget)
