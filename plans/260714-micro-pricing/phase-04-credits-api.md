# Phase 4: Customer-Facing Credits API

**Effort:** M (1 new file + 1 existing file modified)
**Depends on:** Phase 3 (feature flag deployed)

---

## Context

`/api/v1/credits` exists but gated behind API-key auth (RaaS machine clients).
Customers need a session-based endpoint to view their credit balance.

---

## New Route: `src/app/api/credits/route.ts`

```typescript
/**
 * GET /api/credits
 *
 * Returns current credit balance + purchase history for authenticated user.
 *
 * Auth: Session (getCurrentUser) — NOT API key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { getUserTier } from '@/seed/db/get-user-tier';
import { tierHasFeature, type FeatureFlag } from '@/seed/config/tiers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tier = await getUserTier(user.id);
  if (!tierHasFeature(tier, 'enable_credit_topup' as FeatureFlag)) {
    return NextResponse.json(
      { error: 'Credit packs require PREMIUM tier or above', upgradeRequired: true },
      { status: 403 }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const db = getD1();

  // Sum active credits across all non-expired purchases
  const balance = await db
    .prepare(
      `SELECT COALESCE(SUM(credits_remaining), 0) as active_credits,
              COUNT(*) as active_packs
       FROM user_purchases
       WHERE user_id = ?1
         AND status = 'paid'
         AND kind = 'one_time'
         AND (expires_at IS NULL OR expires_at > ?2)`
    )
    .bind(user.id, now)
    .first<{ active_credits: number; active_packs: number }>();

  // Purchase history (last 10)
  const history = await db
    .prepare(
      `SELECT id, sku, credits_total, credits_remaining, amount_cents,
              expires_at, created_at, status
       FROM user_purchases
       WHERE user_id = ?1 AND kind = 'one_time'
       ORDER BY created_at DESC
       LIMIT 10`
    )
    .bind(user.id)
    .all();

  return NextResponse.json({
    balance: {
      activeCredits: balance?.active_credits ?? 0,
      activePacks: balance?.active_packs ?? 0,
    },
    history: history?.results ?? [],
    tier,
  });
}
```

---

## Modified Route: `src/app/api/v1/credits/route.ts`

Current: API-key only (RaaS machine clients).
Change: Also accept session auth — redirect to `/api/credits` for user-facing access.

```typescript
// Add session auth branch
import { getCurrentUser } from '@/seed/auth/better-auth-session';

export async function GET(request: NextRequest) {
  // Existing: API key auth (machine clients)
  const apiKeyAuth = await validateMissionApiKey(...);
  if (apiKeyAuth.valid) {
    // Return machine-client format (backward compat)
    return machineClientResponse(apiKeyAuth);
  }

  // NEW: Session auth (human users)
  const user = await getCurrentUser();
  if (user) {
    // Delegate to /api/credits format
    return NextResponse.json({ user_credits: true /* ... */ });
  }

  return apiKeyAuthErrorResponse(apiKeyAuth);
}
```

---

## Frontend: Credit Display Component

**File:** `src/components/credits/credit-balance.tsx` (new)

Shows:
- Active credits remaining (big number)
- Expiry warning ("X credits expire in Y days")
- "Buy Credits" CTA (links to checkout for selected pack)

Bilingual labels via `useTranslations('billing')`.

---

## Tier-Gated Checkout Flow

```
User clicks "Buy Credits"
  → Check tierHasFeature('enable_credit_topup')
  → If no: show upgrade CTA to PREMIUM
  → If yes: show pack selection (Starter/Standard/Power)
  → User selects pack → POST /api/payments/one-time-checkout
      (existing flow, SKU = selected pack ID)
  → NOWPayments checkout redirect
  → IPN → credits added to balance
```

---

## Protected Flow Check

- No changes to subscription flow
- `/api/v1/credits` existing machine-client auth preserved
- NOWPayments IPN handler: unchanged (uses existing `one_time` pipeline)
- No new D1 tables required (uses `user_purchases` + `user_mcu_balance`)

---

## Verification

1. `npm run build` passes
2. `npm test -- app/api/credits` passes
3. Manual E2E:
   - PREMIUM user → GET /api/credits → sees balance
   - Purchase credit pack → IPN fires → balance updates
   - BASIC user → GET /api/credits → 403 upgradeRequired
