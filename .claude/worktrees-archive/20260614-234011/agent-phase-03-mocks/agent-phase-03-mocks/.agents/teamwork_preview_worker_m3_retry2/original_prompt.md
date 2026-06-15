## 2026-05-31T07:38:38Z
You are teamwork_preview_worker. Your working directory is: /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_worker_m3_retry2/

Your objective is to fix a minor coverage gap in Milestone 3 (Credits & Video Concurrency):

1. Purchase Refund Check in video-status-sync cron:
   - In `apps/sophia-ai-factory/src/app/api/cron/video-status-sync/route.ts` inside `handleOneBundlePermanentFailure(db, row, reason)`:
     - Check if the linked purchase is refunded. Query the `user_purchases` table using `createServerClient()`.
     - If the purchase status is `'refunded'`, log a warning/info message and skip calling `grantCompensationCredit` and sending the failed render email.
     - Note: ensure that `createServerClient` is imported and used correctly. (Import `createServerClient` from `@/seed/db/client` if it isn't already).

2. Test verification:
   - Update `apps/sophia-ai-factory/src/app/api/cron/video-status-sync/route.test.ts` to add a test case verifying that if the purchase status is `'refunded'`, `handleOneBundlePermanentFailure` skips both granting compensation credit and sending the email.
   - Verify that all typechecks (`npm run ci:typecheck` inside apps/sophia-ai-factory) and vitest unit/integration tests pass cleanly.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please execute these changes, verify them, write a handoff report to: /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_worker_m3_retry2/handoff.md and notify me.
