# Codebase Edge Cases & Security Review Report — Sophia AI Factory

This report presents a comprehensive audit of the Sophia AI Factory codebase, evaluating critical edge cases across four key domains: **Payments & Webhooks**, **Authentication & Session Validation**, **Credits & Video Generation**, and **Usage Metering & Quotas**. 

A total of **14 critical edge cases** have been identified, verified, and mapped to exact code locations. 

---

## 🚦 Executive Summary

| ID | Domain | Edge Case Concern | Status | File Reference / Line Number |
| :--- | :--- | :--- | :---: | :--- |
| **1** | Payments | Concurrent Duplicate IPN Requests (Idempotency) | ❌ **Unhandled** | [nowpayments-ipn-handlers.ts:L35-37](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts#L35-37) <br> [route.ts:L97-102](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts#L97-L102) |
| **2** | Payments | Webhook Signature Checking & Timing Security | ✅ **Handled** | [route.ts:L38-48](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/nowpayments/route.ts#L38-L48) <br> [signature.ts:L118-131](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/webhooks/signature.ts#L118-131) |
| **3** | Payments | PayOS Underpayment & Overpayment Verification | ❌ **Unhandled** | [route.ts:L122-137](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts#L122-L137) |
| **4** | Payments | PayOS Insecure Match Fallback Exploit Vector | ❌ **Unhandled** | [route.ts:L133-134](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts#L133-L134) |
| **5** | Auth | Session Sync on Tier Upgrades/Downgrades | ✅ **Handled** | [middleware.ts:L168-176](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/middleware.ts#L168-176) <br> [get-user-tier.ts:L35-72](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/get-user-tier.ts#L35-72) |
| **6** | Auth | Admin Role Demotion Cookie Caching Latency | ⚠️ **Partial** | [is-user-admin.ts:L35-37](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/is-user-admin.ts#L35-L37) <br> [better-auth-server.ts:L97](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts#L97) |
| **7** | Auth | D1 DB Connectivity Failure (General Dashboard) | ✅ **Handled** | [middleware.ts:L137-196](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/middleware.ts#L137-196) <br> [better-auth-session.ts:L25-41](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/better-auth-session.ts#L25-41) |
| **8** | Auth | MFA Bypass on Database Connectivity Failure | ❌ **Unhandled** | [middleware.ts:L151-154](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/middleware.ts#L151-154) |
| **9** | Video | Concurrent Duplicate HeyGen Webhooks (Success) | ⚠️ **Partial** | [complete-video-from-webhook.ts:L77-183](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts#L77-L183) |
| **10** | Video | Concurrent Duplicate HeyGen Webhooks (Failure) | ✅ **Handled** | [complete-video-from-webhook.ts:L193-262](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts#L193-L262) |
| **11** | Video | Credit Decrement Integrity (Double-spent protection) | ✅ **Handled** | [complete-video-from-webhook.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts) |
| **12** | Video | Optimistic Locking in `decrementCredits` | ❌ **Unhandled** | [user-purchases-repo.ts:L180-205](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts#L180-L205) |
| **13** | Video | Cloudflare Worker Timeouts in Retry Cron Batch Loop | ⚠️ **Partial** | [route.ts:L105-131](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/route.ts#L105-L131) |
| **14** | Metering | Redis Non-Atomic Read-Modify-Write | ❌ **Unhandled** | [realtime-tracker.ts:L40-48](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker.ts#L40-L48) |
| **15** | Metering | D1 Usage Query JavaScript Rollup performance | ❌ **Unhandled** | [quota-checker-db.ts:L71-107](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/quota/quota-checker-db.ts#L71-L107) |

---

## 🔎 Detailed Findings & Recommendations

### 1. Payments & Webhooks

#### Case 1.1: Concurrent Duplicate IPN Requests (Idempotency Race)
* **Status:** ❌ **Unhandled**
* **Verification Detail:** 
  The webhook handler for both NOWPayments and PayOS checks if a payment transaction has already been processed using a simple database select read:
  * For NOWPayments: [nowpayments-ipn-handlers.ts:L35-37](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts#L35-37) checks `isPaymentProcessed(payment_id)`.
  * For PayOS: [route.ts:L97-102](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts#L97-L102) checks `isPayOsEventProcessed(orderCode)`.
  
  Both handlers execute an asynchronous database write to store the status at the *end* of the request cycle. Two concurrent webhooks executing simultaneously will both read the database before either has written, bypassing the idempotency check.
* **Risk:** Redundant execution of side effects (duplicate welcome emails, receipts, auto-handovers, and referral reward credits).
* **Remediation:** 
  Replace the read-then-write sequence with an immediate atomic `INSERT` of the event identifier using a `UNIQUE` constraint in D1. Catch the unique constraint violation and abort early:
  ```typescript
  try {
    await db.from('payment_events').insert({
      event_id: `nowpayments_${paymentId}`,
      processed: 0,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    return { success: true, message: 'Already processing or completed' }; // Abort early
  }
  ```

#### Case 1.2: Webhook Signature Checks
* **Status:** ✅ **Handled**
* **Verification Detail:** 
  * NOWPayments verify HMAC-SHA512 in [route.ts:L38-48](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/nowpayments/route.ts#L38-L48). Mismatch/missing signatures are properly rejected.
  * PayOS verify signature in [route.ts:L80-94](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts#L80-L94). Mismatch/missing signatures throw error or fail Zod schema parse.
  * Underlying cryptographic verification in [signature.ts:L118-131](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/webhooks/signature.ts#L118-L131) wraps execution in `try-catch` blocks returning `false` on any parsing or signature failure, preventing crash loops.

#### Case 1.3: PayOS Underpayment & Overpayment Verification
* **Status:** ❌ **Unhandled**
* **Verification Detail:** 
  The PayOS IPN route ([route.ts:L122-137](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts#L122-L137)) receives the `amount` paid in VND. However, the handler activates the tier blindly upon receiving a success status from PayOS without comparing the transfer amount against the expected price configured for that tier (`getPayOsTierConfig(tier).vndAmount`).
* **Risk:** Users paying a custom low amount can bypass pricing limits and register high tiers.
* **Remediation:** 
  Add amount verification:
  ```typescript
  const expectedConfig = getPayOsTierConfig(tier);
  if (amount < expectedConfig.vndAmount) {
    logger.error('[PayOS IPN] Underpayment detected', { orderCode, amount, expected: expectedConfig.vndAmount });
    return NextResponse.json({ error: 'Underpayment' }, { status: 400 });
  }
  ```

#### Case 1.4: PayOS Insecure Match Fallback
* **Status:** ❌ **Unhandled**
* **Verification Detail:** 
  If matching the pending order via URL fails, the handler falls back to the first available pending order ([route.ts:L133-134](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts#L133-L134)):
  ```typescript
  const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)))
    ?? orders?.[0]
  ```
* **Risk:** If a user has a pending checkout for a `MASTER` tier and later creates a checkout for a `BASIC` tier, an IPN match failure on the `BASIC` invoice will activate the first element (`orders?.[0]`), upgrading the user to the `MASTER` plan for the price of `BASIC`.
* **Remediation:** 
  Remove the fallback. Fail the request if no exact match is found:
  ```typescript
  const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)));
  if (!matchOrder) {
    logger.error('[PayOS IPN] No matching pending order found', { paymentLinkId, orderCode });
    return NextResponse.json({ error: 'Order not found' }, { status: 400 });
  }
  ```

---

### 2. Authentication & Session Validation

#### Case 2.1: Session Synchronization on Tier Changes
* **Status:** ✅ **Handled**
* **Verification Detail:** 
  The codebase retrieves the tier configuration from the database in real-time. In [middleware.ts:L168-176](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/middleware.ts#L168-176), direct lookup checks the `subscriptions` table. Across the pages, the server actions call `getUserTier(userId)` ([get-user-tier.ts:L35-72](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/get-user-tier.ts#L35-72)). Tiers are not stored in JWTs, ensuring updates apply immediately.

#### Case 2.2: Admin Role Demotion Cache Latency
* **Status:** ⚠️ **Partial**
* **Verification Detail:** 
  Better Auth implements a 5-minute session cookie cache in [better-auth-server.ts:L97](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts#L97). When checking admin status, [is-user-admin.ts:L35-37](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/is-user-admin.ts#L35-L37) relies on the session role:
  ```typescript
  if (user.role === 'admin') {
    return { isAdmin: true, dbRole: 'admin' };
  }
  ```
  If an admin user is demoted in the database, the check will evaluate to `true` until the cookie cache expires or the user manually logs out.
* **Risk:** Demoted admins retain full privileges on active sessions for up to 5 minutes.
* **Remediation:** 
  Remove the session-cookie fast-path for critical administrator commands, enforcing a direct DB lookup on user demotions:
  ```typescript
  // Enforce DB verify for role verification in isUserAdminWithRole:
  const profile = await db.from('user_profiles').select('role').eq('user_id', user.id).single();
  if (profile?.data?.role === 'admin') {
    return { isAdmin: true, dbRole: 'admin' };
  }
  return { isAdmin: false, dbRole: profile?.data?.role };
  ```

#### Case 2.3: Database Outage during Auth Check
* **Status:** ✅ **Handled** (Fail Closed)
* **Verification Detail:** 
  `middleware.ts` wraps path validation in `try-catch` structures. D1 query failure inside `getSession` causes the middleware to abort, returning HTTP 503 or redirecting the user to `/login` ([middleware.ts:L194-196](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/middleware.ts#L194-196)).

#### Case 2.4: MFA Bypass on Database Outage
* **Status:** ❌ **Unhandled** (Fail Open / Security Vulnerability)
* **Verification Detail:** 
  If a user has MFA enabled, the middleware normally redirects them to `/auth/mfa-challenge` ([middleware.ts:L145-150](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/middleware.ts#L145-150)). However, if the database connectivity check fails during the check (`isSessionMfaPending`), the middleware logs the error and allows the user straight into the dashboard ([middleware.ts:L151-154](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/middleware.ts#L151-154)):
  ```typescript
  } catch (mfaErr) {
    // Non-fatal — log and allow through to avoid locking out users on DB errors
    logger.error('[Middleware] MFA pending check error', toError(mfaErr))
  }
  ```
* **Risk:** During transient database connectivity glitches, a user who has bypassed password auth can enter dashboard environments without passing MFA.
* **Remediation:** 
  Make the check fail closed. If the check throws, redirect the user back to the login page or an authentication error state rather than bypassing the MFA gate:
  ```typescript
  } catch (mfaErr) {
    logger.error('[Middleware] MFA pending check error — failing closed', toError(mfaErr));
    return NextResponse.redirect(new URL('/login?error=auth_temp_unavailable', request.url));
  }
  ```

---

### 3. Credits & Video Generation

#### Case 3.1: Concurrent Duplicate HeyGen Webhooks (Success / Completed)
* **Status:** ⚠️ **Partial**
* **Verification Detail:** 
  In [complete-video-from-webhook.ts:L77-183](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts#L77-L183), when processing `avatar_video.success`, the handler reads the video status and skips if it is already terminal. 
  If two duplicate webhooks execute concurrently, they will both read the database before either has written. This leads to redundant asset downloads, duplicate R2 uploads, and duplicate completion emails sent to the customer.
* **Remediation:** 
  Introduce Compare-And-Swap (CAS) update checks directly into the update query:
  ```typescript
  const result = await d1
    .prepare(
      `UPDATE videos
       SET status = 'completed', video_url = ?2, r2_key = ?3, updated_at = ?4
       WHERE id = ?1 AND status != 'completed'
       RETURNING id`,
    )
    .bind(row.id, videoUrl, r2Key, now)
    .first<{ id: string }>();

  if (!result) {
    logger.info('[WebhookComplete] Lost race — already marked completed', { videoId: row.id });
    return;
  }
  ```

#### Case 3.2: Concurrent Duplicate HeyGen Webhooks (Failure & Compensation)
* **Status:** ✅ **Handled**
* **Verification Detail:** 
  Failure webhooks (`avatar_video.fail`) process through CAS mechanisms (`recordAttemptCAS`, `markPermanentFailureCAS` in [videos-repo.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/repositories/videos-repo.ts#L167-L242)). Only one webhook execution can modify the status to failed and issue refund/compensation credits, preventing double-credits.

#### Case 3.3: Optimistic Locking Failure in `decrementCredits`
* **Status:** ❌ **Unhandled**
* **Verification Detail:** 
  In [user-purchases-repo.ts:L180-205](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts#L180-L205), `decrementCredits` performs an optimistic locking update on `credits_remaining`:
  ```typescript
  await db
    .from('user_purchases')
    .update({ credits_remaining: row.credits_remaining - 1, updated_at: now })
    .eq('id', purchaseId)
    .eq('credits_remaining', row.credits_remaining) // optimistic check

  return true;
  ```
  However, the custom D1 query runner does not throw an error if zero rows match the criteria. The update succeeds silently modifying 0 rows, and the function blindly returns `true` to the caller.
* **Risk:** Parallel processes can consume the same credits concurrently without detecting failures, allowing users to render multiple videos for free.
* **Remediation:** 
  Check the execution response to ensure a row was mutated:
  ```typescript
  const { data, error } = await db
    .from('user_purchases')
    .update({ credits_remaining: row.credits_remaining - 1, updated_at: now })
    .eq('id', purchaseId)
    .eq('credits_remaining', row.credits_remaining)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    return false; // Lock failed
  }
  return true;
  ```

#### Case 3.4: Worker Timeouts in Retry Queue Batch Loops
* **Status:** ⚠️ **Partial**
* **Verification Detail:** 
  The cron handler in [route.ts:L105-131](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/route.ts#L105-L131) runs a sequential `for...of` loop to create retry jobs. If the batch contains 20 items and each request to HeyGen times out or takes 10+ seconds, the sequential execution will exceed the Cloudflare Worker execution time cap (30 seconds) and terminate mid-batch.
* **Remediation:** 
  Process the retries concurrently in limited batches (e.g. using `Promise.allSettled` or `p-limit` concurrency of 5):
  ```typescript
  const chunks = chunk(rows, 5);
  for (const batch of chunks) {
    await Promise.allSettled(batch.map(row => retryFulfillment(row)));
  }
  ```

---

### 4. Usage Metering & Quotas

#### Case 4.1: Redis Non-Atomic Read-Modify-Write
* **Status:** ❌ **Unhandled**
* **Verification Detail:** 
  In [realtime-tracker.ts:L40-48](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker.ts#L40-L48), the usage tracker reads current value from Redis via `kv.get`, calculates updates in memory, and sets it back using `kv.set`. 
  If multiple API calls hit the service concurrently, the fetch-then-set loop creates a race condition where some increments are overwritten.
* **Risk:** Usage quotas are undercounted under high-concurrency requests, allowing customers to bypass billing tiers.
* **Remediation:** 
  Transition from storing JSON objects to structured string keys incorporating the window start stamp: `usage:${userId}:${licenseNonce}:${windowStart}`. Perform atomic operations (`INCRBY` / `hincrby` with expiry):
  ```typescript
  const key = `usage:${userId}:${licenseNonce}:${windowStart}`;
  const total = await kv.incrby(key, creditsUsed);
  if (total === creditsUsed) {
    await kv.expire(key, 3600); // Set TTL on initialization
  }
  ```

#### Case 4.2: D1 Usage Query JavaScript Rollup Performance
* **Status:** ❌ **Unhandled**
* **Verification Detail:** 
  `calculateCurrentUsage` retrieves every individual `credits_used` record within hourly, daily, and monthly rolling windows:
  ```typescript
  const [hourlyResult, dailyResult, monthlyResult] = await Promise.all([
    db.from('usage_events').select('credits_used')...
  ]);
  ```
  It then reduces them using JavaScript `.reduce` inside the worker ([quota-checker-db.ts:L71-107](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/quota/quota-checker-db.ts#L71-L107)).
* **Risk:** High memory usage (Worker crash on 128MB limits) and CPU loop blocking when summing thousands of monthly rows.
* **Remediation:** 
  Execute the sum aggregation in SQL:
  ```typescript
  const result = await db
    .from('usage_events')
    .select(`
      COALESCE(SUM(CASE WHEN created_at >= ${hourStart} AND created_at < ${hourStart + 3600} THEN credits_used ELSE 0 END), 0) as hourly_credits,
      COALESCE(SUM(CASE WHEN created_at >= ${dayStart} AND created_at < ${dayStart + 86400} THEN credits_used ELSE 0 END), 0) as daily_credits,
      COALESCE(SUM(CASE WHEN created_at >= ${monthStart} THEN credits_used ELSE 0 END), 0) as monthly_credits,
      COUNT(CASE WHEN created_at >= ${dayStart} AND created_at < ${dayStart + 86400} THEN 1 END) as daily_requests
    `)
    .eq('user_id', userId)
    .eq('license_nonce', licenseNonce)
    .gte('created_at', monthStart)
    .single();
  ```
  This reduces the D1 roundtrips from 3 to 1 and offloads the calculation to SQLite, passing only 1 row over the network.
