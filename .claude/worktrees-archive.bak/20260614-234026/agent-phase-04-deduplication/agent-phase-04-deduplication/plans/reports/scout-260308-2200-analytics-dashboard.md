# Analytics Dashboard Scout Report

**Date:** 2026-03-08  
**Scout Agent:** Explore  
**Purpose:** Understand existing analytics dashboard implementation for agencyos.network/analytics

---

## 1. FILE LOCATIONS & STRUCTURE

### Admin Analytics (`/admin/analytics/usage`)
| File Path | Purpose |
|-----------|---------|
| `apps/sophia-ai-factory/src/app/[locale]/(admin)/admin/analytics/usage/page.tsx` | Main admin dashboard page |
| `apps/sophia-ai-factory/src/components/analytics/QuotaGauge.tsx` | Quota utilization gauge visualization |
| `apps/sophia-ai-factory/src/components/analytics/UsageChart.tsx` | Time-series usage chart (Recharts) |
| `apps/sophia-ai-factory/src/components/analytics/ErrorRateChart.tsx` | Error rate trends chart |
| `apps/sophia-ai-factory/src/components/analytics/LicenseMetricsTable.tsx` | Per-license metrics table |

### User Dashboard Analytics (`/dashboard/analytics`)
| File Path | Purpose |
|-----------|---------|
| `apps/sophia-ai-factory/src/app/[locale]/dashboard/analytics/page.tsx` | Main user analytics page |
| `apps/sophia-ai-factory/src/app/[locale]/dashboard/analytics/components/analytics-view.tsx` | Main analytics view component |
| `apps/sophia-ai-factory/src/app/[locale]/dashboard/analytics/components/usage-analytics-view.tsx` | Usage metrics view with export |

### API Routes
| Endpoint | Purpose |
|----------|---------|
| `GET /api/analytics/usage` | Usage metrics with time-series data |
| `GET /api/analytics/licenses` | License utilization metrics |
| `GET /api/analytics/revenue` | Revenue and MRR metrics |
| `GET /api/analytics/roi` | ROI metrics per license |
| `POST /api/analytics/export` | Export usage data (CSV) |
| `POST /api/graphql/analytics` | GraphQL analytics queries |

### Analytics Types & Queries
| File Path | Purpose |
|-----------|---------|
| `apps/sophia-ai-factory/src/lib/analytics/types.ts` | Type definitions |
| `apps/sophia-ai-factory/src/lib/analytics/queries.ts` | Supabase query helpers |
| `apps/sophia-ai-factory/src/lib/analytics/rbac.ts` | Role-based access control |

### Validation
| File Path | Purpose |
|-----------|---------|
| `apps/sophia-ai-factory/src/lib/validation/services.ts` | Zod schemas for API validation |

---

## 2. COMPONENT ARCHITECTURE

### Client-Side Components

```
analytics/
├── usageanalyticsView.tsx          # User-facing usage dashboard
├── metrics-cards.tsx               # Summary stats cards
├── usage-chart.tsx                 # Time-series line/area chart
├── QuotaGauge.tsx                  # Radial bar quota gauges
├── ErrorRateChart.tsx              # Error count + rate over time
├── LicenseMetricsTable.tsx         # Per-license sortable table
├── export-button.tsx               # CSV/PNG export UI
├── tier-filter.tsx                 # Tier selector (admin)
├── customer-search.tsx             # Customer ID search (admin)
├── date-range-picker.tsx           # Calendar-based date range
├── service-breakdown.tsx           # Service usage pie chart
└── license-utilization.tsx         # Tier-based utilization display
```

### UI Library
- **Recharts** - Chart visualization
- **shadcn/ui** - Card, Table, Button, Select, Badge components
- **react-day-picker** - Date range picker
- **Tailwind CSS 4** - Styling with custom CSS variables

---

## 3. DATA FLOW ARCHITECTURE

### Data Pipeline
```
Supabase (usage_events table)
    ↓
queries.ts (fetchUsageMetrics, fetchLicenseMetrics)
    ↓
API Routes (GET /api/analytics/*)
    ↓
Client Components (UsageAnalyticsView, LicenseMetricsTable)
    ↓
Recharts Visualization
```

