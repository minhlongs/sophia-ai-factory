---
title: "Phase 04: Cleanup + Verify"
description: "Remove deprecated code, run full test suite, verify build, manual IPN simulation test"
status: pending
priority: P1
effort: 1h
phase: 04
depends_on: [02, 03]
blocks: []
---

# Phase 04: Cleanup + Verify

## Overview

Final cleanup phase: remove or freeze deprecated code, verify the full test suite passes, confirm the build compiles with zero errors, and run a manual IPN simulation test to validate end-to-end flow.

## Key Insights

- **Pre-created invoice IDs are kept as frozen constants** — not removed, to preserve emergency fallback path
- **Deprecated functions marked with `@deprecated` JSDoc** — kept for one release cycle, removed in follow-up
- **Full verification includes**: type-check, build, full test suite, secrets audit
- **Manual IPN simulation via synthetic IPN route** — validates SDK parseWebhook + handler chain
- **Deploy verification** — SHA match check per CF-direct doctrine

## Files to Finalize

| File | Action |
|------|--------|
| `src/tree/clients/nowpayments-client.ts` | Final review: all exports correct, deprecated annotations clear |
| `src/tree/clients/__tests__/nowpayments-hmac.test.ts` | Confirm deleted |
| `src/land/services/real/payment-service.ts` | Confirm fallback logic present |
| `src/app/api/checkout/route.ts` | Confirm fallback logic present |
| `src/app/api/payments/one-time-checkout/route.ts` | Confirm fallback logic present |
| `src/app/api/webhooks/nowpayments/route.ts` | Confirm `parseIpnWebhook()` used |
| `src/app/api/admin/synthetic-ipn/route.ts` | Confirm signature compatible with SDK |
| `src/seed/config/environment-config.ts` | Confirm `NOWPAYMENTS_API_KEY` validated |

## Implementation Steps

### Step 1: Review deprecated function annotations

Verify all deprecated functions in `nowpayments-client.ts` have clear JSDoc:

```typescript
/**
 * @deprecated Use createCheckout() instead. Pre-created invoice IDs retained
 * as emergency fallback. Will be removed in next release cycle.
 */
export const NOWPAYMENTS_TIERS = { ... }

/** @deprecated Use parseIpnWebhook() instead. */
export async function verifyIpnSignature(...): Promise<boolean> { ... }

/** @deprecated Use createCheckout() instead. */
export function createInvoiceUrl(...): string { ... }

/** @deprecated Use createOneTimeCheckout() instead. */
export function createOneTimeInvoiceUrl(...): string { ... }
```

### Step 2: Verify no unused imports in modified files

```bash
npm run lint
```

Fix any unused import warnings in modified files.

### Step 3: Run full type check

```bash
npm run type-check
```

Must pass with 0 errors. Common issues:
- ESM import type resolution
- `PaymentEvent` type mismatch with adapter
- Missing fields in `sdkEventToInternalPayload()`

### Step 4: Run full test suite

```bash
npm test
```

Target: 6525+ tests pass. If failures:
- Identify failing test files
- Check if mocks need updating (SDK class mock vs function mock)
- Verify adapter maps all required fields
- Fix and re-run until all pass

### Step 5: Run build

```bash
npm run build
```

Must produce production build with 0 TypeScript errors. This validates ESM SDK import works in Next.js build pipeline.

### Step 6: Run secrets audit

```bash
npm run verify
```

or manually:
```bash
npx secretlint "src/**/*.ts" --format=json
```

Ensure no API keys or secrets leaked in code.

### Step 7: Manual IPN simulation test (if dev environment available)

```bash
# Start dev server
npm run dev

# In another terminal, simulate a NOWPayments IPN
curl -X POST http://localhost:3000/api/admin/synthetic-ipn \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"skuId": "STARTER_BUNDLE"}'
```

Expected: `{"success": true, "payment_id": "ADMIN_E2E_...", ...}`

### Step 8: Verify protected flows intact

Per CLAUDE.md, verify three protected flows:

1. **Setup Wizard** — no changes to BYOK onboarding paths
2. **Telegram Bot** — no changes to webhook integration
3. **Payment Flow** — verify via synthetic IPN (step 7) + checkout smoke test

```bash
# Check no files in protected paths were modified
git diff --name-only HEAD | grep -E "setup-wizard|telegram|byok"
# Should return empty
```

### Step 9: Commit conventional commit

```bash
git add apps/sophia-ai-factory/package.json apps/sophia-ai-factory/package-lock.json
git add apps/sophia-ai-factory/src/tree/clients/nowpayments-client.ts
git add apps/sophia-ai-factory/src/land/services/real/payment-service.ts
git add apps/sophia-ai-factory/src/app/api/checkout/route.ts
git add apps/sophia-ai-factory/src/app/api/payments/one-time-checkout/route.ts
git add apps/sophia-ai-factory/src/app/api/webhooks/nowpayments/route.ts
git add apps/sophia-ai-factory/src/app/api/admin/synthetic-ipn/route.ts
git add apps/sophia-ai-factory/src/seed/config/environment-config.ts
# Add all modified test files
git commit -m "feat(billing): adopt NOWPayments SDK for checkout and webhook verification

Replace pre-created invoice redirects with SDK createCheckout() API calls.
Replace custom HMAC-SHA512 verification with SDK parseWebhook().
Keep pre-created invoice IDs as emergency fallback.
Keep custom verifyIpnSignature for payout webhook (SDK doesn't cover payouts)."
```

## Todo List

- [ ] Review deprecated annotations on old functions
- [ ] Run `npm run lint` — fix unused imports
- [ ] Run `npm run type-check` — 0 errors
- [ ] Run `npm test` — 6525+ pass
- [ ] Run `npm run build` — 0 errors
- [ ] Run secrets audit — no leaks
- [ ] Manual synthetic IPN test — end-to-end success
- [ ] Verify protected flows intact (git diff check)
- [ ] Commit with conventional commit message

## Success Criteria

- `npm run build` → 0 TypeScript errors
- `npm test` → 6525+ pass
- `npm run lint` → 0 errors (warnings acceptable)
- Secrets audit clean
- Synthetic IPN test works end-to-end
- No regressions in protected flows
- Deprecated functions clearly marked, not removed
- Conventional commit message

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Test count regression | Low | Medium | Check `npm test` output; fix any broken tests |
| Build failure from ESM SDK | Low | High | Already verified in Phase 01; re-verify here |
| Protected flow breakage | Low | **Critical** | Git diff check + synthetic IPN test |
| Secrets leak in commit | Low | High | Pre-commit secrets audit |
| SDK version mismatch with Node | Low | Medium | SDK requires Node 18+; Next.js 16 runs on Node 20+ |

## Rollback Plan (if Phase 04 reveals blocking issues)

1. Revert the git commit
2. Run `npm install` to remove SDK from node_modules
3. Run `npm run build && npm test` to confirm green
4. Document blocking issue in plan report

## Post-Deploy Verification (after merge + deploy)

Per CF-direct doctrine:

```bash
git push origin main
cd apps/sophia-ai-factory
npm run deploy:full

# Verify SHA match
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
# Must match

# Apply any new migrations
bash scripts/apply-migrations.sh

# Health check
curl -sI https://sophia.agencyos.network | head -3  # HTTP/2 200
```

## Unresolved Questions (carried from plan.md)

1. Confirm `PaymentEvent.payment` includes `invoice_id` after real IPN test
2. Should pre-created invoice IDs be removed entirely in next release?
3. Should `payCurrency` be set in `createCheckout()` to trigger preflight validation?
