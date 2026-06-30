---
title: "Payment Pipeline Hardening"
description: "Fix 3 remaining IPN vulnerabilities: TOCTOU windows, refund idempotency, DLQ overflow protection"
status: completed
priority: P1
effort: 12h
branch: main
tags: [payment, security, idempotency, dlq, nowpayments]
created: 2026-06-30
completed: 2026-07-01
---

## Payment Pipeline Hardening

Fix 3 vulnerabilities in the NOWPayments IPN pipeline identified during red-team audit.

### Scope

| ID | Initiative | Severity | Files |
|----|-----------|----------|-------|
| P1.1 | Eliminate TOCTOU Windows | HIGH | dispatch.ts:60-69, subscription.ts:588-596 |
| P1.2 | Refund Idempotency Hardening | MEDIUM | subscription.ts:588-596 |
| P1.5 | DLQ Overflow Prevention | MEDIUM | handlers.ts:173-182, dead-letter.ts |

### Phases (TDD: Tests First)

| # | Phase | Status | Effort | Depends On |
|---|-------|--------|--------|------------|
| 01 | Contract tests — prove bugs exist | ✅ completed | 3h | — |
| 02 | Fix TOCTOU + refund idempotency | ✅ completed | 3h | Phase 01 |
| 03 | DLQ overflow hardening | ✅ completed | 4h | Phase 01 |
| 04 | Integration tests — end-to-end IPN | ✅ completed | 2h | Phase 02, 03 |

### Architecture Constraints

- Cloudflare D1 (SQLite) — use `d1.batch()` for atomic multi-table writes
- 4-layer: all payment code in `land/billing/`
- Canonical imports only (`@/seed/*`, `@/tree/*`, `@/land/*`)
- Zero `:any` types, Zod validation on all inputs
- PROTECTED FLOW: NOWPayments IPN webhook → tier activation (0 regression)

### Key Discovery

The atomic lock in `processNowPaymentsIpn()` (INSERT ON CONFLICT DO NOTHING at handlers.ts:44-85) already provides event-level dedup. The bugs are in handler-level SELECT checks that run OUTSIDE the atomic lock transaction, creating TOCTOU windows.

### Unresolved Questions

1. Should DLQ purge be cron-automated or manual-admin-triggered? (No-tech doctrine: no operator-side cron. Manual admin endpoint preferred.)
2. What is the exact event_id format collision risk between lock INSERT and handler SELECT? (Both use `nowpayments_${payment_id}_${status}` — format is same, issue is timing, not format.)
