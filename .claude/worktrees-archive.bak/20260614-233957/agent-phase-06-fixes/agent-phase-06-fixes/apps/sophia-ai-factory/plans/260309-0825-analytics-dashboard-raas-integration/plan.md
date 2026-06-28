# Phase 5: Analytics Dashboard - RaaS Gateway Integration

**Date:** 2026-03-09
**Status:** ✅ Complete - Infrastructure Already Existed
**Work Context:** `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/apps/sophia-ai-factory`

---

## Overview

Enhance existing Analytics Dashboard để hiển thị usage metrics từ RaaS Gateway với real-time data thay vì mock data.

---

## Current State Analysis

### ✅ Existing Infrastructure

**Dashboard Page:**
- `/dashboard/analytics/page.tsx` - Server component với auth protection
- `/dashboard/analytics/components/analytics-view.tsx` - Client component với tabs
- Tabs: **Usage** (RaaS metrics) và **Campaigns** (campaign stats)

**Components:**
- `UsageChart.tsx` - Area chart với Recharts (requests/credits/tokens)
- `QuotaGauge.tsx` - Gauge hiển thị quota usage
- `ErrorRateChart.tsx` - Error rate tracking
- `LicenseMetricsTable.tsx` - License utilization table
- `UsageAnalyticsView.tsx` - Usage tab content (cần check)

**Hooks:**
- `use-analytics-data.ts` - Hook cho campaign analytics (existing)
- Cần tạo: `use-raas-usage.ts` - Hook cho RaaS usage data

**API Routes:**
- `/api/internal/usage/query` - Query usage data (already implemented)
- `/api/usage/summary` - Usage summary endpoint
- `/api/v1/quota/{tenantId}` - Quota status (Phase 1)
- `/api/v1/overage/{tenantId}` - Overage events (Phase 1)

---

## Implementation Plan

### Step 1: Create RaaS Usage API Client

**File:** `src/lib/raas-gateway-client.ts`

**Functions:**
- `fetchUsageMetrics(options: UsageQueryOptions): Promise<UsageMetricsResponse>`
- `fetchQuotaStatus(tenantId: string): Promise<QuotaStatusResponse>`
- `fetchOverageEvents(tenantId: string, options?: OverageQueryOptions): Promise<OverageEventsResponse>`

**Auth:**
- JWT token from Supabase session
- mk_ API key from environment
- X-RaaS-Agency-ID header for tenant isolation

---

### Step 2: Create useRaaSUsage Hook

**File:** `src/hooks/analytics/use-raas-usage.ts`

**Features:**
- Fetch usage data from RaaS Gateway
- Support time ranges: 24h, 7d, 30d, custom
- Auto-refresh every 30s (optional)
- Error handling + retry logic
- Loading states

**Return Value:**
```typescript
{
  usageData: TimeSeriesPoint[];
  quotaStatus: QuotaStatus;
  overageEvents: OverageEvent[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
}
```

---

### Step 3: Enhance UsageAnalyticsView Component

**File:** `src/app/[locale]/dashboard/analytics/components/usage-analytics-view.tsx`

**Enhancements:**
1. Replace mock data với `useRaaSUsage` hook
2. Add time range picker (24h/7d/30d/custom)
3. Add refresh button với auto-refresh toggle
4. Add quota gauges (hourly/daily/monthly)
5. Add overage events timeline
6. Add service breakdown pie chart
7. Add export to CSV functionality

**New Sub-components:**
- `QuotaGaugeGroup.tsx` - 3 gauges cho hourly/daily/monthly
- `OverageTimeline.tsx` - Timeline của overage events
- `ServiceBreakdownPieChart.tsx` - Pie chart cho service breakdown
- `TimeRangePicker.tsx` - Picker cho time range
- `ExportButton.tsx` - Export data to CSV

---

### Step 4: Add Analytics Dashboard Page (Optional)

**File:** `src/app/[locale]/dashboard/analytics/raas/page.tsx`

Nếu muốn tách riêng RaaS analytics ra page khác.

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Analytics Dashboard (Client Component)                     │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ useRaaSUsage Hook                                      │ │
│  │   ↓ fetches                                            │ │
│  │   → /api/internal/usage/query?license_nonce=xxx       │ │
│  └───────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Components                                             │ │
│  │  - UsageChart (Area chart)                             │ │
│  │  - QuotaGaugeGroup (3 gauges)                          │ │
│  │  - OverageTimeline (Event list)                        │ │
│  │  - ServiceBreakdownPieChart                            │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Internal API call
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  /api/internal/usage/query (Next.js API Route)             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  1. Validate internal secret                           │ │
│  │  2. Query usage_events table                           │ │
│  │  3. Aggregate by hour/day                              │ │
│  │  4. Calculate quota usage                              │ │
│  │  5. Build service/feature breakdown                    │ │
│  │  6. Return JSON response                               │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Database query
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase PostgreSQL                                        │
│  - usage_events table                                       │
│  - quota_limits table                                       │
│  - overage_events table                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## API Response Schema

