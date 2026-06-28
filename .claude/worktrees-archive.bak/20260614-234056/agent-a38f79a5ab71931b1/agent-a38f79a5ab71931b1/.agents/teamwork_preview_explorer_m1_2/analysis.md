# Analysis Report: Payments & Webhooks Security (Milestone 1)

This report details the investigation of concurrent duplicate IPN requests (idempotency race conditions), expected VND amount verification, and insecure fallback order removal in the Sophia AI Factory platform.

## Summary of Core Findings
* **Idempotency Race Condition**: Both NOWPayments and PayOS webhooks currently employ a vulnerable "check-then-upsert" pattern. We can resolve this race condition by executing an atomic `INSERT` statement on the `UNIQUE`/`PRIMARY KEY` constraint of the webhook logs table (`payment_events`/`payos_events`) to act as a lock, catching any constraint violations, and rolling back (deleting the record) upon processing failure to allow retries.
* **PayOS VND Amount Verification**: PayOS IPN requests lack amount validation because `pending_orders.amount_usd_cents` is set to `0` for VND checkouts. We can calculate the correct expected VND price by invoking `getPayOsTierConfig(tier).vndAmount` and verifying it matches the incoming payload amount.
* **Insecure Order Fallback**: In the PayOS IPN route, if no match is found, the system falls back to `orders?.[0]` (the first pending order). This can be resolved by removing the fallback and returning a `400 Bad Request` when no matching pending order exists.

---

## 1. Resolving Concurrent Duplicate IPN Requests (Idempotency Race)

### Direct Observations & Context
* **NOWPayments Codebase**:
  * File: `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts`
  * Vulnerable Code (Lines 35-37):
    ```typescript
    if (await isPaymentProcessed(payment_id)) return { success: true, message: 'Already processed' }
    await recordIpnEvent(payment_id, payment_status, ipn as unknown as Record<string, unknown>, false)
    ```
  * In `nowpayments-ipn-db.ts` (Lines 32-37), the function `recordIpnEvent` executes a `.upsert()` operation. If a duplicate concurrent request passes `isPaymentProcessed` (because `processed` is still `0`), it will overwrite the lock record without throwing any constraint violations. Additionally, the database operations are wrapped in `try/catch` blocks that catch and ignore errors.
* **PayOS Codebase**:
  * File: `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`
  * Vulnerable Code (Lines 97-102):
    ```typescript
    if (await isPayOsEventProcessed(orderCode)) {
      return NextResponse.json({ received: true, note: 'Already processed' })
    }
    await recordPayOsEvent(orderCode, success ? 'PAID' : 'CANCELLED', bodyJson, false)
    ```
  * In `route.ts` (Lines 35-47), `recordPayOsEvent` also runs an `.upsert()` statement on the `payos_events` table and catches/swallows all exceptions.
* **Schema Definitions**:
  * `payment_events` table (in `migrations/0002-payment-events.sql`) contains:
    ```sql
    event_id TEXT UNIQUE NOT NULL
    ```
  * `payos_events` table (in `migrations/0072-payos-events.sql`) contains:
    ```sql
    event_id TEXT PRIMARY KEY
    ```

### Logic Chain & Resolution Plan
1. **The Concurrency Problem**: When two concurrent IPN requests hit the endpoint at the same millisecond:
   * Thread A checks if processed (none exists/returns false).
   * Thread B checks if processed (none exists/returns false).
   * Thread A upserts `processed = 0`.
   * Thread B upserts `processed = 0`.
   * Both threads proceed to dispatch/upgrade the subscription, resulting in double-crediting or duplicate upgrades.
2. **The Atomic Lock Solution**:
   * Instead of the non-atomic check-then-upsert approach, we should use a single `insert()` call to try inserting the event row with `processed = 0`.
   * Since `event_id` is unique, only the first request can successfully insert the record.
   * If the `insert()` fails due to a `UNIQUE` / `PRIMARY KEY` constraint violation, it will return an `error` object (e.g. `UNIQUE constraint failed`). We can handle this error:
     * Check if the event in the database is already fully processed (`processed = 1`). If so, return a success response immediately (idempotency).
     * If `processed = 0` (processing in progress), return a conflict status (409 for PayOS or success=false for NOWPayments) so the sender retries later.
   * If processing fails, delete the inserted row so that the event can be retried.
   * Once processing succeeds, update the row to `processed = 1`.

### Proposed Code Changes (Non-applied)

**For NOWPayments (`nowpayments-ipn-db.ts` / `nowpayments-ipn-handlers.ts`)**:
Create new locking functions or modify `recordIpnEvent`:
```typescript
export async function acquireNowPaymentsLock(paymentId: string, status: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const db = getDb();
    const { error } = await db.from('payment_events').insert({
      event_id: `nowpayments_${paymentId}`,
      event_type: `nowpayments.${status}`,
      payload: JSON.stringify(payload),
      processed: 0,
      created_at: new Date().toISOString()
    });
    return !error;
  } catch {
    return false;
  }
}

export async function markNowPaymentsEventProcessed(paymentId: string): Promise<void> {
  const db = getDb();
  await db.from('payment_events').update({ processed: 1 }).eq('event_id', `nowpayments_${paymentId}`);
}

export async function releaseNowPaymentsLock(paymentId: string): Promise<void> {
  const db = getDb();
  await db.from('payment_events').delete().eq('event_id', `nowpayments_${paymentId}`);
}
```

