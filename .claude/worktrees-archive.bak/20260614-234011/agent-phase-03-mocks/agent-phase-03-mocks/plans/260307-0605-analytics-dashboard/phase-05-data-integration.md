---
title: "Phase 5: Data Integration"
status: completed
priority: P1
effort: 2h
completed: 2026-03-07
---

# Phase 5: Data Integration

## Context

**Existing Data Sources:**
- Usage events: `usage_events` table (Supabase)
- Licenses: `raas_licenses` table
- Payment events: `payment_events` table (Polar webhooks)
- User profiles: `user_profiles` table

**Research:** Report Section 3 (Usage Metering), Section 4 (Billing Integration)

## Requirements

### 5.1 Usage Data Pipeline

**Flow:**
```
Gateway Instrumentation → Usage Events → Aggregator → Analytics API → Dashboard
```

**Existing:**
- `src/lib/usage-metering/gateway-instrumentation.ts` - Captures usage
- `src/lib/usage-metering/tracker.ts` - Records events
- `src/lib/usage-metering/aggregator.ts` - Aggregates by hour/day

**Integration Point:**
```typescript
// src/lib/analytics/queries.ts
import { aggregateUsageEvents, buildHourlySummary } from '@/lib/usage-metering/aggregator';

export async function fetchUsageMetrics(
  supabase: SupabaseClient,
  userId: string,
  licenseNonce: string,
  start: number,
  end: number
) {
  // Fetch raw events
  const { data: events } = await supabase
    .from('usage_events')
    .select('*')
    .eq('user_id', userId)
    .eq('license_nonce', licenseNonce)
    .gte('created_at', start)
    .lte('created_at', end);

  // Reuse aggregator
  const aggregated = aggregateUsageEvents(events || [], 'hour');
  const hourly = buildHourlySummary(aggregated);

  // Format for dashboard
  return formatUsageMetrics(hourly);
}
```

### 5.2 Revenue Data Sync

**Source:** Polar webhook events → `payment_events` table

**Query Pattern:**
```typescript
// src/lib/analytics/queries.ts
export async function fetchRevenueMetrics(
  supabase: SupabaseClient,
  period: 'current_month' | 'last_month' | 'last_30_days'
) {
  const { start, end } = getDateRange(period);

  // Get payment events
  const { data: events } = await supabase
    .from('payment_events')
    .select('payload, created_at')
    .eq('event_type', 'checkout.updated')
    .gte('created_at', start)
    .lte('created_at', end);

  // Extract revenue from payload
  const revenueByTier = {};
  let totalRevenue = 0;

  for (const event of events || []) {
    const payload = event.payload as any;
    const amount = payload.checkout?.total_amount?.amount || 0;
    const tier = payload.metadata?.tier || 'BASIC';

    revenueByTier[tier] = (revenueByTier[tier] || 0) + amount;
    totalRevenue += amount;
  }

  return {
    totalRevenue,
    byTier: Object.entries(revenueByTier).map(([tier, revenue]) => ({
      tier,
      revenue,
      customers: 1, // Simplified
    })),
  };
}
```

### 5.3 License Utilization

**Query:**
```typescript
export async function fetchLicenseUtilization(
  supabase: SupabaseClient,
  filters: { status?: string; tier?: string }
) {
  // Get all licenses
  let query = supabase
    .from('raas_licenses')
    .select('nonce, tier, created_by, expires_at, is_revoked');

  if (filters.status === 'active') {
    query = query.eq('is_revoked', false).gt('expires_at', Math.floor(Date.now() / 1000));
  }

  if (filters.tier) {
    query = query.eq('tier', filters.tier);
  }

  const { data: licenses } = await query;

  // Get usage for each license
  const utilization = await Promise.all(
    licenses?.map(async (license) => {
      const { data: usage } = await supabase
        .from('usage_events')
        .select('credits_used')
        .eq('license_nonce', license.nonce)
        .gte('created_at', Math.floor(Date.now() / 1000) - 86400 * 30); // Last 30 days

      const usedCredits = usage?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0;
      const limitCredit = QUOTA_LIMITS[license.tier]?.monthlyCredits || 0;

      return {
        licenseNonce: license.nonce,
        tier: license.tier,
        usedCredits,
        limitCredit,
        percentage: limitCredit > 0 ? (usedCredits / limitCredit) * 100 : 0,
        expiresAt: license.expires_at,
      };
    }) || []
  );

  return {
    total: licenses?.length || 0,
    byTier: licenses?.reduce((acc, l) => {
      acc[l.tier] = (acc[l.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    utilization,
  };
}
```

