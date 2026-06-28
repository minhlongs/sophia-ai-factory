# Analytics Dashboard Implementation Research

**Date:** 2026-03-07
**Work Context:** `/apps/sophia-ai-factory`
**Report File:** `researcher-analytics-dashboard-260307-0605.md`

---

## Executive Summary

Sophia AI Factory's existing analytics implementation uses **Recharts** (v3.7.0) with Next.js App Router. The codebase already has a functional dashboard with tier-based feature gating and usage metering integration via `/api/internal/usage/query` and `/api/usage/summary`. This report provides implementation patterns for expanding analytics capabilities.

---

## 1. Charting Library: Recharts (Selected)

### Current State
- **Library:** Recharts v3.7.0 (already in `package.json`)
- **Files:** `src/app/[locale]/dashboard/analytics/components/charts.tsx`
- **Pattern:** Lazy-loaded components with `next/dynamic`

### Why Recharts Was Selected

| Criterion | Recharts | Chart.js | Visx |
|-----------|----------|----------|------|
| Bundle Size | ~45KB gzipped | ~48KB gzipped | ~30KB+ (modular) |
| SSR Support | Full (ssr: false safe) | Full | Full |
| TypeScript Types | Excellent | Good | Excellent |
| Customization | High (SVG-based) | Medium | High |
| Learning Curve | Low-Medium | Low | Medium-High |

### Current Chart Patterns

```tsx
// src/app/[locale]/dashboard/analytics/components/charts.tsx
import { PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function StatusDistributionChart({ data }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" label>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
```

### Recommendation
**Keep Recharts** - It's already integrated, has excellent TypeScript support, and handles responsive charts well for App Router.

---

## 2. RBAC Implementation Pattern

### Current Implementation

**File:** `src/lib/tier-guard.ts`

```tsx
// Tier-based access control structure
export type LimitType =
  | "youtubeChannels"
  | "videoTemplates"
  | "trainingSessions"
  | "automationScripts"
  | "affiliateDashboard"
  | "adminDashboard"
  | "apiAccess"
  | "earlyAccess";

export const tierGuard = {
  async checkLimit(userId: string, limitType: LimitType): Promise<LimitCheckResult> {
    const userTier = await getUserTier(userId);
    const config = getTierConfig(userTier);

    if (userTier === "MASTER") {
      return { allowed: true, limit: Infinity, ... };
    }

    // Switch cases for each limit type
    switch (limitType) {
      case "youtubeChannels":
        return { allowed: config.limits.youtubeChannels > currentUsage, ... };
      // ...
    }
  }
};
```

**File:** `src/lib/features.ts`

```tsx
export function checkTierAccess(tier: Tier, feature: FeatureFlag): AccessCheck {
  if (!getFeatureFlag(feature)) {
    return { hasAccess: false, reason: "Feature disabled" };
  }

  if (!tierHasFeature(tier, feature)) {
    return {
      hasAccess: false,
      reason: `Requires ${getRequiredTierForFeature(feature)} tier`,
      requiredTier: getRequiredTierForFeature(feature)
    };
  }

  return { hasAccess: true };
}
```

### RBAC Middleware Pattern

```tsx
// src/app/[locale]/dashboard/analytics/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkTierAccess, getRequiredTierForFeature } from '@/lib/features';
import { getUserTier } from '@/lib/subscription';

export async function analyticsMiddleware(request: NextRequest) {
  const { pathname } = new URL(request.url);

  // Skip public routes
  if (pathname === '/api/usage/summary' || pathname === '/api/internal/usage/query') {
    return NextResponse.next();
  }

  // Get user tier
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const userTier = await getUserTier(user.id);
  const requiresTier = getRequiredTierForFeature('enable_advanced_analytics');

  if (!checkTierAccess(userTier, 'enable_advanced_analytics').hasAccess) {
    return NextResponse.json(
      { error: 'Upgrade required', requiredTier: requiresTier },
      { status: 403 }
    );
  }

  return NextResponse.next();
}
```

### Usage in Page Component

