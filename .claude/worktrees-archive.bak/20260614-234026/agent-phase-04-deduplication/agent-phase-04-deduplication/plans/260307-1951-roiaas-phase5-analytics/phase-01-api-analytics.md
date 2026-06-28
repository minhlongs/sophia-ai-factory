---
title: "Phase 01 — Analytics API Enhancement"
description: "Củng cố analytics API endpoints cho usage, revenue, và license metrics"
status: pending
priority: P2
effort: 2h
---

# Phase 01 — Analytics API Enhancement

**Context:**
- Research: `plans/reports/researcher-260307-1943-roiaas-analytics.md`
- Existing API: `src/app/api/analytics/usage/route.ts`, `revenue/route.ts`, `licenses/route.ts`
- Queries: `src/lib/analytics/queries.ts`
- Types: `src/lib/analytics/types.ts`

---

## Overview

Cải thiện analytics API endpoints để hỗ trợ đầy đủ usage, revenue, và license metrics với RBAC proper.

---

## Key Insights

1. **Revenue API đã tồn tại** nhưng cần verify logic tính MRR từ Polar metadata
2. **Usage API** đang query trực tiếp `usage_events` — cần optimize với indexes
3. **License Metrics** cần include utilization rate từ `usage_quota_usage` table

---

## Requirements

### Functional

1. **Usage API** (`/api/analytics/usage`)
   - Query params: `start`, `end`, `granularity` (hour/day), `service`, `licenseNonce`
   - Response: `summary`, `timeSeries`, `serviceBreakdown`
   - RBAC: User chỉ xem data của license mình sở hữu

2. **Revenue API** (`/api/analytics/revenue`)
   - Query params: `period` (current_month, last_month, last_7_days, last_30_days), `tier` (admin-only)
   - Response: `totalRevenue`, `recurringRevenue` (MRR), `oneTimeRevenue`, `byTier`, `trend`
   - RBAC: ENTERPRISE+ hoặc admin

3. **License API** (`/api/analytics/licenses`)
   - Query params: `status` (active/expired/revoked/all), `tier` (admin-only)
   - Response: `total`, `byTier`, `utilization` (với % quota usage)
   - RBAC: Admin xem tất cả, user chỉ xem license của mình

### Non-Functional

- Response time < 500ms cho queries < 30 ngày
- SWR caching: 60s deduping, revalidateOnFocus = false
- Error handling: 400 cho invalid params, 403 cho RBAC failures

---

## Related Code Files

**Modify:**
- `src/lib/analytics/queries.ts` — Optimize queries, add indexes
- `src/app/api/analytics/usage/route.ts` — Enhance usage endpoint
- `src/app/api/analytics/revenue/route.ts` — Verify MRR calculation
- `src/app/api/analytics/licenses/route.ts` — Add utilization data

**Create:**
- `src/lib/analytics/cache.ts` — Cache helpers cho SWR (optional)

---

## Implementation Steps

### Step 1: Database Indexes

```sql
-- Tạo indexes để optimize analytics queries
CREATE INDEX IF NOT EXISTS idx_usage_events_license_nonce ON usage_events(license_nonce, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_service ON usage_events(service_name, created_at);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_tier ON raas_licenses(tier, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_events_processed ON payment_events(processed, created_at);
```

### Step 2: Enhance Usage Query

File: `src/lib/analytics/queries.ts`

```typescript
export async function fetchUsageMetrics(filters: UsageFilters): Promise<UsageMetrics> {
  // Current implementation đã tốt, nhưng cần:
  // 1. Add logging cho query performance
  // 2. Handle edge cases (empty data, invalid timestamps)
  // 3. Optimize với batch queries nếu có thể
}
```

### Step 3: Verify Revenue Calculation

File: `src/lib/analytics/queries.ts`

```typescript
export async function fetchRevenueMetrics(period: RevenuePeriod): Promise<RevenueMetrics> {
  // Verify logic:
  // 1. MRR từ Polar subscription metadata
  // 2. One-time revenue từ MASTER tier purchases
  // 3. Trend data từ payment_events
}
```

### Step 4: License Utilization

File: `src/lib/analytics/queries.ts`

```typescript
export async function fetchLicenseMetrics(filters: LicenseFilters): Promise<LicenseMetrics> {
  // Include utilization % từ usage_quota_usage table
  // Join với usage_events để tính actual usage
}
```

### Step 5: API Route Handlers

Files: `src/app/api/analytics/*/route.ts`

- Add request logging
- Enhance error messages
- Add rate limiting (optional)

---

## Todo Checklist

- [ ] Chạy SQL tạo indexes
- [ ] Enhance `fetchUsageMetrics` với better error handling
- [ ] Verify `fetchRevenueMetrics` MRR calculation
- [ ] Add utilization % vào `fetchLicenseMetrics`
- [ ] Test API endpoints với Postman/curl
- [ ] Add logging cho query performance

---

## Success Criteria

- [ ] `/api/analytics/usage` returns data < 500ms
- [ ] `/api/analytics/revenue` tính đúng MRR từ Polar metadata
- [ ] `/api/analytics/licenses` includes utilization %
- [ ] RBAC hoạt động đúng (user không xem được data người khác)
- [ ] Error messages rõ ràng, HTTP status codes proper

---

## Security Considerations

1. **RBAC Verification:**
   - `verifyLicenseAccess()` phải check user sở hữu license
   - Admin-only endpoints phải reject non-admin requests

2. **Input Validation:**
   - Validate date ranges (max 90 days)
   - Sanitize tier/service params

3. **Rate Limiting:**
   - Consider rate limit analytics API (100 req/min per user)

---

## Next Steps

→ Phase 02: Dashboard UI components
→ Phase 03: ROI Calculator logic
→ Phase 04: Data visualizations với Recharts
