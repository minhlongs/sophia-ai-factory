# Analysis Report — Milestone 1: Payments & Webhooks Security

## 1. Concurrency Idempotency Race Resolution

### direct Observations & Context
- In `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts`, the IPN handler checks `isPaymentProcessed(payment_id)` and then immediately writes to the DB using `recordIpnEvent(...)` with `processed = false`.
- In `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`, the PayOS IPN route checks `isPayOsEventProcessed(orderCode)` and then calls `recordPayOsEvent(...)` with `processed = false`.
- However, both DB handlers (`recordIpnEvent` and `recordPayOsEvent`) use `upsert()` on their respective tables (`payment_events` and `payos_events`).
- `upsert()` does not fail on duplicate keys; it performs an `ON CONFLICT DO UPDATE` under the hood, allowing concurrent execution flows to succeed, leading to a TOCTOU race condition where two webhook invocations can simultaneously trigger tier activation and credit grant.

### Existing Tables & Constraints
- **NOWPayments (`payment_events` table)**: Defined in `migrations/0002-payment-events.sql`. The column `event_id` is defined as `TEXT UNIQUE NOT NULL`.
- **PayOS (`payos_events` table)**: Defined in `migrations/0072-payos-events.sql`. The column `event_id` is defined as `TEXT PRIMARY KEY` (which inherently has a `UNIQUE` constraint).

### Proposed Resolution
To solve the concurrency race, we must change the initial reservation to use `.insert()` instead of `.upsert()`. When multiple concurrent requests attempt to insert the same `event_id`, SQLite will raise a unique key/primary key violation. The DB wrapper will return an error object (`{ error: { message } }`). If we check for this error and return early, only the first request to insert will proceed, while subsequent concurrent requests will abort safely.

#### Proposed Snippet: NOWPayments
Add `reserveIpnEvent` in `nowpayments-ipn-db.ts`:
```typescript
export async function reserveIpnEvent(paymentId: string, status: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const db = getDb()
    const { error } = await db.from('payment_events').insert({
      event_id: `nowpayments_${paymentId}`,
      event_type: `nowpayments.${status}`,
      payload: JSON.stringify(payload),
      processed: 0,
      created_at: new Date().toISOString()
    })
    if (error) {
      logger.warn('[NOWPayments] Event reservation failed (possible duplicate)', { paymentId, error: error.message })
      return false
    }
    return true
  } catch (err) {
    logger.warn('[NOWPayments] Event reservation exception', { paymentId, error: String(err) })
    return false
  }
}
```
Modify `processNowPaymentsIpn` in `nowpayments-ipn-handlers.ts`:
```typescript
  if (await isPaymentProcessed(payment_id)) return { success: true, message: 'Already processed' }

  // Atomic reservation to prevent race conditions
  const reserved = await reserveIpnEvent(payment_id, payment_status, ipn as unknown as Record<string, unknown>)
  if (!reserved) return { success: true, message: 'Already processed or processing' }
```

#### Proposed Snippet: PayOS
Add `reservePayOsEvent` and modify POST in `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`:
```typescript
async function reservePayOsEvent(orderCode: number, status: string, payload: unknown, amount: number): Promise<boolean> {
  try {
    const db = createServerClient()
    const { error } = await db.from('payos_events').insert({
      event_id: `payos_${orderCode}`,
      order_code: String(orderCode),
      status,
      amount,
      currency: 'VND',
      payload: JSON.stringify(payload),
      processed: 0,
      created_at: new Date().toISOString(),
    })
    if (error) {
      logger.warn('[PayOS IPN] Event reservation failed (possible duplicate)', { orderCode, error: error.message })
      return false
    }
    return true
  } catch (err) {
    logger.warn('[PayOS IPN] Event reservation exception', { orderCode, error: String(err) })
    return false
  }
}
```
In POST handler:
```typescript
  // Idempotency check
  if (await isPayOsEventProcessed(orderCode)) {
    return NextResponse.json({ received: true, note: 'Already processed' })
  }

  // Record event as unprocessed (reserve row) atomically
  const reserved = await reservePayOsEvent(orderCode, success ? 'PAID' : 'CANCELLED', bodyJson, amount)
  if (!reserved) {
    return NextResponse.json({ received: true, note: 'Already processed or processing' })
  }
```

---

## 2. Expected VND Amount Verification in PayOS IPN Route

### Direct Observations & Context
- In `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`, the paid amount in VND (`amount`) is received from the trusted, verified webhook body (`ipnData.amount`).
- Currently, the route does not verify if this `amount` matches the pricing configuration of the matched order's tier.
- The function `getPayOsTierConfig(tier)` in `apps/sophia-ai-factory/src/land/payments/payos.ts` defines the expected VND price for each tier (e.g. `vndAmount: 4975000` for `BASIC` when `USD_TO_VND` is `25000`).

### Proposed Resolution
Import `getPayOsTierConfig` into `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`. After finding the `matchOrder` and resolving its `tier`, calculate the expected `vndAmount` and verify that the received `amount` matches it.

#### Proposed Snippet
```typescript
  const expectedConfig = getPayOsTierConfig(tier)
  if (amount !== expectedConfig.vndAmount) {
    logger.warn('[PayOS IPN] Payment amount mismatch', {
      orderCode,
      receivedAmount: amount,
      expectedAmount: expectedConfig.vndAmount,
      tier,
    })
    return NextResponse.json({ error: 'Payment amount mismatch' }, { status: 400 })
  }
```

---

## 3. Removal of Insecure Fallback `orders?.[0]` in PayOS IPN

### Direct Observations & Context
- In `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`, the order matching is done as follows:
  ```typescript
  const orders = pendingOrders as Array<{ order_id: string; tier: string; invoice_url: string | null }> | null
  const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)))
    ?? orders?.[0]
  ```
- If a user has multiple pending orders, and the system fails to match by URL/orderCode, the `?? orders?.[0]` fallback automatically picks the first pending order.
- This is a major security flaw: a user can initiate checkout for a high-value tier (e.g., MASTER), initiate a subsequent checkout for a lower-value tier (e.g., BASIC), pay only for the lower-value tier, and potentially be activated for the high-value tier if the system falls back to `orders[0]`.

### Proposed Resolution
Remove the `?? orders?.[0]` fallback. If `matchOrder` is undefined, the webhook should immediately reject the request with a warning and a `400` status code, preventing any activation.

#### Proposed Snippet
```typescript
  const orders = pendingOrders as Array<{ order_id: string; tier: string; invoice_url: string | null }> | null
  const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)))

  if (!matchOrder) {
    logger.warn('[PayOS IPN] Matching pending order not found', { userId, paymentLinkId, orderCode })
    return NextResponse.json({ error: 'Matching pending order not found' }, { status: 400 })
  }

  const tier = matchOrder.tier as Tier
  const orderId = matchOrder.order_id
```
