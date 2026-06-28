# Auto-Handover from Payment IPN

**Goal:** Payment IPN auto-triggers full customer handover pipeline. CEO monitors, never clicks.

## Phases

| Phase | File | Status |
|-------|------|--------|
| F — Migration 0065 | phase-01-migration-0065.md | pending |
| A — Auto-handover orchestrator | phase-02-auto-handover-orchestrator.md | pending |
| G — Email variants | phase-03-email-variants.md | pending |
| B — IPN handler refactor | phase-04-ipn-refactor.md | pending |
| C+D — Checkout customerEmail flow | phase-05-checkout-email-flow.md | pending |
| H — Payment success page | phase-06-payment-success-page.md | pending |
| E — Admin source column | phase-07-admin-source-column.md | pending |

## Key Files

- `migrations/0065-handover-source.sql` — NEW
- `src/lib/handover/auto-handover.ts` — NEW orchestrator
- `src/lib/handover/handover-email-service.ts` — ADD auto/upgrade email variants
- `src/lib/billing/nowpayments-ipn-subscription.ts` — ADD triggerAutoHandover call
- `src/lib/billing/nowpayments-ipn-one-time.ts` — ADD triggerAutoHandover call
- `src/lib/clients/nowpayments-client.ts` — ADD customerEmail param
- `src/app/api/checkout/route.ts` — ADD customerEmail support
- `src/app/api/payments/one-time-checkout/route.ts` — ADD customerEmail support
- `src/app/[locale]/payment-success/page.tsx` — Enhanced with 4-step guide
- `src/app/[locale]/dashboard/admin/handover/list/handover-list-client.tsx` — ADD source column
- `src/lib/handover/handover-types.ts` — ADD source to CustomerHandoverRow

## Dependencies
- D1 table `customer_handovers` exists (migration 0064)
- `sendWelcomeEmail` exists in handover-email-service.ts
- `createCustomerUser`, `upsertUserTier`, `preInstallSops`, `createHandoverRecord` exist in handover-account-setup.ts
- `createMagicLinkToken` exists in handover-magic-link.ts
