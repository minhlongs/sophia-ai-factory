# ROIaaS Phase 5 Analytics Research Report

**Date:** 2026-03-07
**Project:** Sophia AI Factory
**Researcher:** Agent
**Status:** Complete

---

## 1. ROIaaS Dual-Stream Model

### Engineering ROI (Dev Key Pattern)
**Status:** IMPLEMENTED
**Location:** `src/lib/raas-*.ts`, `src/lib/subscription.ts`

**Structure:**
- License keys auto-generated on Polar payment via `raas-key-generator.ts`
- License stored in `raas_licenses` table with `key_hash`, `tier`, `nonce`
- Tier: BASIC | PREMIUM | ENTERPRISE | MASTER (uppercase)
- MASTER tier = perpetual (expires_at = 0)
- Subscription tiers = 1 year default, configurable via Polar

**Key Files:**
- `src/lib/raas-key-generator.ts` - License key generation
- `src/lib/raas-audit.ts` - Audit trail
- `src/lib/subscription.ts` - User tier resolution with `getUserTier()`
- `src/lib/usage-metering/aggregator.ts` - Quota limits per tier

### Operational ROI (User UI Pattern)
**Status:** IMPLEMENTED (Phase 5)
**Location:** `src/app/[locale]/dashboard/analytics/`

**Features:**
- Usage Analytics: Time-series metrics (requests, credits, tokens, errors)
- Revenue Analytics: MRR by tier, trend data
- License Analytics: Utilization tracking per license
- Export: CSV/PNG (PREMIUM+ only)

---

## 2. Existing Dashboard Architecture

### Data Flow
```
Supabase ← [usage_events, raas_licenses, payment_events]
    ↓
API Routes (/api/analytics/*)
    ↓
React Hook (useSWR)
    ↓
Charts (recharts)
```

### Components
| Path | Purpose | Access |
|------|---------|--------|
| `dashboard/analytics/page.tsx` | Main analytics route | Authenticated |
| `dashboard/analytics/components/analytics-view.tsx` |usage/campaign tabs | Tier-gated |
| `dashboard/analytics/components/usage-analytics-view.tsx` |Usage metrics UI | PREMIUM+ |
| `dashboard/analytics/components/charts.tsx` | Pie/Bar charts | Recharts |

### State Management
- **Client:** React hooks + SWR caching
- **Data Fetching:** `useAnalyticsData`, `useUsageAnalytics`, `useRevenueAnalytics`, `useLicenseAnalytics`
- **Quota Limits:** `src/lib/usage-metering/aggregator.ts`

---

## 3. Payment & Tier System

### Polar Integration
**Status:** FULLY IMPLEMENTED
**Files:** `src/lib/polar.ts`, `src/lib/payments/polar-*.ts`

**Flow:**
1. User clicks checkout → `POST /api/checkout`
2. Creates Polar checkout session
3. Polar webhook → `POST /api/webhooks/polar`
4. Generates license key automatically
5. Updates `raas_licenses` + `user_profiles`

### Tier Configuration
**Location:** `src/lib/polar-config.ts`

| Tier | Name | Price | Billing | Product Env |
|------|------|-------|---------|-------------|
| BASIC | Starter | $199 | Monthly | POLAR_PRODUCT_ID_STARTER |
| PREMIUM | Growth | $399 | Monthly | POLAR_PRODUCT_ID_GROWTH |
| ENTERPRISE | Premium | $799 | Monthly | POLAR_PRODUCT_ID_PREMIUM |
| MASTER | Master | $4,999 | One-time | POLAR_PRODUCT_ID_MASTER |

### Tier Classes
**Location:** `src/types/index.ts`

```typescript
export type Tier = "BASIC" | "PREMIUM" | "ENTERPRISE" | "MASTER";
```

**RBAC (src/lib/analytics/rbac.ts):**
- BASIC: Basic analytics, no export
- PREMIUM: Custom date range, export, no tier breakdown
- ENTERPRISE: Full access (except customer table)
- MASTER: Full access + admin features
- Admin: Full access (via user_profiles.role)

---

## 4. Data Visualization Stack

### Libraries
- **Charts:** Recharts (PieChart, BarChart)
- **Layout:** Tailwind CSS 4 + shadcn/ui
- **Data Fetching:** SWR (stale-while-revalidate)

### Chart Components
| Component | File | Description |
|-----------|------|-------------|
| StatusDistributionChart | `charts.tsx` | Pie chart for campaign status |
| CompletionTimeChart | `charts.tsx` | Bar chart for duration |
| CampaignsByTypeChart | `charts.tsx` | Pie chart for templates |
| UsageChart | `usage-chart.tsx` | Time-series line chart |
| ServiceBreakdownChart | `service-breakdown.tsx` | Service usage breakdown |
| LicenseUtilizationChart | `license-utilization.tsx` | License usage % |
| MetricsCards | `metrics-cards.tsx` | KPI cards |

