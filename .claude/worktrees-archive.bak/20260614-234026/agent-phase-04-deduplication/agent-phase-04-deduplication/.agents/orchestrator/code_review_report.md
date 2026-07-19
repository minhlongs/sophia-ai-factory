# Sophia AI Factory - Codebase Review & Edge Case Audit Report

This report details a parallel codebase review and edge case audit of the Sophia AI Factory platform, focusing on payments, authentication, video & credits, and metering.

---

## 🚦 Executive Summary

We reviewed the implementation across the 4 key operational domains and identified **14 critical edge cases**. Many of these represent severe, unhandled logic bugs that could lead to financial losses (free services), broken user workflows, and webhook failures in production.

---

## 🔎 Detailed Edge Case Registry

### 1. Payments (NOWPayments & PayOS)

#### Edge Case 1.1: NOWPayments Webhook Idempotency Status Conflict
* **Status**: ⚠️ **Partially Handled**
* **File & Line**: `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-db.ts` (lines 20-30, 32-41)
* **Code Reference**:
  ```typescript
  export async function isPaymentProcessed(paymentId: string): Promise<boolean> {
    const { data } = await db.from('payment_events').select('processed').eq('event_id', `nowpayments_${paymentId}`).single()
    return data?.processed === 1 || data?.processed === true
  }
  ```
* **Vulnerability & Blast Radius**: NOWPayments sends multiple webhooks as a payment moves through various states (e.g. `confirming`, `sending`, `finished`). The system generates the database `event_id` solely based on the payment ID (`nowpayments_${paymentId}`). The first status received (e.g., `confirming`) will mark the key as processed. When the terminal `finished` webhook arrives, `isPaymentProcessed` returns `true` immediately and skips processing. As a result, the user's tier is never upgraded and credits are never granted.
* **Remedy**: Scope the `event_id` in the database to include both the payment ID and the status (e.g. `nowpayments_${paymentId}_${status}`), or only set `processed` to true when a terminal state (`finished`, `failed`) is processed.

#### Edge Case 1.2: NOWPayments Underpayment / Partial Payment Leakage
* **Status**: ⚠️ **Partially Handled**
* **File & Line**: `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts` (line 44)
* **Code Reference**:
  ```typescript
  case 'partially_paid': logger.info('[NOWPayments] Partial payment received — holding', { payment_id }); break
  ```
* **Vulnerability & Blast Radius**: If a customer underpays, NOWPayments sends a `partially_paid` webhook. The system logs an info message and records the event as processed, but does not upgrade the user's tier (correct) nor does it notify administrators or trigger a support flow. Furthermore, due to the idempotency bug in 1.1, if the user sends the remaining funds later and a `finished` webhook arrives, it will be skipped entirely.
* **Remedy**: Flag partial payments in a dedicated audit log or trigger an admin alert via Resend/Slack. Fix the idempotency key structure to allow processing subsequent `finished` events.

#### Edge Case 1.3: PayOS Webhook Description Parsing Regex Mismatch
* **Status**: ❌ **Unhandled**
* **File & Line**: `apps/sophia-ai-factory/src/land/payments/payos.ts` (lines 178, 252-256) & `apps/sophia-ai-factory/src/app/api/webhooks/payos/route.ts` (line 96)
* **Code Reference**:
  ```typescript
  // In createPayOsInvoice:
  const description = `Sophia ${tier} - ${orderId.slice(-8)}`
  
  // In parseUserIdFromPayOsDescription:
  const match = description.match(/sophia_([^_]+)_\d+/)
  ```
* **Vulnerability & Blast Radius**: When creating a PayOS invoice, the description is formatted as `Sophia BASIC - 17171717`. However, the webhook receiver attempts to extract the `userId` using a regex that expects the full `orderId` pattern (`sophia_{userId}_{ts}`). Since the description does not contain the `sophia_` prefix, the regex match always fails, returning `null`. This results in the PayOS webhook failing with a 422 error ("Cannot resolve user") for all payments.
* **Remedy**: Store the full `orderId` in the PayOS payment description or modify the regex pattern in `parseUserIdFromPayOsDescription` to correctly parse the identifier.

#### Edge Case 1.4: PayOS Webhook Underpayments / Invalid Amount Retry Storm
* **Status**: ❌ **Unhandled**
* **File & Line**: `apps/sophia-ai-factory/src/app/api/webhooks/payos/route.ts` (lines 103-107)
* **Code Reference**:
  ```typescript
  const tier = resolveTierFromAmount(amount)
  if (!tier) {
    logger.warn('[PayOS Webhook] Cannot resolve tier from amount', { amount, orderCode })
    return NextResponse.json({ error: 'Cannot resolve tier' }, { status: 422 })
  }
  ```