### Query Flow Example (Usage Metrics)
1. User opens `/admin/analytics/usage` page
2. Page calls `fetchUsageMetrics({ start, end, granularity, licenseNonce })`
3. `fetchUsageMetrics` queries `usage_events` table via Supabase admin client
4. Data aggregated by hour/day into time-series
5. Response includes: `summary`, `timeSeries`, `serviceBreakdown`
6. React components render guages, charts, and tables

---

## 4. API ENDPOINTS

### `/api/analytics/usage - GET`

**Query Params:**
- `start` (required) - Unix timestamp
- `end` (required) - Unix timestamp  
- `granularity` - 'hour' | 'day' (default: 'hour')
- `license_nonce` (optional) - Filter by license
- `service` - 'heygen' | 'elevenlabs' | 'openrouter' (optional)

**RBAC:**
- **Admin** - Can query any license or global (omit license_nonce)
- **Customer** - Only own license_nonce (auto-injected)

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
  timeSeries: {
    timestamp: number;
    requests: number;
    credits: number;
    tokens: number;
    errors: number;
  }[];
  serviceBreakdown: {
    service: string;
    requests: number;
    credits: number;
    percentage: number;
  }[];
  metadata: { queriedAt: string; period: {start, end}; granularity; service };
}
```

### `/api/analytics/licenses - GET`

**Query Params:**
- `status` - 'active' | 'expired' | 'revoked' | 'all' (default: 'active')
- `tier` - Filter by tier (optional)
- `license_nonce` - Filter by specific license (optional)

**RBAC:**
- **Admin** - Full access, can filter by status/tier
- **Customer** - Only own license data

**Response:**
```typescript
{
  total: number;
  byTier: Record<string, number>;
  utilization: {
    licenseNonce: string;
    tier: string;
    usedCredits: number;
    limitCredit: number;
    percentage: number;
    expiresAt: number | null;
    overageCount?: number;
    billableCount?: number;
    overageCredits?: number;
  }[];
}
```

### `/api/analytics/revenue - GET`
### `/api/analytics/roi - GET`
### `/api/analytics/export - POST`
### `/api/graphql/analytics - POST`

---

## 5. AUTHENTICATION & AUTHORIZATION

### Authentication Flow (Middleware)
```
Middleware (src/middleware.ts)
    ↓
Check /admin path → Basic Auth (ADMIN_USER/ADMIN_PASS)
Check /dashboard path → Supabase Magic Link Auth
    ↓
getCurrentUser() → Returns User | null
```

### Auth Implementation
| Component | File | Mechanism |
|-----------|------|-----------|
| **Current User** | `lib/auth.ts` | `getCurrentUser()` - Supabase Auth.getUser() |
| **Admin Check** | `lib/analytics/rbac.ts` | `checkAdmin(userId)` - MASTER tier or role='admin' |
| **License Access** | `lib/analytics/rbac.ts` | `verifyLicenseAccess(userId, nonce)` |
| **License Nonce** | `lib/analytics/rbac.ts` | `getUserLicenseNonce(userId)` |

### RBAC Feature Matrix

| Feature | BASIC | PREMIUM | ENTERPRISE | MASTER/Admin |
|---------|-------|---------|------------|--------------|
| Custom date range | ✗ | ✓ | ✓ | ✓ |
| Time series | ✓ | ✓ | ✓ | ✓ |
| Tier breakdown | ✗ | ✗ | ✓ | ✓ |
| Customer table | ✗ | ✗ | ✗ | ✓ |
| Revenue metrics | ✗ | ✗ | ✗ | ✓ |
| Export | ✗ | ✓ | ✓ | ✓ |
| Auto-refresh | ✗ | ✗ | ✓ | ✓ |
| ROI metrics | ✗ | ✗ | ✗ | ✓ |

---

## 6. DESIGN SYSTEM

### Color Variables
| Variable | Purpose |
|----------|---------|
| `--neon-cyan` | Primary brand color |
| `--neon-purple` | Secondary color for credits |
| `--neon-red` | Error/critical states |
| `--neon-orange` | Warning states |
| `--neon-yellow` | Moderate warning |
| `--muted` | Background/placeholder |

### Card Component
```tsx
<Card glass={true} hover={true}>  // Glassmorphism option
  <CardHeader>
    <CardTitle>{title}</CardTitle>
    <CardDescription>{description}</CardDescription>
  </CardHeader>
  <CardContent>{children}</CardContent>
