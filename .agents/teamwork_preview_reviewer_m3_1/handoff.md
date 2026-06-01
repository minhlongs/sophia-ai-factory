# Review & Audit Handoff Report — Milestone 3 Fixes

**Verdict**: REQUEST_CHANGES

---

## 1. Observation

### 1.1 Test Failures
Running the test command:
`npm run ci:test` inside `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/`
resulted in **exit code 1** with 4 unit test failures in `complete-video-from-webhook.test.ts`:

```
 FAIL  src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts > failVideoFromWebhook > records attempt (CAS) when below MAX_ATTEMPTS threshold
AssertionError: expected "vi.fn()" to be called with arguments: [ 'vid-1', 'timeout' ]
Number of calls: 0
 ❯ src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts:214:37
    214|     expect(recordWebhookAttemptCAS).toHaveBeenCalledWith('vid-1', 'timeout')

 FAIL  src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts > failVideoFromWebhook > marks permanent failure (CAS) and compensates when attempt_count reaches MAX_ATTEMPTS
AssertionError: expected "vi.fn()" to be called with arguments: [ 'vid-1', 'api_error', 4 ]
Number of calls: 0
 ❯ src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts:223:44
    223|     expect(markWebhookPermanentFailureCAS).toHaveBeenCalledWith('vid-1', 'api_error', 4)

 FAIL  src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts > failVideoFromWebhook > M2: CAS lost on permanent failure — skips email + compensation
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
Received:
  1st vi.fn() call:
    Array [
      "purch-1",
      "render_failed_permanent",
    ]
Number of calls: 1
 ❯ src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts:236:41
    236|     expect(grantCompensationCredit).not.toHaveBeenCalled()

 FAIL  src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts > failVideoFromWebhook > skips compensation and email when purchase is refunded on permanent failure
AssertionError: expected "vi.fn()" to be called with arguments: [ 'vid-1', 'api_error', 4 ]
Number of calls: 0
 ❯ src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts:269:44
    269|     expect(markWebhookPermanentFailureCAS).toHaveBeenCalledWith('vid-1', 'api_error', 4)
```

### 1.2 Webhook Failure Implementation Code
In `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts` lines 22-26 and 227-269:
```typescript
import {
  findByHeygenJobId,
  markPermanentFailureCAS,
  recordAttemptCAS,
} from '@/seed/db/repositories/videos-repo'
...
    if (nextAttemptCount >= MAX_ATTEMPTS) {
      // CAS: only the winner of the race sends email + compensation
      const won = await markPermanentFailureCAS(row.id, errorText, nextAttemptCount - 1)
      if (!won) {
        logger.info('[WebhookFail] CAS lost — another caller already marked permanent failure', {
          videoId: row.id,
        })
        return
      }
...
    } else {
      // CAS: increment attempt_count only when still in 'queued' state
      const newCount = await recordAttemptCAS(row.id, errorText)
      if (newCount === null) {
        logger.info('[WebhookFail] CAS lost — row already transitioned, skipping recordAttempt', {
          videoId: row.id,
        })
        return
      }
```

### 1.3 Repository Code
In `apps/sophia-ai-factory/src/seed/db/repositories/videos-repo.ts`:
```typescript
export async function recordWebhookAttemptCAS(
  videoId: string,
  errorMsg: string,
): Promise<number | null> {
  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)

  const result = await db
    .prepare(
      `UPDATE videos
       SET status = 'queued',
           attempt_count = attempt_count + 1,
           last_attempt_at = ?2,
           last_error = ?3
       WHERE id = ?1 AND status = 'processing'
       RETURNING attempt_count`,
    )
    .bind(videoId, now, errorMsg)
    .first<{ attempt_count: number }>()

  return result?.attempt_count ?? null
}

export async function markWebhookPermanentFailureCAS(
  videoId: string,
  reason: string,
  minAttemptCount: number,
): Promise<boolean> {
  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)

  const result = await db
    .prepare(
      `UPDATE videos
       SET status = 'failed_permanent',
           last_attempt_at = ?2,
           last_error = ?3
       WHERE id = ?1
         AND status = 'processing'
         AND attempt_count >= ?4
       RETURNING id`,
    )
    .bind(videoId, now, reason, minAttemptCount)
    .first<{ id: string }>()

  return result !== null
}
```

