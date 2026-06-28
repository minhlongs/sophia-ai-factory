---
title: "Overage Billing & Quota Enforcement System"
description: "Implement real-time quota enforcement with overage billing, 429/403 rejection, and dashboard warnings"
status: pending
priority: P1
effort: 8h
branch: main
tags: [billing, quota, overage, raas, enforcement]
created: 2026-03-08
---

# Overage Billing & Quota Enforcement - Implementation Plan

## Overview

Build a comprehensive quota enforcement system that:
1. **Blocks requests** when usage exceeds licensed limits (429/403 with `quota_exceeded` error)
2. **Real-time quota checks** against Stripe/Polar entitlements
3. **Logs overage events** to KV storage for audit and billing reconciliation
4. **Dashboard warnings** with upgrade prompts before hard limits

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         QUOTA ENFORCEMENT FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

Request → Proxy Middleware → RaaS Gate → Quota Checker → [ALLOW/BLOCK]
                                    │
                                    ├──→ Check raas_licenses (tier, limits)
                                    ├──→ Check usage_events (current usage)
                                    ├──→ Check overage_events (audit log)
                                    └──→ Return 429/403 if exceeded

┌─────────────────────────────────────────────────────────────────────────────┐
│                         OVERAGE BILLING FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

Quota Exceeded → Log overage_event → Return 429 → Dashboard Alert → Upgrade
                      │
                      ├──→ KV storage (fast lookup)
                      ├──→ Async write to usage_events
                      └──→ Webhook to billing system (Stripe/Polar)
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Fail-closed** | Block on quota exceeded (not fail-open) |
| **Two-tier warning** | Soft warning at 80%, hard block at 100% |
| **KV-first caching** | Redis/Upstash for sub-ms quota checks |
| **Async audit logging** | Don't block request on audit write |
| **Overage billing** | Track exceeded usage for potential billing |

---

## Phase 1: Database Schema (1h)

### 1.1 Create `overage_events` Table

**File:** `supabase/migrations/20260308-overage-billing-schema.sql`

```sql
-- ============================================================================
-- Table: overage_events
-- Purpose: Track quota exceeded events for billing reconciliation
-- ============================================================================

CREATE TABLE IF NOT EXISTS overage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  license_nonce TEXT NOT NULL REFERENCES raas_licenses(nonce),

  -- Overage details
  exceeded_type TEXT NOT NULL,  -- hourly_credits | daily_credits | monthly_credits | daily_requests
  exceeded_limit INTEGER NOT NULL,
  exceeded_current INTEGER NOT NULL,
  exceeded_by INTEGER NOT NULL,   -- How much over the limit

  -- Request context
  requested_credits INTEGER NOT NULL DEFAULT 1,
  endpoint TEXT,
  service_name TEXT,
  action TEXT,

  -- Billing context
  tier_at_exceeded TEXT NOT NULL,
  external_customer_id TEXT,      -- Stripe/Polar customer ID
  billable BOOLEAN DEFAULT false, -- Flag for billing reconciliation

  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Indexes for fast queries
CREATE INDEX idx_overage_events_user ON overage_events(user_id);
CREATE INDEX idx_overage_events_license ON overage_events(license_nonce);
CREATE INDEX idx_overage_events_created_at ON overage_events(created_at DESC);
CREATE INDEX idx_overage_events_billable ON overage_events(billable) WHERE billable = true;

-- RLS
ALTER TABLE overage_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own overage events
CREATE POLICY "Users can view own overage events"
  ON overage_events FOR SELECT
  USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

-- Policy: Service role can insert
CREATE POLICY "Service role can insert overage events"
  ON overage_events FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

### 1.2 Create `quota_limits` Table (Override Defaults)

**File:** `supabase/migrations/20260308-quota-limits-schema.sql`

```sql
-- ============================================================================
-- Table: quota_limits
-- Purpose: Custom quota limits per license (override defaults)
-- ============================================================================

CREATE TABLE IF NOT EXISTS quota_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_nonce TEXT NOT NULL UNIQUE REFERENCES raas_licenses(nonce) ON DELETE CASCADE,

  -- Custom limits (NULL = use default from QUOTA_LIMITS)
  custom_daily_credits INTEGER,
  custom_hourly_credits INTEGER,
  custom_monthly_credits INTEGER,
  custom_daily_requests INTEGER,

  -- Overage billing settings
  overage_allowed BOOLEAN DEFAULT false,      -- Allow overage (don't block)
  overage_price_per_credit DECIMAL(10,4),     -- Price per overage credit
  overage_hard_limit INTEGER,                 -- Absolute max (even if overage allowed)

  -- Metadata
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT,
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_quota_limits_license ON quota_limits(license_nonce);

-- RLS
ALTER TABLE quota_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Admins have full access
CREATE POLICY "Admins have full access to quota_limits"
  ON quota_limits FOR ALL
  USING (EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  ));
