# Synthesis: Milestone 3 - Credits & Video Concurrency (Updated)

## Consensus
All Explorer and Reviewer agents agree on the exact issues and proposed remediations for the Credits & Video Concurrency edge cases:

1. **HeyGen Completed Webhooks Duplicate Execution (Case 3.1)**:
   - **Root Cause**: Webhook handler `completeVideoFromWebhook()` in `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts` updates status to `completed` without checking if it is already completed or failed, leading to duplicate email triggers and R2 copy races.
   - **Remediation**: Append `AND status != 'completed' AND status != 'failed_permanent'` to the SQL UPDATE query. Check `(result.meta?.changes ?? 0) === 0` to verify if the webhook lost the race, returning early if so to skip email send and subsequent calls.

2. **Optimistic Locking Failure in `decrementCredits` (Case 3.3)**:
   - **Root Cause**: `decrementCredits` in `apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts` returns `true` blindly without checking if the row was actually updated. Using chainable query builder `.update()` with `.single()` or `.returning()` causes a subsequent SELECT with the *original* filters, which fails to find the row (since the credits value was decremented), resulting in false-negative `No rows updated` errors.
   - **Remediation**: Execute the update via raw D1 query using `getD1Raw()` directly, checking `(result.meta?.changes ?? 0) > 0` to return `true` on successful update and `false` on lock conflict.

3. **Fulfillment Retry Cron Wall-Time Limit (Case 3.4)**:
   - **Root Cause**: The Cron handler in `apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/route.ts` loops through stuck queue rows sequentially. Sequentially sending requests to HeyGen and emails can exceed the Cloudflare Edge runtime limit of 30 seconds.
   - **Remediation**: Filter queue rows that are actually due for retry, chunk them into batches of 5, and execute the processing logic for each batch concurrently using `Promise.all()`.

## Resolved Reviewer Conflicts & Critical Gaps
During the review cycle, two critical defects and one coverage gap were identified:

1. **Webhook Failure CAS State Precondition Mismatch**:
   - **Issue**: `failVideoFromWebhook` was updated to call `recordAttemptCAS` and `markPermanentFailureCAS`. However, both of these methods enforce `WHERE status = 'queued'`. Because in-flight videos are in `'processing'` state, these CAS queries fail to update any rows (returning changes = 0), leaving failed rendering videos stuck in `'processing'` forever in production.
   - **Remediation**: Create new database repository helpers `recordWebhookAttemptCAS` and `markWebhookPermanentFailureCAS` in `videos-repo.ts` that specifically target rows where `status = 'processing'`. When recording an attempt, the method must transition the status back to `'queued'` (so the retry cron can pick it up). When marking permanent failure, it transitions to `'failed_permanent'`.

2. **Active Video Instant Timeout & Credit Leakage in Dependent Sync Cron**:
   - **Issue**: In `apps/sophia-ai-factory/src/app/api/cron/video-status-sync/route.ts` line 150, the cron parses the D1 timestamp (stored in seconds as `unixepoch()` in SQLite) using `new Date()` (which expects milliseconds). This interprets seconds as milliseconds, yielding Jan 20, 1970. This causes all in-flight rendering videos to be instantly flagged as timed out (>24h), marked as `failed_permanent`, and granted compensation credits.
   - **Remediation**: Modify the date parsing: `const createdAt = new Date(Number(row.created_at) * 1000).getTime();`.

3. **Refund-Mid-Render Failure Path Email and Compensation Leak**:
   - **Issue**: `failVideoFromWebhook` and `processRowRetry` do not check if the purchase was refunded. They will grant compensation credits and send failure emails to users whose purchases are already refunded.
   - **Remediation**: Check `purchase.status === 'refunded'` before executing the compensation credit and sending the failure email.
