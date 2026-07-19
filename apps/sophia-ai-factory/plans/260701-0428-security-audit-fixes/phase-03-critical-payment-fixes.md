# Phase 3 — Critical Payment Fixes

**Status:** pending | **Priority:** P0 | **Effort:** 4h

## Context
- Parent: [plan.md](plan.md)
- Source: [security-audit-report](../../reports/security-audit-260701-0428-full-codebase.md)
- ⚠️ **Financial code — TDD required. Contract tests first.**

## Findings Addressed

| ID | Severity | File | Issue | Fix |
|----|----------|------|-------|-----|
| C1 | Critical | `nowpayments-ipn-handlers.ts:73-86` | Stale lock destroys events | Re-enqueue, don't mark processed |
| H7 | High | `nowpayments-ipn-handlers.ts:78-86` | Returns success on stale lock | Return `{success: false}` for retry |
| H8 | High | `nowpayments-ipn-one-time.ts:59-73` | Missing amount cross-check | Validate against `sku.priceUsd` |
| H9 | High | `admin/refunds/[id]/route.ts:43-51` | TOCTOU refund approval | Add `WHERE status='pending'` |
| H10 | High | `nowpayments-ipn-one-time.ts:91-96` | insertPurchase failure = success | Use `ON CONFLICT DO UPDATE` upsert |
| M13 | Medium | `nowpayments-ipn-subscription.ts:590-592` | Non-atomic cancel on refund | Single UPDATE with JOIN |
| M14 | Medium | `nowpayments-ipn-subscription.ts:283-309` | Batch fallback no atomicity | Remove fallback, retry |
| M15 | Medium | `nowpayments-ipn-subscription.ts:66-72` | Overpayment silent | Insert audit log |
| M16 | Medium | `nowpayments-ipn-one-time.ts:204-217` | Access revocation fire-and-forget | Move into main try block |
| M17 | Medium | `admin/refunds/[id]/route.ts:53-58` | Audit log after UPDATE | Use `d1.batch()` |

## Key Files
- `src/land/billing/nowpayments-ipn-handlers.ts` — stale lock recovery (C1, H7)
- `src/land/billing/nowpayments-ipn-one-time.ts` — amount check (H8), upsert (H10), access revoke (M16)
- `src/land/billing/nowpayments-ipn-subscription.ts` — atomic cancel (M13), batch fallback (M14), overpayment (M15)
- `src/app/api/admin/refunds/[id]/route.ts` — TOCTOU (H9), audit log order (M17)
- `src/land/billing/nowpayments-ipn-db.ts` — `isPaymentProcessed` error discrimination (Low)

## TDD Approach
1. Write contract test reproducing C1 (stale lock → payment lost)
2. Fix C1 + H7 together (same code block)
3. Write test for H8 (manipulated price → reject)
4. Fix H8
5. Write test for H9 (concurrent PATCH race)
6. Fix H9 + M17 (same file)
7. Fix H10, M13-M16
8. Verify all tests pass

## Success Criteria
- [ ] Stale lock re-enqueues event instead of destroying it
- [ ] Amount cross-check rejects manipulated prices >1% off
- [ ] Concurrent refund PATCH cannot flip approve/reject
- [ ] insertPurchase never returns null on conflict
- [ ] Batch fallback removed — D1 batch failure → throw + retry
- [ ] All 6694+ existing tests pass
- [ ] New contract tests added for C1, H8, H9