```

### 1.3 Add `overage_alert_sent` to `raas_licenses.metadata`

```sql
-- Add metadata column for tracking alert state (already JSONB, just document)
COMMENT ON COLUMN raas_licenses.metadata IS 'JSONB for tier-specific custom fields + overage alert state: {"overage_alert_sent": true, "alert_threshold": 80}'
```

---

## Phase 2: Quota Checker Service (2h)

### 2.1 Create `quota-checker.ts` Service

**File:** `apps/sophia-ai-factory/src/lib/quota/quota-checker.ts`

```typescript
/**
 * Quota Checker Service
 *
 * Real-time quota validation with:
 * - KV caching (Upstash Redis)
 * - Overage event logging
 * - Soft/hard limit enforcement
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import { QUOTA_LIMITS } from '@/lib/usage-metering/aggregator';
import type { QuotaLimit, QuotaCheckResult } from '@/lib/usage-metering/types';

// KV/Redis client (lazy init)
let kvClient: any = null;

function getKvClient() {
  if (!kvClient && process.env.UPSTASH_REDIS_REST_URL) {
    // Initialize Upstash Redis client
    // kvClient = new Redis({ ... })
  }
  return kvClient;
}

export interface QuotaCheckContext {
  userId: string;
  licenseNonce: string;
  tier: string;
  requestedCredits: number;
  endpoint?: string;
  service?: string;
  action?: string;
}

export interface QuotaConfig {
  softWarningThreshold: number;  // Default 80%
  enableOverageBilling: boolean; // Default false
  failClosed: boolean;           // Default true (block on exceeded)
}

const DEFAULT_CONFIG: QuotaConfig = {
  softWarningThreshold: 0.8,
  enableOverageBilling: false,
  failClosed: true,
};

/**
 * Get effective quota limits (DB override > defaults)
 */
export async function getEffectiveQuotaLimits(
  licenseNonce: string,
  tier: string
): Promise<QuotaLimit> {
  const supabase = createAdminClient();

  // Check for custom limits
  const { data: custom } = await supabase
    .from('quota_limits')
    .select('*')
    .eq('license_nonce', licenseNonce)
    .single();

  const defaultLimit = QUOTA_LIMITS[tier] || QUOTA_LIMITS.BASIC;

  if (!custom) {
    return defaultLimit;
  }

  // Merge custom with defaults
  return {
    tier,
    dailyCredits: custom.custom_daily_credits ?? defaultLimit.dailyCredits,
    hourlyCredits: custom.custom_hourly_credits ?? defaultLimit.hourlyCredits,
    monthlyCredits: custom.custom_monthly_credits ?? defaultLimit.monthlyCredits,
    dailyRequests: custom.custom_daily_requests ?? defaultLimit.dailyRequests,
  };
}

/**
 * Get cached usage from KV (fast path)
 */
async function getCachedUsage(
  userId: string,
  licenseNonce: string
): Promise<{ hourly: number; daily: number; monthly: number; requests: number } | null> {
  const kv = getKvClient();
  if (!kv) return null;

  try {
    const key = `quota:${userId}:${licenseNonce}`;
    const cached = await kv.get(key);
    return cached as any;
  } catch (error) {
    logger.error('[Quota Checker] KV cache read error', error as Error);
    return null;
  }
}

/**
 * Update cached usage in KV
 */
async function updateCachedUsage(
  userId: string,
  licenseNonce: string,
  usage: { hourly: number; daily: number; monthly: number; requests: number },
  ttlSeconds: number = 3600
): Promise<void> {
  const kv = getKvClient();
  if (!kv) return;

  try {
    const key = `quota:${userId}:${licenseNonce}`;
    await kv.set(key, usage, { ex: ttlSeconds });
  } catch (error) {
    logger.error('[Quota Checker] KV cache write error', error as Error);
  }
}

/**
 * Calculate current usage from database
 */
