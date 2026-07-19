## 2026-05-31T07:47:53Z
**Context**: Implementing Quota Metering & Performance - Case 4.1 & 4.2 in `apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker.ts` and `apps/sophia-ai-factory/src/forest/quota/quota-checker-db.ts`.
**Content**: You are a worker with loadable domain expertise. Your working directory is `/Users/macbook/projects/sophia-ai-factory/.agents/worker_m4`.
Please refer to the synthesized findings in `/Users/macbook/projects/sophia-ai-factory/.agents/orchestrator_fixes_run1/synthesis_m4.md` and implement the following:

1. **Case 4.1: Redis Non-Atomic Read-Modify-Write**:
   - In `apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker-kv-ops.ts`, implement `incrementRealTimeUsage` using a Redis pipeline with `hincrby` (Hash field = stringified `windowStart`) and `expire` (resets TTL on the key `usage:${userId}:${licenseNonce}`).
   - Update `getRealTimeUsage` to read from the Hash key using `hget`.
   - Update `trackWithCircuitBreaker` in `realtime-tracker.ts` to use `incrementRealTimeUsage`.
   - Invalidation in `invalidateRealTimeCache` must continue to use `del(key)` which is O(1).
   - Write a unit test file `apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker.test.ts` to verify basic and concurrent increments.

2. **Case 4.2: D1 Usage Query JavaScript Rollup Performance**:
   - In `apps/sophia-ai-factory/src/forest/quota/quota-checker-db.ts`, refactor `calculateCurrentUsage` to run a single SQLite aggregate query via `getD1Raw()` and a prepared statement with conditional aggregates `SUM(CASE WHEN...)` and `COUNT(CASE WHEN...)`, bound to the appropriate rolling window timestamps (`hourStart`, `dayStart`, `monthStart`, etc.).
   - Create a corresponding unit test file (e.g. `quota-checker-db.test.ts` or add cases in the adjacent test suite) to verify the aggregate rollup logic.

Verify your work:
- Run vitest on both new test suites and ensure all existing tests pass: `npx vitest run src/forest/usage-metering/ src/forest/quota/`
- Run the compiler checks: `npm run ci:typecheck` (or `npm run type-check`)
- Run `python3 scripts/verify-go-live-docs.py` and `bash scripts/ci/run-gates.sh` to ensure no validation gate failures.
Provide your verification command output in your handoff report.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your parent is aa61d1be-e9e2-442b-a2c6-60c57f94f9ae.
**Action**: Implement the fixes, run all verification tests, document the results in `handoff.md` and notify me when completed.
