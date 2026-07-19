# Analysis: Milestone 3 — Credits & Video Concurrency

This report details the architectural vulnerabilities and proposed solutions for atomic state changes, optimistic credit decrements, and cron retry parallelization in the Sophia AI Factory codebase.

## Executive Summary
- **Compare-And-Swap (CAS) in Video Webhooks**: The current HeyGen completion webhook does not restrict status transition at the database level, leading to potential duplicate processing and double emails under concurrency. A SQL-level `status != 'completed'` check and checking `result.meta.changes` resolves this.
- **Optimistic Locking in `decrementCredits`**: The D1 query builder is architecturally unable to check row mutation count for updates where filter columns are modified, because it performs a post-update `SELECT` using the old filter values. Bypassing the builder to use raw D1 execution with `result.meta.changes` is required.
- **Cron Retry Parallelization**: The current retry cron processes video fulfillment sequentially. Network request overhead to the HeyGen API can easily exceed Edge runtime execution limits. A concurrent chunked execution pattern (chunk size = 5) with a wall-time safety limit prevents timeouts.

---

## 1. Compare-And-Swap (CAS) in `complete-video-from-webhook.ts`

### Current Implementation
In `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts` (lines 119-132):
```typescript
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

### Problem Analysis
The `WHERE` clause is only `id = ?1`. If multiple webhook calls or a retry cron and webhook race concurrently:
1. Both find the video row as `processing`/`queued` and proceed.
2. Both download/copy to R2.
3. Both run the update statement successfully, resulting in double-emails and unnecessary duplicate execution.

### Proposed Solution
Add `status != 'completed'` and `status != 'failed_permanent'` to the `WHERE` clause, and check `result.meta?.changes` to verify if the row was actually updated:

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
       WHERE id = ?1 AND status != 'completed' AND status != 'failed_permanent'`,
    )
    .bind(row.id, videoUrl, thumbnailUrl ?? null, r2Key, r2SizeBytes, now, nowEpoch)
    .run()

  const updated = (result.meta?.changes ?? 0) > 0
  if (!updated) {
    logger.info('[WebhookComplete] CAS lost — video already completed or failed permanently', {
      videoId: row.id,
    })
    return
  }
```

---

## 2. Optimistic Locking in `decrementCredits`

### Current Implementation
In `apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts` (lines 180-205):
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

### Crucial Bug in custom D1 Query Builder
1. By default, calling `await db.from(...).update(...)` with the custom `D1QueryChain` returns `{ data: null, error: null }` and discards the execution metadata (`result.meta?.changes`).
2. If `.returning('id')` or `.single()` is appended to get updated row info, `execUpdate` in `d1-query-chain-executors.ts` performs a subsequent `SELECT` query using the original `WHERE` clause:
   ```typescript
   const result = await state.db.prepare(`SELECT ${selectCols} FROM ${state.table}${clause}`).bind(...params).first()
   ```
   Because `clause` is `WHERE id = ? AND credits_remaining = ?` and `params` contains the **old** `credits_remaining` (e.g. 5), but the database has already updated `credits_remaining` to `4`, this `SELECT` query returns `null`/`[]`!
3. Therefore, both `.single()` and `.returning('id')` will falsely report 0 updated rows even when the update succeeded.

### Proposed Solution
To check changes reliably, bypass the query builder and use raw SQL via `getD1Raw()`, which directly exposes `result.meta.changes`:

```typescript
import { getD1Raw } from '@/seed/db/client'