```tsx
// src/app/[locale]/dashboard/analytics/page.tsx
export default async function AnalyticsPage() {
  const { session } = await supabase.auth.getSession();

  if (!session?.user) {
    return redirect('/login');
  }

  const userTier = await getUserTier(session.user.id);

  // Check license ownership for internal queries
  if (licenseNonce && !isAdmin) {
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('created_by')
      .eq('nonce', license_nonce)
      .single();

    if (license?.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return <AnalyticsView campaigns={campaigns} userTier={userTier} />;
}
```

### Row-Level Security (RLS) Pattern

**Supabase RLS Policy:**

```sql
-- User can only see their own usage data
CREATE POLICY "-users can view own usage"
ON usage_events
FOR SELECT
USING (auth.uid() = user_id);

-- Admin can view all usage data
CREATE POLICY "admin can view all usage"
ON usage_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

---

## 3. Usage Metering Integration

### Current API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/internal/usage/query` | GET | Admin/internal billing queries |
| `/api/usage/summary` | GET | User-owned usage queries |
| `/api/usage/export` | GET | CSV export |

### Query Patterns for Aggregation

**Internal Query API: `/internal/usage/query`**

```tsx
// GET /api/internal/usage/query?license_nonce={nonce}&start={ts}&end={ts}&format=summary

const query = supabase
  .from('usage_events')
  .select('*')
  .eq('user_id', queryUserId)
  .eq('license_nonce', queryLicenseNonce!)
  .gte('created_at', startTimestamp)
  .lte('created_at', endTimestamp);

const { data: events } = await query;

// Manual aggregation (no pre-built rollup tables)
const hourlyMap = new Map<number, HourlySummary>();

for (const event of events) {
  const hourTs = Math.floor(event.created_at / 3600) * 3600;
  // ... aggregation logic
}
```

### Date Range Filtering

```tsx
// src/app/api/internal/usage/query/route.ts
const MAX_DATE_RANGE_DAYS = 90; // Prevent expensive full-table scans

if (endTimestamp - startTimestamp > MAX_DATE_RANGE_DAYS * 86400) {
  return NextResponse.json({
    error: `Date range exceeds maximum of ${MAX_DATE_RANGE_DAYS} days`
  }, { status: 400 });
}
```

**Supported Periods:**

```tsx
// src/lib/usage-metering/export.ts
const date = new Date();

switch (period) {
  case 'current_month':
    startTimestamp = Math.floor(new Date(date.getFullYear(), date.getMonth(), 1).getTime() / 1000);
    break;
  case 'last_month':
    date.setMonth(date.getMonth() - 1);
    startTimestamp = Math.floor(new Date(date.getFullYear(), date.getMonth(), 1).getTime() / 1000);
    endTimestamp = Math.floor(new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime() / 1000);
    break;
  case 'last_7_days':
    startTimestamp = now - (7 * 86400);
    break;
  case 'last_30_days':
    startTimestamp = now - (30 * 86400);
    break;
}
```

### Usage Aggregation Query (Real Example)

```tsx
// src/lib/usage-metering/aggregator.ts
export function aggregateUsageEvents(
  events: Array<{
    user_id: string;
    license_nonce: string;
    service_name: string;
    action: string;
    credits_used: number;
    tokens_input: number;
    tokens_output: number;
    response_time_ms: number | null;
    status_code: number | null;
    created_at: number;
  }>,
  windowSize: 'hour' | 'day' = 'hour'
): AggregatedUsage[] {
  const aggregationMap = new Map<string, AggregatedUsage>();

  for (const event of events) {
    const timestamp = windowSize === 'hour'
      ? Math.floor(event.created_at / 3600) * 3600
      : Math.floor(event.created_at / 86400) * 86400;

    const featureKey = `${event.service_name}.${event.action}`;
    const key = `${event.user_id}:${event.license_nonce}:${featureKey}:${timestamp}`;

    const existing = aggregationMap.get(key) || {
      tenantId: event.user_id,
      licenseNonce: event.license_nonce,
      featureKey,
      timestamp,
      consumedUnits: 0,
      requestCount: 0,
      tokensInput: 0,
      tokensOutput: 0,
      avgResponseTimeMs: 0,
      errorCount: 0,
    };

    existing.consumedUnits += event.credits_used || 0;
    existing.requestCount += 1;
    existing.tokensInput += event.tokens_input || 0;
    existing.tokensOutput += event.tokens_output || 0;

    if (!event.status_code || event.status_code >= 400) {
      existing.errorCount += 1;
    }

    // Running average for response time
    const totalRt = existing.avgResponseTimeMs * (existing.requestCount - 1) + (event.response_time_ms || 0);
    existing.avgResponseTimeMs = totalRt / existing.requestCount;

    aggregationMap.set(key, existing);
  }

  return Array.from(aggregationMap.values());
}
```