async function calculateCurrentUsage(
  userId: string,
  licenseNonce: string
): Promise<{ hourly: number; daily: number; monthly: number; requests: number }> {
  const supabase = createAdminClient();
  const now = Math.floor(Date.now() / 1000);

  const hourStart = Math.floor(now / 3600) * 3600;
  const dayStart = Math.floor(now / 86400) * 86400;
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

  // Parallel queries for performance
  const [hourlyResult, dailyResult, monthlyResult] = await Promise.all([
    supabase
      .from('usage_events')
      .select('credits_used')
      .eq('user_id', userId)
      .eq('license_nonce', licenseNonce)
      .gte('created_at', hourStart)
      .lt('created_at', hourStart + 3600),

    supabase
      .from('usage_events')
      .select('credits_used')
      .eq('user_id', userId)
      .eq('license_nonce', licenseNonce)
      .gte('created_at', dayStart)
      .lt('created_at', dayStart + 86400),

    supabase
      .from('usage_events')
      .select('credits_used')
      .eq('user_id', userId)
      .eq('license_nonce', licenseNonce)
      .gte('created_at', monthStart),
  ]);

  const hourly = (hourlyResult.data as any[])?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0;
  const daily = (dailyResult.data as any[])?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0;
  const monthly = (monthlyResult.data as any[])?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0;
  const requests = dailyResult.data?.length || 0;

  return { hourly, daily, monthly, requests };
}

/**
 * Log overage event for billing reconciliation
 */
export async function logOverageEvent(
  context: QuotaCheckContext & {
    exceededType: string;
    exceededLimit: number;
    exceededCurrent: number;
    exceededBy: number;
  }
): Promise<void> {
  const supabase = createAdminClient();

  try {
    await supabase.from('overage_events').insert({
      user_id: context.userId,
      license_nonce: context.licenseNonce,
      exceeded_type: context.exceededType,
      exceeded_limit: context.exceededLimit,
      exceeded_current: context.exceededCurrent,
      exceeded_by: context.exceededBy,
      requested_credits: context.requestedCredits,
      endpoint: context.endpoint,
      service_name: context.service,
      action: context.action,
      tier_at_exceeded: context.tier,
      billable: false, // Default: not billable (user should upgrade)
    });

    logger.warn('[Quota Checker] Overage event logged', {
      userId: context.userId,
      licenseNonce: context.licenseNonce.slice(0, 8),
      exceededType: context.exceededType,
      exceededBy: context.exceededBy,
    });
  } catch (error) {
    logger.error('[Quota Checker] Failed to log overage event', error as Error);
    // Don't throw - audit logging failure shouldn't block request
  }
}

/**
 * Check quota with caching and overage logging
 *
 * @returns QuotaCheckResult with allowed: false if exceeded
 */
export async function checkQuotaWithOverage(
  context: QuotaCheckContext,
  config: QuotaConfig = DEFAULT_CONFIG
): Promise<QuotaCheckResult & { warningThreshold?: boolean }> {
  const { userId, licenseNonce, tier, requestedCredits } = context;

  // Get effective limits (DB override or defaults)
  const limits = await getEffectiveQuotaLimits(licenseNonce, tier);

  // Try KV cache first
  let cached = await getCachedUsage(userId, licenseNonce);

  // Cache miss → calculate from DB
  if (!cached) {
    cached = await calculateCurrentUsage(userId, licenseNonce);
    // Update cache (non-blocking)
    updateCachedUsage(userId, licenseNonce, cached).catch(() => {});
  }

  // Check each limit
  const checks = [
    { type: 'hourly_credits', current: cached.hourly, limit: limits.hourlyCredits },
    { type: 'daily_credits', current: cached.daily, limit: limits.dailyCredits },
    { type: 'monthly_credits', current: cached.monthly, limit: limits.monthlyCredits },
    { type: 'daily_requests', current: cached.requests, limit: limits.dailyRequests },
  ];

  let warningThreshold = false;

  for (const check of checks) {
    const usageAfter = check.current + requestedCredits;

    // Check soft warning threshold (80%)
    if (check.current >= check.limit * config.softWarningThreshold &&
        check.current < check.limit) {
      warningThreshold = true;
    }

    // Check hard limit exceeded
    if (usageAfter > check.limit) {
      // Log overage event
      await logOverageEvent({
        ...context,
        exceededType: check.type,
        exceededLimit: check.limit,
        exceededCurrent: check.current,
        exceededBy: usageAfter - check.limit,
      });

      // Return blocked result
      if (config.failClosed) {
        return {
          allowed: false,
          remaining: {
            dailyCredits: Math.max(0, limits.dailyCredits - cached.daily),
            hourlyCredits: Math.max(0, limits.hourlyCredits - cached.hourly),
            dailyRequests: Math.max(0, limits.dailyRequests - cached.requests),
            monthlyCredits: Math.max(0, limits.monthlyCredits - cached.monthly),
          },
          exceeded: {
            type: check.type as any,
            limit: check.limit,
            current: check.current,
          },
        };
      }
    }
  }

  // All checks passed
  return {
    allowed: true,
    remaining: {
      dailyCredits: limits.dailyCredits - cached.daily,
      hourlyCredits: limits.hourlyCredits - cached.hourly,
      dailyRequests: limits.dailyRequests - cached.requests,
      monthlyCredits: limits.monthlyCredits - cached.monthly,
    },
    warningThreshold,
  };
}
```

---

## Phase 3: RaaS Gate Integration (1.5h)

### 3.1 Update `raas-gate.ts` Middleware

**File:** `apps/sophia-ai-factory/src/lib/raas-gate.ts`

Add quota check after license validation:

```typescript
import { checkQuotaWithOverage } from './quota/quota-checker';