</Card>
```

### Chart Patterns
- **AreaChart** - Usage trends over time
- **RadialBarChart** - Quota gauges
- **BarChart** - Error rates
- **Custom tooltips** - Formatted number display

---

## 7. TENANT ISOLATION

### Implementation Strategy
1. **Supabase RLS Policies** - Database-level row isolation
2. **License Nonce Linkage** - Each usage event tied to license
3. **User ID Tracking** - `created_by` field on raas_licenses

### RLS Example (overage_events)
```sql
CREATE POLICY "Users can view own overage events"
  ON overage_events FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );
```

### API-Level Isolation
```typescript
// Admin: Check user role via admin client
const isAdmin = await checkAdmin(user.id);

// Customer: Auto-inject user's license nonce
if (!isAdmin) {
  queryLicenseNonce = await getUserLicenseNonce(user.id) || undefined;
}
```

---

## 8. DATABASE SCHEMA

### Main Tables
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `usage_events` | Raw usage data | user_id, license_nonce, service_name, action, credits_used, status_code, created_at |
| `raas_licenses` | License management | nonce, tier, is_revoked, created_by, expires_at |
| `usage_hourly_summary` | Hourly rollup | hour_timestamp, tenant_id, total_requests, total_credits |
| `usage_daily_summary` | Daily rollup | day_timestamp, tenant_id, total_requests, total_credits |
| `usage_quota_usage` | Quota tracking | window_type, window_start, credits_used |
| `overage_events` | Quota exceeded | exceeded_type, exceeded_by, billable |
| `quota_limits` | Custom limits | custom_daily_credits, overage_allowed |
| `export_jobs` | Export audit trail | license_nonce, record_count, success, error_message |
| `payment_events` | Revenue tracking | event_type, payload->>amount, processed |

### Data Model Relationships
```
auth.users (id)
    ↓ (created_by)
raas_licenses (created_by → user_id)
    ↓ (license_nonce)
usage_events (license_nonce → raas_licenses.nonce)
    ↓ (aggregation)
usage_hourly_summary, usage_daily_summary

raas_licenses
    ↓ (license_nonce)
overage_events (license_nonce → raas_licenses.nonce)
    ↓