In `nowpayments-ipn-handlers.ts`:
```typescript
export async function processNowPaymentsIpn(
  ipn: NowPaymentsIpnPayload
): Promise<{ success: boolean; message: string }> {
  const { payment_id, payment_status } = ipn

  const lockAcquired = await acquireNowPaymentsLock(payment_id, payment_status, ipn as unknown as Record<string, unknown>);
  if (!lockAcquired) {
    if (await isPaymentProcessed(payment_id)) {
      return { success: true, message: 'Already processed' };
    }
    return { success: false, message: 'Processing in progress' };
  }

  try {
    switch (payment_status) {
      case 'finished':      await dispatchFinished(ipn); break
      case 'refunded':      await dispatchRefunded(ipn); break
      case 'failed':        await handleFailed(ipn); break
      case 'partially_paid': logger.info('[NOWPayments] Partial payment received — holding', { payment_id }); break
      case 'expired':        logger.info('[NOWPayments] Payment expired — no action', { payment_id }); break
      default:               logger.debug('[NOWPayments] Unhandled status', { payment_status, payment_id })
    }
    await markNowPaymentsEventProcessed(payment_id);
    return { success: true, message: `Processed ${payment_status}` }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[NOWPayments] IPN processing failed', err, { payment_id, payment_status })
    await releaseNowPaymentsLock(payment_id);
    return { success: false, message: err.message }
  }
}
```

---

## 2. Implementing PayOS VND Amount Verification

### Direct Observations & Context
* **PayOS Checkout Route**:
  * File: `apps/sophia-ai-factory/src/app/api/checkout/route.ts`
  * Observation (Line 233):
    ```typescript
    amount_usd_cents: 0, // VND payment — USD amount not relevant
    ```
  * During checkouts via PayOS, the USD amount is recorded as `0` in `pending_orders`, rendering comparison with `amount_usd_cents` impossible.
* **PayOS Config Helpers**:
  * File: `apps/sophia-ai-factory/src/land/payments/payos.ts`
  * Observation (Lines 30-34):
    ```typescript
    export function getPayOsTierConfig(tier: Tier): PayOsTierConfig {
      const usd = TIER_USD_PRICES[tier]
      const vnd = Math.round((usd * USD_TO_VND) / 1000) * 1000 // round to 1000 VND
      return { tier, vndAmount: vnd, usdAmount: usd }
    }
    ```

### Logic Chain & Resolution Plan
1. Since the pending order does not contain the expected amount in VND (or cents), we must calculate the expected VND price dynamically.
2. The `getPayOsTierConfig(tier)` helper calculates the standard price in VND by converting USD price to VND using the environment variable `USD_TO_VND` (fallback to `25000`) and rounding to the nearest 1000 VND. This is exactly how the payment link is generated at checkout time.
3. In `POST /api/payos/ipn/route.ts`, after resolving the tier from the matching pending order:
   * Retrieve the tier configuration: `const tierConfig = getPayOsTierConfig(tier)`
   * Check if the paid amount (`amount` from IPN payload) is equal to `tierConfig.vndAmount`.
   * If it differs, log an error and return a `400 Bad Request` error to reject the webhook transaction.

### Proposed Code Changes (Non-applied)

Import the helper in `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`:
```typescript
import { verifyPayOsWebhook, payOsIpnSchema, FEATURE_PAYOS, parseUserIdFromPayOsDescription, getPayOsTierConfig } from '@/land/payments/payos'
```

Add the comparison logic after resolving the `tier` and `orderId`:
```typescript
  const tier = (matchOrder?.tier ?? 'BASIC') as Tier
  
  // Verify expected VND amount matches actual paid amount
  const tierConfig = getPayOsTierConfig(tier)
  if (amount !== tierConfig.vndAmount) {
    logger.error('[PayOS IPN] Amount mismatch detected', {
      orderCode,
      paidAmount: amount,
      expectedAmount: tierConfig.vndAmount,
      tier
    })
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
  }
```

---

## 3. Removing Insecure Fallback `orders?.[0]` in PayOS IPN

### Direct Observations & Context
* **PayOS IPN Handler**:
  * File: `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`
  * Observation (Lines 132-134):
    ```typescript
    const orders = pendingOrders as Array<{ order_id: string; tier: string; invoice_url: string | null }> | null
    const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)))
      ?? orders?.[0]
    ```

### Logic Chain & Resolution Plan
1. The current fallback `?? orders?.[0]` assigns the first pending order if no match is found by `paymentLinkId` or `orderCode`.
2. This is insecure: if a user creates a cheap pending order and then a expensive pending order, an arbitrary payment could fall back to upgrading their account with the wrong plan.
3. To secure this logic:
   * Remove the fallback `?? orders?.[0]`.
   * Assert that `matchOrder` is defined.
   * If `matchOrder` is `undefined`, return a `400 Bad Request` with an appropriate warning log.

### Proposed Code Changes (Non-applied)
Modify the matching block:
```typescript
  const orders = pendingOrders as Array<{ order_id: string; tier: string; invoice_url: string | null }> | null
  const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)))

  if (!matchOrder) {
    logger.warn('[PayOS IPN] No matching pending order found for user', { userId, orderCode, paymentLinkId })
    return NextResponse.json({ error: 'No matching pending order found' }, { status: 400 })
  }
```
This guarantees that only orders with a matching payment link ID or order code in their metadata are processed and activated.
