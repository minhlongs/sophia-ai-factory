## 2026-05-31T07:32:16Z

<USER_REQUEST>
You are teamwork_preview_worker. Your working directory is: /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_worker_m3_retry1/

Your objective is to implement robust fixes for Milestone 3 (Credits & Video Concurrency) and resolve the critical defects identified in the review.

Refer to the synthesis report at: /Users/macbook/projects/sophia-ai-factory/.agents/orchestrator_fixes_run1/synthesis_m3.md
And the reviewer's reports at:
- /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_reviewer_m3_1/handoff.md
- /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_reviewer_m3_2/handoff.md

Implement the following:

1. Webhook Failure CAS State Precondition Mismatch:
   - In `apps/sophia-ai-factory/src/seed/db/repositories/videos-repo.ts`, define two new repository methods:
     - `recordWebhookAttemptCAS(videoId: string, errorMsg: string): Promise<number | null>`: updates rows where `id = videoId` and `status = 'processing'`. It must set `status = 'queued'` (to put it back in the retry queue for the retry cron), increment `attempt_count = attempt_count + 1`, update `last_attempt_at = now` and `last_error = errorMsg`, and return `attempt_count`.
     - `markWebhookPermanentFailureCAS(videoId: string, reason: string, minAttemptCount: number): Promise<boolean>`: updates rows where `id = videoId`, `status = 'processing'`, and `attempt_count >= minAttemptCount`. It must set `status = 'failed_permanent'`, update `last_attempt_at = now` and `last_error = reason`, and return `true` if updated (using returning id to verify row mutation).
   - In `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts` inside `failVideoFromWebhook()`:
     - Replace calls to `recordAttemptCAS` and `markPermanentFailureCAS` with your new `recordWebhookAttemptCAS` and `markWebhookPermanentFailureCAS` methods.
     - Before granting compensation credit or sending the failure email, check if the linked purchase is refunded:
       ```typescript
       if (row.purchase_id) {
         const { data: purchaseData } = await clientDb.from('user_purchases').select('status').eq('id', row.purchase_id).single();
         if ((purchaseData as any)?.status === 'refunded') {
           logger.info('[WebhookFail] Skipping email and compensation — purchase refunded', { purchaseId: row.purchase_id });
           return;
         }
         // ... proceed to grant compensation and send email
       }
       ```
   - Update tests in `apps/sophia-ai-factory/src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts` to mock the new `recordWebhookAttemptCAS` and `markWebhookPermanentFailureCAS` methods instead of the queued ones.

2. Active Video Instant Timeout & Credit Leakage in Dependent Sync Cron:
   - In `apps/sophia-ai-factory/src/app/api/cron/video-status-sync/route.ts` around line 150:
     - Fix the date parsing of `row.created_at`. Since D1 stores `created_at` as integer seconds (via `unixepoch()`), change:
       `const createdAt = new Date(row.created_at).getTime();`
       to:
       `const createdAt = new Date(Number(row.created_at) * 1000).getTime();`

3. Retry Cron Refund-Mid-Render Failure Path Check:
   - In `apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/route.ts` inside `processRowRetry()`, before granting compensation credit or sending failure email:
     - Check if the linked purchase is refunded. You can query the purchase using the database client `createServerClient()`. If `purchase.status === 'refunded'`, skip granting compensation credit and sending the email.

4. Build & Test Verification:
   - Verify that all typechecks (`npm run ci:typecheck` inside apps/sophia-ai-factory) and vitest unit/integration tests pass cleanly.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please execute these changes, verify them, write a handoff report to: /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_worker_m3_retry1/handoff.md and notify me.
</USER_REQUEST>
