---
title: "Phase 01 — Circuit Breaker Hardening"
description: "Extend canonical circuit breaker (System A) to per-service per-key isolation with D1 schema support."
status: ready-for-merge
priority: P0
effort: 2h
branch: main
tags: [circuit-breaker, resilience, d1, byok, per-key]
created: 2026-08-16
completed: 2026-08-16
---

# Phase 01 — Circuit Breaker Hardening ✅ COMPLETE

## Context Links

- Canonical circuit breaker: `src/seed/security/circuit-breaker.ts` (291 lines, 40+ consumers)
- Circuit breaker config: `src/seed/config/circuit-breaker.ts` (thresholds, cooldowns)
- Failure kinds: `src/seed/types/failure-kind.ts`
- D1 migration: `migrations/0228_create_circuit_breaker_state.sql`
- HeyGen KV breaker (System B): `src/seed/utils/circuit-breaker.ts` (6 consumers, separate)
- In-memory breaker (System C): `src/seed/utils/in-memory-circuit-breaker.ts` (1 consumer)
- Admin reset route: `src/app/api/admin/circuit-breaker/reset/route.ts` (resets System B only)
- Tests: `src/seed/security/circuit-breaker.test.ts`

## Overview

**Priority:** P1
**Status:** TODO
**Description:** The canonical circuit breaker (System A) already accepts optional `keyRef?` in `recordFailure`, `recordSuccess`, `shouldAllowRequest`, and `getState`. However, the D1 schema uses `service TEXT PRIMARY KEY` — meaning per-key isolation is not yet backed by the database. This phase extends the D1 schema to support composite keys (`service + keyRef`), adds per-key lockout durations, and creates an admin endpoint for System A (currently only System B has one).

## Key Insights

- **System A already has `keyRef?` in its API** (`seed/security/circuit-breaker.ts:47,128,143,181,185`) — but the D1 table `circuit_breaker_state` uses `service TEXT PRIMARY KEY` which collapses all keyRefs for a service into one row
- Per-kind cooldowns already exist (`FAILURE_COOLDOWNS` in `seed/config/circuit-breaker.ts:14`):
  - `AUTH_FAILURE` → 0ms (immediate open)
  - `RATE_LIMIT` → 60s
  - `TIMEOUT` → 120s
  - `NETWORK` → 180s
  - `SERVER_ERROR` → 300s
  - `UNKNOWN` → 120s
- State machine: CLOSED → DEGRADED → OPEN → HALF_OPEN (4 states, System A only)
- Thresholds: `openThreshold`, `degradedThreshold`, `failureWindowMs` per service
- LRU eviction: `lastAccessAt` field, entries evicted when cache exceeds limit
- `shouldImmediateOpen(kind)` returns true for `AUTH_FAILURE` — no cooldown wait
- Admin reset route (`POST /api/admin/circuit-breaker/reset`) only resets System B (HeyGen KV). System A has no admin HTTP endpoint.

## Requirements

### Functional
1. D1 schema extension: composite key `service + keyRef` (keyRef defaults to `'*'` for service-wide)
2. Per-key cooldown override: `CIRCUIT_KEY_LOCKOUTS` map allows per-provider per-key lockout duration
3. `getAggregateState(service)` — returns worst-case state across all keys for a service
4. Admin endpoint: `POST /api/admin/circuit-breaker/reset` accepts `service` + optional `keyRef` for System A
5. Admin endpoint: `GET /api/admin/circuit-breaker/status` returns all circuit states for a service
6. Backward compatible: existing `keyRef=null` calls use `'*'` as default keyRef

### Non-functional
1. D1 write amplification bounded: max 1 write per service per 100ms window
2. LRU eviction still works with composite keys
3. All 40+ existing consumers continue working without changes (keyRef defaults to null/undefined)

## Architecture

```
┌─────────────────────────────────────────────────┐
│  D1 Schema Extension                             │
│  service    TEXT NOT NULL                        │
│  key_ref    TEXT NOT NULL DEFAULT '*'            │
│  PRIMARY KEY (service, key_ref)                  │
│  (+ existing fields: state, failure_count, etc.) │
├─────────────────────────────────────────────────┤
│  shouldAllowRequest(service, keyRef?)            │
│  ├── effectiveKey = keyRef ?? '*'                │
│  ├── Check D1 row for (service, effectiveKey)    │
│  ├── Also check (service, '*') for service-wide  │
│  └── Worst-case wins: if any key is OPEN → deny  │
├─────────────────────────────────────────────────┤
│  getAggregateState(service)                      │
│  ├── Query all rows WHERE service = ?            │
│  ├── Return worst state across all keys          │
│  └── Include per-key breakdown in response       │
├─────────────────────────────────────────────────┤
│  Admin Reset                                     │
│  ├── POST /reset: service + keyRef?              │
│  ├── Deletes specific row or all rows for service│
│  └── Returns aggregate state after reset         │
├─────────────────────────────────────────────────┤
│  Admin Status                                    │
│  ├── GET /status?service=heygen                  │
│  └── Returns all rows for service with state     │
└─────────────────────────────────────────────────┘
```

