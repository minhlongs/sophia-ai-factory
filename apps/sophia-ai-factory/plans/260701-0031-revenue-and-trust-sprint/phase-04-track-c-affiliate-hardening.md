# Phase 04 — Track C: Affiliate Pipeline Hardening

**Priority:** P1 | **Status:** pending | **Effort:** 6h | **Depends On:** Phase 03

## Overview

Harden the affiliate pipeline applying the same patterns proven in Payment Pipeline Hardening. Focus areas: idempotency in commission ledger, ClickBank postback replay protection, error handling in conversion attribution, DLQ for failed commission events.

## Key Insights

- `commission-ledger.ts` + `commission-ledger-mutations.ts` — financial ledger for affiliate commissions, needs atomic lock pattern
- `conversion-attributor.ts` — 2 attribution paths, both use parameterized queries (SQL injection safe)
- `clickbank-postback-parser.ts` — Zod validation is solid; no hardening needed (already well-written)
- `clickbank-signature-verifier.ts` — cryptographic verification; need to review secret management
- `commission-calculator.ts` — pure function, no side effects (already clean)

## Implementation Steps

### Step 1: Add idempotency to commission ledger mutations

```typescript
// commission-ledger-mutations.ts — add atomic lock
// INSERT INTO commission_events (event_id, ...) ON CONFLICT(event_id) DO NOTHING
// event_id format: clickbank_{receipt}_{transactionType} or network_{subId}_{network}
```

### Step 2: Add ClickBank postback replay protection

```typescript
// New: src/land/affiliates/clickbank-replay-guard.ts
// Check event_id in commission_events before processing
// If already processed (receipt seen), return "already processed"
// Prevents double-crediting from ClickBank INS retries
```

### Step 3: Add error handling to conversion-attributor

- Currently returns null on all errors (including DB failures)
- Distinguish: "not found" (null) vs "DB error" (Result failure)
- Add Result<T,E> return type alongside existing null returns

### Step 4: Review and harden clickbank-signature-verifier

- Ensure secret is stored encrypted (BYOK pattern)
- Add timing-safe comparison if not already
- Add audit log for verification failures (potential attack indicator)

### Step 5: Add commission DLQ for failed ledger writes

- Pattern: same as payment DLQ (INSERT → ON CONFLICT update retry_count)
- Failed commission events go to `commission_dead_letter` table
- Admin reconciliation endpoint (GET /api/admin/commissions/dlq)

## Related Code Files

| File | Action | Description |
|------|--------|-------------|
| `src/land/affiliates/commission-ledger-mutations.ts` | MODIFY | Add atomic lock pattern |
| `src/land/affiliates/clickbank-replay-guard.ts` | CREATE | Postback replay protection |
| `src/land/affiliates/conversion-attributor.ts` | MODIFY | Add Result<T,E> error handling |
| `src/land/affiliates/clickbank-signature-verifier.ts` | READ | Audit security |
| `src/land/affiliates/commission-dlq.ts` | CREATE | Commission DLQ for failed ledger writes |
| `migrations/0204_commission_events.sql` | CREATE | Schema for commission event tracking |

## Todo List

- [ ] Add atomic lock to commission ledger mutations
- [ ] Create ClickBank replay guard (event_id dedup)
- [ ] Harden conversion-attributor error handling
- [ ] Audit clickbank-signature-verifier security
- [ ] Create commission DLQ
- [ ] Create migration for commission_events table
- [ ] Verify contract tests from Phase 03 now PASS
- [ ] Run full test suite (6200+ tests, 0 regressions)

## Success Criteria

- [] All 20+ contract tests from Phase 03 now PASS
- [] `npm run build` → 0 TypeScript errors
- [] `npm test` → all tests pass, 0 regressions
- [] Commission ledger idempotent: duplicate postback → "already processed"
- [] ClickBank replay guard prevents double-crediting
- [] Conversion attribution returns Result<T,E> for DB errors
- [] Protected flows unchanged

## Risk Assessment

- **Risk:** Commission ledger schema changes may break existing affiliate payouts
- **Mitigation:** Add columns (don't remove); use migrations with IF NOT EXISTS
- **Risk:** ClickBank replay guard needs event_id format agreement with existing postback handler
- **Mitigation:** Document event_id format: `clickbank_{receipt}_{canonicalType}`
- **Risk:** Commission DLQ may grow large with high-volume affiliate traffic
- **Mitigation:** Same graduated threshold pattern (50%/90%/100%) as payment DLQ

## Next Steps

- Phase 09: Integration tests across all tracks
