# Codebase Operational Excellence Audit Report
*Sophia AI Factory Operational Audit against Stripe/Vercel Standards*

## 1. Observation

Direct observations from codebase inspection, including file paths, line numbers, and patterns:

### A. Race Conditions

1. **`src/seed/db/d1-client-rpc.ts` (Lines 68–84)**:
   ```typescript
   private async debitMcuBalance(orgId: string, amount: number, feature: string): Promise<QueryResult<unknown>> {
     const current = await this.db
       .prepare('SELECT balance FROM org_balances WHERE org_id = ?')
       .bind(orgId)
       .first<{ balance: number }>();

     if (!current || current.balance < amount) {
       return { data: null, error: { message: 'Insufficient balance' } };
     }

     await this.db.batch([
       this.db.prepare('UPDATE org_balances SET balance = balance - ?, updated_at = datetime(\'now\') WHERE org_id = ?').bind(amount, orgId),
       this.db.prepare('INSERT INTO transactions (org_id, amount, type, description) VALUES (?, ?, ?, ?)').bind(orgId, -amount, 'debit', feature),
     ]);
     // ...
   ```
   - **Observation**: Read-modify-write query pattern. No `AND balance >= amount` check is performed during the `UPDATE` query.

2. **`src/seed/db/repositories/user-purchases-repo.ts` (Lines 180–205)**:
   ```typescript
   export async function decrementCredits(purchaseId: string): Promise<boolean> {
     // ...
     const { data } = await db
       .from('user_purchases')
       .select('credits_remaining')
       // ...
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
   - **Observation**: Uses an optimistic check `.eq('credits_remaining', row.credits_remaining)`, but returns `true` unconditionally without verifying if the update query affected any rows.

3. **`src/lib/fulfillment/compensation.ts` (Lines 81–87)**:
   ```typescript
   await db
     .from('user_purchases')
     .update({
       credits_remaining: purchase.credits_remaining + 1,
       updated_at: now,
     })
     .eq('id', purchaseId)
   ```
   - **Observation**: Updates `credits_remaining` by writing back a pre-queried value (`purchase.credits_remaining + 1`) instead of performing an atomic SQL increment (`SET credits_remaining = credits_remaining + 1`).

4. **`src/lib/fulfillment/one-time-fulfillment.ts` (Lines 48–111)**:
   - Checks if a video exists using `const existing = await findByPurchaseId(purchaseId)`.
   - If not, inserts using `videoRowId = await enqueueVideo({ userId, purchaseId, ... })`.
   - **Observation**: The `videos` schema definition in `migrations/0089-videos-drop-user-id-fk.sql` defines `purchase_id TEXT` without a `UNIQUE` constraint, exposing the flow to duplicate video enqueues under concurrent triggers.

5. **`src/forest/quota/mission-quota.ts` (Lines 82–91)**:
   - Runs `checkMissionQuota` to count the database rows in `missions` and `engine_missions`, checking if `used < limit`.
   - Callers (`raas/missions/route.ts` and `auto-video/route.ts`) use this boolean, then insert new rows.
   - **Observation**: Read-then-write pattern with no atomic locks or tables to gate concurrent requests.

---

### B. N+1 Query Patterns

1. **`src/app/api/cron/dunning-advance/route.ts` (Lines 114–122)**:
   ```typescript
   const delinquentPromises = (delinquentRows ?? []).map(async (row) => {
     try {
       const { data: pendingRetry } = await db
         .from('dunning_attempts')
         .select('next_retry_at')
         .eq('license_nonce', row.license_nonce)
         .eq('success', false)
         // ...
   ```
   - **Observation**: Within the `delinquentPromises` parallel map loop, a separate query is executed for each individual delinquent row to check for pending retries.

2. **`src/app/api/cron/video-status-sync/route.ts` (Lines 144–178)**:
   - Loops sequentially through up to 50 processing videos using `for (const row of pending)`.
   - **Observation**: Executes `fetchUserInfo(row.user_id)` (database select query) and `getHeyGenClient(row.user_id)` (API client config resolution) sequentially inside the loop body.

---

### C. Zod Input Validation

- **Observation**: The codebase contains 377 API route files (matching `route.ts`).
  - **126 routes** implement schema validation using Zod (`safeParse` or `.parse()`).
  - **251 routes** do not use Zod input validation (e.g., `/api/discovery/search/route.ts` and `/api/discovery/validate-link/route.ts` which read `searchParams` directly without strict schema guards).

---

### D. Worker Fault Isolation

1. **`src/forest/worker/worker-handlers.ts` (Lines 44–94)**:
   - **Observation**: The `handleProxyRequest` edge request handler does not contain a top-level try-catch block, meaning any unhandled rejection (e.g. from `getCurrentUsage` or `fetch`) will result in unhandled worker exceptions.

2. **`src/forest/worker/index.ts` (Lines 69–80)**:
   - **Observation**: The `queue` consumer loop processes messages in the batch sequentially without trapping errors inside the loop body:
     ```typescript
     async queue(batch: MessageBatch<WorkerUsageEvent>, env: Env, ctx: ExecutionContext): Promise<void> {
       for (const event of batch.messages.map(m => m.body)) {
         await incrementUsage(event.licenseNonce, event.service || 'default', event.overageCount, env.KV_KV)
         // ...
     ```
     If `incrementUsage` throws for one corrupted event, the entire batch fails execution.

---

### E. Observability & Telemetry

- **Observation**: Ephemeral request tracking is handled via `logger.withRequestId(requestId)`.
- However, correlation IDs are generated manually in individual routes (e.g., `const requestId = crypto.randomUUID()` in `/api/scripts/generate/route.ts`), while other key endpoints (such as `v1/agent-chat/route.ts`) lack request ID generation or tracing metadata altogether.

---

## 2. Logic Chain

1. **Read-Modify-Write Races**:
   - In `debitMcuBalance` (RPC), if two calls check balance `X` (e.g. `X = 10`) concurrently and both request `8`, both see `10 >= 8` as valid and proceed. They both execute the decrement update. The resulting balance goes negative (`-6`), violating billing invariants.
   - In `decrementCredits`, because the result of the optimistic update query is not checked, when a conflict occurs and the row is not updated, the function returns `true` anyway. This tells the caller the charge succeeded, permitting a free render.
   - In `grantCompensationCredit`, using `purchase.credits_remaining + 1` directly inside the update query means the update overwrites the column value. If a decrement occurred between the SELECT and UPDATE, it is overwritten and lost.

2. **Fulfillment Duplicates**:
   - `triggerOneTimeFulfillment` relies on `findByPurchaseId` to prevent double-rendering. Because there is no database-level unique constraint on `purchase_id` in the `videos` table, concurrent webhook delivery calls will trigger concurrent SELECTs, see no row, and insert duplicate rows.

3. **N+1 Performance Deterioration**:
   - In `dunning-advance`, querying `dunning_attempts` for each delinquent row triggers `N` network/DB rounds. On large datasets, this exhausts the DB connection pool/limits and slows down execution.
   - In `video-status-sync`, executing sequential external API calls (HeyGen status) and DB queries in a `for` loop will hit Cloudflare's 30-second execution time limit under a load of 20+ processing videos.

4. **Fault Isolation Vulnerability**:
   - In `queue`, a single throwing message in `batch.messages` halts the consumer execution. The runtime marks the batch as failed and retries, creating a head-of-line blocking loop.

---

## 3. Caveats

- **Scope Limit**: The D1 SQLite database driver behaves with single-writer lock characteristics. This mitigates some write races (by blocking concurrent writers), but does not resolve logical races (like TOCTOU or overwrite races) where read values are computed in the application tier.
- **Mock Environment**: Verification was performed by static analysis and codebase review. Dynamic execution traces under artificial load were not run.

---

## 4. Conclusion

The codebase follows high-quality patterns (such as AES-GCM PII-bound user credential encryption and HMACS webhook verifications), but suffers from critical architectural issues in race conditions, validation, and fault isolation:

### P0/P1 Risks & Recommended Remedies

| Priority | Issue / Risk | Location | Recommended Remedy |
|---|---|---|---|
| **P1** | **Negative Balances / Double Spending** (Read-then-Write Race) | `src/seed/db/d1-client-rpc.ts` | Change the `UPDATE` query to atomically decrement the balance and enforce the limit check in the SQL statement: `SET balance = balance - ? WHERE org_id = ? AND balance >= ?`. Check `meta.changes === 0` to reject if insufficient. |
| **P1** | **Bypassed Credit Deduction** (Unchecked Optimistic Update) | `src/seed/db/repositories/user-purchases-repo.ts` | Verify the update query's affected rows count (`meta.changes`) and return `false` if the optimistic lock failed to modify the row. |
| **P1** | **Overwritten Credits / Lost Balance Changes** (Non-atomic Increment) | `src/lib/fulfillment/compensation.ts` | Replace the read-modify-write update with an atomic increment query: `SET credits_remaining = credits_remaining + 1 WHERE id = ?`. |
| **P1** | **Double Video Renders** (Missing DB Unique Constraint) | `src/lib/fulfillment/one-time-fulfillment.ts` | Add a `UNIQUE` constraint or unique index to `videos.purchase_id` to strictly block duplicate enqueues at the database layer. |
| **P1** | **N+1 Dunning Queries** (DB Query in Map Loop) | `src/app/api/cron/dunning-advance/route.ts` | Batch query the `dunning_attempts` table using a `.in('license_nonce', nonces)` query filter, then join in memory. |
| **P1** | **Worker Handlers Un-isolated Errors** (Missing top-level try-catch) | `src/forest/worker/worker-handlers.ts` | Wrap the entire `handleProxyRequest` body in a try-catch block and return a structured HTTP 500 JSON response on failure. |
| **P1** | **Queue Head-of-line Blocking** (No loop try-catch isolation) | `src/forest/worker/index.ts` | Wrap individual message processing inside the `queue` batch loop in a try-catch block to isolate and drop or dead-letter corrupted events. |

### P2/P3 Issues

- **P2: Sequential HTTP/DB Loop Timeout**: In `video-status-sync`, replace the sequential `for` loop with a parallel execution pattern (e.g. using `p-limit` with a concurrency limit of 5-10) to avoid Cloudflare 30s timeouts.
- **P2: Inconsistent Input Validation**: Enforce Zod validation on all API endpoints. Currently 251 out of 377 routes bypass schema checks.
- **P3: Disjointed Observability Tracing**: Implement a Next.js API middleware wrapper or use Node's `AsyncLocalStorage` to propagate the `requestId` context automatically to all logger calls.

---

## 5. Verification Method

To verify these findings:

1. **Verify `debitMcuBalance` Race**:
   - Write a unit test invoking `debitMcuBalance` concurrently for the same `orgId` (e.g., using `Promise.all`).
   - Check if the resulting balance drops below 0.
2. **Verify Zod Route Coverage**:
   - Inspect `zod-audit-results.json` in the working directory to see the complete list of validated/unvalidated routes.
3. **Verify Queue Consumer Isolation**:
   - Push a message that causes `incrementUsage` to throw an error into the queue.
   - Verify if valid messages in the same batch are prevented from being processed.
