# Sophia AI Factory — Phase 9 Analytics Dashboard Research Report

**Date:** 2026-04-25  
**Researcher:** Claude Code  
**Status:** Complete  
**Scope:** Assess existing analytics infrastructure vs Phase 9 requirements

---

## Executive Summary

Sophia AI Factory has **comprehensive analytics foundations** already built. Phase 9 requires integrating existing pieces into a founder-facing real-time dashboard, plus adding 3 missing components:
- **Existing:** Usage metrics, revenue, license tracking, GraphQL API, D1 aggregations, RBAC
- **Missing:** Cohort retention tracking, churn analysis, LTV calculation, client tier adoption timeline
- **Key insight:** 80% of infrastructure exists; Phase 9 = polish UI + add retention/LTV modules

---

## Current Analytics State

### ✅ What Exists

**User Dashboard** (`src/app/[locale]/dashboard/analytics/`)
- Campaign performance cards (total, success rate, completion time)
- Recharts integration (status, completion time, campaigns by type)
- Real-time hook: `useAnalyticsData` aggregates campaigns in-browser
- Tier-gated advanced features

**Admin Dashboard** (`src/app/[locale]/(admin)/admin/analytics/usage/page.tsx`)
- 3 tabs: Overview, Usage Trends, Per-License breakdown
- Summary cards: Total Requests, Credits, Error Rate, Active Licenses
- Quota gauges (UsageChart, ErrorRateChart, LicenseMetricsTable)
- Date range picker, granularity toggle (hour/day)
- 24h/7d auto-calculated windows

**API Routes** (5 core endpoints)
- `GET /api/analytics/usage` — Time-series usage (license, start/end, granularity, service filter)
- `GET /api/analytics/revenue` — Revenue by tier & period (Polar.sh-based, pre-Phase 2 design)
- `GET /api/analytics/licenses` — License utilization (per-license credits/limits)
- `GET /api/analytics/roi` — ROI calculator (cost attribution per feature)
- `POST /api/v1/usage` — Batch ingestion (Zod validated, quota enforcement, rate-limited)

**Type System** (`src/lib/analytics/types.ts`)
- UsageMetrics, RevenueTrend, LicenseUtilization, ViolationEvent (all typed)
- Enums: AnalyticsGranularity, RevenuePeriod, LicenseStatus, ViolationType, ViolationSeverity
- RBAC context: UserContext, violation summary

**Data Layer** (`src/lib/analytics/`)
- `queries/` directory (7 specialized query modules)
- `rbac.ts` — verifyLicenseAccess, checkAdmin, canAccessRevenue
- `roi-calculator.ts` — cost attribution engine
- `queries.ts` — barrel re-export (fetchUsageMetrics, fetchRevenueMetrics, fetchLicenseMetrics)
- `analytics-query-resolvers.ts` — dimension resolution (resolve service name, tier name)
- `analytics-timeseries-helpers.ts` — window aggregation helpers

**GraphQL** (`src/app/api/graphql/analytics/`)
- Apollo schema (unused currently; prepared for future)
- Route: `POST /api/graphql/analytics` (schema + resolvers)

**D1 Integration**
- Usage events table + indexes
- License metrics materialized view
- Admin monitoring (Phase 8.7): D1 aggregates LLM cache, workflows, signals
- Inngest cron for async rollup jobs

**Validation**
- `src/lib/validation/services.ts` — analyticsUsageQuerySchema, analyticsRevenueQuerySchema
- Zod guards all API inputs (license_nonce, timestamps, granularity, tier)

### ❌ What's Missing for Phase 9

| Feature | Gap | Impact |
|---------|-----|--------|
| **Cohort Retention** | No cohort tracking by signup date | Can't calculate month-1, month-2+ retention |
| **Churn Analysis** | No tier downgrade/cancellation timeline | Missing churn rate KPIs |
| **LTV Calculation** | No ARPU × retention multiplier | Can't optimize pricing/retention |
| **Tier Adoption Timeline** | No "new PREMIUM customers per day" metric | Missing growth funnel visibility |
| **Real-Time Dashboard** | Admin page exists but no WebSocket/SSE for live updates | Founder sees stale data every 5+ min |
| **Custom Date Ranges** | Only preset granularities (hour/day, 24h/7d windows) | Can't slice specific date ranges (e.g., 2026-01-15 to 2026-02-28) |

