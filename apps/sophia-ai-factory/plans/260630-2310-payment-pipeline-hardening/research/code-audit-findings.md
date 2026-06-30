# Code Audit — Payment Pipeline Vulnerabilities

## P1.1 — TOCTOU Race Condition

**Status: PARTIAL FIX.** Atomic lock pattern EXISTS in processNowPaymentsIpn (line 44-85 of nowpayments-ipn-handlers.ts) via `INSERT ... ON CONFLICT DO NOTHING`. But 2 TOCTOU windows remain:

1. **dispatchFinished dedup check** (`nowpayments-ipn-dispatch.ts:60-69`): SELECT from pending_orders for duplicate check is OUTSIDE the atomic lock. Two concurrent `finished` IPNs for same user+tier could both pass.

2. **handleRefunded redundant check** (`nowpayments-ipn-subscription.ts:588-596`): SELECT from payment_events AFTER atomic lock already released. Redundant AND introduces separate TOCTOU window.

**Fix needed:** Remove redundant SELECT checks, rely entirely on atomic lock in processNowPaymentsIpn.

## P1.2 — Refund Idempotency

**Status: PARTIAL FIX.** processNowPaymentsIpn provides event-level dedup via atomic INSERT. But handleRefunded has a second SELECT-based check that:
- Is redundant (atomic lock already deduplicates)
- Introduces race window (SELECT outside transaction)
- Uses different event_id format (`nowpayments_${payment_id}_refunded` vs lock key `nowpayments_${payment_id}_refunded`)

**Fix needed:** Remove line 588-596 SELECT check. Atomic lock is sufficient.

## P1.5 — DLQ Overflow

**Status: GRADUATED BUT SILENT DROP.** DLQ_SIZE_CAP=1000 with thresholds at 50% (warn), 90% (error), 100% (drop). When cap hit:
- Event silently dropped
- No customer notification
- No payment recovery path
- No automatic alert to operator

**Fix needed:** 
- Add idempotency key-based dedup BEFORE DLQ enqueue (reduce bloat)
- Add automatic alert on 90% threshold
- Consider admin reconciliation endpoint for dropped events
