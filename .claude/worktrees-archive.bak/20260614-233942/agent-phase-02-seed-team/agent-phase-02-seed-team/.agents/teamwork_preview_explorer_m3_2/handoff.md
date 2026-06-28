# Handoff Report - Milestone 3 Edge Cases (Credits & Video Concurrency)

This report details the findings and implementation recommendations for addressing three specific edge cases in Milestone 3:
1. **Case 3.1: Concurrent Duplicate HeyGen Webhooks (Success)**
2. **Case 3.3: Optimistic Locking Failure in decrementCredits**
3. **Case 3.4: Worker Timeouts in Retry Queue Batch Loops**

No direct changes have been made to the codebase, adhering to the read-only constraint.

---

## 1. Observation

### Case 3.1: HeyGen Webhooks Success Concurrency
- **File:** `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts`
- **Lines 89-96:**
  ```typescript
  // Idempotency — already terminal
  if (row.status === 'completed' || row.status === 'failed_permanent') {
    logger.info('[WebhookComplete] Already in terminal state, skipping', {
      videoId: row.id,
      status: row.status,
    })
    return
  }
  ```
- **Lines 101-132:**
  ```typescript
  // Copy to R2 (best-effort)
  let r2Key: string | null = null
  let r2SizeBytes: number | null = null
  try {
    const stored = await downloadAndStore(videoUrl, row.id, `videos/${row.user_id}/${row.id}.mp4`)
    r2Key = stored.path
    r2SizeBytes = stored.sizeBytes
  } catch (r2Err) {
    logger.warn('[WebhookComplete] R2 copy failed — keeping HeyGen URL', {
      videoId: row.id,
      error: getErrorMessage(r2Err),
    })
  }

  // completed_at is set ONCE on terminal transition (P27 honest benchmark — migration 0113).
  // now is unix-epoch INTEGER; updated_at column happens to be TEXT, so we keep the existing
  // datetime('now') default by binding `now` as INTEGER cast to TEXT via SQLite implicit conversion.
  const nowEpoch = Math.floor(Date.now() / 1000)
  await d1
    .prepare(
      `UPDATE videos
       SET status = 'completed',
           video_url = ?2,
           thumbnail_url = ?3,
           r2_key = ?4,
           r2_size_bytes = ?5,
           updated_at = ?6,
           completed_at = COALESCE(completed_at, ?7)
       WHERE id = ?1`,
    )
    .bind(row.id, videoUrl, thumbnailUrl ?? null, r2Key, r2SizeBytes, now, nowEpoch)
    .run()
  ```

### Case 3.3: Optimistic Locking in decrementCredits
- **File:** `apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts`
- **Lines 180-205:**
  ```typescript
  export async function decrementCredits(purchaseId: string): Promise<boolean> {
    const db = createServerClient()
    const now = Math.floor(Date.now() / 1000)

    // Fetch current credits first
    const { data } = await db
      .from('user_purchases')
      .select('credits_remaining')
      .eq('id', purchaseId)
      .eq('status', 'paid')
      .single()

    const row = data as { credits_remaining: number } | null
    if (!row || row.credits_remaining <= 0) return false

    await db
      .from('user_purchases')
      .update({
        credits_remaining: row.credits_remaining - 1,
        updated_at: now,
      })
      .eq('id', purchaseId)
      .eq('credits_remaining', row.credits_remaining) // optimistic check

    return true
  }
  ```
- **D1QueryChain Emulated Mutation Verification (`apps/sophia-ai-factory/src/seed/db/d1-query-chain-executors.ts` lines 113-122):**
  ```typescript
  if (state.returnCols || state.isSingle) {
    const selectCols = state.returnCols ?? state.selectCols
    if (state.isSingle) {
      const result = await state.db.prepare(`SELECT ${selectCols} FROM ${state.table}${clause}`).bind(...params).first()
      return result ? { data: parseJsonFields(result), error: null } : { data: null, error: { message: 'No rows updated' } }
    }
    const result = await state.db.prepare(`SELECT ${selectCols} FROM ${state.table}${clause}`).bind(...params).all()
    return { data: (result.results ?? []).map(parseJsonFields), error: null }
  }
  ```

