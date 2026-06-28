## 2026-05-31T07:21:45Z
You are teamwork_preview_worker. Your working directory is: /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_worker_m3/
Your task is to implement the fixes for Milestone 3: Credits & Video Concurrency.

Please refer to the synthesis report at: /Users/macbook/projects/sophia-ai-factory/.agents/orchestrator_fixes_run1/synthesis_m3.md
And proposed implementations by explorers at:
- /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_m3_2/analysis.md
- /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_m3_3/analysis.md

Implement the following:
1. HeyGen Success Webhook Compare-And-Swap (CAS):
   - In `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts`, update the status update SQL statement to include `status != 'completed'` and `status != 'failed_permanent'` (or just `status != 'completed'`) in the `WHERE` clause.
   - Run the query and verify that the row was actually mutated by checking `(result.meta?.changes ?? 0) > 0` (or using a similar SQLite mechanism). If it was not mutated (value is 0), log a warning and return early from the handler.
   - Modify the test file `apps/sophia-ai-factory/src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts`'s D1 prepare mock to return `meta: { changes: 1 }` to align with the changes check.

2. Optimistic Locking in `decrementCredits`:
   - In `apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts`, bypass the fluent query builder client (which runs a post-update select and fails when updated fields are filtered) and perform raw SQL update using `getD1Raw()`.
   - Update `user_purchases` setting `credits_remaining = credits_remaining - 1` and `updated_at = now` where `id = ? AND status = 'paid' AND credits_remaining = ? AND credits_remaining > 0`.
   - Verify row mutation using `(result.meta?.changes ?? 0) > 0` and return true ONLY if changes is greater than 0.
   - Mock `getD1Raw()` inside `apps/sophia-ai-factory/src/seed/db/repositories/__tests__/user-purchases-repo.test.ts` to mock execution results properly (returning changes: 1 on success, changes: 0 on collision).

3. Parallelized Cron Retry Loop:
   - In `apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/route.ts`, extract retry row processing logic into a helper function `processRowRetry(row, now, summary)`.
   - Filter eligible rows in-memory first to obtain due rows.
   - Process due rows concurrently in chunks of 5 using `Promise.all` instead of sequentially.
   - Implement a wall-time safety limit check (e.g. 20 seconds threshold) to gracefully abort processing remaining chunks if execution runs too long.

4. Build & Test Verification:
   - Verify that both typechecks (`npm run ci:typecheck`) and tests (`npm run ci:test`) pass cleanly.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please execute the changes, run build and test verification, write a handoff report to: /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_worker_m3/handoff.md.
