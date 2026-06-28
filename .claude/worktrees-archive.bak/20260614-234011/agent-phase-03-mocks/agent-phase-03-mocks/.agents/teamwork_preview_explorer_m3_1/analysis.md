# Milestone 3 Analysis: Credits & Video Concurrency

This analysis details the implementation design and requirements for **Milestone 3: Credits & Video Concurrency** in the Sophia AI Factory codebase.

---

## 1. Compare-And-Swap (CAS) in HeyGen Success Webhooks

### Direct Observations & Current Flow
In `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts`, the success webhook handler (`completeVideoFromWebhook`) performs the following non-atomic update:

```typescript
// Line 119 - 132
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

While it checks `if (row.status === 'completed' || row.status === 'failed_permanent')` at the beginning of the function (lines 90-96) to skip execution, this read-then-write sequence is vulnerable to race conditions if concurrent webhook requests or retry cron runs fire simultaneously.

### CAS Implementation Plan
To implement atomic CAS check:
1. Modify the `UPDATE` SQL statement to enforce that the video is not already in the terminal `'completed'` state by adding `AND status != 'completed'` to the `WHERE` clause.
2. Verify if a row was actually updated by appending `RETURNING id` and using `.first<{ id: string }>()` instead of `.run()`. If another request has already updated the status, this query will return `null` (or a falsy result).
3. Check the returned result: if it is falsy, log the event and return early from the handler. This avoids sending duplicate emails, copying files to R2 multiple times, or skewing circuit breaker metrics.

#### Proposed Code Sketch:
```typescript
const nowEpoch = Math.floor(Date.now() / 1000)
const result = await d1
  .prepare(
    `UPDATE videos
     SET status = 'completed',
         video_url = ?2,
         thumbnail_url = ?3,
         r2_key = ?4,
         r2_size_bytes = ?5,
         updated_at = ?6,
         completed_at = COALESCE(completed_at, ?7)
     WHERE id = ?1 AND status != 'completed'
     RETURNING id`,
  )
  .bind(row.id, videoUrl, thumbnailUrl ?? null, r2Key, r2SizeBytes, now, nowEpoch)
  .first<{ id: string }>()

if (!result) {
  logger.info('[WebhookComplete] CAS lost — video already marked completed, skipping post-processing', {
    videoId: row.id,
  })
  return
}
```

---

## 2. Optimistic Credit Decrement & Mutated Row Check

### Direct Observations & Current Flow
In `apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts`, `decrementCredits` is written as follows:

```typescript
// Line 180 - 205
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

This returns `true` unconditionally after running the `update` statement, regardless of whether any rows were actually updated. If a concurrent transaction decrements the credits between the initial `select` and the `update`, the optimistic check (`.eq('credits_remaining', row.credits_remaining)`) fails, updating 0 rows, yet the function returns `true`, leading to credit leakage (over-spending).

### Fluent Query Builder Limitation
The query builder client (`D1QueryChain` executing via `execUpdate` in `d1-query-chain-executors.ts`) does not return the number of modified rows for updates.
If `.single()` is added to the chain to verify the update:
```typescript
// d1-query-chain-executors.ts line 116
const result = await state.db.prepare(`SELECT ${selectCols} FROM ${state.table}${clause}`).bind(...params).first()
```
Because the `clause` and `params` (from `buildWhere(state)`) contain `credits_remaining = row.credits_remaining`, and the update query successfully decrements it, the subsequent `SELECT` query will check for the *old* value and fail to find the row. Thus, both successful and failed updates return `{ data: null, error: { message: 'No rows updated' } }`.

### Solution using Raw D1 Client
To correctly verify modified rows, we must bypass the query builder's select-after-update logic and access the raw D1 result using `db.unwrap()` or `await getD1Raw()`.