---

## 4. Billing Data Integration (Polar.sh)

### Current Integration

**File:** `src/lib/payments/polar-webhook-handler.ts`

Polar.sh webhooks handle:
- `checkout.updated` → Create license key
- `subscription.created` → Activate subscription
- `subscription.updated` → Handle tier changes
- `subscription.cancelled` → Revoke license

### License Auto-Generation on Payment

```tsx
// src/lib/payments/polar-webhook-handler.ts
async function generateLicenseOnPayment(params: {
  userId: string;
  tier: Tier;
  email?: string;
  polarSubscriptionId?: string;
  polarCustomerId?: string;
  expiresAt?: string;
}): Promise<{ nonce: string; keyHash: string } | null> {
  const { userId, tier, polarCustomerId, expiresAt } = params;

  // Calculate expiration (MASTER = perpetual)
  let expiresTimestamp: number;
  if (tier === 'MASTER') {
    expiresTimestamp = 0; // perpetual
  } else if (expiresAt) {
    expiresTimestamp = Math.floor(new Date(expiresAt).getTime() / 1000);
  } else {
    expiresTimestamp = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);
  }

  // Generate license key using RAAS_SECRET
  const tierLowercase = tier.toLowerCase() as 'basic' | 'premium' | 'enterprise' | 'master';
  const licenseKey = generateLicenseKey(tierLowercase, new Date(expiresTimestamp * 1000), secret);

  // Extract nonce (4th part of key)
  const parts = licenseKey.split('_');
  const nonce = parts[3];

  // Store in database
  await createLicense({
    tier,
    nonce,
    keyHash: createHash('sha256').update(licenseKey).digest('hex'),
    expiresAt: expiresTimestamp,
    metadata: {
      polarCustomerId,
      polarSubscriptionId,
      source: 'auto-generated',
    }
  });

  return { nonce, keyHash };
}
```

### Polar Customer ID Linkage

```tsx
// src/app/api/admin/usage/customer-linkage/route.ts
const { data: license } = await supabase
  .from('raas_licenses')
  .select('nonce, tier, polar_customer_id, stripe_customer_id')
  .eq('polar_customer_id', externalCustomerId)
  .single();

// Fallback to Stripe customer ID
if (!license) {
  const { data: stripeLicense } = await supabase
    .from('raas_licenses')
    .select('nonce, tier')
    .eq('stripe_customer_id', externalCustomerId)
    .single();
}
```

### Revenue Tracking Schema

```sql
-- Polar subscription + license relationship
raas_licenses (
  id uuid,
  nonce text UNIQUE,
  tier text CHECK (tier IN ('BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER')),
  polar_customer_id text,
  polar_subscription_id text,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  expires_at bigint,  -- Unix timestamp
  is_revoked boolean DEFAULT false,
  metadata jsonb
)

-- Payment events (idempotency)
payment_events (
  polar_event_id text PRIMARY KEY,
  event_type text,
  payload jsonb,
  processed boolean DEFAULT false,
  created_at timestamptz
)
```

---

## 5. Performance Patterns

### Current Data Fetching

**File:** `src/app/[locale]/dashboard/analytics/hooks/use-analytics-data.ts`

uses **client-side data processing** (no external fetching libraries):