**Data flow:**
- Entry: `shouldAllowRequest('heygen', 'sk-o123')` from any consumer
- Transform: D1 query → state machine evaluation → D1 write (if state changes)
- Exit: boolean allow/deny + circuit status for logging

**D1 migration:**
```sql
-- New table with composite primary key
CREATE TABLE IF NOT EXISTS circuit_breaker_state_v2 (
  service   TEXT NOT NULL,
  key_ref   TEXT NOT NULL DEFAULT '*',
  state     TEXT NOT NULL DEFAULT 'CLOSED',
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TEXT,
  cooldown_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (service, key_ref)
);
-- Migrate existing data
INSERT INTO circuit_breaker_state_v2 (service, state, failure_count, last_failure_at, cooldown_until, created_at, updated_at)
  SELECT service, state, failure_count, last_failure_at, cooldown_until, created_at, updated_at
  FROM circuit_breaker_state;
```

## Related Code Files

| File | Action | Notes |
|------|--------|-------|
| `src/seed/security/circuit-breaker.ts` | Modify | Composite key queries, aggregate state, write coalescing |
| `src/seed/config/circuit-breaker.ts` | Modify | Add `CIRCUIT_KEY_LOCKOUTS` map, update D1CircuitRow type |
| `migrations/0NNN_circuit_breaker_v2.sql` | Create | Schema migration with data migration |
| `src/app/api/admin/circuit-breaker/reset/route.ts` | Modify | Add System A reset (currently only System B) |
| `src/app/api/admin/circuit-breaker/status/route.ts` | Create | New: GET status for System A |
| `src/seed/security/circuit-breaker.test.ts` | Modify | Add per-key isolation tests |

## Implementation Steps

1. Create D1 migration for `circuit_breaker_state_v2` with composite PK
2. Add data migration: copy existing rows with `key_ref = '*'`
3. Update `seed/config/circuit-breaker.ts`: add `CIRCUIT_KEY_LOCKOUTS` map, update `D1CircuitRow` type
4. Update `seed/security/circuit-breaker.ts`: composite key queries (`service + keyRef`)
5. Add `getAggregateState(service)` — worst-case across all keys
6. Add write coalescing: batch writes per service within 100ms window
7. Update admin reset route to support System A (service + optional keyRef)
8. Create admin status route: GET all circuit states for a service
9. Update existing tests for composite key behavior
10. Add new tests: per-key isolation, aggregate state, admin endpoints
11. Verify: `npm test` passes, `npm run type-check` clean

## Todo List

- [ ] Create D1 migration for composite PK schema
- [ ] Add data migration from existing table
- [ ] Update `D1CircuitRow` type with `key_ref` field
- [ ] Add `CIRCUIT_KEY_LOCKOUTS` per-provider per-key map
- [ ] Update `recordFailure` to use composite key
- [ ] Update `recordSuccess` to use composite key
- [ ] Update `shouldAllowRequest` to use composite key
- [ ] Add `getAggregateState(service)` function
- [ ] Add write coalescing (100ms batch window)
- [ ] Update admin reset route for System A
- [ ] Create admin status route
- [ ] Update existing tests for composite key
- [ ] Add per-key isolation tests
- [ ] Run `npm test` — all pass
- [ ] Run `npm run type-check` — clean

## Success Criteria

- Two consumers with different keyRefs for same service have independent circuit states
- `AUTH_FAILURE` on key A does not affect key B's circuit
- `getAggregateState('heygen')` returns worst-case across all keys
- Admin reset with specific keyRef resets only that key
- Admin reset without keyRef resets all keys for service
- Admin status returns per-key breakdown
- All 40+ existing consumers work without changes (keyRef defaults to `'*'`)
- All existing tests still pass

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| D1 schema migration fails on existing data | Low | High | Transaction-safe migration with rollback |
| Write amplification under load | Medium | High | Batch coalescing, 100ms window |
| Existing consumers break with new schema | Low | High | Default `key_ref = '*'` preserves old behavior |
| LRU eviction incorrect with composite keys | Medium | Medium | Update eviction query to scan composite PK |
| Admin route auth bypass | Low | High | Reuse `requireAdminWithRecentAuth` |

## Security Considerations

- API key references (keyRef) should be hashed, not raw keys
- Admin endpoints protected by `requireAdminWithRecentAuth`
- Per-key lockout prevents abuse of individual compromised keys
- Circuit state contains no PII — only state enum, timestamps, counts

## Next Steps

- Depends on: nothing (independent phase)
- Blocks: Phase 06 (deploy checklist can verify circuit breaker health)
- Follow-up: Wire per-key circuit into all external HTTP call sites (already partially done via `keyRef?` param)
