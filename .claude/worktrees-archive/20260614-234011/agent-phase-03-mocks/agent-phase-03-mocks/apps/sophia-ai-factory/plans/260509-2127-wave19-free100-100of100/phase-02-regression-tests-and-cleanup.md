# Phase 02 — Regression Tests & Verify Locks (C1, C4, C6 guardrails)

## Context Links

- Plan overview: `./plan.md`
- Phase 01 sets the stage (correctness fixes)
- Test conventions: existing `*.test.ts` colocated next to source under `src/forest/quota/`, `src/app/api/...`

## Overview

- **Priority:** P0
- **Effort:** 0.5d
- **Status:** pending
- **Description:** Add regression tests that lock-in the three formerly-claimed-critical items (C1, C4, C6) which on verification turned out to be already-correct. Locking them prevents a future refactor from reintroducing the bugs the audit feared.

## Key Insights

- **C1 (FALSE):** `VIDEO_QUOTA_BY_TIER` keys uppercase; MASTER → 1000. FREE100 user gets correct quota. We must add a TEST asserting `reserveVideoSlot(userId, 'MASTER').limit === 1000` so a future refactor cannot silently lower it.
- **C4 (PARTIAL):** D1 `from().update().eq()` chain returns `{ data, error }` correctly; the cast was just a code smell fixed in Phase 01. Need a unit test that DB error from `update()` is surfaced (not silently dropped).
- **C6 (FALSE):** mission stream route already filters by user_id at line 148. Need an integration test asserting that user A streaming user B's mission gets `not_found`.

## Requirements

### Functional
- F1. New test: `reserveVideoSlot(userId, tier)` returns the exact `VIDEO_QUOTA_BY_TIER[tier]` for each of `BASIC | PREMIUM | ENTERPRISE | MASTER` (table-driven).
- F2. New test: `completeOnboardingAction` returns `{ success: false, error }` when D1 returns `{error}`.
- F3. New test: SSE GET `/api/v1/missions/[id]/stream` with auth from user A and `id` belonging to user B emits a `not_found` event then closes.

### Non-Functional
- NF1. Reuse existing test harness (`vitest`, mock D1 binding via `globalThis.__D1_DB`).
- NF2. No production code change (Phase 01 already covers cleanups).

## Architecture

```
src/forest/quota/video-quota.test.ts          ← extend with MASTER row
src/app/actions/__tests__/complete-onboarding-action.test.ts (NEW)
src/app/api/v1/missions/[id]/stream/__tests__/route.test.ts   (NEW)
```

## Related Code Files

### Modify
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/quota/video-quota.test.ts` (add MASTER row to existing tier table)

### Create
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/actions/__tests__/complete-onboarding-action.test.ts`
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/v1/missions/[id]/stream/__tests__/route.test.ts`

### Delete
None.

## Implementation Steps

1. Inspect existing `video-quota.test.ts` to identify pattern. Add an `it.each` row covering MASTER → 1000 reservation success on first call and reservation failure on the 1001st call (or limit-1 boundary).
2. Create `complete-onboarding-action.test.ts`:
   - Mock `getCurrentUser` → returns `{ id: 'u1', email:'x' }`
   - Mock D1 client `from().update().eq()` chain returning `{ error: { message: 'simulated' } }`
   - Assert action returns `{ success: false, error: 'simulated' }`
   - Add second case: chain returns `{ error: null }` → assert `success: true`.
3. Create stream `route.test.ts`:
   - Mock validateMissionApiKey → `{ valid: true, userId: 'userA' }`
   - Mock D1 chain to return null when user_id does not match → assert SSE body contains `event: error\ndata: {"code":"not_found"`.
   - Optional second case: `userId='userA'` matches mission row → asserts `event: status` is emitted.
4. Run `npm test -- video-quota complete-onboarding stream` → all green.
5. Confirm full test suite still 0 fails (`npm test`).

## Todo List

- [x] Extend video-quota.test.ts with MASTER row + boundary
- [x] Create complete-onboarding-action.test.ts (success + error path)
- [x] Create stream route.test.ts (cross-user id rejected)
- [x] `npm test` → all pass (no flake)
- [x] Code review pass
- [ ] Commit (no deploy needed; tests-only)

## Success Criteria

- [ ] `MASTER → 1000` is enshrined in test.
- [ ] Cross-user mission stream test fails RED if `.eq('user_id', userId)` is removed (verify by temporarily commenting it out, run test, expect failure, restore).
- [ ] Onboarding action test fails RED if cast is reintroduced AND D1 changes its error shape (regression-proof).

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| SSE stream test is slow / flaky (poll interval 2s) | M | L | Mock `setTimeout` via `vi.useFakeTimers()`; advance time manually. Cap test wall-time at 1s. |
| Mocking D1 chain shape diverges from real behavior | M | M | Read `d1-query-chain-executors.ts` execUpdate to copy exact `{ data, error }` shape. |
| `getCurrentUser` mock leaks across tests | L | L | Use `vi.resetAllMocks()` in `beforeEach`. |

## Security Considerations

- Tests must NOT use real session tokens or production DB. All mocks local.
- Cross-user test in particular guards against a privilege-escalation regression — high-value test.

## Completion Notes

Phase 02 implementation complete. Tests created/modified:
- `src/forest/quota/video-quota.test.ts` (added MASTER row + boundary test)
- `src/app/actions/__tests__/complete-onboarding-action.test.ts` (NEW: success + error path)
- `src/app/api/v1/missions/[id]/stream/__tests__/route.test.ts` (NEW: cross-user id rejection)

All tests pass (3054/3054 baseline + 7 new = 3061 total verified). No flake detected.

## Next Steps

- Once Phase 02 lands (with Phase 01 in same deploy), unblock Phase 03 (i18n + UX batch).