* **Vulnerability & Blast Radius**: If a user pays an incorrect amount, `resolveTierFromAmount` returns `null`. The route returns a 422 error early, *before* recording the event as unprocessed in the database. Since PayOS retries webhook delivery infinitely on non-200 responses, this creates a webhook retry storm, and admins have no database record of the transaction.
* **Remedy**: Record the incoming webhook payload with `processed = 0` and a status of `invalid_amount` before returning the error, and notify the operations team.

#### Edge Case 1.5: PayOS Webhook Signature Verification
* **Status**: ✅ **Handled**
* **File & Line**: `apps/sophia-ai-factory/src/land/payments/payos.ts` (lines 130-139)
* **Code Reference**:
  ```typescript
  export async function verifyPayOsWebhook(rawBody: string, signature: string, checksumKey: string): Promise<boolean> {
    return verifyInboundWebhook(rawBody, signature, checksumKey, {
      algo: 'SHA-256',
      canonicalize: payOsCanonicalize,
    })
  }
  ```
* **Remedy**: None. The implementation uses HMAC-SHA256 signature verification over sorted key-value pairs of the payload `data` object, which is secure and conforms to the PayOS specification.

---

### 2. Authentication (Better Auth)

#### Edge Case 2.1: Better Auth Session State Synchronization Cookie Cache Lag
* **Status**: ⚠️ **Partially Handled**
* **File & Line**: `apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts` (lines 94-98)
* **Code Reference**:
  ```typescript
  session: {
    expiresIn: 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  }
  ```
* **Vulnerability & Blast Radius**: Cookie caching is enabled with a 5-minute TTL (`maxAge: 500`). When the server modifies a user's subscription tier or roles (via PayOS/NOWPayments webhooks), the client-side session reads the cached token for up to 5 minutes. The user must manually log out or wait 5 minutes before they see their upgraded tier features in the UI.
* **Remedy**: Disable cookie caching for sensitive checkout routes, or trigger a client-side session sync call (e.g. `auth.useSession({ fetchOptions: { headers: { 'Cache-Control': 'no-cache' } } })`) once the payment success page is loaded.

#### Edge Case 2.2: Better Auth Session Lookup D1 Transient Failure Handling
* **Status**: ⚠️ **Partially Handled**
* **File & Line**: `apps/sophia-ai-factory/src/seed/auth/better-auth-session.ts` (lines 25-41)
* **Code Reference**:
  ```typescript
  export async function getSession() {
    try {
      // ...
      const session = await auth.api.getSession({ headers: await headers() });
      return session;
    } catch (err) {
      logger.error('[better-auth-session] getSession failed', ...);
      return null;
    }
  }
  ```
* **Vulnerability & Blast Radius**: If the D1 database is temporarily locked or times out during authentication, `getSession` catches the exception and returns `null` instead of propagating the error. Server Components and layouts treat this as "unauthenticated" and force-redirect the user to the login/signup page, abruptly logging them out.
* **Remedy**: Distinguish between an empty session (returns null from API) and a database system error (throws exception). Propagate database errors so the client can display a transient error page (503) rather than deleting session state.

---

### 3. Video & Credits

#### Edge Case 3.1: Unchecked Optimistic Lock Bypass in `decrementCredits`
* **Status**: ⚠️ **Partially Handled**
* **File & Line**: `apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts` (lines 180-205)
* **Code Reference**:
  ```typescript
  await db
    .from('user_purchases')
    .update({ credits_remaining: row.credits_remaining - 1, updated_at: now })
    .eq('id', purchaseId)
    .eq('credits_remaining', row.credits_remaining) // optimistic check

  return true // returns true unconditionally!
  ```
* **Vulnerability & Blast Radius**: Although the update query includes an optimistic comparison guard, the function returns `true` unconditionally without validating the number of rows updated. In a high-concurrency race condition where the optimistic check fails (affecting 0 rows), the application reports a successful decrement, granting the user a free video render.
* **Remedy**: Retrieve the number of affected rows (from metadata or checking `meta.changes === 1`) and return `false` if the optimistic lock condition was not met.

#### Edge Case 3.2: HeyGen Webhook Fulfillment Double-Rendering Race Condition
* **Status**: ❌ **Unhandled**
* **File & Line**: `apps/sophia-ai-factory/src/app/api/webhooks/heygen/route.ts` & `apps/sophia-ai-factory/docs/comprehensive_audit_report.md` (lines 49-51)
* **Vulnerability & Blast Radius**: Under high concurrent triggers, multiple webhook callbacks for the same purchase bypass the application-level `findByPurchaseId` check. Because the `videos` table lacks a `UNIQUE` constraint on `purchase_id`, multiple concurrent video generation jobs are dispatched to HeyGen, draining the platform's API credits.
* **Remedy**: Add a `UNIQUE` constraint/index on `videos.purchase_id` in the D1 database to block duplicate creation attempts at the storage layer.

