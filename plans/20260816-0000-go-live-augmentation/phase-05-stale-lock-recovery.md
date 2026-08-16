---
title: "Phase 05 — KV Stale-Lock Recovery + Reaper"
description: "Extract D1 stale-lock recovery logic into seed utility and create periodic reaper cron for payment_events."
status: in-progress
priority: P1
effort: 3h
branch: main
tags: [stale-lock, recovery, reaper, d1, byok]
created: 2026-08-16
updated: 2026-08-16
---

# Phase 05 — KV Stale-Lock Recovery + Reaper

## Context Links

- Existing inline stale-lock recovery: `src/land/billing/overage-topup.ts` (lines 142-155)
- Existing inline stale-lock recovery: `src/land/billing/nowpayments-ipn-handlers.ts` (lines 87-99)
- Existing reaper pattern: `src/forest/inngest/functions/dlq-reaper.ts` (DLQ re-enqueue)
- Existing reaper pattern: `src/app/api/cron/mission-reaper/route.ts` (stuck mission recovery)
- D1 lock schema: `payment_events` table with `processed` flag
- Logger utility: `src/seed/utils/logger-utility.ts`
- Result type: `src/seed/types/result.ts`
- DB client: `src/seed/db/client.ts` (sync, do not await)

## Overview

**Priority:** P1
**Status:** in-progress
**Description:** Extract duplicated stale-lock recovery logic from billing handlers into a shared seed utility, and create a periodic D1 lock reaper that scans `payment_events` for stale locks (unprocessed > 5 min) and clears them for retry. Eliminates code duplication and ensures lock recovery is consistent, auditable, and configurable.

## Key Insights

- **Stale-lock logic duplicated** across `overage-topup.ts` and `nowpayments-ipn-handlers.ts`
- **Pattern**: check `meta.changes` after INSERT → 0 means contention → select existing → if `processed=0` and age > 5min, mark for recovery
- **Race-safe recovery**: `UPDATE ... WHERE processed=0` ensures only one winner
- **Existing reapers**: DLQ reaper (Inngest cron, hourly), mission-reaper (HTTP cron, every 5 min)
- **No KV-based locks currently** — all locks are D1-only via `payment_events` table

## Requirements

### Functional
1. Extract stale-lock detection into `src/seed/utils/stale-lock-recovery.ts`:
   - Query lock by ID
   - Determine if stale (configurable threshold, default 5 min)
   - Mark for recovery (race-safe UPDATE)
   - Return recovery result
2. Replace inline stale-lock code in `overage-topup.ts` and `nowpayments-ipn-handlers.ts` with utility calls
3. Create `src/forest/inngest/functions/d1-lock-reaper.ts`:
   - Inngest cron job (or HTTP cron route)
   - Query `payment_events` for `processed=0` and `created_at` older than threshold
   - Mark stale entries for recovery or delete
   - Log actions for audit
4. Configurable threshold per lock type

### Non-functional
1. No breaking changes to existing billing handlers
2. Reaper completes in <30s on typical D1 dataset (<10K payment_events)
3. Backward compatible: existing callers continue working

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  src/seed/utils/stale-lock-recovery.ts                       │
│  ├── detectStaleLock(db, eventId, thresholdMs)              │
│  │   └── SELECT processed, created_at FROM payment_events   │
│  ├── markForRecovery(db, eventId)                           │
│  │   └── UPDATE payment_events SET processed=2 WHERE ...    │
│  └── clearStaleLock(db, eventId)                            │
│      └── DELETE FROM payment_events WHERE event_id = ?      │
├─────────────────────────────────────────────────────────────┤
│  src/forest/inngest/functions/d1-lock-reaper.ts              │
│  ├── Cron trigger: every 5 minutes                          │
│  ├── Query stale: WHERE processed=0 AND created_at < NOW()-5m│
│  ├── For each stale: call markForRecovery                    │
│  └── Log: count recovered, errors                            │
└─────────────────────────────────────────────────────────────┘
```

**Data flow:**
- `payment_events` table: `event_id` (PK), `processed` (0=locked, 1=done, 2=recovery), `created_at`
- Stale threshold: 5 minutes (`5 * 60 * 1000` ms)
- Recovery: mark `processed=2` (race-safe: only one winner via UPDATE WHERE processed=0)

## Related Code Files

| File | Action | Notes |
|------|--------|-------|
| `src/seed/utils/stale-lock-recovery.ts` | CREATE | Shared utility for stale lock detection + recovery |
| `src/forest/inngest/functions/d1-lock-reaper.ts` | CREATE | Periodic cron for D1 lock cleanup |
| `src/land/billing/overage-topup.ts` | MODIFY | Replace inline stale-lock logic with utility calls |
| `src/land/billing/nowpayments-ipn-handlers.ts` | MODIFY | Replace inline stale-lock logic with utility calls |

## Implementation Steps

1. Create `src/seed/utils/stale-lock-recovery.ts` with detect/mark/clear functions
2. Add `db.getD1()` access pattern (sync, no await)
3. Use Result type for all return values
4. Wire circuit breaker for D1 operations (already in use)
5. Update `overage-topup.ts`: replace inline stale-lock check with utility import
6. Update `nowpayments-ipn-handlers.ts`: replace inline stale-lock logic with utility import
7. Create `src/forest/inngest/functions/d1-lock-reaper.ts`
8. Register reaper cron in Inngest client or create HTTP cron route
9. Add tests for `stale-lock-recovery.ts`
10. Verify: `npm test` passes, `npm run type-check` clean

## Todo List

- [ ] Create `src/seed/utils/stale-lock-recovery.ts` with detect/mark/clear
- [ ] Update `overage-topup.ts` to use utility
- [ ] Update `nowpayments-ipn-handlers.ts` to use utility
- [ ] Create `src/forest/inngest/functions/d1-lock-reaper.ts`
- [ ] Run `npm test` — all pass
- [ ] Run `npm run type-check` — clean

## Success Criteria

- Stale-lock logic extracted and reused in both billing handlers
- Reaper cron can be triggered manually for testing
- All existing billing handler tests still pass
- Circuit breaker and Result type patterns preserved

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Reaper accidentally clears active locks | Low | High | Time threshold (5 min) + `processed=0` check before clearing |
| Billing handler behavior changed | Low | High | Preserve exact same logic in utility, only refactor shape |
| Race condition in recovery | Low | Medium | Use `UPDATE ... WHERE processed=0` (winner-takes-all) |
| Reaper floods logs | Low | Low | Log summary counts, not individual entries |

## Security Considerations

- No secrets in lock metadata
- Reaper only touches `payment_events` table (no PII)
- Logs contain event IDs only (no payment amounts or user data)

## Next Steps

- Depends on: Phase 04 (BYOK Audit pattern influenced logger usage)
- Blocks: Phase 06 (deploy checklist can verify reaper health)