# Phase 6 — ESLint Disables + Phase 5 Review Nits

**Status:** ✅ COMPLETE (2026-04-20 04:22)
**Priority:** P2
**Session:** completed Phase 6 (`/cook next --auto Phase 6`)

## Scope

Eliminate residual tech debt từ Phase 5 review + telegram module eslint-disables.

### Group A — Phase 5 Nits (3 files)

| File | Issue | Fix | Status |
|---|---|---|---|
| `src/lib/env-validation.ts` | `logger.warn` in loop spam | Merge into single multi-line warning | ✅ DONE |
| `src/app/api/setup/local-mode/provision/route.ts` | HTTP 500 severity | Upgrade error classification (500 → 502/503 where appropriate) | ✅ DONE |
| `src/app/api/setup/local-mode/provision/route.test.ts` | Assertion sync | Updated 500→503 expectation | ✅ DONE |

### Group B — Telegram Module ESLint-Disables (11 → 0)

| File | Disables | Root cause | Fix | Status |
|---|---|---|---|---|
| `src/lib/telegram/user-mappings-service.ts` | 4 | `(db as any)` D1 query casts | Typed D1 query builder | ✅ DONE |
| `src/lib/telegram/telegram-fsm-state-manager.ts` | 4 | `(db as any)` D1 query casts | Typed D1 query builder | ✅ DONE |
| `src/lib/telegram/telegram-auth-middleware.ts` | 2 | `(db as any)` D1 query casts + latent bug | Typed D1 builder + fixed checkTierAccess arg order (O(1) TIER_RANK map) | ✅ DONE |
| `src/lib/telegram/sql-rate-limiter.ts` | 1 | `(db as any)` D1 query casts | Typed D1 query builder | ✅ DONE |

**Approach:** Replace `(db as any)` with typed D1 query builder signatures or explicit row interfaces.

## Deferred (NOT in Phase 6 scope)

- `no-var` eslint-disables (legitimate for global declarations: `var KV_KV`, `var QUOTA_KV`)
- test file disables (legitimate for testing unknown shapes)
- `base-adapter.ts` unused-vars (abstract method signature)
- `video-generator.ts` unused-vars (future param)
- `local-mode-step.tsx` react-hooks/exhaustive-deps (legitimate mount-only)

## Verification

- **Tests:** 1297/1297 pass (100%, maintained baseline)
- **Code Review:** APPROVE_WITH_NITS 8.8/10 (excellent — nits are non-blocking)
- **Lint:** 0 errors on all edited files
- **Production:** HTTP 200 ✅
- **ESLint Disables:** 11→0 in telegram module (all eliminated)

## Deferred (Phase 7 backlog)

1. `logger.error` API — could accept `{error?}` field (awkward `undefined` arg in error logs)
2. `telegram-fsm-state-manager` L58 — add runtime BotState enum validation
3. `sql-rate-limiter` "fail open" — emit observability metric on fallback
4. `raas_licenses` table (pre-existing dead code, low priority)
5. Remaining `:any` in components (~420 items, requires sub-phasing for Phase 7+)

## Next Phase

Phase 7 candidates (in priority order):
1. Deferred items 1-3 above (quick wins)
2. raas_licenses table migration cleanup
3. Component `:any` reduction (~420 items across UI layer)
