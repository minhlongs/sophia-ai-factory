---
title: "ROIaaS PHASE 5 - Analytics Dashboard Implementation"
description: "Dual-stream revenue tracking, user metrics dashboard, ROI calculator, and license-gated premium visualizations"
status: pending
priority: P1
effort: 12h
branch: main
tags: [analytics, roi, dashboard, polar, usage-metering]
created: 2026-03-07
---

# ROIaaS PHASE 5 - Analytics Dashboard

## Overview

Implement comprehensive analytics dashboard for Sophia AI Factory with dual-stream revenue tracking (Engineering ROI + Operational ROI), user metrics, ROI calculator, and premium visualizations gated by RaaS license.

## Phases

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| [01](#phase-01-database-analytics-schema) | Database Analytics Schema | pending | 2h |
| [02](#phase-02-api-endpoints) | API Endpoints for Analytics | pending | 2h |
| [03](#phase-03-dashboard-ui-components) | Dashboard UI Components | pending | 3h |
| [04](#phase-04-revenue-tracking) | Revenue Tracking Module | pending | 2h |
| [05](#phase-05-roi-calculator) | ROI Calculator Component | pending | 2h |
| [06](#phase-06-premium-visualizations) | Premium Visualizations | pending | 1h |

## Dependencies

- **Usage Metering (Phase 4)**: `usage_events`, `usage_hourly_summary`, `usage_daily_summary` tables
- **Polar.sh Integration**: Webhooks, orders, subscriptions data
- **RaaS Licenses**: License validation, tier gating

## Key Files

- **Schema**: `supabase/migrations/20260307-analytics-revenue-schema.sql`
- **API**: `src/app/api/analytics/**`
- **UI**: `src/app/[locale]/dashboard/analytics/components/`
- **Services**: `src/lib/analytics/**`

## Success Criteria

- [ ] Revenue metrics tracked per license/tier
- [ ] ROI calculator shows projected vs actual returns
- [ ] Dashboard loads < 2s with real-time data
- [ ] Premium features gated by RaaS license (PREMIUM+ tiers)
- [ ] All tests pass, build green, production verified

## Related Documentation

- [HIEN_PHAP_ROIAAS.md](../../../docs/HIEN_PHAP_ROIAAS.md)
- [pricing-and-tiers.md](../../../docs/pricing-and-tiers.md)
- [raas-license-gating.md](../../../docs/raas-license-gating.md)
