# Phase 09 — Integration Tests + Cross-Track Validation

**Priority:** P1 | **Status:** pending | **Effort:** 4h | **Depends On:** Phase 02, 04, 06, 08

## Overview

End-to-end integration tests validating all 4 tracks work together without regression. Verify that the billing page (A2) correctly reflects refunds (D), overage top-ups (A1), and affiliate commissions (C). Cross-track validation ensures no silent contract breaks between subsystems.

## Key Insights

- Bundle of 4 independently-tested tracks — integration tests verify the seams
- Key seams: billing dashboard → refund backend, quota enforcer → overage billing → billing portal
- Affiliate pipeline is mostly independent but commissions appear in revenue dashboard
- **Pattern:** Same Vitest + D1 mock approach as Payment Pipeline Hardening integration tests

## Integration Tests to Write

### File: `src/land/billing/__tests__/billing-portal-integration.test.ts`

1. **full billing lifecycle** — Subscribe → view plan → change tier → view invoice → cancel → resubscribe
2. **refund appears in billing history** — Process refund → billing page shows refund line item
3. **overage top-up appears in payment history** — Buy credits → payment history shows top-up
4. **credit bar reflects current usage** — Use credits → credit bar updates → top up → credit bar reflects new balance
5. **concurrent operations don't corrupt state** — Rapid tier change + top-up + refund request → all succeed or gracefully fail

### File: `src/land/affiliates/__tests__/affiliate-revenue-integration.test.ts`

1. **commission appears in revenue dashboard** — Sale postback → commission calculated → revenue dashboard shows affiliate line
2. **refund reverses commission correctly** — Refund postback → negative commission → revenue dashboard updated
3. **conversion → attribution → commission → ledger** — End-to-end affiliate pipeline

### File: `src/land/refunds/__tests__/refund-cross-track-integration.test.ts`

1. **refund + tier change interaction** — User upgrades, then requests refund for previous period → correct handling
2. **refund + dunning interaction** — User in dunning requests refund → blocked with clear message
3. **refund + overage top-up interaction** — User tops up, then requests refund for original subscription → credits handled correctly

## Cross-Track Validation Checklist

- [ ] Protected flow 1: Setup Wizard works end-to-end
- [ ] Protected flow 2: Telegram Bot @Sophia_Bbot responds to `/campaign`, `/status`, `/results`
- [ ] Protected flow 3: NOWPayments IPN webhook → tier activation still works
- [ ] Billing dashboard loads without errors (all new components render)
- [ ] Admin endpoints still functional (refund approve, DLQ replay, quota overage summary)
- [ ] `npm run build` → 0 TypeScript errors
- [ ] `npm test` → all 6250+ tests pass, 0 regressions
- [ ] `npm run lint` → 0 new warnings
- [ ] Zero `:any` types in new code
- [ ] Bilingual VI+EN for all new customer-facing strings

## Success Criteria

- [] 8+ integration tests pass
- [] All cross-track validation checklist items checked
- [] No regression in protected flows
- [] Build green, tests green, lint green
