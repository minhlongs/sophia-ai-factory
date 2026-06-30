---
title: "Revenue & Trust Sprint — 4 Parallel Tracks"
description: "TDD hardening for 4 subsystems: refund backend, overage billing, self-service billing portal, affiliate pipeline"
status: complete
priority: P1
effort: 6-10d (parallel)
branch: main
tags: [revenue, refunds, overage, billing, affiliates, tdd, security]
created: 2026-07-01
---

# Revenue & Trust Sprint

4 parallel tracks hardening revenue-critical subsystems. Follows the TDD contract-test pattern proven in Payment Pipeline Hardening (29 new tests, 0 regressions).

## Scope

| Track | Initiative | Files | Effort | Priority |
|-------|-----------|-------|--------|----------|
| **D** | Refund Backend Completion | `land/refunds/`, `land/billing/nowpayments-ipn-subscription.ts` | 1-2d | P1 |
| **A1** | Overage Billing | `forest/quota/`, `land/billing/overage-*` | 4-6d | P1 |
| **A2** | Self-Service Billing Portal | `app/[locale]/dashboard/billing/` | 3-4d | P1 |
| **C** | Affiliate Pipeline Hardening | `land/affiliates/` | 3-4d | P1 |

## Architecture Constraints

- Cloudflare D1 (SQLite) — atomic lock via INSERT ON CONFLICT DO NOTHING
- 4-layer: seed→tree→forest→land
- Canonical imports only (`@/seed/*`, `@/tree/*`, `@/land/*`)
- Zero `:any` types, Zod validation on all inputs
- Result<T,E> pattern from `@/seed/types/result`
- Logger utility from `@/seed/utils/logger-utility`
- PROTECTED FLOWS: NOWPayments IPN, Setup Wizard, Telegram Bot — 0 regression
- Bilingual VI+EN required for all customer-facing UI strings

## Key Patterns (proven in Payment Pipeline Hardening)

1. **TDD**: Contract tests first → prove bugs exist → fix → verify tests pass
2. **Atomic lock**: `INSERT INTO table (id, ...) VALUES (...) ON CONFLICT(id) DO NOTHING` for financial idempotency
3. **DLQ overflow**: Graduated thresholds (50%/90%/100%), record dropped events before rejection
4. **Error handling**: Result<T,E> return type, no silent catch(() => '') patterns

## Phases

| # | Phase | Tracks | Status | Effort | Depends On |
|---|-------|--------|--------|--------|------------|
| 01 | Track D — Refund Backend Contract Tests | D | completed | 2h | — |
| 02 | Track D — Refund Backend Implementation | D | completed | 4h | Phase 01 |
| 03 | Track C — Affiliate Contract Tests | C | completed | 3h | — |
| 04 | Track C — Affiliate Hardening | C | completed | 6h | Phase 03 |
| 05 | Track A1 — Overage Billing Contract Tests | A1 | completed | 3h | — |
| 06 | Track A1 — Overage Billing Implementation | A1 | completed | 8h | Phase 05 |
| 07 | Track A2 — Self-Service Billing Portal Tests | A2 | completed | 2h | — |
| 08 | Track A2 — Self-Service Billing Portal | A2 | completed | 6h | Phase 07 |
| 09 | Integration Tests + Cross-Track Validation | All | completed | 4h | Phase 02,04,06,08 |
| 10 | Build + Deploy + Verify | All | completed | 1h | Phase 09 |
| 11 | Code Review Fixes (i18n, layer violations, types) | All | completed | 1h | Phase 10 |

**Parallel execution possible:** Phases 01,03,05,07 can start simultaneously. Phases within each track are sequential.

## Success Criteria

- [x] All new tests pass (target: 50+ contract + integration tests)
- [x] `npm run build` → 0 TypeScript errors
- [x] Protected flows verified unchanged (NOWPayments IPN, Setup Wizard, Telegram Bot)
- [x] Zero `:any` types in new code
- [x] Bilingual VI+EN for all customer-facing UI strings
- [x] `npm run deploy:full` exit 0, SHA verified on production

## Phase 11 — Code Review Fixes

Post-implementation code review of the 4-track Revenue & Trust Sprint (SHA 04d01ab60) identified findings in i18n coverage, layer architecture compliance, and type safety. All resolved in SHA 5265c0a5a.

**i18n Fixes:**
- `billing.creditBar` — Added Vietnamese translations; was rendering English to VI users (creditBar used only Vietnamese `fa-solid` icons but English text labels)
- `dashboard.billing` — Replaced English placeholder copy (`"Upgrade to access all features..."`) with real bilingual copy in self-serve portal keys

**Layer Violations (3 items moved from forest/quota to seed/):**
- `markEventsAsBillable` → `seed/db/overage-billing-ops.ts` (re-exported from forest/quota and tree/quota via barrel index)
- `invalidateQuotaCache` → `seed/kv/quota-cache-ops.ts` (re-exported from forest/quota and tree/quota)
- `TOPUP_PRICE_PER_MCU` → `seed/config/tiers/tier-configs.ts` (consumed by forest/quota/quota-enforcer-response.ts)

**Type Safety:**
- `TopupIpnPayload` interface updated to match Zod schema: added `actually_paid` and `invoice_id` fields
- Removed `eslint-disable-next-line` and `as unknown as` cast in `overage-topup.ts`

**Code Hygiene:**
- Added `@param _customerWalletAddress` JSDoc to `refund-processor.ts` (explicitly documents intentionally unused parameter)
- Deleted orphaned `src/land/heygen/heygen-client.ts.new` backup file (223 LOC, leftover from prior refactor)

**Verification:** Build 0 TS errors, i18n 4080+ keys verified bilingual, layer lint passes (no seed→forest imports).
