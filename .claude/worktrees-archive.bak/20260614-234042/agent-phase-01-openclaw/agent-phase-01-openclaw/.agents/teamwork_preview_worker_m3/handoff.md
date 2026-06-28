# Handoff Report — Milestone 3: Credits & Video Concurrency Fixes

## 1. Observation
- Modified `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts` at line 125, replacing `WHERE id = ?1` with `WHERE id = ?1 AND status != 'completed' AND status != 'failed_permanent'`. The row mutation count is validated via `(result.meta?.changes ?? 0) > 0`. If `0`, we log a warning: `logger.warn('[WebhookComplete] CAS lost — video already completed or failed permanently', { videoId: row.id })` and return early.
- Updated the webhook unit tests mock function `makeD1` in `apps/sophia-ai-factory/src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts` to return `meta: { changes: 1 }`.
- Rewrote `decrementCredits` in `apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts` to use raw SQL via `getD1Raw()`, querying the user purchase remaining credits:
  ```sql
  SELECT credits_remaining FROM user_purchases WHERE id = ?1 AND status = 'paid' LIMIT 1
  ```
  And atomically updating the credits remainder:
  ```sql
  UPDATE user_purchases SET credits_remaining = credits_remaining - 1, updated_at = ?2 WHERE id = ?1 AND status = 'paid' AND credits_remaining = ?3 AND credits_remaining > 0
  ```
  Returns `(result.meta?.changes ?? 0) > 0`.
- Mocked `getD1Raw()` in `apps/sophia-ai-factory/src/seed/db/repositories/__tests__/user-purchases-repo.test.ts` to mock execution results properly (returning changes: 1 on success, changes: 0 on collision).
- Extracted retry row processing logic in `apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/route.ts` into a helper function `processRowRetry(row, now, summary)`.
- Restructured `GET` function in the cron route to filter eligible rows in-memory via `rows.filter(row => isRetryDue(row.attempt_count, row.last_attempt_at, now))`. Concurrently processes in chunks of 5 using `Promise.all` with a wall-time safety check threshold of 20 seconds (`MAX_WALL_TIME_MS = 20000`) checking `Date.now() - startTime`.
- Created route unit tests in `apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/__tests__/route.test.ts` exercising successful processing, skipped/due filtering, and concurrency.
- Ran typechecks (`npm run ci:typecheck` in the app directory) which compiled successfully, and ran vitest which returned:
  ```
  ✓ src/seed/db/repositories/__tests__/user-purchases-repo.test.ts (17 tests) 32ms
  ✓ src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts (10 tests) 11ms
  ✓ src/app/api/cron/fulfillment-retry/__tests__/route.test.ts (3 tests) 9ms

  Test Files  3 passed (3)
  Tests  30 passed (30)
  ```

## 2. Logic Chain
- Concurrency race conditions on the HeyGen Webhook were caused by non-atomic updates where multiple database updates or R2 downloads could trigger concurrently. Adding SQL state-guard checks (`status != 'completed' AND status != 'failed_permanent'`) inside the update block ensures only one concurrent execution actually updates the row, validated by asserting that `result.meta.changes > 0`.
- Custom D1 builder clients (`createServerClient()`) perform a post-update SELECT using the original where-clause parameters. For credit decrements, this post-update select checks for the old credit balance, which has already been changed, causing the query builder to throw errors or falsely return empty rows. Bypassing the client and executing raw queries via `getD1Raw` allows directly asserting the execution metadata (`result.meta.changes > 0`) to confirm successful mutation.
- Processing retries sequentially in a loop blocks Edge execution and triggers timeout limits. Chunking the queue into groups of 5 with concurrent `Promise.all` and adding a wall-time safety threshold allows gracefully aborting the job loop before worker timeout occurs.

## 3. Caveats
- The wall-time safety limit threshold of 20 seconds is checked at the start of each batch. If a single batch itself stalls on an external HTTP request, it may still run slightly past the threshold, but chunking ensures bounded execution.
- Only the specific components and endpoints in scope were refactored. No general codebase refactoring or unrelated cleanup was performed.

## 4. Conclusion
All four Milestone 3 fixes (HeyGen Webhook CAS, raw D1 optimistic locking check for user purchases repository, parallelized cron retry queue chunking with timeout bounds, and full build/test verification) are fully implemented, robustly covered by unit tests, and compile clean.

## 5. Verification Method
- **Typecheck command**: `npm run ci:typecheck` inside `apps/sophia-ai-factory`
- **Test command**: `npx vitest run src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts src/seed/db/repositories/__tests__/user-purchases-repo.test.ts src/app/api/cron/fulfillment-retry/__tests__/route.test.ts`
- **Files to inspect**:
  - `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts`
  - `apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts`
  - `apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/route.ts`