---

## 2. Logic Chain

1. When a video is submitted to HeyGen, its status in the `videos` table transitions to `'processing'`.
2. When the HeyGen webhook reports a failure (`failVideoFromWebhook`), the video row status is still `'processing'`.
3. In `complete-video-from-webhook.ts`, `failVideoFromWebhook` calls `recordAttemptCAS` and `markPermanentFailureCAS` (which update rows `WHERE status = 'queued'`).
4. Since the video status in the database is `'processing'` (not `'queued'`), these SQL updates match 0 rows and return `null` or `false`.
5. As a result:
   - The video remains stuck in `'processing'` status indefinitely.
   - The retry count is never incremented, the error log is not saved, and the video is not queued back.
   - The mock assertions in `complete-video-from-webhook.test.ts` (which expect `recordWebhookAttemptCAS` and `markWebhookPermanentFailureCAS` to be invoked) fail, causing the unit tests to fail.
6. To fix this, `complete-video-from-webhook.ts` must import and use `recordWebhookAttemptCAS` and `markWebhookPermanentFailureCAS` instead of the queue-based variants.

---

## 3. Caveats

- **Time-check formatting**: In `video-status-sync` cron, `row.created_at` is returned as a number (representing seconds since epoch) and multiplied by 1000 inside `new Date(...)`. This resolves the legacy parsing mismatch that triggered instant timeouts for active jobs (since JavaScript parsed seconds as milliseconds, moving the creation date back to 1970). However, if there are any database engines/drivers returning ISO datetimes (as text), `Number(row.created_at)` will be `NaN`. Based on D1 schemas, `created_at` is strictly configured as `INTEGER DEFAULT (unixepoch())`, so this representation is correct in production.

---

## 4. Conclusion

- The implementation of Milestone 3 has a **critical correctness defect** that breaks test execution and prevents HeyGen webhook failures from being recorded in production (stalling them in `'processing'`).
- The CAS optimization logic, batch timeout thresholds, and credit decrements are structurally correct, but this integration mismatch makes the system fragile.
- **Verdict**: REQUEST_CHANGES to correct the imported function bindings in the webhook handler file.

---

## 5. Verification Method

### 5.1 Verification Commands
Verify typechecking passes:
```bash
cd apps/sophia-ai-factory
npm run ci:typecheck
```

Verify unit tests pass:
```bash
cd apps/sophia-ai-factory
npm run ci:test
```

### 5.2 Specific Code Audits
Inspect `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts` to ensure:
1. `recordWebhookAttemptCAS` and `markWebhookPermanentFailureCAS` are imported from `@/seed/db/repositories/videos-repo`.
2. `recordWebhookAttemptCAS` is called inside the non-exhaustion retry path of `failVideoFromWebhook`.
3. `markWebhookPermanentFailureCAS` is called inside the exhaustion path of `failVideoFromWebhook`.

---

## 6. Quality & Adversarial Review Details

### 6.1 Attack Surface Challenge
- **Scenario**: A HeyGen job fails rendering, triggering the `avatar_video.fail` webhook.
- **Expected Behavior**: The status transitions from `'processing'` to `'queued'` (if attempts < 5) or `'failed_permanent'` (if attempts >= 5). A compensation credit is granted on permanent failure.
- **Actual Behavior**: The CAS queries match 0 rows due to checking `status = 'queued'`. The update silently fails. The video is permanently orphaned in the `'processing'` state, and the user never receives their credit back.

### 6.2 Stress Test Results
- **Scenario 1**: Concurrent webhook + cron execution on terminal completion.
  - *Result*: Pass (CAS status guard prevents double completions).
- **Scenario 2**: Concurrent webhook + cron execution on rendering failure.
  - *Result*: **FAIL** (Webhook failure is silently dropped; cron polling eventually times out the job after 24h, causing delayed compensation instead of real-time fallback).
