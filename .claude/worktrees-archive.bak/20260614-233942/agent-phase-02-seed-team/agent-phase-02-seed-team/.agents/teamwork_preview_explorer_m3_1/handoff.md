# Handoff Report — Milestone 3 (Credits & Video Concurrency)

This report details the investigation and proposed implementation plans for three critical edge cases in Milestone 3.

## 1. Observation
We analyzed the following files:
* `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts`
* `apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts`
* `apps/sophia-ai-factory/src/seed/db/d1-query-chain-executors.ts` (query builder execution engine)
* `apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/route.ts`

### Direct Code Inspection Findings:
1. **Case 3.1 (Success Webhook Idempotency)**:
   In `complete-video-from-webhook.ts`, lines 98–132 download and upload the video to R2 *before* performing the `UPDATE` query. The update statement itself has no status check guard:
   ```typescript
   await d1
     .prepare(
       `UPDATE videos
        SET status = 'completed', ...
        WHERE id = ?1`,
     )
     .bind(...)
     .run()
   ```
   If duplicate success webhooks race concurrently, both will download and store the video to R2. Moreover, both updates will succeed, causing duplicate success emails to be sent.

2. **Case 3.3 (decrementCredits Optimistic Locking)**:
   In `user-purchases-repo.ts`, lines 195–202 update `credits_remaining` but return `true` unconditionally:
   ```typescript
   await db
     .from('user_purchases')
     .update({
       credits_remaining: row.credits_remaining - 1,
       updated_at: now,
     })
     .eq('id', purchaseId)
     .eq('credits_remaining', row.credits_remaining) // optimistic check
   return true
   ```
   If the update fails due to a mismatched `credits_remaining` value (optimistic lock failure), the function still returns `true`, causing silent failures and credit double-spending.

   Furthermore, looking at `execUpdate` in `d1-query-chain-executors.ts` (lines 115–118), if `isSingle` is true:
   ```typescript
   if (state.isSingle) {
     const result = await state.db.prepare(`SELECT ${selectCols} FROM ${state.table}${clause}`).bind(...params).first()
     return result ? { data: parseJsonFields(result), error: null } : { data: null, error: { message: 'No rows updated' } }
   }
   ```
   Since `clause` uses `credits_remaining = [old_value]`, and the update set `credits_remaining = [new_value]`, the post-update `SELECT` will ALWAYS return `null` and report `'No rows updated'` even if the update succeeded!

3. **Case 3.4 (Worker Timeouts)**:
   In `fulfillment-retry/route.ts`, lines 105–195 process retries in a sequential `for (const row of rows)` loop. If multiple videos require retry, the worker will sequentially make multiple HeyGen API HTTP requests and S3 uploads, which will trigger execution timeouts.

---

## 2. Logic Chain
* **Case 3.1 Logic**: To prevent both duplicate R2 uploads and duplicate ready emails, the webhook handler must acquire a lock on the job's completion state before doing any heavy operations. We can do this using a Compare-And-Swap (CAS) update to transition `status = 'completed'` only if the status is not already completed. If the CAS update succeeds (mutates 1 row), we proceed with the R2 copy and emails.
* **Case 3.3 Logic**: To prevent double-spending, the decrement function must check if the update query mutated exactly 1 row.
  - Since the query builder's `execUpdate` has a filter-mutation bug when selecting updated rows, calling `.single()` directly will fail.
  - Resolving this requires either:
    1. Bypassing the query builder via `D1Client.unwrap()` to run a raw SQLite `UPDATE ... RETURNING id` query.
    2. Patching the query builder's `execUpdate` to natively append `RETURNING` instead of running a separate SELECT.
* **Case 3.4 Logic**: To prevent timeouts, we can pre-filter rows that are actually due for retry, chunk them into batches of size 5, and process each batch concurrently using `Promise.allSettled`. This avoids massive sequential HTTP wait times.

---

## 3. Caveats
* **D1 SQLite Version**: SQLite 3.35.0 (supported natively on Cloudflare D1) is assumed to be available. It supports the `RETURNING` clause.
* **HeyGen API Concurrency**: We assume HeyGen API can handle up to 5 concurrent creation requests without issues. A batch limit of 5 is highly safe and standard.

---

## 4. Conclusion & Proposed Changes
We propose the following code changes:

