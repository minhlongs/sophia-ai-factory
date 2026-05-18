# Refactor: Extract Account Lockout — 2026-05-18

## LOC Before / After

| File | Before | After |
|---|---|---|
| `sql-rate-limiter.ts` | 290 | 152 |
| `account-lockout.ts` | — (new) | 154 |

Both files now under 200-LOC guideline.

## Files Modified

- `src/seed/security/sql-rate-limiter.ts` — removed lockout block (lines 144–290), added re-export block for back-compat, updated header comment
- `src/seed/security/account-lockout.ts` — CREATED; contains all 4 lockout symbols + D1Binding interface + internal getD1()
- `src/seed/auth/account-lockout-hook.ts` — import path changed: `@/seed/security/sql-rate-limiter` → `@/seed/security/account-lockout`

## Back-compat Decision

Re-export block kept in `sql-rate-limiter.ts` so F01 test file (`f01-per-account-rate-limit.test.ts`) needs zero changes — it still imports from `sql-rate-limiter` and resolves through to the new module.

## Test Results

- F01 tests: **14/14 passed**
- Typecheck: **0 errors**
- Lint: **341 warnings, 0 errors** (341 = pre-existing ceiling, unchanged)

## Unresolved

None.