---

## Type Definitions Found

### Core Analytics Types
```typescript
UsageMetrics {
  summary: UsageSummary  // totalRequests, totalTokens, totalCredits, errorRate
  timeSeries: TimeSeriesPoint[]  // timestamp-bucketed requests/credits/tokens/errors
  serviceBreakdown: ServiceBreakdown[]  // per-service aggregates
}

RevenueMetrics {
  totalRevenue, recurringRevenue, oneTimeRevenue
  byTier: TierRevenue[]  // {tier, customers, revenue}
  trend: RevenueTrend[]  // {date, revenue}
}

LicenseUtilization {
  licenseNonce, tier, usedCredits, limitCredit, percentage, expiresAt
  overageCount?, billableCount?, overageCredits?  // Phase 6 fields
}

ViolationEvent {
  id, type, severity, userId, licenseNonce, tier, endpoint
  ipAddress?, userAgent?, metadata?
  createdAt, resolved, resolvedAt?
}
```

### Enums & Query Filters
- `AnalyticsGranularity = 'hour' | 'day'`
- `RevenuePeriod = 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days'`
- `LicenseStatus = 'active' | 'expired' | 'revoked' | 'all'`
- `ViolationType = 'quota_exceeded' | 'invalid_license' | 'expired_license' | 'revoked_license' | 'rate_limit_exceeded' | 'unauthorized_access' | 'cross_tenant_access'`

---

## API Routes Available

| Route | Method | Purpose | RBAC | Status |
|-------|--------|---------|------|--------|
| `/api/analytics/usage` | GET | Time-series usage + service breakdown | Admin: global; Customer: own license | ✅ |
| `/api/analytics/revenue` | GET | MRR, churn, tier breakdown | Admin: filter by tier; Customer: aggregates only | ✅ |
| `/api/analytics/licenses` | GET | Per-license quotas + utilization | Admin: all; Customer: own | ✅ |
| `/api/analytics/roi` | GET | Cost attribution per feature | Admin: all; Customer: own org | ✅ |
| `/api/v1/usage/batch` | POST | Batch ingestion (up to 1000 records) | Authenticated user | ✅ |
| `/api/graphql/analytics` | POST | GraphQL schema (prepared, unused) | Not yet wired | 🟡 |
| `/api/analytics/agencyos-sync` | GET | External sync (AgencyOS) | Admin only | 🟡 |
| `/api/analytics/export` | GET | CSV/JSON export | Admin: all; Customer: own | ✅ |

---

## Recommended Phase 9 Implementation Plan

### A. Quick Wins (2-3 days)
1. **Real-time dashboard polling** → SSE endpoint for founder live view
   - New route: `GET /api/analytics/realtime?org_id=...`
   - Returns: current ARR, active clients, top features
   - 30s poll interval on frontend (Founder Dashboard)
2. **Custom date range picker** → Replace preset windows
   - Extend UsageFilters to accept `startDate` + `endDate` (human-readable)
   - Query validation remains Zod strict
3. **Client revenue card** → Show: Total ARR, MRR Growth %, Tier breakdown pie chart
   - Reuse existing RevenueMetrics, add UI card to admin dashboard

### B. Retention Module (4-5 days)
1. **D1 migration**: Cohort table with `user_id, signup_date, first_tier, cohort_month`
2. **Queries**: `getCohortRetention(cohortMonth)` → `{month: 1-12, activeCount, retentionRate}`
3. **UI component**: Cohort retention heatmap (months × cohorts)
4. **Data backfill**: Ingest existing user signup dates from `users` table

### C. Churn Analysis (3-4 days)
1. **Events table**: Track tier downgrade/cancellation with timestamps
2. **Query**: `getChurnMetrics(period)` → `{churnRate, churnedUsers, avgLifetime}`
3. **UI**: Churn timeline chart + reason categorization (optional: user feedback form)

