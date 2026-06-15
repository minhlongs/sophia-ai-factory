# Handoff Report: Milestone 3 — Credits & Video Concurrency

## 1. Observation

Direct observations in the codebase include the following:

- **HeyGen Completion Update Statement** (`complete-video-from-webhook.ts`, lines 119-132):
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

- **Fluent Update Statement with Optimistic Guard** (`user-purchases-repo.ts`, lines 195-204):
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

- **Query Builder Update Runner** (`d1-query-chain-executors.ts`, lines 112-121):
  ```typescript
  await state.db.prepare(`UPDATE ${state.table} SET ${cols.map((c) => `${c} = ?`).join(', ')}${clause}`).bind(...vals, ...params).run()
  if (state.returnCols || state.isSingle) {
    const selectCols = state.returnCols ?? state.selectCols
    if (state.isSingle) {
      const result = await state.db.prepare(`SELECT ${selectCols} FROM ${state.table}${clause}`).bind(...params).first()
      return result ? { data: parseJsonFields(result), error: null } : { data: null, error: { message: 'No rows updated' } }
    }
  ```

- **Retry Cron Sequential Batch Loop** (`fulfillment-retry/route.ts`, lines 103-110):
  ```typescript
    const rows = await listQueuedForRetry(MAX_ATTEMPTS, BATCH_LIMIT)

    for (const row of rows) {
      // Skip rows not yet due based on backoff schedule
      if (!isRetryDue(row.attempt_count, row.last_attempt_at, now)) {
  ```

---

## 2. Logic Chain

1. **Vulnerability 1: Webhook Concurrency Race**
   - *Observation*: The `completeVideoFromWebhook` update checks `WHERE id = ?1` without checking the status.
   - *Inference*: If two concurrent webhook triggers process completion for the same job, both will match `WHERE id = ?1` and execute successfully, leading to duplicate downstream logic (sending multiple emails).
   - *Reasoning*: By adding `AND status != 'completed'` to the `WHERE` clause and checking `result.meta.changes > 0`, only the first request will perform the transition. The second request will update 0 rows and return early.

2. **Vulnerability 2: Query Builder Optimistic Mutation Detection Defect**
   - *Observation*: Custom query builder `.update()` returns `{ data: null, error: null }`. If modified by `.single()` or `.returning()`, it runs a subsequent `SELECT` utilizing the original `WHERE` clause `id = ? AND credits_remaining = ?`.
   - *Inference*: Since `credits_remaining` was updated (decremented), the subsequent `SELECT` checks for the *old* credits value. It will fail to find any matching rows, returning `null`/`[]` and reporting `No rows updated` error.
   - *Reasoning*: Bypassing the builder to execute the query via `getD1Raw()` lets us verify `result.meta.changes` directly on the `run()` return value, eliminating this bug.

3. **Vulnerability 3: Edge Timeout during Retry Cron**
   - *Observation*: The retry cron processes up to 20 queue rows sequentially. Each row can perform 1-2 external network requests (HeyGen API, send emails) taking ~1-3s each.
   - *Inference*: Processing 10+ due retries sequentially can exceed Vercel Edge / Cloudflare wall-time limitations (typically 30 seconds).
   - *Reasoning*: Filtering due rows first and processing them in parallel chunks of 5 using `Promise.all` and checking elapsed time against a threshold (20 seconds) keeps execution safe from timeouts.

---

## 3. Caveats

- **Raw SQL Maintenance**: Using `getD1Raw()` bypasses TypeScript type validation for schema columns. However, this is the established standard pattern elsewhere (e.g. `videos-repo.ts`).
- **HeyGen Rate Limits**: Increasing concurrency to 5 HeyGen API calls in parallel is safe but should be monitored to ensure it does not hit HeyGen's API rate limits.

---

## 4. Conclusion

- **CAS in Webhooks**: Add `AND status != 'completed'` to the `completeVideoFromWebhook` UPDATE statement and return early if `(result.meta?.changes ?? 0) === 0`.
- **Decrement Credits Lock**: Rewrite `decrementCredits` using `getD1Raw()`, executing the UPDATE with an optimistic `credits_remaining` check and returning `(result.meta?.changes ?? 0) > 0`.
- **Parallel Retry Cron**: Refactor the retry cron to filter due rows first, process in parallel chunks of size 5, and abort gracefully if execution exceeds 20 seconds.

---

## 5. Verification Method

To verify these proposed changes after implementation:

1. **Verify Compilation**:
   - Run type checking:
     ```bash
     npm run ci:typecheck
     ```
2. **Execute Tests**:
   - Run existing unit/integration tests to ensure no regressions:
     ```bash
     npm run ci:test
     ```
3. **Verify Row Change Checks**:
   - Inspect query logs or mock D1 responses to ensure the update result metadata (`changes === 0`) works correctly under a simulated race.
