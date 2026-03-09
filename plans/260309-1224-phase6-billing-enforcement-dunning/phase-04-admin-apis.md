---
title: "Phase 4: Admin Billing APIs"
description: "Admin API endpoints for managing billing, dunning state, and violations"
status: pending
priority: P2
effort: 2h
parent: ../plan.md
---

# Phase 4: Admin Billing APIs

## Overview

Create admin API endpoints for managing billing operations, viewing dunning status, manual overrides, and violation management.

## Implementation Steps

### Step 1: Admin Dunning Status API

**File:** `src/app/api/admin/billing/dunning-status/route.ts` (NEW)

```typescript
/**
 * GET /api/admin/billing/dunning-status
 * POST /api/admin/billing/dunning-status
 *
 * View and manage dunning state for licenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getDunningState,
  suspendLicense,
  restoreLicense,
  type DunningState,
} from '@/lib/billing/dunning-workflow';

/**
 * GET: List dunning statuses
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Get query params
    const searchParams = req.nextUrl.searchParams;
    const state = searchParams.get('state') as DunningState | null;
    const limit = parseInt(searchParams.get('limit') || '50');

    // Query dunning settings
    let query = supabase
      .from('dunning_settings')
      .select(`
        *,
        user_profiles!inner(email, full_name)
      `)
      .order('dunning_state_changed_at', { ascending: false })
      .limit(limit);

    if (state) {
      query = query.eq('dunning_state', state);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch dunning statuses' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        licenseNonce: row.license_nonce,
        email: row.user_profiles?.email,
        fullName: row.user_profiles?.full_name,
        dunningState: row.dunning_state,
        gracePeriodDays: row.grace_period_days,
        maxRetryAttempts: row.max_retry_attempts,
        failedPaymentCount: row.failed_payment_count,
        stateChangedAt: row.dunning_state_changed_at,
        nextRetryAt: row.next_retry_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch dunning statuses' },
      { status: 500 }
    );
  }
}

/**
 * POST: Update dunning state (suspend/restore)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { licenseNonce, action, reason } = body;

    if (!licenseNonce || !action) {
      return NextResponse.json(
        { error: 'licenseNonce and action required' },
        { status: 400 }
      );
    }

    // Get license to find user ID
    const supabase = createAdminClient();
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('created_by')
      .eq('nonce', licenseNonce)
      .single();

    if (!license) {
      return NextResponse.json(
        { error: 'License not found' },
        { status: 404 }
      );
    }

    const userId = license.created_by;

    // Perform action
    let result;
    if (action === 'suspend') {
      result = await suspendLicense(licenseNonce, userId, reason || 'Manual suspension by admin');
    } else if (action === 'restore') {
      result = await restoreLicense(licenseNonce, userId, reason || 'Manual restoration by admin');
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "suspend" or "restore"' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `License ${action}ed successfully`,
      state: result.state,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update dunning state' },
      { status: 500 }
    );
  }
}
```

### Step 2: Admin Overage Events API

**File:** `src/app/api/admin/billing/overage-events/route.ts` (NEW)

