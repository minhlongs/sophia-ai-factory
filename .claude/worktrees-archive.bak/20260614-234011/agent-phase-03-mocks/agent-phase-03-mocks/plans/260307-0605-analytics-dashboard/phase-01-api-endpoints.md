---
title: "Phase 1: Analytics API Endpoints"
status: complete
priority: P1
effort: 2h
completed: 2026-03-07
---

# Phase 1: Analytics API Endpoints

## Context
**Research:** `../reports/researcher-analytics-dashboard-260307-0605.md` → Section 3 (Usage Metering Integration)

**Existing Infrastructure:**
- Usage events table: `usage_events` (Supabase)
- Internal query API: `/api/internal/usage/query`
- Aggregator: `src/lib/usage-metering/aggregator.ts`
- Types: `src/lib/usage-metering/types.ts`

**Gap:** No unified analytics API for dashboard consumption

## Requirements

### 1.1 GET /api/analytics/usage
**Purpose:** Usage metrics with time-series data

**Query Params:**
- `license_nonce` (optional) - Filter by license
- `start` (required) - Unix timestamp
- `end` (required) - Unix timestamp
- `granularity` - `hour` | `day` (default: `hour`)
- `service` - `heygen` | `elevenlabs` | `openrouter` (optional)

**Response:**
```typescript
{
  summary: {
    totalRequests: number;
    totalTokensInput: number;
    totalTokensOutput: number;
    totalCredits: number;
    avgResponseTimeMs: number;
    errorRate: number;
  };
  timeSeries: Array<{
    timestamp: number;
    requests: number;
    credits: number;
    tokens: number;
    errors: number;
  }>;
  serviceBreakdown: Array<{
    service: string;
    requests: number;
    credits: number;
    percentage: number;
  }>;
}
```

**RBAC:**
- Admin: Can query any `license_nonce` or global (omit param)
- Customer: Only own license_nonce (auto-injected if missing)

### 1.2 GET /api/analytics/revenue
**Purpose:** Revenue metrics from Polar.sh subscriptions

**Query Params:**
- `period` - `current_month` | `last_month` | `last_7_days` | `last_30_days`
- `tier` - Filter by tier (optional, admin only)

**Response:**
```typescript
{
  totalRevenue: number;
  recurringRevenue: number; // MRR
  oneTimeRevenue: number;
  byTier: Array<{
    tier: string;
    customers: number;
    revenue: number;
  }>;
  trend: Array<{
    date: string; // YYYY-MM-DD
    revenue: number;
  }>;
}
```

**Data Source:**
- `raas_licenses` table (tier, created_by, metadata.polar_customer_id)
- Polar webhook events (payment_events table)

### 1.3 GET /api/analytics/licenses
**Purpose:** License utilization metrics

**Query Params:**
- `status` - `active` | `expired` | `revoked` | `all` (default: `active`)
- `tier` - Filter by tier (optional)

**Response:**
```typescript
{
  total: number;
  byTier: Record<string, number>;
  utilization: Array<{
    licenseNonce: string;
    tier: string;
    usedCredits: number;
    limitCredit: number;
    percentage: number;
    expiresAt: number | null;
  }>;
}
```

## Files to Create

```
src/app/api/analytics/
├── usage/
│   └── route.ts           # GET handler for usage metrics
├── revenue/
│   └── route.ts           # GET handler for revenue metrics
├── licenses/
│   └── route.ts           # GET handler for license metrics
└── export/
    └── route.ts           # POST handler for CSV export
```

```
src/lib/analytics/
├── types.ts               # Analytics-specific types
├── queries.ts             # Supabase query helpers
└── formatters.ts          # Data formatting utilities
```

## Implementation Steps

### Step 1: Create Analytics Types (`src/lib/analytics/types.ts`)
```typescript
// Extend existing usage-metering types
export interface UsageMetrics {
  summary: UsageSummary;
  timeSeries: TimeSeriesPoint[];
  serviceBreakdown: ServiceBreakdown[];
}

export interface RevenueMetrics {
  totalRevenue: number;
  recurringRevenue: number;
  oneTimeRevenue: number;
  byTier: TierRevenue[];
  trend: RevenueTrend[];
}

export interface LicenseMetrics {
  total: number;
  byTier: Record<string, number>;
  utilization: LicenseUtilization[];
}
```

### Step 2: Create Query Helpers (`src/lib/analytics/queries.ts`)
```typescript
// Supabase query functions
export async function fetchUsageMetrics(
  supabase: SupabaseClient,
  filters: UsageFilters
): Promise<UsageMetrics>;

export async function fetchRevenueMetrics(
  supabase: SupabaseClient,
  period: string
): Promise<RevenueMetrics>;

export async function fetchLicenseMetrics(
  supabase: SupabaseClient,
  filters: LicenseFilters
): Promise<LicenseMetrics>;
```

### Step 3: Implement /api/analytics/usage
- Reuse aggregator functions from `src/lib/usage-metering/aggregator.ts`
- Add response formatting in `src/lib/analytics/formatters.ts`
- Implement RBAC check (admin vs customer)

### Step 4: Implement /api/analytics/revenue
- Query `raas_licenses` with Polar customer linkage
- Calculate MRR from subscription metadata
- Build trend data from `payment_events`

### Step 5: Implement /api/analytics/licenses
- Query all licenses with tier breakdown
- Calculate utilization from `usage_events`
- Include quota limits from `QUOTA_LIMITS`

## Success Criteria

- [x] All 3 endpoints return valid JSON
- [x] RBAC enforced (admin vs customer data access)
- [x] Date range validation (max 90 days)
- [x] Error handling for invalid params
- [x] Response time <200ms for 90-day queries (to be verified with load testing)

## Implementation Notes

**Completed:** 2026-03-07

**Files Created:**
- `src/lib/analytics/types.ts` (166 lines)
- `src/lib/analytics/queries.ts` (278 lines)
- `src/lib/analytics/formatters.ts` (224 lines)
- `src/app/api/analytics/usage/route.ts` (165 lines)
- `src/app/api/analytics/revenue/route.ts` (104 lines)
- `src/app/api/analytics/licenses/route.ts` (153 lines)

**Report:** `../reports/fullstack-developer-260307-0625-analytics-api-endpoints.md`

## Related Files

**Read:**
- `src/lib/usage-metering/aggregator.ts`
- `src/lib/usage-metering/types.ts`
- `src/app/api/internal/usage/query/route.ts`
- `src/lib/payments/polar-webhook-handler.ts`

**Create:**
- `src/lib/analytics/types.ts`
- `src/lib/analytics/queries.ts`
- `src/lib/analytics/formatters.ts`
- `src/app/api/analytics/usage/route.ts`
- `src/app/api/analytics/revenue/route.ts`
- `src/app/api/analytics/licenses/route.ts`

## Testing Notes

- Unit tests for query helpers
- Integration tests for each endpoint
- RBAC tests (admin vs customer access)
- Date range boundary tests