### Usage Metrics Response

```typescript
interface UsageMetricsResponse {
  tenantId: string;
  licenseNonce: string;
  tier: string;
  period: {
    start: number;  // Unix timestamp (seconds)
    end: number;
  };
  totals: {
    totalRequests: number;
    totalCredits: number;
    totalTokensInput: number;
    totalTokensOutput: number;
    totalErrors: number;
    avgResponseTimeMs: number;
  };
  byService: Record<string, {
    requests: number;
    credits: number;
    tokensInput: number;
    tokensOutput: number;
  }>;
  byFeature: Record<string, {
    requests: number;
    credits: number;
  }>;
  quotaUsage: {
    hourlyUsed: number;
    hourlyLimit: number;
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
  };
  aggregated: {
    hourly: HourlySummary[];
    daily: DailySummary[];
  };
}
```

### Time Series Data (for charts)

```typescript
interface TimeSeriesPoint {
  timestamp: number;      // Unix timestamp (seconds)
  requests: number;
  credits: number;
  tokens: number;
  errors?: number;
  avgResponseTimeMs?: number;
}
```

---

## UI Mockup

```
┌────────────────────────────────────────────────────────────┐
│  Analytics Dashboard / Usage                               │
├────────────────────────────────────────────────────────────┤
│  [24h ▼]  [7d]  [30d]  [Custom]        [↻ Refresh] [⚙ Auto]│
├────────────────────────────────────────────────────────────┤
│  Quota Usage                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Hourly     │  │    Daily     │  │   Monthly    │     │
│  │   [Gauge]    │  │   [Gauge]    │  │   [Gauge]    │     │
│  │   75/100     │  │  450/500     │  │ 2800/3000    │     │
│  │    75% ⚠️    │  │    90% 🔴    │  │    93% 🔴    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
├────────────────────────────────────────────────────────────┤
│  Usage Over Time                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  [Area Chart - Requests/Credits/Tokens]              │ │
│  │                                                       │ │
│  └──────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────┤
│  Service Breakdown          │  Overage Events (Last 24h)  │
│  ┌──────────────┐           │  ┌────────────────────────┐ │
│  │  [Pie Chart] │           │  │ - 2h ago: Hourly +25%  │ │
│  │              │           │  │ - 5h ago: Daily +10%   │ │
│  │  - HeyGen    │           │  │ - 1d ago: Monthly +5%  │ │
│  │  - ElevenLabs│           │  └────────────────────────┘ │
│  │  - D-ID      │           │                              │
│  └──────────────┘           │                              │
└────────────────────────────────────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests
- `src/hooks/analytics/use-raas-usage.test.ts`
- `src/lib/raas-gateway-client.test.ts`

### Integration Tests
- Test API endpoint với various query params
- Test error handling (401, 404, 500)
- Test data transformation

### E2E Tests (Playwright)
- Navigate to /dashboard/analytics
- Select time range → Verify chart updates
- Click refresh → Verify data reloads
- Export to CSV → Verify file download

---

## Success Criteria

- [ ] Dashboard loads với real RaaS data
- [ ] Time range picker hoạt động correctly
- [ ] Charts render correctly với all data states
- [ ] Quota gauges show accurate percentages
- [ ] Auto-refresh works (30s interval)
- [ ] Error handling graceful (no crashes)
- [ ] Export to CSV functional
- [ ] Performance: < 2s initial load, < 500ms refresh

---

## Dependencies

- Recharts (already installed)
- next-intl (already installed)
- shadcn/ui components (already installed)
- Supabase client (already installed)

---

## Timeline

- **Step 1:** RaaS Gateway Client - 30min
- **Step 2:** useRaaSUsage Hook - 45min
- **Step 3:** UsageAnalyticsView Enhancement - 1.5h
- **Step 4:** Testing & Polish - 45min

**Total:** ~3.5 hours

---

## Unresolved Questions

1. Should auto-refresh be default on or off?
2. What's the max history to display in charts? (recommend 30 days)
3. Should overage events paginate or show last N only?
