---
title: "Revenue & Trust Sprint — 4 Parallel Tracks"
description: "TDD hardening for 4 subsystems: refund backend, overage billing, self-service billing portal, affiliate pipeline"
status: pending
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
| 01 | Track D — Refund Backend Contract Tests | D | pending | 2h | — |
| 02 | Track D — Refund Backend Implementation | D | pending | 4h | Phase 01 |
| 03 | Track C — Affiliate Contract Tests | C | pending | 3h | — |
| 04 | Track C — Affiliate Hardening | C | pending | 6h | Phase 03 |
| 05 | Track A1 — Overage Billing Contract Tests | A1 | pending | 3h | — |
| 06 | Track A1 — Overage Billing Implementation | A1 | pending | 8h | Phase 05 |
| 07 | Track A2 — Self-Service Billing Portal Tests | A2 | pending | 2h | — |
| 08 | Track A2 — Self-Service Billing Portal | A2 | pending | 6h | Phase 07 |
| 09 | Integration Tests + Cross-Track Validation | All | pending | 4h | Phase 02,04,06,08 |
| 10 | Build + Deploy + Verify | All | pending | 1h | Phase 09 |

**Parallel execution possible:** Phases 01,03,05,07 can start simultaneously. Phases within each track are sequential.

## Success Criteria

- [] All new tests pass (target: 50+ contract + integration tests)
- [] `npm run build` → 0 TypeScript errors
- [] Protected flows verified unchanged (NOWPayments IPN, Setup Wizard, Telegram Bot)
- [] Zero `:any` types in new code
- [] Bilingual VI+EN for all customer-facing UI strings
- [] `npm run deploy:full` exit 0, SHA verified on production