```tsx
export function useAnalyticsData(campaigns: Campaign[]) {
  const stats = useMemo(() => {
    const total = campaigns.length;
    const completed = campaigns.filter(c => c.status === 'completed');
    const successRate = total > 0 ? (completed.length / total) * 100 : 0;
    // ... calculations
    return { total, successRate, avgTime };
  }, [campaigns]);

  const statusData = useMemo(() => {
    // ... chart data preparation
  }, [campaigns]);

  return { stats, statusData, recentPerformanceData, typeData };
}
```

### SWR vs React Query Decision

**Current:** Neither used for analytics (data comes from pageprops)

**Recommendation for Analytics Dashboard:**

| Use Case | Recommendation | Reason |
|----------|---------------|--------|
| Real-time usage chart | **SWR** | Simpler for frequent polling |
| Admin queries | **React Query** | Better cache invalidation |
| One-time page load | **Server Component** | SSR = best for initial load |

### SWR Pattern Example

```tsx
// src/app/[locale]/dashboard/analytics/hooks/use-usage-data.ts
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export function useUsageData(licenseNonce: string, start: number, end: number) {
  const url = `/api/internal/usage/query?license_nonce=${licenseNonce}&start=${start}&end=${end}&format=summary`;

  const { data, error, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // 1 min
  });

  return {
    usage: data,
    loading: !error && !data,
    error,
    refresh: mutate
  };
}
```

### React Query Pattern Example

```tsx
// src/app/[locale]/dashboard/analytics/hooks/use-billing-query.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function useBillingQuery(licenseNonce: string, period: string) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['usage', licenseNonce, period],
    queryFn: async () => {
      const res = await fetch(
        `/api/usage/summary?period=${period}&license_nonce=${licenseNonce}`
      );
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['usage', licenseNonce] });
  };

  return { data, isLoading, error, invalidate };
}
```

### Incremental Static Regeneration (ISR)

**For Analytics Dashboard (admin-only features):**

```tsx
// src/app/[locale]/dashboard/analytics/page.tsx
export const metadata = {
  title: 'Analytics | Sophia AI',
  description: 'Campaign performance statistics',
};

export default async function AnalyticsPage() {
  // Server-side rendering = ISR in Next.js
  const campaigns = await getCampaigns();

  return <AnalyticsView campaigns={campaigns} />;
}

// For revalidation (optional):
// export const revalidate = 3600; // Rebuild every hour
```

### Caching Strategy

```tsx
// src/lib/usage-metering/aggregator.ts
const MAX_DATE_RANGE_DAYS = 90; // Hard limit

// In API routes, add cache headers
return NextResponse.json(data, {
  headers: {
    'Cache-Control': 'public, max-age=300, s-maxage=3600',
  },
});
```

---

## Code Examples Summary

### Recharts Time-Series Chart