#### Proposed Code Sketch:
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

  // Execute atomic update directly on D1 to check mutation count
  const rawDb = db.unwrap()
  const result = await rawDb
    .prepare(
      `UPDATE user_purchases
       SET credits_remaining = ?,
           updated_at = ?
       WHERE id = ?
         AND credits_remaining = ?`
    )
    .bind(row.credits_remaining - 1, now, purchaseId, row.credits_remaining)
    .run()

  const succeeded = (result.meta?.changes ?? 0) > 0
  return succeeded
}
```

---

## 3. Parallelized Retry Queue Cron Execution Plan

### Direct Observations & Current Flow
In `apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/route.ts`, the cron handler retrieves a batch of queued videos (`BATCH_LIMIT = 20`) and processes them in a sequential `for (const row of rows)` loop (lines 105 - 195).
Each iteration performs multiple asynchronous network requests:
1. `getHeyGenKey()` — DB lookup
2. `createHeyGenVideo()` — HeyGen API video submission (high latency)
3. `markVideoProcessing()`, `recordAttemptCAS()`, or `markPermanentFailureCAS()` — DB update
4. `sendBundleRenderFailedEmail()` — Email dispatch (high latency)

If multiple items need retrying, the sequential execution easily exceeds edge runtime wall-time limits (typically 30 seconds), causing the cron job to time out mid-execution.

### Concurrent Retry Chunk Execution Plan
We will restructure the cron loop to run concurrent executions using `Promise.all` in throttled chunks (e.g., chunk size of 5) to prevent wall-time limits while avoiding HeyGen/DB rate limit exhaustion.

1. **Extract Row Processing Logic**: Move the operations for a single row into an asynchronous helper `processRow(row, now)`.
2. **Chunking Utility**: Implement a helper function `chunkArray(array, size)` to partition the queued `rows` array.
3. **Controlled Concurrency Loop**: Process chunks sequentially, but execute each chunk's items concurrently using `Promise.all`.
4. **Aggregate Results**: Collect the status of each processed row to calculate summary statistics.

#### Proposed Code Structure:

```typescript
// 1. Array Chunking Helper
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

// 2. Single Row Processing Helper
async function processRow(
  row: any, 
  now: number
): Promise<'skipped' | 'succeeded' | 'failed' | 'permanent' | 'cas_lost'> {
  if (!isRetryDue(row.attempt_count, row.last_attempt_at, now)) {
    return 'skipped'
  }

  const keyResult = await getHeyGenKey({ userId: row.user_id, fallbackToPlatform: false })
  if (!keyResult) {
    await recordAttemptCAS(row.id, 'no_user_heygen_key')
    return 'failed'
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
    return 'succeeded'
  } catch (err) {
    const errMsg = getErrorMessage(err)
    const nextAttemptCount = row.attempt_count + 1
    try { await recordHeyGenAttempt(false) } catch { /* non-fatal */ }

    if (nextAttemptCount >= MAX_ATTEMPTS) {
      const won = await markPermanentFailureCAS(row.id, errMsg, nextAttemptCount - 1)
      if (!won) return 'cas_lost'

      if (row.purchase_id) {
        await grantCompensationCredit(row.purchase_id, 'render_failed_permanent')
        const userInfo = await fetchUserEmail(row.user_id)
        await sendBundleRenderFailedEmail({
          userEmail: userInfo?.email,
          userId: row.user_id,
          purchaseId: row.purchase_id,
          locale: userInfo?.locale ?? row.locale ?? 'vi',
        })
      }
      return 'permanent'
    } else {
      const newCount = await recordAttemptCAS(row.id, errMsg)
      if (newCount === null) return 'cas_lost'
      return 'failed'
    }
  }
}

// 3. GET Request Orchestration
// Inside GET(req: NextRequest) after verification and setup:
const rows = await listQueuedForRetry(MAX_ATTEMPTS, BATCH_LIMIT)
const chunks = chunkArray(rows, 5) // Concurrent batch size of 5

for (const chunk of chunks) {
  const results = await Promise.all(chunk.map(row => processRow(row, now)))
  for (const res of results) {
    if (res === 'skipped') summary.skipped++
    else if (res === 'succeeded') { summary.retried++; summary.succeeded++ }
    else if (res === 'failed') { summary.retried++; summary.failed++ }
    else if (res === 'permanent') { summary.retried++; summary.permanent++ }
    // 'cas_lost' is skipped (already handled by a racing process)
  }
}
```

---

## 4. Unresolved Questions / Next Steps
No technical unknowns remain regarding the execution and design of Milestone 3. The proposed changes are structurally sound and leverage existing Cloudflare D1 APIs (`getD1Raw`, `unwrap`, `changes` metadata).
The next phase will involve applying these changes and running vitest/CI verification commands.