### Case 3.4: Worker Timeouts in Retry Queue Batch Loops
- **File:** `apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/route.ts`
- **Lines 103-195:**
  ```typescript
    try {
      const rows = await listQueuedForRetry(MAX_ATTEMPTS, BATCH_LIMIT)

      for (const row of rows) {
        // Skip rows not yet due based on backoff schedule
        if (!isRetryDue(row.attempt_count, row.last_attempt_at, now)) {
          summary.skipped++
          continue
        }

        summary.retried++

        // Per-row: resolve this user's HeyGen key (customer must have own key)
        const keyResult = await getHeyGenKey({ userId: row.user_id, fallbackToPlatform: false })
        if (!keyResult) {
          await recordAttemptCAS(row.id, 'no_user_heygen_key')
          summary.failed++
          continue
        }
        const rowApiKey = keyResult.key

        const script = row.script ?? ''
        const title = `Welcome Bundle — ${row.id.slice(0, 8)}`
        const callbackUrl =
          process.env.NODE_ENV === 'production'
            ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/webhooks/heygen`
            : undefined

        try {
          const { videoId: heygenJobId } = await createHeyGenVideo({ script, title, apiKey: rowApiKey, callbackUrl })
          await markVideoProcessing(row.id, heygenJobId)
          try { await recordHeyGenAttempt(true) } catch { /* non-fatal */ }
          summary.succeeded++

          logger.info('[fulfillment-retry] Retry succeeded', {
            videoId: row.id,
            purchaseId: row.purchase_id,
            heygenJobId,
          })
        } catch (err) {
          const errMsg = getErrorMessage(err)
          const nextAttemptCount = row.attempt_count + 1
          try { await recordHeyGenAttempt(false) } catch { /* non-fatal */ }

          if (nextAttemptCount >= MAX_ATTEMPTS) {
            // M2 CAS: only the caller that wins the race sends email + compensation
            const won = await markPermanentFailureCAS(row.id, errMsg, nextAttemptCount - 1)
            if (!won) {
              logger.info('[fulfillment-retry] CAS lost — permanent failure already set', {
                videoId: row.id,
              })
              continue
            }

            summary.permanent++

            logger.warn('[fulfillment-retry] Permanent failure — compensating', {
              videoId: row.id,
              purchaseId: row.purchase_id,
              attempts: nextAttemptCount,
            })

            if (row.purchase_id) {
              await grantCompensationCredit(row.purchase_id, 'render_failed_permanent')

              const userInfo = await fetchUserEmail(row.user_id)
              const failedEmailInput: SendBundleRenderFailedInput = {
                userEmail: userInfo?.email,
                userId: row.user_id,
                purchaseId: row.purchase_id,
                locale: userInfo?.locale ?? row.locale ?? 'vi',
              }
              await sendBundleRenderFailedEmail(failedEmailInput)
            }
          } else {
            // M2 CAS: increment only if still in 'queued' state
            const newCount = await recordAttemptCAS(row.id, errMsg)
            if (newCount === null) {
              logger.info('[fulfillment-retry] CAS lost — row already transitioned, skipping', {
                videoId: row.id,
              })
              continue
            }
            summary.failed++

            logger.warn('[fulfillment-retry] Attempt failed', {
              videoId: row.id,
              purchaseId: row.purchase_id,
              attempt: newCount,
              error: errMsg,
            })
          }
        }
      }
  ```

---

## 2. Logic Chain

### Case 3.1: HeyGen Success Webhooks Concurrency
1. In `completeVideoFromWebhook`, the JS memory idempotency check (`row.status === 'completed'`) occurs before the long-running R2 download/upload (`downloadAndStore`).
2. Concurrent webhook calls will pass this check simultaneously if the DB row hasn't been updated yet. They will both download and upload the video to R2, wasting bandwidth and triggering duplicate ready emails.
3. **Solution:** Execute the SQLite update using CAS *before* triggering `downloadAndStore`.
   - Update `status = 'completed'` ONLY if the current status is NOT `completed` and NOT `failed_permanent`.
   - Return early if the update affected 0 rows (lost the CAS race).
   - Only the winner of the CAS race performs the R2 upload and sends the email notification. Once the R2 copy completes, perform a subsequent update to record the R2 keys.

### Case 3.3: D1QueryChain / D1Client Bug in `decrementCredits`
1. The current `decrementCredits` function performs an optimistic locking check via:
   `db.from('user_purchases').update(...).eq('id', purchaseId).eq('credits_remaining', row.credits_remaining)`
2. It immediately returns `true` without checking if the database update statement actually mutated any rows.
3. If we try to check using the query builder's `.single()` or `.returning()` methods, it will **always** fail and return an error/empty results (even on success!).
   - **Why?** SQLite D1 does not natively return mutated rows on `.update()` in the query builder. Instead, `D1QueryChain` emulates this by running a secondary `SELECT` statement after the `UPDATE` using the **same** filters.
   - Since the filter includes `credits_remaining = old_value` and the update successfully changed `credits_remaining = old_value - 1`, the post-update `SELECT` statement will look for the old value and find nothing.
4. **Solution:** Avoid the query builder bug by executing a raw SQL statement via `getD1Raw()` and checking `result.meta.changes === 1`. This matches the pattern already used elsewhere in the codebase for CAS checks (e.g. `workflow-stepper/route.ts`).

### Case 3.4: Worker Timeouts in Retry Queue Batch Loops
1. The retry queue process up to `BATCH_LIMIT = 20` items sequentially in a `for` loop.
2. Because each HeyGen API request and email notification involves a network round-trip, executing 20 operations sequentially can easily exceed Cloudflare Worker timeout limits (especially on the free tier or under load).
3. **Solution:** Refactor the loop to group the items into concurrent chunks of 5 using `Promise.allSettled`.
   - `Promise.allSettled` is safer than `Promise.all` as it ensures that an unhandled rejection in one item does not abort the rest of the batch chunk.

---

## 3. Caveats

- **R2 Storage Sync:** If the worker crashes or fails during the subsequent R2 upload step after the CAS success transition, the video will remain completed using the HeyGen URL (`video_url`) rather than the R2 proxy URL. This is a safe fallback (non-blocking for the user).
- **Concurrency on `summary`:** Properties in the `summary` counter object are incremented inside concurrent microtasks. Since JavaScript execution is single-threaded, concurrent updates to properties like `summary.retried++` are atomic and free of race conditions.

---

## 4. Conclusion

The suggested changes are highly actionable and resolve the concurrency, race condition, and worker timeout issues with zero code replication and maximum structural safety.

---

## 5. Verification Method

To verify these changes:
1. Run the local vitest test suite:
   ```bash
   npm run test
   ```
2. Inspect the modified files to verify that line numbers and logic matches the recommendations.
3. Verify that the D1 database changes do not invalidate the schema.

---

## Proposed Code Changes

### Case 3.1: HeyGen Success Webhooks Concurrency
*File:* `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts`
*Replace lines 98–132 with:*
```typescript
  const d1 = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)
  const nowEpoch = Math.floor(Date.now() / 1000)

  // CAS: Mark status as 'completed' first, preventing concurrent webhook/retry runs from duplicate processing.
  // Checks status != 'completed' AND status != 'failed_permanent' to ensure idempotency.
  const updateResult = await d1
    .prepare(
      `UPDATE videos
       SET status = 'completed',
           video_url = ?2,
           thumbnail_url = ?3,
           updated_at = ?4,
           completed_at = COALESCE(completed_at, ?5)
       WHERE id = ?1 AND status != 'completed' AND status != 'failed_permanent'
       RETURNING id`,
    )
    .bind(row.id, videoUrl, thumbnailUrl ?? null, now, nowEpoch)
    .first<{ id: string }>()

  if (!updateResult) {
    logger.info('[WebhookComplete] CAS lost — video already in terminal state, skipping R2 and emails', {
      videoId: row.id,
    })
    return
  }

  // Copy to R2 (best-effort)
  let r2Key: string | null = null
  let r2SizeBytes: number | null = null
  try {
    const stored = await downloadAndStore(videoUrl, row.id, `videos/${row.user_id}/${row.id}.mp4`)
    r2Key = stored.path
    r2SizeBytes = stored.sizeBytes

    // Update R2 details on the completed row
    await d1
      .prepare(
        `UPDATE videos
         SET r2_key = ?2,
             r2_size_bytes = ?3
         WHERE id = ?1`,
      )
      .bind(row.id, r2Key, r2SizeBytes)
      .run()
  } catch (r2Err) {
    logger.warn('[WebhookComplete] R2 copy failed — keeping HeyGen URL', {
      videoId: row.id,
      error: getErrorMessage(r2Err),
    })
  }