export async function decrementCredits(purchaseId: string): Promise<boolean> {
  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)

  // Fetch current credits
  const row = await db
    .prepare(
      `SELECT credits_remaining
       FROM user_purchases
       WHERE id = ?1 AND status = 'paid'
       LIMIT 1`
    )
    .bind(purchaseId)
    .first<{ credits_remaining: number }>()

  if (!row || row.credits_remaining <= 0) return false

  const result = await db
    .prepare(
      `UPDATE user_purchases
       SET credits_remaining = ?2,
           updated_at = ?3
       WHERE id = ?1 AND credits_remaining = ?4 AND status = 'paid'`
    )
    .bind(purchaseId, row.credits_remaining - 1, now, row.credits_remaining)
    .run()

  return (result.meta?.changes ?? 0) > 0
}
```

---

## 3. Parallel Retry Queue Cron Jobs

### Current Implementation
In `apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/route.ts` (lines 103-195):
```typescript
    const rows = await listQueuedForRetry(MAX_ATTEMPTS, BATCH_LIMIT)

    for (const row of rows) {
      if (!isRetryDue(row.attempt_count, row.last_attempt_at, now)) { ... }
      // Sequential HTTP and database calls...
    }
```

### Problem Analysis
Sequential `for...of` iteration makes HTTP calls to the external HeyGen API one after another. If multiple videos are due (up to 20), this could easily run for 20+ seconds, exceeding Edge runtime CPU/wall-time limits (typically 30 seconds) and resulting in execution termination mid-loop.

### Proposed Solution
1. **Pre-filter due rows** using `isRetryDue`.
2. **Implement concurrent execution** with a concurrency chunk limit (chunk size = 5).
3. **Add wall-time check** (`MAX_WALL_TIME_MS = 20000`) to abort early and fail-safe if processing takes too long.

#### Refactored Code Structure Proposal:
```typescript
interface ProcessResult {
  status: 'succeeded' | 'failed' | 'permanent' | 'no_key' | 'skipped'
}

async function processRetryRow(row: VideoRow, now: number): Promise<ProcessResult> {
  const keyResult = await getHeyGenKey({ userId: row.user_id, fallbackToPlatform: false })
  if (!keyResult) {
    await recordAttemptCAS(row.id, 'no_user_heygen_key')
    return { status: 'no_key' }
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
    return { status: 'succeeded' }
  } catch (err) {
    const errMsg = getErrorMessage(err)
    const nextAttemptCount = row.attempt_count + 1
    try { await recordHeyGenAttempt(false) } catch { /* non-fatal */ }

    if (nextAttemptCount >= MAX_ATTEMPTS) {
      const won = await markPermanentFailureCAS(row.id, errMsg, nextAttemptCount - 1)
      if (!won) return { status: 'skipped' }

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
      return { status: 'permanent' }
    } else {
      const newCount = await recordAttemptCAS(row.id, errMsg)
      if (newCount === null) return { status: 'skipped' }
      return { status: 'failed' }
    }
  }
}
```

And update the main cron loop:
```typescript
    const rows = await listQueuedForRetry(MAX_ATTEMPTS, BATCH_LIMIT)
    
    // Filter due rows first
    const dueRows = rows.filter(row => isRetryDue(row.attempt_count, row.last_attempt_at, now))
    summary.skipped = rows.length - dueRows.length

    const CHUNK_SIZE = 5
    const startTime = Date.now()
    const MAX_WALL_TIME_MS = 20000 // 20 seconds threshold

    for (let i = 0; i < dueRows.length; i += CHUNK_SIZE) {
      // Graceful timeout guard
      if (Date.now() - startTime > MAX_WALL_TIME_MS) {
        logger.warn('[fulfillment-retry] Wall-time threshold reached; aborting remaining chunks', {
          processed: i,
          total: dueRows.length
        })
        break
      }

      const chunk = dueRows.slice(i, i + CHUNK_SIZE)
      const results = await Promise.all(chunk.map(row => processRetryRow(row, now)))

      for (const res of results) {
        summary.retried++
        if (res.status === 'succeeded') summary.succeeded++
        else if (res.status === 'failed' || res.status === 'no_key') summary.failed++
        else if (res.status === 'permanent') summary.permanent++
        else if (res.status === 'skipped') summary.skipped++
      }
    }
```