// ... existing raasGate function ...

export async function raasGate(request: NextRequest): Promise<{
  valid: boolean;
  response?: NextResponse;
  tier?: string;
  receipt?: string;
  quotaWarning?: boolean;
}> {
  // ... existing license validation ...

  // After successful license validation, check quota
  if (result.valid && licenseKey) {
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('nonce, tier')
      .eq('key_hash', createHash('sha256').update(licenseKey).digest('hex'))
      .single();

    if (license) {
      const quotaResult = await checkQuotaWithOverage({
        userId: 'anonymous', // Or extract from auth
        licenseNonce: license.nonce,
        tier: license.tier,
        requestedCredits: 1,
        endpoint: request.nextUrl.pathname,
      });

      if (!quotaResult.allowed) {
        // Return 429 Too Many Requests
        return {
          valid: false,
          response: NextResponse.json(
            {
              error: 'Quota exceeded',
              message: `Your ${quotaResult.exceeded?.type} limit has been reached`,
              code: 'quota_exceeded',
              exceeded: quotaResult.exceeded,
              upgradeUrl: '/dashboard/billing',
            },
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'X-RateLimit-Limit': String(quotaResult.exceeded?.limit || 0),
                'X-RateLimit-Remaining': '0',
                'Retry-After': '3600', // 1 hour
              },
            }
          ),
        };
      }

      // Return warning header if approaching limit
      if (quotaResult.warningThreshold) {
        return {
          valid: true,
          tier: result.tier,
          receipt,
          quotaWarning: true,
        };
      }
    }
  }

  // ... rest of existing function ...
}
```

### 3.2 Update `proxy.ts` Middleware

**File:** `apps/sophia-ai-factory/src/proxy.ts`

Handle quota warning headers:

```typescript
// After RaaS gate check
if (raasResult.valid && raasResult.quotaWarning) {
  // Add warning header to response
  response.headers.set('X-RaaS-Quota-Warning', 'threshold');
}
```

---

## Phase 4: Overage Event Logging Service (1h)

### 4.1 Create `overage-logger.ts` Service

**File:** `apps/sophia-ai-factory/src/lib/quota/overage-logger.ts`

```typescript
/**
 * Overage Event Logger
 *
 * Async logging for quota exceeded events
 * - Batch writes for efficiency
 * - Retry on failure
 * - Integration with billing webhooks
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';

export interface OverageEvent {
  userId: string;
  licenseNonce: string;
  exceededType: string;
  exceededLimit: number;
  exceededCurrent: number;
  exceededBy: number;
  requestedCredits: number;
  tier: string;
  endpoint?: string;
}

export async function logOverageEvent(event: OverageEvent): Promise<void> {
  const supabase = createAdminClient();

  try {
    await supabase.from('overage_events').insert({
      user_id: event.userId,
      license_nonce: event.licenseNonce,
      exceeded_type: event.exceededType,
      exceeded_limit: event.exceededLimit,
      exceeded_current: event.exceededCurrent,
      exceeded_by: event.exceededBy,
      requested_credits: event.requestedCredits,
      endpoint: event.endpoint,
      tier_at_exceeded: event.tier,
      billable: false,
    });
  } catch (error) {
    logger.error('[Overage Logger] Failed to log event', error as Error);
  }
}
```

---

## Phase 5: Dashboard UI Components (2h)

### 5.1 Create `OverageWarningBanner` Component

**File:** `apps/sophia-ai-factory/src/components/quota/overage-warning-banner.tsx`

```tsx
'use client';

interface OverageWarningBannerProps {
  remaining: {
    dailyCredits: number;
    hourlyCredits: number;
    monthlyCredits: number;
  };
  limits: {
    dailyCredits: number;
    hourlyCredits: number;
    monthlyCredits: number;
  };
  onUpgradeClick?: () => void;
}

export function OverageWarningBanner({
  remaining,
  limits,
  onUpgradeClick
}: OverageWarningBannerProps) {
  // Calculate percentages
  const usagePercentages = {
    daily: ((limits.dailyCredits - remaining.dailyCredits) / limits.dailyCredits) * 100,
    hourly: ((limits.hourlyCredits - remaining.hourlyCredits) / limits.hourlyCredits) * 100,
    monthly: ((limits.monthlyCredits - remaining.monthlyCredits) / limits.monthlyCredits) * 100,
  };

  const maxUsage = Math.max(
    usagePercentages.daily,
    usagePercentages.hourly,
    usagePercentages.monthly
  );

  if (maxUsage < 80) {
    return null; // Don't show if under 80%
  }

  const isCritical = maxUsage >= 100;

  return (
    <div className={`rounded-lg border p-4 ${
      isCritical
        ? 'bg-red-500/10 border-red-500/50'
        : 'bg-amber-500/10 border-amber-500/50'
    }`}>
      <div className="flex items-center gap-3">
        {isCritical ? (
          <AlertTriangle className="w-5 h-5 text-red-500" />
        ) : (
          <AlertCircle className="w-5 h-5 text-amber-500" />
        )}

        <div className="flex-1">
          <h3 className={`font-semibold ${isCritical ? 'text-red-500' : 'text-amber-500'}`}>
            {isCritical ? 'Quota Exceeded' : 'Quota Warning'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isCritical
              ? "You've reached your usage limit. Upgrade to continue."
              : `You've used ${maxUsage.toFixed(0)}% of your quota. Consider upgrading.`
            }
          </p>
        </div>

        <Button onClick={onUpgradeClick}>
          {isCritical ? 'Upgrade Now' : 'View Plans'}
        </Button>
      </div>
    </div>
  );
}
```

### 5.2 Update Usage Dashboard Page

**File:** `apps/sophia-ai-factory/src/app/[locale]/(admin)/admin/analytics/usage/page.tsx`

Add overage warnings to the dashboard:

```tsx
// Add to imports
import { OverageWarningBanner } from '@/components/quota/overage-warning-banner';

// In component, fetch overage data
const [overageEvents, setOverageEvents] = useState<any[]>([]);

// Fetch overage events
useEffect(() => {
  fetch('/api/quota/overage-events')
    .then(r => r.json())
    .then(data => setOverageEvents(data.events));
}, []);

// Render warning banner
{overageEvents.length > 0 && (
  <OverageWarningBanner
    remaining={quotaRemaining}
    limits={quotaLimits}
    onUpgradeClick={() => router.push('/dashboard/billing')}
  />
)}
```

### 5.3 Create API Endpoint for Overage Events

**File:** `apps/sophia-ai-factory/src/app/api/quota/overage-events/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger-utility';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch recent overage events
    const { data: events } = await supabase
      .from('overage_events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({ events: events || [] });
  } catch (error) {
    logger.error('[Overage API] Error fetching events', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch overage events' },
      { status: 500 }
    );
  }
}
```

---

## Phase 6: Testing Strategy (1.5h)

### 6.1 Unit Tests

**File:** `apps/sophia-ai-factory/src/lib/quota/quota-checker.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkQuotaWithOverage, getEffectiveQuotaLimits } from './quota-checker';

describe('Quota Checker', () => {
  beforeEach(() => {
    vi.mock('@/lib/supabase/admin');
  });

  describe('getEffectiveQuotaLimits', () => {
    it('returns default limits when no custom limits exist', async () => {
      // Mock DB query to return null
      const limits = await getEffectiveQuotaLimits('test-nonce', 'BASIC');
      expect(limits).toEqual({
        tier: 'BASIC',
        dailyCredits: 100,
        hourlyCredits: 20,
        monthlyCredits: 2000,
        dailyRequests: 500,
      });
    });

    it('returns custom limits when configured', async () => {
      // Mock DB query to return custom limits
      const limits = await getEffectiveQuotaLimits('test-nonce', 'PREMIUM');
      expect(limits.custom_daily_credits).toBe(1000);
    });
  });

  describe('checkQuotaWithOverage', () => {
    it('allows request when under quota', async () => {
      const result = await checkQuotaWithOverage({
        userId: 'test-user',
        licenseNonce: 'test-nonce',
        tier: 'BASIC',
        requestedCredits: 1,
      });

      expect(result.allowed).toBe(true);
      expect(result.warningThreshold).toBe(false);
    });

    it('blocks request when quota exceeded', async () => {
      // Mock usage near limit
      const result = await checkQuotaWithOverage({
        userId: 'test-user',
        licenseNonce: 'test-nonce',
        tier: 'BASIC',
        requestedCredits: 100, // Exceeds hourly limit of 20
      });

      expect(result.allowed).toBe(false);
      expect(result.exceeded?.type).toBe('hourly_credits');
    });

    it('sets warning threshold at 80%', async () => {
      // Mock usage at 85%
      const result = await checkQuotaWithOverage({
        userId: 'test-user',
        licenseNonce: 'test-nonce',
        tier: 'BASIC',
        requestedCredits: 1,
      });

      expect(result.allowed).toBe(true);
      expect(result.warningThreshold).toBe(true);
    });
  });
});
```

### 6.2 Integration Tests

**File:** `apps/sophia-ai-factory/src/app/api/v1/usage/quota-enforcement.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createTestClient } from 'vitest-canvas-mock';

describe('Quota Enforcement API', () => {
  it('returns 429 when quota exceeded', async () => {
    const response = await fetch('/api/v1/usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RaaS-License-Key': 'raas_basic_test',
      },
      body: JSON.stringify({
        records: [{ /* usage record */ }],
      }),
    });

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.code).toBe('quota_exceeded');
  });

  it('includes retry-after header on 429', async () => {
    const response = await fetch('/api/v1/usage', {
      method: 'POST',
      headers: { 'X-RaaS-License-Key': 'raas_basic_test' },
    });

    expect(response.headers.get('Retry-After')).toBeTruthy();
  });
});
```

---

## Files Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/20260308-overage-billing-schema.sql` | overage_events table |
| `supabase/migrations/20260308-quota-limits-schema.sql` | quota_limits table |
| `src/lib/quota/quota-checker.ts` | Core quota checking service |
| `src/lib/quota/overage-logger.ts` | Async overage event logging |
| `src/lib/quota/index.ts` | Quota module exports |
| `src/components/quota/overage-warning-banner.tsx` | Dashboard warning UI |
| `src/app/api/quota/overage-events/route.ts` | Overage events API |
| `src/lib/quota/quota-checker.test.ts` | Unit tests |
| `src/app/api/v1/usage/quota-enforcement.test.ts` | Integration tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/raas-gate.ts` | Add quota check, return 429 on exceeded |
| `src/proxy.ts` | Handle quota warning headers |
| `src/app/[locale]/(admin)/admin/analytics/usage/page.tsx` | Add overage warning banner |
| `src/lib/supabase/types.ts` | Add OverageEventRow, QuotaLimitRow types |
| `src/lib/usage-metering/aggregator.ts` | Export checkQuota for reuse |

---

## Error Response Format

### 429 Too Many Requests

```json
{
  "error": "Quota exceeded",
  "message": "Your hourly_credits limit has been reached",
  "code": "quota_exceeded",
  "exceeded": {
    "type": "hourly_credits",
    "limit": 20,
    "current": 20
  },
  "upgradeUrl": "/dashboard/billing",
  "remaining": {
    "dailyCredits": 80,
    "hourlyCredits": 0,
    "monthlyCredits": 1980,
    "dailyRequests": 480
  }
}
```

### Response Headers

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1678234567
Retry-After: 3600
X-RaaS-Reason: quota_exceeded
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| KV cache failures | Quota checks fall back to DB (slower) | Graceful degradation to DB queries |
| False positive blocks | Users blocked incorrectly | Add fail-open config option for testing |
| Performance impact | Added latency per request | KV caching, async audit logging |
| Billing reconciliation | Overage tracking incorrect | Audit log + manual review process |

---

## Unresolved Questions

1. **Overage billing model**: Should overage be billable automatically or require manual upgrade?
2. **KV provider**: Use Upstash Redis or Vercel KV? (currently no KV configured)
3. **Grace period**: Should there be a 5-minute grace period before hard blocking?
4. **Admin override**: Should admins be able to temporarily increase limits?
