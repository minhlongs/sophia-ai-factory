---
title: "Phase 4: RBAC Implementation"
status: completed
priority: P1
effort: 2h
completed: 2026-03-07
---

# Phase 4: RBAC Implementation

## Context

**Existing Infrastructure:**
- Tier guard: `src/lib/tier-guard.ts`
- Feature flags: `src/lib/features.ts`
- Supabase RLS policies on `usage_events`
- Middleware: `src/middleware.ts`

**Research:** Report Section 2 (RBAC Implementation Pattern)

## Requirements

### 4.1 Access Control Matrix

| Feature | BASIC | PREMIUM | ENTERPRISE | MASTER | Admin |
|---------|-------|---------|------------|--------|-------|
| View own usage (current month) | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own usage (custom range) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Time-series charts | Basic | ✅ | ✅ | ✅ | ✅ |
| Tier breakdown | ❌ | ❌ | ✅ | ✅ | ✅ |
| Customer table | ❌ | ❌ | ❌ | ❌ | ✅ |
| Revenue metrics | ❌ | ❌ | ✅ | ✅ | ✅ |
| CSV export | ❌ | ✅ | ✅ | ✅ | ✅ |
| Real-time refresh | ❌ | ❌ | ✅ | ✅ | ✅ |

### 4.2 API-Level RBAC

**Pattern:**
```typescript
// src/app/api/analytics/usage/route.ts
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const licenseNonce = searchParams.get('license_nonce');
  const isAdmin = await checkAdmin(user.id);
  const userTier = await getUserTier(user.id);

  // RBAC: Non-admin can only query own data
  if (!isAdmin && licenseNonce) {
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('created_by')
      .eq('nonce', licenseNonce)
      .single();

    if (license?.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Auto-inject license_nonce for non-admin
  if (!licenseNonce && !isAdmin) {
    const { data: userLicense } = await supabase
      .from('raas_licenses')
      .select('nonce')
      .eq('created_by', user.id)
      .eq('is_revoked', false)
      .single();

    if (!userLicense) {
      return NextResponse.json(
        { error: 'No active license' },
        { status: 403 }
      );
    }
  }

  // Proceed with query...
}
```

### 4.3 Feature Gating Helper

**Create:** `src/lib/analytics/access-control.ts`

```typescript
import { Tier } from '@/types';
import { getFeatureFlag } from '@/lib/features';

interface AnalyticsFeatureAccess {
  canViewCustomDateRange: boolean;
  canViewTimeSeries: boolean;
  canViewTierBreakdown: boolean;
  canViewCustomerTable: boolean;
  canViewRevenue: boolean;
  canExport: boolean;
  canAutoRefresh: boolean;
}

export function getAnalyticsAccess(tier: Tier, isAdmin: boolean): AnalyticsFeatureAccess {
  // Master tier gets everything
  if (tier === 'MASTER') {
    return {
      canViewCustomDateRange: true,
      canViewTimeSeries: true,
      canViewTierBreakdown: true,
      canViewCustomerTable: false, // Admin only
      canViewRevenue: true,
      canExport: true,
      canAutoRefresh: true,
    };
  }

  // Admin gets all + customer table
  if (isAdmin) {
    return {
      canViewCustomDateRange: true,
      canViewTimeSeries: true,
      canViewTierBreakdown: true,
      canViewCustomerTable: true,
      canViewRevenue: true,
      canExport: true,
      canAutoRefresh: true,
    };
  }

  // Enterprise tier
  if (tier === 'ENTERPRISE') {
    return {
      canViewCustomDateRange: true,
      canViewTimeSeries: true,
      canViewTierBreakdown: true,
      canViewCustomerTable: false,
      canViewRevenue: true,
      canExport: true,
      canAutoRefresh: true,
    };
  }

  // Premium tier
  if (tier === 'PREMIUM') {
    return {
      canViewCustomDateRange: true,
      canViewTimeSeries: true,
      canViewTierBreakdown: false,
      canViewCustomerTable: false,
      canViewRevenue: false,
      canExport: true,
      canAutoRefresh: false,
    };
  }

  // BASIC tier (default)
  return {
    canViewCustomDateRange: false,
    canViewTimeSeries: true, // Basic chart only
    canViewTierBreakdown: false,
    canViewCustomerTable: false,
    canViewRevenue: false,
    canExport: false,
    canAutoRefresh: false,
  };
}
```

### 4.4 Row-Level Security (RLS)

**Database Policies:**

```sql
-- Policy 1: Users can view their own usage data
CREATE POLICY "users_view_own_usage"
ON usage_events
FOR SELECT
USING (
  auth.uid() = user_id
);

-- Policy 2: Admins can view all usage data
CREATE POLICY "admins_view_all_usage"
ON usage_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Policy 3: Users can view their own licenses
CREATE POLICY "users_view_own_licenses"
ON raas_licenses
FOR SELECT
USING (
  auth.uid() = created_by
);

-- Policy 4: Admins can view all licenses
CREATE POLICY "admins_view_all_licenses"
ON raas_licenses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);
```

### 4.5 Middleware Protection

**Update:** `src/middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/middleware';
import { getUserTier } from '@/lib/subscription';
import { checkTierAccess } from '@/lib/features';

export async function middleware(request: NextRequest) {
  const { pathname } = new URL(request.url);

  // Protect analytics routes
  if (pathname.includes('/dashboard/analytics')) {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const userTier = await getUserTier(user.id);
    const featureAccess = checkTierAccess(userTier, 'enable_analytics');

    if (!featureAccess.hasAccess) {
      // Redirect to upgrade page
      return NextResponse.redirect(new URL('/pricing', request.url));
    }
  }

  return NextResponse.next();
}
```

## Files to Create/Modify

**Create:**
```
src/lib/analytics/
└── access-control.ts        # Feature gating helper
```

**Modify:**
```
src/app/api/analytics/usage/route.ts       # Add RBAC checks
src/app/api/analytics/revenue/route.ts     # Admin only
src/app/api/analytics/licenses/route.ts    # Admin only
src/middleware.ts                          # Add analytics route protection
supabase/migrations/                       # Add RLS policies
```

## Implementation Steps

### Step 1: Create Access Control Helper
- Implement `getAnalyticsAccess()` function
- Export types for feature flags

### Step 2: Add RBAC to API Routes
- Usage endpoint: Customer = own data, Admin = all data
- Revenue endpoint: Admin + Enterprise/Master only
- Licenses endpoint: Admin only (customer table)

### Step 3: Update Middleware
- Add analytics route protection
- Redirect BASIC tier to pricing page

### Step 4: Add RLS Policies
- Create migration file
- Test policies with admin/non-admin users

### Step 5: UI Feature Gating
- Hide/show controls based on tier
- Show upgrade prompts for locked features

## Success Criteria

- [ ] Non-admin cannot query other customers' data
- [ ] BASIC tier redirected from analytics page
- [ ] Revenue endpoint returns 403 for BASIC/PREMIUM
- [ ] RLS policies prevent direct Supabase access
- [ ] UI shows correct features per tier

## Related Files

**Read:**
- `src/lib/tier-guard.ts`
- `src/lib/features.ts`
- `src/lib/subscription.ts`
- `src/middleware.ts`

**Create:**
- `src/lib/analytics/access-control.ts`
- Supabase migration for RLS policies

## Testing Notes

- Test each API endpoint with different tier users
- Verify RLS with direct Supabase queries
- Test middleware redirects
- UI component tests for feature gating