### Case 3.1: Duplicate Webhook Protection (complete-video-from-webhook.ts)
Change lines 98–132 to:
```typescript
  const d1 = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)
  const nowEpoch = Math.floor(Date.now() / 1000)

  // Acquire terminal completion state via CAS update first
  const casResult = await d1
    .prepare(
      `UPDATE videos
       SET status = 'completed',
           updated_at = ?2,
           completed_at = COALESCE(completed_at, ?3)
       WHERE id = ?1 AND status != 'completed'
       RETURNING id`,
    )
    .bind(row.id, now, nowEpoch)
    .first<{ id: string }>()

  if (!casResult) {
    logger.info('[WebhookComplete] Already completed (CAS lost), skipping', {
      videoId: row.id,
    })
    return
  }

  // Only the winner of the CAS lock proceeds to copy to R2
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

  // Update row with final R2 path and sizes
  await d1
    .prepare(
      `UPDATE videos
       SET video_url = ?2,
           thumbnail_url = ?3,
           r2_key = ?4,
           r2_size_bytes = ?5,
           updated_at = ?6
       WHERE id = ?1`,
    )
    .bind(row.id, videoUrl, thumbnailUrl ?? null, r2Key, r2SizeBytes, now)
    .run()
```

### Case 3.3: Optimistic Locking Check (user-purchases-repo.ts)
#### Option A (Bypassing Query Builder via raw D1 - Recommended):
Modify `decrementCredits` in `user-purchases-repo.ts` to:
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

  // Bypass query builder to avoid the select filter-mutation bug
  const rawDb = db.unwrap()
  const result = await rawDb
    .prepare(
      `UPDATE user_purchases
       SET credits_remaining = credits_remaining - 1,
           updated_at = ?2
       WHERE id = ?1 AND credits_remaining = ?3
       RETURNING id`,
    )
    .bind(purchaseId, now, row.credits_remaining)
    .first<{ id: string }>()

  return result !== null
}
```

#### Option B (Patching the Query Builder + Repository):
1. In `apps/sophia-ai-factory/src/seed/db/d1-query-chain-executors.ts`, replace `execUpdate` with:
```typescript
export async function execUpdate(state: QueryState): Promise<QueryResult<unknown>> {
  const row = state.payload as Record<string, unknown>
  const cols = Object.keys(row)
  const vals = cols.map((c) => serializeValue(row[c]))
  const { clause, params } = buildWhere(state)
  if (state.returnCols || state.isSingle) {
    const selectCols = state.returnCols ?? state.selectCols
    const stmt = state.db.prepare(`UPDATE ${state.table} SET ${cols.map((c) => `${c} = ?`).join(', ')}${clause} RETURNING ${selectCols}`)
    if (state.isSingle) {
      const result = await stmt.bind(...vals, ...params).first()
      return result ? { data: parseJsonFields(result), error: null } : { data: null, error: { message: 'No rows updated' } }
    }
    const result = await stmt.bind(...vals, ...params).all()
    return { data: (result.results ?? []).map(parseJsonFields), error: null }
  }
  await state.db.prepare(`UPDATE ${state.table} SET ${cols.map((c) => `${c} = ?`).join(', ')}${clause}`).bind(...vals, ...params).run()
  return { data: null, error: null }
}
```
2. In `apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts`, change lines 195–204 to:
```typescript
  const { error } = await db
    .from('user_purchases')
    .update({
      credits_remaining: row.credits_remaining - 1,
      updated_at: now,
    })
    .eq('id', purchaseId)
    .eq('credits_remaining', row.credits_remaining) // optimistic check
    .single()

  return !error
```

### Case 3.4: Retry Cron Concurrency (fulfillment-retry/route.ts)
Replace the loop (lines 105–195) in `fulfillment-retry/route.ts` with:
```typescript
    const activeRows = rows.filter((row) => isRetryDue(row.attempt_count, row.last_attempt_at, now))
    summary.skipped = rows.length - activeRows.length

    const chunkArray = <T>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = []
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size))
      }
      return chunks
    }

    const processRow = async (row: typeof rows[0]) => {
      summary.retried++

      // Per-row: resolve this user's HeyGen key
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
    }

    const chunks = chunkArray(activeRows, 5)
    for (const chunk of chunks) {
      await Promise.allSettled(chunk.map((row) => processRow(row)))
    }
```

---

## 5. Verification Method
Verify changes by running:
```bash
npm run ci:test
```
from the `apps/sophia-ai-factory` directory.
Additionally, check:
* `apps/sophia-ai-factory/src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts`
* `apps/sophia-ai-factory/src/seed/db/repositories/__tests__/user-purchases-repo.test.ts`
to ensure the existing mock setups remain fully aligned and verified.
