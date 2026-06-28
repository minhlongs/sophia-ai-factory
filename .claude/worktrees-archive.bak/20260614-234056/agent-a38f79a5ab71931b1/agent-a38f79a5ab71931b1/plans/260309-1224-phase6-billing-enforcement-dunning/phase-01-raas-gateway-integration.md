---
title: "Phase 1: RaaS Gateway Integration - Dunning-Aware Quota Enforcement"
description: "Integrate dunning state check into RaaS Gateway quota enforcement flow"
status: pending
priority: P1
effort: 2h
parent: ../plan.md
---

# Phase 1: RaaS Gateway Integration

## Overview

Integrate dunning state checking into the RaaS Gateway quota enforcement flow. When a license is suspended due to non-payment, all API requests should be blocked with a clear error message.

## Current State

**Existing Components:**
- `src/lib/quota/quota-enforcer.ts` - Hard quota enforcement with 429 responses
- `src/lib/billing/dunning-workflow.ts` - Dunning state machine with `canAccessApi()` function
- `src/lib/quota/quota-checker.ts` - Quota checking logic

**Gap:** Dunning check is not integrated into the main enforcement flow.

## Implementation Steps

### Step 1: Update `enforceQuota()` to Check Dunning State

**File:** `src/lib/quota/quota-enforcer.ts`

Add dunning state check before quota validation:

```typescript
export async function enforceQuota(
  context: QuotaCheckContext,
  config = DEFAULT_CONFIG
): Promise<{ allowed: true; result: EnhancedQuotaCheckResult } | { allowed: false; response: QuotaExceededResponse }> {
  const { licenseNonce, tier, polarCustomerId } = context;

  // NEW: Check dunning state FIRST
  const dunningCheck = await canAccessApi(licenseNonce);
  if (!dunningCheck.allowed) {
    return {
      allowed: false,
      response: createDunningBlockResponse(dunningCheck),
    };
  }

  // Sync from Polar if customer ID available
  if (polarCustomerId) {
    const syncResult = await syncQuotaFromPolar(licenseNonce, polarCustomerId);
    if (!syncResult.success) {
      logger.warn('[Quota Enforcer] Polar sync failed, using local cache', {
        error: syncResult.error,
      });
    }
  }

  // Continue with existing quota check...
  const quotaResult = await checkQuotaWithOverage(context, config);
  // ... rest of existing logic
}
```

### Step 2: Create Dunning Block Response Helper

**File:** `src/lib/quota/quota-enforcer.ts`

```typescript
/**
 * Create 403 response for dunning-blocked licenses
 */
function createDunningBlockResponse(
  dunningCheck: { state: DunningState; reason?: string }
): QuotaExceededResponse {
  return {
    error: 'account_suspended',
    code: 'ACCOUNT_SUSPENDED',
    message: 'Your account has been suspended due to non-payment',
    exceeded: {
      type: 'dunning_state',
      limit: 0,
      current: 0,
      requested: 0,
    },
    remaining: {
      dailyCredits: 0,
      hourlyCredits: 0,
      monthlyCredits: 0,
      dailyRequests: 0,
    },
    retryAfter: 0, // No retry - payment required
    upgradeUrl: '/dashboard/billing',
    dunningState: dunningCheck.state,
    dunningReason: dunningCheck.reason,
  };
}
```

### Step 3: Update QuotaExceededResponse Type

**File:** `src/lib/quota/quota-enforcer.ts`

```typescript
export interface QuotaExceededResponse {
  error: string;
  code: 'quota_exceeded' | 'account_suspended';
  message: string;
  exceeded: {
    type: string;
    limit: number;
    current: number;
    requested: number;
  };
  remaining: {
    dailyCredits: number;
    hourlyCredits: number;
    monthlyCredits: number;
    dailyRequests: number;
  };
  retryAfter: number;
  upgradeUrl: string;
  polarCustomerId?: string;
  // NEW: Dunning-specific fields
  dunningState?: DunningState;
  dunningReason?: string;
}
```

### Step 4: Add Dunning Import

**File:** `src/lib/quota/quota-enforcer.ts`

```typescript
import { canAccessApi, type DunningState } from '@/lib/billing/dunning-workflow';
```

## Database Changes

No database changes required. Uses existing:
- `dunning_settings` table
- `dunning_attempts` table

## API Response Changes

### New Response: Account Suspended (403)

```json
{
  "error": "account_suspended",
  "code": "ACCOUNT_SUSPENDED",
  "message": "Your account has been suspended due to non-payment",
  "exceeded": {
    "type": "dunning_state",
    "limit": 0,
    "current": 0,
    "requested": 0
  },
  "remaining": {
    "dailyCredits": 0,
    "hourlyCredits": 0,
    "monthlyCredits": 0,
    "dailyRequests": 0
  },
  "retryAfter": 0,
  "upgradeUrl": "/dashboard/billing",
  "dunningState": "suspended",
  "dunningReason": "Account suspended due to non-payment"
}
```

## Testing

### Unit Tests

**File:** `src/lib/quota/quota-enforcer.test.ts`

```typescript
describe('enforceQuota - dunning integration', () => {
  it('should block requests when license is suspended', async () => {
    // Mock dunning state as suspended
    mockCanAccessApi.mockResolvedValue({
      allowed: false,
      state: 'suspended',
      reason: 'Non-payment',
    });

    const result = await enforceQuota(mockContext);

    expect(result.allowed).toBe(false);
    expect(result.response.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('should allow requests when dunning state is current', async () => {
    mockCanAccessApi.mockResolvedValue({
      allowed: true,
      state: 'current',
    });

    const result = await enforceQuota(mockContext);

    expect(result.allowed).toBe(true);
  });
});
```

### Integration Test

**File:** `src/test/integration/raas-gateway-dunning.test.ts`

```typescript
describe('RaaS Gateway + Dunning Integration', () => {
  it('should block API request when license suspended', async () => {
    // Create user with suspended license
    const { licenseNonce } = await createSuspendedLicense();

    // Make API request
    const response = await fetch('/api/v1/usage', {
      headers: { 'Authorization': `Bearer ${licenseNonce}` },
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('ACCOUNT_SUSPENDED');
  });
});
```

## Success Criteria

- [ ] `enforceQuota()` checks dunning state before quota limits
- [ ] Suspended licenses receive 403 with clear error message
- [ ] Unit tests pass for dunning integration
- [ ] Integration test verifies end-to-end blocking
- [ ] No breaking changes to existing quota enforcement

## Related Files

- `src/lib/quota/quota-enforcer.ts` (modified)
- `src/lib/billing/dunning-workflow.ts` (imported)
- `src/lib/quota/quota-checker.ts` (unchanged)

---

## Unresolved Questions

None - implementation is straightforward integration of existing components.