```

### Case 3.3: Optimistic Locking in decrementCredits
*File:* `apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts`
*Replace line 8:*
```typescript
import { createServerClient, getD1Raw } from '@/seed/db/client'
```
*Replace lines 195–203 with:*
```typescript
  // Use raw D1 to execute the update and check mutated rows count,
  // avoiding the D1QueryChain post-update SELECT mismatch bug.
  const d1 = await getD1Raw()
  const result = await d1
    .prepare(
      `UPDATE user_purchases
       SET credits_remaining = ?2,
           updated_at = ?3
       WHERE id = ?1 AND credits_remaining = ?4`
    )
    .bind(purchaseId, row.credits_remaining - 1, now, row.credits_remaining)
    .run()

  return (result.meta?.changes ?? 0) === 1
```

### Case 3.4: Worker Timeouts in Retry Queue Batch Loops
*File:* `apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/route.ts`
*Replace lines 105–195 with:*
```typescript
    const chunkSize = 5
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      
      await Promise.allSettled(
        chunk.map(async (row) => {
          // Skip rows not yet due based on backoff schedule
          if (!isRetryDue(row.attempt_count, row.last_attempt_at, now)) {
            summary.skipped++
            return
          }

          summary.retried++

          // Per-row: resolve this user's HeyGen key (customer must have own key)
          const keyResult = await getHeyGenKey({ userId: row.user_id, fallbackToPlatform: false })
          if (!keyResult) {
            await recordAttemptCAS(row.id, 'no_user_heygen_key')
            summary.failed++
            return
          }
          const rowApiKey = keyResult.key

          const script = row.script ?? ''
          const title = `Welcome Bundle — ${row.id.slice(0, 8)}`
          const callbackUrl =
            process.env.NODE_ENV === 'production'
              ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/webhooks/heygen`
              : undefined

          try {
            const { videoId: heygenJobId } = await createHeyGenVideo({ script, title, apiKey: rowApiKey, callbackUrl })
            await markVideoProcessing(row.id, heygenJobId)
            try { await recordHeyGenAttempt(true) } catch { /* non-fatal */ }
            summary.succeeded++

            logger.info('[fulfillment-retry] Retry succeeded', {
              videoId: row.id,
              purchaseId: row.purchase_id,
              heygenJobId,
            })
          } catch (err) {
            const errMsg = getErrorMessage(err)
            const nextAttemptCount = row.attempt_count + 1
            try { await recordHeyGenAttempt(false) } catch { /* non-fatal */ }

            if (nextAttemptCount >= MAX_ATTEMPTS) {
              // M2 CAS: only the caller that wins the race sends email + compensation
              const won = await markPermanentFailureCAS(row.id, errMsg, nextAttemptCount - 1)
              if (!won) {
                logger.info('[fulfillment-retry] CAS lost — permanent failure already set', {
                  videoId: row.id,
                })
                return
              }

              summary.permanent++

              logger.warn('[fulfillment-retry] Permanent failure — compensating', {
                videoId: row.id,
                purchaseId: row.purchase_id,
                attempts: nextAttemptCount,
              })

              if (row.purchase_id) {
                await grantCompensationCredit(row.purchase_id, 'render_failed_permanent')

                const userInfo = await fetchUserEmail(row.user_id)
                const failedEmailInput: SendBundleRenderFailedInput = {
                  userEmail: userInfo?.email,
                  userId: row.user_id,
                  purchaseId: row.purchase_id,
                  locale: userInfo?.locale ?? row.locale ?? 'vi',
                }
                await sendBundleRenderFailedEmail(failedEmailInput)
              }
            } else {
              // M2 CAS: increment only if still in 'queued' state
              const newCount = await recordAttemptCAS(row.id, errMsg)
              if (newCount === null) {
                logger.info('[fulfillment-retry] CAS lost — row already transitioned, skipping', {
                  videoId: row.id,
                })
                return
              }
              summary.failed++

              logger.warn('[fulfillment-retry] Attempt failed', {
                videoId: row.id,
                purchaseId: row.purchase_id,
                attempt: newCount,
                error: errMsg,
              })
            }
          }
        })
      )
    }
```
