---
title: "Phase 05 — Stale-Lock Recovery + Reaper"
description: "Generic stale-lock recovery utility for D1-based atomic locks with 5-minute lazy reaper."
status: TODO
priority: P1
effort: 3h
branch: main
tags: [d1, lock, concurrency, reaper, stale-recovery, financial]
created: 2026-08-16
---

# Phase 05 — Stale-Lock Recovery + Reaper

## Context Links

- Financial code patterns: `CLAUDE.md` (stale lock recovery + atomic lock sections)
- Overage topup: `src/land/billing/overage-topup.ts` (atomic lock at lines 98-125, stale recovery at lines 142-152)
- Refund processor: `src/land/refunds/refund-processor.ts` (atomic lock at lines 94-106)
- Commission ledger: `src/land/affiliates/commission-ledger-mutations.ts` (acquireClickBankEventLock at lines 21-53)
- Commission DLQ: `src/land/affiliates/commission-dlq.ts` (ON CONFLICT pattern)
- Scout writer: `src/land/affiliates/scout/writer.ts` (dedup at line 202)
- Tenant settings: `src/land/tenant-settings/registry.ts` (namespace upsert at line 86)

## Overview

**Priority:** P1
**Status:** TODO
**Description:** Create a generic stale-lock recovery utility with a 5-minute lazy reaper for all D1-based atomic locks. The existing pattern (`INSERT ... ON CONFLICT DO NOTHING` + `meta.changes` check) is scattered across 6+ domains with inconsistent stale-recovery logic. This phase extracts the pattern into a reusable utility and standardizes the 5-minute threshold with structured logging.

## Key Insights

- **Existing lock pattern** is D1-based, NOT KV-based: `INSERT ... ON CONFLICT DO NOTHING`, check `meta.changes === 0` for ownership
- **6+ domains** use this pattern independently (billing, refunds, affiliates, tenant-settings)
- **`CLAUDE.md` financial code patterns** specify: "After 5 min, treat unprocessed locks as stale — mark processed and retry"
- **Current stale recovery** is ad-hoc: `overage-topup.ts:142-152` has inline 5-min check, but other domains may not
- D1 has no transactions — atomic lock via `INSERT ON CONFLICT DO NOTHING` is the only safe pattern
- No external lock service (no Redis, no KV locks) — all in D1
- Lock tables vary per domain: `topup_events`, `refund_events`, `clickbank_events`, etc.

## Requirements

### Functional
1. `acquireLock(table, lockKey, owner)` — atomic `INSERT ... ON CONFLICT DO NOTHING`, returns `{ acquired, owner }`
2. `releaseLock(table, lockKey, owner)` — `UPDATE ... WHERE lock_key = ? AND owner = ?` (owner-gated release)
3. `isStaleLock(table, lockKey, staleThresholdMs?)` — check if lock exceeds threshold (default 5 min)
4. `reapStaleLock(table, lockKey, newOwner)` — force-release stale lock, assign to new owner, log recovery
5. `withLock(table, lockKey, owner, fn, opts?)` — try-acquire + execute + release wrapper
6. Stale threshold configurable per domain via `LOCK_CONFIGS` map
7. Every reaper action logged with structured logger: timestamp, table, lockKey, previousOwner, held duration

### Non-functional
1. Lock operations are D1 single-statement (atomic, no transactions)
2. Lock metadata includes: `owner`, `locked_at` (ISO timestamp), `lock_key`
3. Reaper is lazy: runs on next `acquireLock()` call, not proactive
4. No external cron required (no-tech doctrine)
5. Lock operations < 50ms (D1 single-statement)

## Architecture

```
┌─────────────────────────────────────────────────┐
│  acquireLock(table, lockKey, owner)              │
│  ├── INSERT INTO {table} (lock_key, owner,       │
│  │   locked_at) ON CONFLICT DO NOTHING           │
│  ├── Check meta.changes                          │
│  ├── changes === 0?                              │
│  │   ├── Check isStaleLock()                     │
│  │   │   ├── Stale → reapStaleLock() → retry    │
│  │   │   └── Not stale → return { acquired: false }│
│  │   └── Return { acquired: false }              │
│  └── Return { acquired: true, owner }            │
├─────────────────────────────────────────────────┤
│  releaseLock(table, lockKey, owner)              │
│  ├── UPDATE {table} SET owner = NULL,            │
│  │   locked_at = NULL WHERE lock_key = ?         │
│  │   AND owner = ?                               │
│  └── Check meta.changes (warn if 0 = wrong owner)│
├─────────────────────────────────────────────────┤
│  isStaleLock(table, lockKey, threshold?)         │
│  ├── SELECT locked_at FROM {table}               │
│  │   WHERE lock_key = ? AND owner IS NOT NULL    │
│  ├── Calculate held duration                     │
│  └── Return { stale: bool, heldDurationMs }      │
├─────────────────────────────────────────────────┤
│  reapStaleLock(table, lockKey, newOwner)         │
│  ├── SELECT locked_at, owner (for logging)       │
│  ├── UPDATE {table} SET owner = ?, locked_at = ? │
│  │   WHERE lock_key = ?                          │
│  └── Log: { table, lockKey, prevOwner, duration }│
├─────────────────────────────────────────────────┤
│  withLock(table, lockKey, owner, fn, opts?)      │
│  ├── acquireLock()                               │
│  ├── Execute fn()                                │
│  └── releaseLock() in finally block              │
└─────────────────────────────────────────────────┘
```