### Data Model
**Location:** `src/lib/analytics/types.ts`

```typescript
UsageMetrics {
  summary: UsageSummary
  timeSeries: TimeSeriesPoint[]
  serviceBreakdown: ServiceBreakdown[]
}
```

---

## 5. User Metrics Available

### Supabase Schema
**Location:** `src/lib/supabase/types.ts`

#### Core Tables
| Table | Description | Key Fields |
|-------|-------------|------------|
| `usage_events` | Per-request metrics | user_id, license_nonce, service_name, tokens_input/output, credits_used, response_time_ms, status_code |
| `raas_licenses` | License management | tier, key_hash, nonce, expires_at, is_revoked, polar_customer_id, metadata |
| `payment_events` | Webhook audit | event_type, polar_event_id, payload, processed |
| `user_profiles` | User subscription | subscription_tier, polar_subscription_id, polar_customer_id |
| `campaigns` | Video campaigns | user_id, title, status, template_id, video_url |

#### Usage Metering Summary Tables
| Table | Description |
|-------|-------------|
| `usage_hourly_summary` | Hourly rollup (requests, credits, tokens) |
| `usage_daily_summary` | Daily rollup with hourly breakdown |
| `usage_quota_usage` |Quota consumption tracking |

### Current Analytics Endpoints

| Endpoint | Method | Access |
|----------|--------|--------|
| `/api/analytics/usage` | GET | Authenticated (own data or admin) |
| `/api/analytics/revenue` | GET | ENTERPRISE+ or admin |
| `/api/analytics/licenses` | GET | Authenticated (admin filter) |
| `/api/analytics/export` | POST | PREMIUM+ |
| `/api/graphql/analytics` | POST | GraphQL interface |

---

## 6. Phase 5 Analytics Features Implemented

### Components
- Usage analytics tab with date range filters
- Revenue metrics (MRR, trend, by-tier breakdown)
- License utilization tracking
- Service breakdown (heygen, elevenlabs, openrouter)
- Export functionality (CSV)
- Tier-gating (BASIC vs PREMIUM+)

### Missing/Incomplete
| Feature | Status |
|---------|--------|
| ROI calculator | Schema exists, needs calculation logic |
| Custom date range? | Basic exists, advanced needs work |
| Auto-refresh | UI present, needs implementation |
| Customer table view | Admin-only feature |

---

## Unresolved Questions

1. **ROI Calculation Logic:** Schema defines `ROIMetrics` but no resolver implements the calculation. What inputs should be used?

2. **Analytics Database:** Is `usage_hourly_summary` / `usage_daily_summary` being populated by cron jobs? Need to verify rollup jobs.

3. **GraphQL Implementation:** Current `/api/graphql/analytics` uses regex parsing. Should we use proper graphql-tools for production?

4. **Real-time Updates:** SWR has 60s deduping. Should we add Server-Sent Events or WebSockets for live dashboards?

5. **Polar Webhook Missing Events:** Schema references `order.created` but webhook handler needs verification for all event types.

6. **Data Retention:** No cleanup job for old `usage_events`. Will table grow unbounded?

---

## Key Findings

1. **ROIaaS Architecture:** Already in place with license key generation on payment
2. **Analytics Pipeline:** Data flows Supabase → API → Charts
3. **Tier Gating:** RBAC layer is comprehensive (4 tiers + admin)
4. **Chart Library:** Recharts stable and working
5. **Webhook Handling:** Polar events fully processed with idempotency

---

## Recommendations

1. **Implement ROI resolver** using license cost + usage metrics
2. **Verify cron rollups** are running hourly/daily
3. **Add data retention** policy (keep 90 days raw events, archive older)
4. **Consider WebSocket** for real-time usage monitoring
5. **Document Polar event types** in webhook handler switching

---

## File References

```
src/
├── lib/
│   ├── analytics/
│   │   ├── types.ts                    # API types
│   │   ├── queries.ts                  # Supabase queries
│   │   ├── rbac.ts                     # RBAC helpers
│   │   └── graphql-resolvers.ts        # GraphQL resolvers
│   ├── polar-config.ts                 # Product config
│   ├── polar.ts                        # Polar SDK
│   ├── subscription.ts                 # Tier resolution
│   ├── raas-*.ts                       # License management
│   └── usage-metering/
│       ├── aggregator.ts               # Quota limits
│       └── types.ts                    # Usage types
├── app/
│   └── [locale]/dashboard/analytics/
│       ├── page.tsx
│       ├── components/
│       │   ├── analytics-view.tsx
│       │   ├── usage-analytics-view.tsx
│       │   ├── charts.tsx
│       │   └── *.tsx
│       └── hooks/
│           └── use-analytics-data.ts
└── hooks/use-analytics-data.ts         # Client hooks
```

---

**End of Report**