quota_limits (license_nonce → raas_licenses.nonce)
```

---

## 9. REAL-TIME TRACKING (Redis)

### File: `lib/usage-metering/realtime-tracker.ts`

**Features:**
- Redis/Upstash for sub-second counters
- Circuit breaker pattern for quota failures
- Fail-closed mode (block on circuit open)
- Emergency bypass header (`X-Emergency-Bypass`)

**Key Functions:**
| Function | Purpose |
|----------|---------|
| `trackWithCircuitBreaker()` | Track with CB protection |
| `getRealTimeUsage()` | Get Redis counter |
| `updateRealTimeUsage()` | Increment counter |
| `canPassCircuitBreaker()` | Check CB state |
| `recordCircuitFailure()` | Log circuit breaker event |
| `invalidateRealTimeCache()` | Clear counter after DB insert |

**Circuit States:**
- `closed` - Allow requests
- `open` - Block requests (fail-closed)
- `half-open` - Allow limited test requests

---

## 10. PROBLEM SPACES & GAPS

### Identified Gaps for Real-Time Dashboard

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| No WebSockets for live updates | Dashboard stale until manual refresh | Add WebSockets or polling 10-30s |
| No client-side caching | Re-fetches on every tab switch | Add React Query or SWR |
| No data inset/perspective controls | Limited single-user view | Add multi-tenant selector for admin |
| No export for license metrics table | Manual copy/paste needed | Extend export to include license table |
| No tier-based throttling on API | Heavy queries can hit DB | Add queryResultSize limit per tier |
| No benchmarking/SLA tracking | Unknown performance baselines | Add query duration metrics |

### Performance Considerations

| Issue | Current State | Risk |
|-------|---------------|------|
| No pagination on license table | Loads ALL licenses | OOM for 10k+ licenses |
| N+1 queries for utilization | Loop calls for each license | Slow for large tenant base |
| No index on some analytics queries | Full table scans | Slow >100k events |

### Recommended Optimizations

1. **Add pagination** to LicenseMetricsTable
2. **Query batching** - fetch all license utilizations in single query
3. **Redis caching** - cache aggregated summaries (1-5 min TTL)
4. **Materialized views** - pre-compute daily summaries
5. **Limit max date range** - enforce 90-day cap client-side

---

## 11. COMPONENT USAGE CONTEXT

### Real-World Usage

**Admin Dashboard** (`/admin/analytics/usage`)
- Purpose: Monitor all tenants' usage, quota health, error trends
- User: Platform admin
- Auth: Basic Auth (ADMIN_USER/ADMIN_PASS)

**User Dashboard** (`/dashboard/analytics`)
- Purpose: View own usage, export reports
- User: License holder (customer)
- Auth: Supabase Magic Link

### Tier-Based UX

| Tier | Analytics Access |
|------|------------------|
| BASIC | Usage chart (basic), metrics cards, no export |
| PREMIUM | Full metrics, export enabled |
| ENTERPRISE | All features + auto-refresh + ROI |
| MASTER/Admin | All features + customer table + tier breakdown |

---

## 12. RECOMMENDATIONS FOR agencyos.network/analytics

### Phase 1: Real-Time Updates (Critical)
1. Add polling (30s) or Server-Sent Events for live data
2. Implement React Query for caching
3. Add loading skeleton states

### Phase 2: Admin Enhancements (High Priority)
1. Multi-tenant selector dropdown
2. Export license metrics table
3. Benchmarking dashboard (response times, success rates)

### Phase 3: Advanced Metrics (Medium Priority)
1. API latency percentiles (P50, P95, P99)
2. Error categorization (4xx vs 5xx)
3. Service-specific analytics

### Phase 4: Billing Integration (must-have)
1. Show overage costs in real-time
2. Preview next billing period usage
3. Budget alerts at 80% threshold

---

## 13. REPORT INVENTORY

| Report | Location | Date |
|--------|----------|------|
| Analytics Deployment Verify | plans/reports/analytics-deployment-verify-260307-1700.md | 2026-03-07 |
| Client Assessment | plans/reports/client-assessment-260129-2058-ai-video-affiliate-platform.md | 2026-01-29 |
| **Scout: Analytics Dashboard** | plans/reports/scout-260308-2200-analytics-dashboard.md | 2026-03-08 |

---

## 14. QUERY REFERENCE

### Verification Queries
```sql
-- Count events by license
SELECT license_nonce, COUNT(*) as requests, SUM(credits_used) as credits
FROM usage_events WHERE created_at > EXTRACT(EPOCH FROM NOW()) - 86400
GROUP BY license_nonce ORDER BY credits DESC;

-- Check quota utilization per tier
SELECT tier, COUNT(*) as licenses, SUM(credits_used) as total_credits
FROM raas_licenses r
LEFT JOIN usage_events u ON r.nonce = u.license_nonce
GROUP BY tier;

-- Monitor overage events
SELECT license_nonce, COUNT(*) as overages
FROM overage_events WHERE created_at > EXTRACT(EPOCH FROM NOW()) - 86400
GROUP BY license_nonce HAVING COUNT(*) > 5;
```

---

**Report generated by Explore agent**  
**Source files scanned:** 30+ files across api/, lib/, components/, app/  
**Total lines analyzed:** ~2500 lines of TypeScript/SQL

