# Phase 05 — Mission Control Dashboard Widget

## Context Links
- `apps/sophia-ai-factory/src/components/dashboard/quota-usage-bar.tsx` — quota meter (existing)
- `apps/sophia-ai-factory/src/components/dashboard/health-indicator.tsx` — health pill (existing)
- `apps/sophia-ai-factory/src/components/dashboard/plan-upgrade-widget.tsx` — upgrade CTA (existing)
- `apps/sophia-ai-factory/src/app/api/quota/status/` — quota endpoint
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/page.tsx` — dashboard shell

## Overview
- **Priority:** P2
- **Status:** pending
- **Effort:** 30m

Three widgets exist independently. Compose them into a single hero "Mission Control" card on dashboard top — tier badge + quota meter + last 7d API call sparkline + primary CTA (upgrade or "explore SOPs" depending on usage).

## Key Insights
- D1 table `usage_events` (verify in code) tracks API calls per user per day — use for sparkline
- KV-backed counter is faster but D1 is fine for 7-day rollup
- Avoid SSR for the widget — fetch client-side via React Query (existing pattern)

## Requirements
- Single composite widget, top of `/dashboard` page
- Shows: tier badge (BASIC/GROWTH/PREMIUM/MASTER), quota %, last 7d call count + tiny inline bar chart, primary CTA
- Loads in < 200ms perceived (skeleton → data)
- Responsive: mobile = stacked, desktop = horizontal flex
- Click tier badge → `/dashboard/billing`; click quota → `/dashboard/usage`; click upgrade CTA → `/pricing`

## Architecture
```
src/components/dashboard/mission-control/
├── mission-control-card.tsx           composite widget
├── tier-badge.tsx                     small reusable
├── recent-activity-sparkline.tsx     SVG mini-chart, 7 bars
├── primary-cta.tsx                    smart CTA (upgrade vs explore vs contact)
└── use-mission-control-data.ts        single React Query hook
```

Data hook calls one new endpoint `GET /api/v1/dashboard/mission-control` returning:
```json
{
  "tier": "PREMIUM",
  "quota": { "used": 412, "total": 1000, "label": "API calls" },
  "last7d": [{"date":"2026-04-27","count":34}, ...],
  "ctaHint": "explore_sops" | "upgrade" | "renew"
}
```

## Related Files
**Create:**
- `src/app/api/v1/dashboard/mission-control/route.ts` — aggregator
- `src/components/dashboard/mission-control/mission-control-card.tsx`
- `src/components/dashboard/mission-control/tier-badge.tsx`
- `src/components/dashboard/mission-control/recent-activity-sparkline.tsx`
- `src/components/dashboard/mission-control/primary-cta.tsx`
- `src/components/dashboard/mission-control/use-mission-control-data.ts`

**Modify:**
- `src/app/[locale]/dashboard/page.tsx` — add `<MissionControlCard />` at top

## Implementation Steps
1. Aggregator route: read user tier from `users` row, quota counter from `usage_events` (sum last 30d / monthly cap from tier matrix), 7-day daily counts via GROUP BY date
2. Compute `ctaHint` server-side: quota > 95% → `upgrade`; tier == BASIC && last7d.sum < 5 → `explore_sops`; subscription expiring < 7d → `renew`
3. Sparkline: pure SVG, 7 vertical bars, max-normalized; no external chart lib
4. Tier badge: tier → color (BASIC=slate, GROWTH=indigo, PREMIUM=violet, MASTER=amber)
5. Skeleton: shimmer rows during loading
6. i18n: use existing `dashboard.missionControl.*` namespace (add to vi/en)
7. Place card in `dashboard/page.tsx` above existing widgets

## Todo
- [ ] Aggregator endpoint
- [ ] 5 components built
- [ ] Mission control hook with React Query (5min stale)
- [ ] Card mounted at top of dashboard
- [ ] Skeleton + error fallback
- [ ] i18n vi + en
- [ ] Mobile responsive verified

## Success Criteria
- Card visible above-the-fold on dashboard
- Single network call (`/api/v1/dashboard/mission-control`)
- Sparkline renders 7 bars correctly with 0-count days as empty
- CTA smart-routes based on user state
- Lighthouse: no CLS regression on dashboard

## Risk Assessment
- **Aggregator slow if `usage_events` large**: add covering index `(user_id, created_at)` if not already
- **Tier-to-color mapping must match existing pricing page** — extract to shared `src/lib/tier/tier-display.ts`

## Security Considerations
- Endpoint requires session, returns only own user's data
- Zod validate response shape on server (defense-in-depth)
- No PII in sparkline payload

## Next
Phase 06 builds public `/status` page (no auth) for transparency.