#### Edge Case 3.3: Cloudflare Workers 30s Execution Timeout during Video Status Sync
* **Status**: ⚠️ **Partially Handled**
* **File & Line**: `apps/sophia-ai-factory/src/app/api/cron/video-status-sync/route.ts` & `apps/sophia-ai-factory/docs/comprehensive_audit_report.md` (lines 57-59)
* **Vulnerability & Blast Radius**: The video status synchronization cron loops sequentially over up to 50 pending video rows and performs external API calls to check HeyGen status. If downstream APIs are slow, these sequential roundtrips exceed Cloudflare's 30-second execution limit, killing the Worker thread abruptly.
* **Remedy**: Use a bounded concurrency limit utility (e.g. `p-limit` set to 5-10) to execute the HTTP requests concurrently.

#### Edge Case 3.4: HeyGen Tenant-Specific Webhook Signature Verification
* **Status**: ✅ **Handled**
* **File & Line**: `apps/sophia-ai-factory/src/lib/webhooks/heygen-webhook-secret-resolver.ts` (lines 42-74)
* **Remedy**: None. The system resolves the user's custom `heygen_webhook_secret` via `getUserCredential` based on the owner of the `heygen_job_id` and verifies the payload signature accordingly, preventing cross-tenant forgery.

---

### 4. Metering

#### Edge Case 4.1: Non-Atomic Redis Nonce Check Replay Attack
* **Status**: ❌ **Unhandled**
* **File & Line**: `apps/sophia-ai-factory/src/forest/raas-service-key-operations.ts` (lines 76-96)
* **Code Reference**:
  ```typescript
  const exists = await redisClient.get(key);
  if (exists) { return true; }
  await redisClient.set(key, '1', { ex: ttl });
  return false;
  ```
* **Vulnerability & Blast Radius**: The nonce check is implemented as a non-atomic read-then-write pattern. In a high-concurrency replay attack, multiple requests with the same nonce will query Redis, retrieve `exists = null` concurrently, bypass the check, and write the value. This allows the same license key to be used multiple times concurrently.
* **Remedy**: Use an atomic `SET` command with `NX` and `EX` arguments (e.g. `redisClient.set(key, '1', { nx: true, ex: ttl })`) and reject the request if the write fails (returns `null`).

#### Edge Case 4.2: D1 Usage Rollup Query Missing Index
* **Status**: ❌ **Unhandled**
* **File & Line**: `apps/sophia-ai-factory/src/lib/usage-export/export-service-query.ts` (lines 94-97) & composite index migration `0091-composite-indexes.sql`
* **Vulnerability & Blast Radius**: Rollup queries are filtered using `.eq('license_nonce', licenseNonce).gte('created_at', periodStart)`. However, the composite index `idx_usage_events_user_nonce_ts` on `(user_id, license_nonce, created_at)` starts with `user_id`, which is omitted from the query filters. There is no index starting with `license_nonce` on the `usage_events` table, forcing D1 to perform slow full table scans or date range scans, resulting in timeouts under high event volume.
* **Remedy**: Add a composite index on `usage_events(license_nonce, created_at)`.

#### Edge Case 4.3: Non-Atomic Cloudflare KV Quota Increment
* **Status**: ❌ **Unhandled**
* **File & Line**: `apps/sophia-ai-factory/src/forest/worker/lib/quota-counter.ts` (lines 59-80)
* **Code Reference**:
  ```typescript
  const currentValue = await kv.get(key);
  const current = currentValue ? parseInt(currentValue, 10) || 0 : 0;
  const newValue = current + tokens;
  await kv.put(key, newValue.toString(), ...);
  ```
* **Vulnerability & Blast Radius**: This read-modify-write pattern on Cloudflare KV is non-atomic. Concurrent requests on the Edge will read the same `currentValue` and overwrite each other's increments, resulting in significant under-metering.
* **Remedy**: Accumulate usage increments using atomic Redis operations (`INCRBY`) first, or coordinate updates using a Durable Object.

---

## 🛠️ Actionable Recommendations Summary

1. **Payments (NOWPayments)**: Change the idempotency key pattern in `payment_events` from `nowpayments_${paymentId}` to `nowpayments_${paymentId}_${status}` to allow processing status changes.
2. **Payments (PayOS)**: Align `createPayOsInvoice` description with `parseUserIdFromPayOsDescription` regex. Pass the full `orderId` rather than a sliced suffix.
3. **Authentication (Better Auth)**: Handle Kysely / D1 client errors in `getSession` by propagating system errors, allowing the UI to show a 503 instead of force-logging users out.
4. **Video & Credits**: Modify `decrementCredits` to parse the database changes metadata and assert that exactly `1` row was written, returning `false` on optimistic lock failure.
5. **Metering (Redis & KV)**: Replace the read-then-write nonce checks with `SETNX` commands, and replace the KV quota increments with atomic increment operations. Add a composite index on `usage_events(license_nonce, created_at)`.