```typescript
/**
 * GET /api/admin/billing/overage-events
 *
 * List overage events with filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const searchParams = req.nextUrl.searchParams;

    const billable = searchParams.get('billable');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('overage_events')
      .select(`
        *,
        user_profiles!inner(email, full_name),
        raas_licenses!inner(tier)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (billable !== null) {
      query = query.eq('billable', billable === 'true');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch overage events' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        email: row.user_profiles?.email,
        licenseNonce: row.license_nonce,
        tier: row.raas_licenses?.tier,
        exceededType: row.exceeded_type,
        exceededLimit: row.exceeded_limit,
        exceededCurrent: row.exceeded_current,
        exceededBy: row.exceeded_by,
        billable: row.billable,
        createdAt: row.created_at,
      })),
      total: data.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch overage events' },
      { status: 500 }
    );
  }
}
```

### Step 3: Admin Billing Summary API

**File:** `src/app/api/admin/billing/summary/route.ts` (NEW)

```typescript
/**
 * GET /api/admin/billing/summary
 *
 * Get billing summary for dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Get counts by dunning state
    const { data: dunningCounts } = await supabase
      .from('dunning_settings')
      .select('dunning_state');

    const stateCounts = {
      current: dunningCounts?.filter(d => d.dunning_state === 'current').length || 0,
      past_due: dunningCounts?.filter(d => d.dunning_state === 'past_due').length || 0,
      delinquent: dunningCounts?.filter(d => d.dunning_state === 'delinquent').length || 0,
      suspended: dunningCounts?.filter(d => d.dunning_state === 'suspended').length || 0,
    };

    // Get overage totals
    const { data: overageTotal } = await supabase
      .from('overage_events')
      .select('exceeded_by, billable')
      .eq('billable', false);

    const unbilledOverage = overageTotal?.reduce((sum, e) => sum + e.exceeded_by, 0) || 0;

    // Get recent billing events
    const { data: recentEvents } = await supabase
      .from('billing_events')
      .select('event_type, amount, currency, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate MRR from active subscriptions
    const { data: subscriptions } = await supabase
      .from('user_profiles')
      .select('subscription_tier, subscription_status');

    const mrrCalculation: Record<string, number> = {
      basic: 29,
      premium: 79,
      enterprise: 199,
      master: 499,
    };

    const mrr = subscriptions
      ?.filter(s => s.subscription_status === 'active')
      .reduce((sum, s) => sum + (mrrCalculation[s.subscription_tier] || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      summary: {
        dunning: stateCounts,
        overage: {
          unbilledCredits: unbilledOverage,
        },
        revenue: {
          mrr,
          currency: 'USD',
        },
        recentEvents: recentEvents || [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch billing summary' },
      { status: 500 }
    );
  }
}
```

### Step 4: Admin Violations API

**File:** `src/app/api/admin/violations/route.ts` (NEW)

```typescript
/**
 * GET /api/admin/violations
 * POST /api/admin/violations
 *
 * Manage violations (quota exceeded, abuse, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET: List violations
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const searchParams = req.nextUrl.searchParams;

    const type = searchParams.get('type');
    const processed = searchParams.get('processed');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabase
      .from('violations')
      .select(`
        *,
        user_profiles!inner(email)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq('violation_type', type);
    }

    if (processed !== null) {
      query = query.eq('processed', processed === 'true');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch violations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        email: row.user_profiles?.email,
        licenseNonce: row.license_nonce,
        type: row.violation_type,
        severity: row.severity,
        details: row.violation_details,
        processed: row.processed,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch violations' },
      { status: 500 }
    );
  }
}

/**
 * POST: Mark violation as resolved
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { violationId, action, notes } = body;

    if (!violationId || !action) {
      return NextResponse.json(
        { error: 'violationId and action required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    if (action === 'resolve') {
      await supabase
        .from('violations')
        .update({
          processed: true,
          resolved_at: new Date().toISOString(),
          resolution_notes: notes,
        })
        .eq('id', violationId);
    } else if (action === 'escalate') {
      await supabase
        .from('violations')
        .update({
          severity: 'critical',
          escalation_notes: notes,
        })
        .eq('id', violationId);
    }

    return NextResponse.json({
      success: true,
      message: `Violation ${action}ed successfully`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update violation' },
      { status: 500 }
    );
  }
}
```

### Step 5: Admin Reconciliation Trigger API

**File:** `src/app/api/admin/billing/reconcile/route.ts` (NEW)

```typescript
/**
 * POST /api/admin/billing/reconcile
 *
 * Manually trigger overage reconciliation
 */

import { NextRequest, NextResponse } from 'next/server';
import { reconcileOverageEventsWithRetry } from '@/lib/billing/overage-billing-reconciler';

export async function POST(req: NextRequest) {
  try {
    // Trigger reconciliation
    const result = await reconcileOverageEventsWithRetry();

    return NextResponse.json({
      success: result.success,
      data: {
        scannedEvents: result.scannedEvents,
        billableEvents: result.billableEvents,
        totalCharge: result.totalCharge,
        invoiceItemsCreated: result.invoiceItemsCreated,
        errors: result.errors,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Reconciliation failed' },
      { status: 500 }
    );
  }
}
```

## Admin Dashboard Routes

Create admin UI pages to consume these APIs:

**File:** `src/app/[locale]/(admin)/admin/billing/page.tsx` (NEW)

```typescript
// Admin billing dashboard page
// Will be implemented in Phase 5
```

## Security

All admin APIs require:
1. Authentication (user must be logged in)
2. Admin role check (`user_profiles.role = 'admin'`)
3. Rate limiting (TBD)

Add middleware protection in `src/middleware/admin-billing.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Check admin auth for /api/admin/* routes
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    const supabase = createServerClient(/* ... */);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
  }
}
```

## Testing

### Integration Tests

**File:** `src/test/integration/admin-billing-apis.test.ts`

```typescript
describe('Admin Billing APIs', () => {
  describe('GET /api/admin/billing/dunning-status', () => {
    it('should return dunning statuses for admin user', async () => {
      const response = await fetch('/api/admin/billing/dunning-status', {
        headers: getAdminAuthHeaders(),
      });

      expect(response.status).toBe(200);
      expect(response.json()).toHaveProperty('data');
    });
  });

  describe('POST /api/admin/billing/reconcile', () => {
    it('should trigger overage reconciliation', async () => {
      const response = await fetch('/api/admin/billing/reconcile', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
      });

      expect(response.status).toBe(200);
      expect(response.json()).toHaveProperty('success', true);
    });
  });
});
```

## Success Criteria

- [ ] All 5 admin API endpoints created
- [ ] Admin authentication/authorization working
- [ ] Dunning status list with filtering
- [ ] Manual suspend/restore functionality
- [ ] Overage events listing
- [ ] Billing summary with MRR calculation
- [ ] Violations management
- [ ] Manual reconciliation trigger

## Related Files

- `src/app/api/admin/billing/dunning-status/route.ts` (NEW)
- `src/app/api/admin/billing/overage-events/route.ts` (NEW)
- `src/app/api/admin/billing/summary/route.ts` (NEW)
- `src/app/api/admin/violations/route.ts` (NEW)
- `src/app/api/admin/billing/reconcile/route.ts` (NEW)

---

## Unresolved Questions

1. **Admin role schema** - Need to confirm `user_profiles.role` column exists
2. **Rate limiting** - Should admin APIs have rate limits?
3. **Audit logging** - Should admin actions be logged to audit_logs table?
