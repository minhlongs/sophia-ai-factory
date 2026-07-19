# Phase 08 — Track A2: Self-Service Billing Portal

**Priority:** P1 | **Status:** pending | **Effort:** 6h | **Depends On:** Phase 07

## Overview

Implement the self-service billing portal. Extend the existing billing dashboard with plan management, tier change (upgrade/downgrade), invoice history, and cancel/resubscribe. All via Server Actions — non-tech CEOs manage everything in-app.

## Key Insights

- Existing billing page components: `billing-charge-summary.tsx`, `billing-payment-history.tsx`, `billing-overage-table.tsx`, `billing-client.tsx`
- `tier-change-provisioner.ts` has all business logic for upgrades/downgrades — need to expose via Server Action
- `subscription-expiry.ts` has cancel/resubscribe logic — need Server Action wrapper
- `change-tier/` subdirectory already exists — may contain partial self-service UI
- **Pattern:** Server Actions (not API routes) for data mutations
- **Pattern:** Bilingual VI+EN for all UI strings

## Implementation Steps

### Step 1: Create Server Actions

```typescript
// src/land/billing/actions/change-tier-action.ts (new)
// 'use server'
// changeTier(targetTier: TierEnum): Promise<Result<ChangeTierResult, BillingError>>
// 1. Auth: getCurrentUser()
// 2. Validate: Zod schema on targetTier
// 3. Check dunning state (block if in dunning)
// 4. Calculate proration via tier-change-provisioner
// 5. Create NOWPayments invoice for upgrade (or credit for downgrade)
// 6. Return { newTier, proratedAmount, effectiveDate }

// src/land/billing/actions/cancel-subscription-action.ts (new)
// 'use server'
// cancelSubscription(): Promise<Result<CancelResult, BillingError>>
// 1. Auth: getCurrentUser()
// 2. Check active subscription exists
// 3. Block if in dunning
// 4. Set end_date to current period end (not immediate)
// 5. Return { endDate, remainingDays }

// src/land/billing/actions/resubscribe-action.ts (new)
// 'use server'
// resubscribe(): Promise<Result<ResubscribeResult, BillingError>>
// 1. Auth: getCurrentUser()
// 2. Check previous subscription exists and within grace period
// 3. Restore subscription with same tier
// 4. Return { tier, nextBillingDate }
```

### Step 2: Create billing portal UI components

```typescript
// src/app/[locale]/dashboard/billing/subscription-plan-card.tsx (new)
// Shows: current plan name, price, next billing date, features list
// Action buttons: Upgrade, Downgrade, Cancel

// src/app/[locale]/dashboard/billing/invoice-history-table.tsx (new)
// Table: Date, Description, Amount, Status, Download link
// Last 12 months, paginated

// src/app/[locale]/dashboard/billing/payment-method-display.tsx (new)
// Shows: Payment method type (NOWPayments crypto / PayOS bank)
// Masked address/account, "Update" button → Setup Wizard

// src/app/[locale]/dashboard/billing/tier-change-dialog.tsx (new)
// Modal: Current tier → Target tier selector
// Prorated amount display, confirmation button
```

### Step 3: Update billing page layout

- Integrate new components into existing `billing/page.tsx`
- Keep existing charge-summary, payment-history, overage-table
- Add subscription plan card as hero section

### Step 4: i18n (Bilingual VI+EN)

```json
// messages/vi.json additions
"billing": {
  "subscriptionPlan": "Gói đăng ký",
  "nextBillingDate": "Ngày thanh toán tiếp theo",
  "changeTier": "Đổi gói",
  "cancelSubscription": "Hủy đăng ký",
  "resubscribe": "Đăng ký lại",
  ...
}
// messages/en.json additions (mirror in English)
```

## Related Code Files

| File | Action | Description |
|------|--------|-------------|
| `src/land/billing/actions/change-tier-action.ts` | CREATE | Server Action for tier change |
| `src/land/billing/actions/cancel-subscription-action.ts` | CREATE | Server Action for cancel |
| `src/land/billing/actions/resubscribe-action.ts` | CREATE | Server Action for resubscribe |
| `src/app/[locale]/dashboard/billing/subscription-plan-card.tsx` | CREATE | Plan card UI |
| `src/app/[locale]/dashboard/billing/invoice-history-table.tsx` | CREATE | Invoice history UI |
| `src/app/[locale]/dashboard/billing/payment-method-display.tsx` | CREATE | Payment method UI |
| `src/app/[locale]/dashboard/billing/tier-change-dialog.tsx` | CREATE | Tier change modal |
| `src/app/[locale]/dashboard/billing/page.tsx` | MODIFY | Integrate new components |
| `messages/vi.json` | MODIFY | Add billing portal translations |
| `messages/en.json` | MODIFY | Add billing portal translations |

## Todo List

- [ ] Create Server Actions (change-tier, cancel, resubscribe)
- [ ] Create subscription plan card UI component
- [ ] Create invoice history table UI component
- [ ] Create payment method display UI component
- [ ] Create tier change dialog UI component
- [ ] Integrate components into billing page
- [ ] Add bilingual VI+EN translations
- [ ] Add Zod validation on all Server Action inputs
- [ ] Verify contract tests from Phase 07 now PASS
- [ ] Run full test suite (6200+ tests, 0 regressions)

## Success Criteria

- [] All 17+ contract tests from Phase 07 now PASS
- [] `npm run build` → 0 TypeScript errors
- [] `npm test` → all tests pass
- [] User can view plan details + next billing date
- [] User can upgrade/downgrade tier with prorated calculation
- [] User can cancel subscription (end-of-period, not immediate)
- [] User can resubscribe within grace period
- [] All UI bilingual VI+EN
- [] Protected flows unchanged

## Risk Assessment

- **Risk:** Server Actions for financial operations need CSRF protection
- **Mitigation:** Verify middleware CSRF token seeding covers Server Actions
- **Risk:** Tier change proration may differ from admin-side expectations
- **Mitigation:** Reuse tier-change-provisioner.ts logic; don't duplicate
- **Risk:** Cancel/resubscribe may interact unexpectedly with dunning state
- **Mitigation:** Block cancel during active dunning; show resolution steps

## Next Steps

- Phase 09: Integration tests + cross-track validation
- Deploy + verify