```tsx
// src/app/[locale]/dashboard/analytics/components/time-series-chart.tsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export function UsageTimeSeriesChart({ data }: { data: { timestamp: number; credits: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="timestamp"
          type="number"
          domain={['auto', 'auto']}
          tickFormatter={(ts) => new Date(ts * 1000).toLocaleDateString()}
          stroke="var(--muted-foreground)"
        />
        <YAxis
          unit=" credits"
          stroke="var(--muted-foreground)"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)'
          }}
        />
        <Legend wrapperStyle={{ color: 'var(--foreground)' }} />
        <Line
          type="monotone"
          dataKey="credits"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### RBAC Middleware Pattern

```tsx
// src/middleware.ts (analytics middleware)
import { createClient } from '@/lib/supabase/server';
import { getUserTier } from '@/lib/subscription';
import { checkTierAccess, getRequiredTierForFeature } from '@/lib/features';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = new URL(request.url);

  // Only protect analytics routes
  if (!pathname.startsWith('/dashboard/analytics')) {
    return NextResponse.next();
  }

  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const userTier = await getUserTier(user.id);
  const requiresTier = getRequiredTierForFeature('enable_advanced_analytics');

  if (!checkTierAccess(userTier, 'enable_advanced_analytics').hasAccess) {
    return NextResponse.json(
      {
        error: 'feature_required',
        requiredTier: requiresTier,
        message: `Upgrade to ${requiresTier} for advanced analytics`
      },
      { status: 403 }
    );
  }

  return NextResponse.next();
}
```

### Usage Aggregation Query

```tsx
// src/app/api/usage/aggregation/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const licenseNonce = searchParams.get('license_nonce');
  const start = parseInt(searchParams.get('start') || '0');
  const end = parseInt(searchParams.get('end') || `${Math.floor(Date.now() / 1000)}`);

  // Fetch raw events
  const supabase = createAdminClient();

  const { data: events, error } = await supabase
    .from('usage_events')
    .select('*')
    .eq('license_nonce', licenseNonce)
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by hour
  const hourlyMap = new Map<number, HourlySummary>();

  for (const event of events) {
    const hourStart = Math.floor(event.created_at / 3600) * 3600;
    const featureKey = `${event.service_name}.${event.action}`;

    let hourly = hourlyMap.get(hourStart) || {
      hourTimestamp: hourStart,
      serviceBreakdown: [],
      totalCredits: 0,
      totalRequests: 0,
      totalTokens: 0,
    };

    let service = hourly.serviceBreakdown.find(s => s.featureKey === featureKey);
    if (!service) {
      service = {
        featureKey,
        consumedUnits: 0,
        requestCount: 0,
        tokensInput: 0,
        tokensOutput: 0,
        avgResponseTimeMs: 0,
        errorCount: 0,
      };
      hourly.serviceBreakdown.push(service);
    }

    service.consumedUnits += event.credits_used || 0;
    service.requestCount += 1;
    service.tokensInput += event.tokens_input || 0;
    service.tokensOutput += event.tokens_output || 0;

    if (event.response_time_ms) {
      const totalRt = service.avgResponseTimeMs * (service.requestCount - 1) + event.response_time_ms;
      service.avgResponseTimeMs = totalRt / service.requestCount;
    }

    if (!event.status_code || event.status_code >= 400) {
      service.errorCount += 1;
    }

    hourly.totalCredits += event.credits_used || 0;
    hourly.totalRequests += 1;
    hourly.totalTokens += (event.tokens_input || 0) + (event.tokens_output || 0);

    hourlyMap.set(hourStart, hourly);
  }

  const hourly = Array.from(hourlyMap.values()).sort((a, b) => a.hourTimestamp - b.hourTimestamp);

  return NextResponse.json({ hourly });
}
```

---

## Unresolved Questions

1. **Stripe Integration**: Is Stripe still needed with Polar.sh as the sole provider? Check for `stripe` dependency in `package.json`.

2. **Dashboard Access Control**: Should analytics be available to BASIC tier (limited) or only PREMIUM+?

3. **Real-time Updates**: Should usage metrics update in real-time or batch (hourly/daily rollup)?

4. **Export Frequency**: How often should CSV exports be generated? On-demand or scheduled?

5. **Cost Optimization**: For large datasets (>100k events), should we pre-compute rollups or use materialized views?

---

## Sources

- Current implementation: `src/app/[locale]/dashboard/analytics/`
- Usage metering: `src/lib/usage-metering/`
- Polar integration: `src/lib/payments/polar-webhook-handler.ts`
- Tier system: `src/lib/subscription.ts` and `src/lib/features.ts`
- Documentation: `docs/system-architecture.md`

---

## Quick Reference

### Bundle Sizes (2026)

```
Recharts v3.7.0: ~45KB gzipped
Chart.js v4.4.0: ~48KB gzipped
Visx (all): ~80KB gzipped (modular: ~30KB)
next/dynamic: adds ~1KB runtime
```

### Tier Feature Matrix

| Feature | BASIC | PREMIUM | ENTERPRISE | MASTER |
|---------|-------|---------|------------|--------|
| Basic Analytics | ✅ | ✅ | ✅ | ✅ |
| Advanced Charts | ❌ | ✅ | ✅ | ✅ |
| Revenue Tracking | ❌ | ✅ | ✅ | ✅ |
| CSV Export | ❌ | ✅ | ✅ | ✅ |
| Real-time Metrics | ❌ | ❌ | ✅ | ✅ |

---

*Report generated by researcher agent*
