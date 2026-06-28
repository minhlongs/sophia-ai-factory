# Technical Analysis — Milestone 3 Edge Cases

## Case 3.1: Concurrent Duplicate HeyGen Webhooks (Success)
### Current Implementation Concerns
In `complete-video-from-webhook.ts`, the function `completeVideoFromWebhook` checks if a video status is terminal (`completed` or `failed_permanent`) in JS memory.
However, concurrent webhooks can execute the R2 copy (`downloadAndStore`) concurrently because the status check is only in JavaScript memory and the database write happens *after* the copy is completed.
This causes multiple concurrent workers to download the video and upload to R2, incurring extra cost and processing overhead, and potentially leading to multiple "video ready" emails.

### Proposed CAS Design
We perform the `status = 'completed'` update *first* using a SQLite `UPDATE` query containing a CAS predicate: `WHERE id = ?1 AND status != 'completed' AND status != 'failed_permanent' RETURNING id`.
1. If the update returns no row (`first()` returns null), it means another concurrent worker has already marked the video as completed. We log and return immediately.
2. If the update succeeds, we then trigger `downloadAndStore` and subsequently save the `r2_key` and `r2_size_bytes` on the row.
3. This guarantees that at most one worker downloads and processes the success outcome.

---

## Case 3.3: Optimistic Locking Failure in `decrementCredits`
### Current Implementation Concerns
In `user-purchases-repo.ts`, `decrementCredits` executes the update query:
```typescript
  await db
    .from('user_purchases')
    .update({
      credits_remaining: row.credits_remaining - 1,
      updated_at: now,
    })
    .eq('id', purchaseId)
    .eq('credits_remaining', row.credits_remaining) // optimistic check
```
Because it doesn't call `.single()` or check if the update mutated a row, the query builder resolves but doesn't throw or return an error if the optimistic check fails (which occurs when another query modified the row between the `SELECT` and `UPDATE`). The function returns `true` even if the mutation affected 0 rows.

### Query Builder Limitation
Even if we add `.single()` or `.returning('id')`, `D1QueryChain` emulates returning fields by running a separate SELECT query *after* the update query using the *same* filters (`WHERE id = ? AND credits_remaining = ?`).
Since the update modified `credits_remaining` to `row.credits_remaining - 1`, the select statement looking for `credits_remaining = row.credits_remaining` will find 0 matching rows and return `{ data: null, error: { message: 'No rows updated' } }` (for `single()`) or `{ data: [], error: null }` (for `returning()`) — in both success and failure cases!

### Proposed Design
To bypass this limitation, we use raw D1 via `getD1Raw()` to execute the SQL UPDATE directly, and check `(result.meta?.changes ?? 0) === 1`. This is completely safe, reliable, and matches other CAS check patterns in the project.

---

## Case 3.4: Worker Timeouts in Retry Queue Batch Loops
### Current Implementation Concerns
In `fulfillment-retry/route.ts`, the cron processes up to `BATCH_LIMIT = 20` video retry items sequentially.
Since each HeyGen API request and email notification involves a network round-trip, executing 20 operations sequentially can easily exceed Cloudflare Worker timeout limits.

### Proposed Design
Refactor the loop to group the items into concurrent chunks of 5 using `Promise.allSettled`.
This parallelizes the network requests while staying within reasonable concurrency bounds to avoid hitting API rate limits or connection pool exhaustion.
`Promise.allSettled` is safer than `Promise.all` as it ensures that an unhandled rejection in one item does not abort the rest of the batch chunk.