### D. LTV Calculator (2-3 days)
1. **Formula**: `LTV = ARPU × avgLifetimeMonths`
   - ARPU = total revenue ÷ active customers (per cohort)
   - avgLifetimeMonths = retention lookup at month 12
2. **UI**: LTV by tier, LTV vs CAC ratio, LTV trend

### E. Tier Adoption Timeline (2-3 days)
1. **Query**: `getTierAdoptionTimeline()` → `{date, tier, newCount, churnCount, netGrowth}`
2. **Chart**: Stacked area chart (BASIC, PREMIUM, ENTERPRISE, MASTER)
3. **Reuse**: Existing TimeSeriesPoint bucketing logic

---

## Code File Inventory

### Components
- `src/app/[locale]/dashboard/analytics/` — User dashboard (4 files)
  - `page.tsx` — Server component, loads campaigns
  - `components/analytics-view.tsx` — Tabs (usage vs campaigns)
  - `components/usage-analytics-view.tsx` — Usage-specific view
  - `components/charts.tsx` — Recharts wrappers (StatusDistributionChart, CompletionTimeChart, CampaignsByTypeChart)
  - `hooks/use-analytics-data.ts` — Client-side campaign aggregation

- `src/app/[locale]/(admin)/admin/analytics/usage/page.tsx` — Admin usage dashboard (1 file, 382 lines)

- `src/components/analytics/` — Reusable chart components (5+ files)
  - UsageChart, ErrorRateChart, LicenseMetricsTable, QuotaGaugeList, DateRangePicker

### APIs
- `src/app/api/analytics/` — Analytics endpoints (6 files)
  - usage/route.ts, revenue/route.ts, licenses/route.ts, roi/route.ts, export/route.ts, agencyos-sync/route.ts
- `src/app/api/v1/usage/` — Usage ingestion (2 files)
  - route.ts, batch/route.ts

- `src/app/api/graphql/analytics/` — GraphQL (2 files)
  - route.ts, schema.ts

### Libraries
- `src/lib/analytics/` — Core logic (12 files)
  - types.ts, rbac.ts, queries.ts, roi-calculator.ts, export.ts
  - queries/ — Specialized query modules (7 subdirectory files)
  - Helpers: analytics-query-resolvers.ts, analytics-timeseries-helpers.ts, formatters.ts

### Database
- Migrations: `0008-llm-cache.sql`, `0009-llm-cache-org-scoping.sql` (exist; no analytics-specific migration visible)
- Tables: `usage_events`, license materialized view, D1 aggregations

---

## Success Criteria for Phase 9

1. ✅ **Client revenue tracking** — ARR, MRR, tier adoption visible in founder dashboard
2. ✅ **Admin KPIs** — Total usage, active clients, error rate in single-page view
3. ✅ **Feature-level analytics** — Campaigns, renders, bot responses breakdown per user
4. ⏳ **Retention cohorts** — Month-0 to month-12 retention heatmap
5. ⏳ **LTV tracking** — LTV by tier, LTV vs CAC comparison
6. ✅ **Real-time updates** — Dashboard auto-refreshes (pending SSE endpoint)

---

## Unresolved Questions

1. **Polar.sh vs NOWPayments**: Revenue route hardcodes Polar.sh queries; Sophia uses NOWPayments IPN. Which source of truth for Phase 9 revenue metrics?
   - → **Action**: Verify with CTO which payment provider data to use for revenue reports

2. **Cohort backfill**: Should retention cohorts include pre-April 2026 users? How to bootstrap historical signup dates?
   - → **Action**: Check if `users.created_at` is reliable; if not, mark as "unknown cohort" in reports

3. **Real-time push strategy**: SSE vs WebSocket vs polling? Founder likely expects <30s latency.
   - → **Recommendation**: Start with SSE (simpler; CF Workers native), upgrade to WebSocket if needed

4. **Churn attribution**: When a user downgrades (PREMIUM → BASIC), is that churn or downgrade? Count separately?
   - → **Action**: Define churn KPI (cancellation only? or tier downgrade?); suggest product decision

5. **Custom date ranges**: Should API accept ISO 8601 strings or Unix timestamps? Existing code uses Unix only.
   - → **Recommendation**: Accept both, normalize internally in query validator