### 5.4 Real-Time Updates

**Pattern with SWR:**
```typescript
// src/app/[locale]/dashboard/analytics/hooks/use-analytics-data.ts
'use client';

import useSWR from 'swr';

export function useAnalyticsData(
  licenseNonce: string | null,
  start: number,
  end: number,
  options: { autoRefresh?: boolean; refreshInterval?: number } = {}
) {
  const { autoRefresh = false, refreshInterval = 60000 } = options;

  const url = `/api/analytics/usage?start=${start}&end=${end}${
    licenseNonce ? `&license_nonce=${licenseNonce}` : ''
  }`;

  const { data, error, mutate } = useSWR(url, fetcher, {
    dedupingInterval: 30000,
    refreshInterval: autoRefresh ? refreshInterval : 0,
    revalidateOnFocus: false,
  });

  return {
    data,
    loading: !error && !data,
    error,
    refresh: mutate,
  };
}
```

**Pattern with React Query (alternative):**
```typescript
// Using React Query for more complex caching
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function useUsageQuery(
  licenseNonce: string,
  start: number,
  end: number
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['analytics', 'usage', licenseNonce, start, end],
    queryFn: async () => {
      const res = await fetch(
        `/api/analytics/usage?license_nonce=${licenseNonce}&start=${start}&end=${end}`
      );
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}
```

### 5.5 Data Export

**Endpoint:** `POST /api/analytics/export`

```typescript
// src/app/api/analytics/export/route.ts
import { generateCsvRows, rowsToCsv } from '@/lib/usage-metering/aggregator';

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { format, dateRange, customerId } = body;

  // RBAC check
  const userTier = await getUserTier(user.id);
  const isAdmin = await checkAdmin(user.id);

  if (userTier === 'BASIC' && !isAdmin) {
    return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
  }

  // Fetch data
  const { data: events } = await supabase
    .from('usage_events')
    .select('*')
    .eq('user_id', customerId || user.id)
    .gte('created_at', dateRange.start)
    .lte('created_at', dateRange.end);

  // Generate export
  if (format === 'csv') {
    const rows = generateCsvRows(events || []);
    const csv = rowsToCsv(rows);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="analytics-${dateRange.start}-${dateRange.end}.csv"`,
      },
    });
  }

  // PDF export (use @react-pdf/renderer or similar)
  // ...

  return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
}
```

## Files to Create/Modify

**Create:**
```
src/lib/analytics/
├── queries.ts              # Data fetching functions
├── formatters.ts           # Data formatting utilities
└── export.ts               # Export helpers (CSV/PDF)
```

**Modify:**
```
src/app/api/analytics/usage/route.ts       # Connect to usage-metering
src/app/api/analytics/export/route.ts      # Implement export
```

## Implementation Steps

### Step 1: Create Query Helpers
- `fetchUsageMetrics()` - Usage data from aggregator
- `fetchRevenueMetrics()` - Revenue from payment_events
- `fetchLicenseUtilization()` - License usage stats

### Step 2: Create Formatters
- `formatUsageMetrics()` - Format for charts
- `formatRevenueMetrics()` - Format for revenue cards
- `formatLicenseUtilization()` - Format for tables

### Step 3: Implement Export
- CSV export using existing `rowsToCsv()`
- PDF export (optional, use @react-pdf/renderer)

### Step 4: Set Up Real-Time Updates
- Configure SWR with refresh interval
- Add manual refresh button

### Step 5: Test Data Flow
- Verify aggregator integration
- Test with large datasets (90 days)

## Success Criteria

- [ ] Usage data matches aggregator output
- [ ] Revenue metrics calculate correctly from Polar events
- [ ] License utilization shows accurate percentages
- [ ] Real-time refresh works (60s interval)
- [ ] CSV export downloads correctly

## Related Files

**Read:**
- `src/lib/usage-metering/aggregator.ts`
- `src/lib/usage-metering/export.ts`
- `src/lib/payments/polar-webhook-handler.ts`

**Create:**
- `src/lib/analytics/queries.ts`
- `src/lib/analytics/formatters.ts`
- `src/lib/analytics/export.ts`
