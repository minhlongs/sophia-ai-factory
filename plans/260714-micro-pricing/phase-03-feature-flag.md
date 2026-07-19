# Phase 3: Feature Flag + Tier Gate

**Effort:** XS (2 files, additive)
**Depends on:** Phase 2 (cron deployed)

---

## Context

Credit pack purchases should be gated by tier — only PREMIUM and above can buy credits.
This uses the existing `FeatureFlag` system (`tierHasFeature()`).

---

## Changes

### 1. `src/seed/types/index.ts`

Add to `FeatureFlag` type:

```typescript
export type FeatureFlag =
  | 'enable_affiliate_engine'
  | 'enable_roi_calculator'
  | 'enable_api_integrations'
  | 'enable_admin_dashboard'
  | 'enable_auto_update'
  | 'enable_credit_topup'   // <-- NEW
  | 'enable_white_label';
```

### 2. `src/seed/config/tiers/tier-configs.ts`

Add `'enable_credit_topup'` to `features` arrays for eligible tiers:

```typescript
BASIC: {
  // ... existing
  features: [
    'enable_affiliate_engine',
    'enable_roi_calculator',
    // BASIC cannot buy credits — upsell path
  ],
},
PREMIUM: {
  features: [
    'enable_affiliate_engine',
    'enable_roi_calculator',
    'enable_api_integrations',
    'enable_credit_topup',      // <-- NEW
  ],
},
ENTERPRISE: {
  features: [
    // ... all existing
    'enable_credit_topup',      // <-- NEW
  ],
},
MASTER: {
  features: [
    // ... all existing
    'enable_credit_topup',      // <-- NEW (implied)
  ],
},
```

---

## Gate Enforcement

Two enforcement points:

1. **UI gate:** Checkout page for credit packs checks `tierHasFeature(userTier, 'enable_credit_topup')`
2. **API gate:** Credit purchase endpoint validates the flag server-side

```typescript
// In credit pack checkout handler
import { tierHasFeature } from '@/seed/config/tiers/tier-configs';
import { getUserTier } from '@/seed/db/get-user-tier';

const tier = await getUserTier(userId);
if (!tierHasFeature(tier, 'enable_credit_topup')) {
  return NextResponse.json(
    { error: 'Credit packs require PREMIUM tier or above' },
    { status: 403 }
  );
}
```

---

## Protected Flow Check

- No changes to subscription IPN flow
- No changes to Tier enum
- No changes to NOWPayments invoice registry
- Zero regression on existing tier-gated features

---

## Verification

1. `npm run build` passes (FeatureFlag type union updated)
2. `npm test -- seed/config` passes
3. Manual: BASIC user → credit pack page → shows "Upgrade to PREMIUM" CTA
4. Manual: PREMIUM user → credit pack page → shows pack selection