**Data flow:**
- Entry: Business logic calls `withLock()` or `acquireLock()`
- Transform: D1 INSERT → staleness check → UPDATE (reap or release)
- Exit: lock acquired/released, stale locks reaped and logged

**LOCK_CONFIGS map (per-domain thresholds):**
```typescript
const LOCK_CONFIGS: Record<string, { staleThresholdMs: number }> = {
  'topup_events':        { staleThresholdMs: 300_000 },  // 5 min
  'refund_events':       { staleThresholdMs: 300_000 },
  'clickbank_events':    { staleThresholdMs: 300_000 },
  'commission_dlq':      { staleThresholdMs: 300_000 },
  'tenant_settings':     { staleThresholdMs: 300_000 },
  default:               { staleThresholdMs: 300_000 },
}
```

## Related Code Files

| File | Action | Notes |
|------|--------|-------|
| `src/seed/utils/stale-lock-recovery.ts` | Create | Generic lock primitives (acquire, release, reap) |
| `src/seed/utils/d1-lock-reaper.ts` | Create | Reaper logic with structured logging |
| `src/seed/utils/logger-utility.ts` | Read-only | `logger` for reaper actions |
| `src/land/billing/overage-topup.ts` | Read-only | Reference pattern (lines 98-152) |
| `src/land/refunds/refund-processor.ts` | Read-only | Reference pattern (lines 94-106) |
| `src/land/affiliates/commission-ledger-mutations.ts` | Read-only | Reference pattern (lines 21-88) |

## Implementation Steps

1. Define `LockMetadata`, `LockConfig`, `ReaperEvent` TypeScript interfaces
2. Create `src/seed/utils/stale-lock-recovery.ts` — core lock primitives
3. Create `src/seed/utils/d1-lock-reaper.ts` — reaper with structured logging
4. Add `LOCK_CONFIGS` per-domain configuration map
5. Implement `acquireLock()` with D1 INSERT ON CONFLICT DO NOTHING
6. Implement `releaseLock()` with owner-gated UPDATE
7. Implement `isStaleLock()` with threshold comparison
8. Implement `reapStaleLock()` with logging
9. Implement `withLock()` convenience wrapper with try/finally
10. Write tests: acquire, release, stale detection, reaper action, owner mismatch
11. Verify: `npm test` passes, `npm run type-check` clean

## Todo List

- [ ] Define `LockMetadata`, `LockConfig`, `ReaperEvent` interfaces
- [ ] Create `src/seed/utils/stale-lock-recovery.ts` — core lock primitives
- [ ] Create `src/seed/utils/d1-lock-reaper.ts` — reaper with logging
- [ ] Add `LOCK_CONFIGS` per-domain configuration map
- [ ] Implement `acquireLock()` with D1 atomic INSERT
- [ ] Implement `releaseLock()` with owner-gated UPDATE
- [ ] Implement `isStaleLock()` with threshold check
- [ ] Implement `reapStaleLock()` with structured logging
- [ ] Add `withLock()` convenience wrapper
- [ ] Write unit tests for lock lifecycle
- [ ] Write unit tests for stale detection and reaper
- [ ] Write unit tests for owner mismatch handling
- [ ] Run `npm test` — all pass
- [ ] Run `npm run type-check` — clean

## Success Criteria

- `acquireLock()` returns `{ acquired: true }` on fresh lock
- `acquireLock()` returns `{ acquired: false }` on held lock
- `acquireLock()` reaps stale lock (>5 min) and retries acquisition
- `releaseLock()` only succeeds for matching owner
- `releaseLock()` warns on owner mismatch (no-op, not error)
- Reaper logs every action with timestamp, table, lockKey, previousOwner, held duration
- `withLock()` acquires, executes, and releases in finally block
- All existing tests still pass

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Reaper too aggressive (5 min too short) | Medium | Medium | Configurable per domain; log all reaper actions for tuning |
| D1 INSERT latency spike under load | Low | Low | Single-statement, no transactions |
| Wrong table name causes silent failure | Low | Medium | Validate table name against allowlist in LOCK_CONFIGS |
| Reaper on hot path adds latency | Low | Low | D1 SELECT is sub-ms; staleness check is in-memory |

## Security Considerations

- Lock owner is worker instance ID (not PII)
- Reaper logs contain no sensitive data — table name, lock key, duration, owner ID only
- Lock metadata does not contain API keys or credentials
- Owner-gated release prevents lock hijacking

## Next Steps

- Depends on: nothing (independent phase)
- Blocks: Phase 06 (deploy checklist can verify lock health)
- Follow-up: Adopt `withLock()` in overage-topup, refund-processor, commission-ledger-mutations
