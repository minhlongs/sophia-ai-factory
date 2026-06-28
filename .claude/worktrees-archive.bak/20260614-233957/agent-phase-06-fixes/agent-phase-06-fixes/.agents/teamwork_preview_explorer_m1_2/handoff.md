# Handoff Report — Milestone 1: Payments & Webhooks Security

This handoff report summarizes the findings of the investigation into payments security, focusing on concurrency control, PayOS amount verification, and fallback order removal.

---

## 1. Observation

### Concurrency Control & Idempotency
* **NOWPayments Route**:
  * File path: `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts`
  * Line 35: `if (await isPaymentProcessed(payment_id)) return { success: true, message: 'Already processed' }`
  * Line 37: `await recordIpnEvent(payment_id, payment_status, ipn as unknown as Record<string, unknown>, false)`
  * File path: `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-db.ts`
  * Line 35: `await db.from('payment_events').upsert(...)` (handles SQL update/insert using Postgrest upsert).
* **PayOS Route**:
  * File path: `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`
  * Line 97: `if (await isPayOsEventProcessed(orderCode)) { return NextResponse.json({ received: true, note: 'Already processed' }) }`
  * Line 102: `await recordPayOsEvent(orderCode, success ? 'PAID' : 'CANCELLED', bodyJson, false)`
  * Line 38: `await db.from('payos_events').upsert(...)`
* **Schema definitions**:
  * In `apps/sophia-ai-factory/migrations/0002-payment-events.sql` line 4: `event_id TEXT UNIQUE NOT NULL`
  * In `migrations/0072-payos-events.sql` line 5: `event_id TEXT PRIMARY KEY`

### PayOS Amount Verification
* **Checkout route**:
  * File path: `apps/sophia-ai-factory/src/app/api/checkout/route.ts`
  * Line 233: `amount_usd_cents: 0, // VND payment — USD amount not relevant`
* **VND Prices derivation**:
  * File path: `apps/sophia-ai-factory/src/land/payments/payos.ts`
  * Lines 30-34:
    ```typescript
    export function getPayOsTierConfig(tier: Tier): PayOsTierConfig {
      const usd = TIER_USD_PRICES[tier]
      const vnd = Math.round((usd * USD_TO_VND) / 1000) * 1000 // round to 1000 VND
      return { tier, vndAmount: vnd, usdAmount: usd }
    }
    ```

### PayOS Fallback Order Removal
* **Route file**:
  * File path: `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`
  * Lines 133-134:
    ```typescript
    const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)))
      ?? orders?.[0]
    ```

---

## 2. Logic Chain

1. **Concurrency Race Condition**:
   * Checking if processed (`isPaymentProcessed` or `isPayOsEventProcessed`) followed by an `upsert()` allows concurrent requests to simultaneously pass the check and proceed to double-upgrade users.
   * By changing the logic to execute an atomic `INSERT` statement first on the table with the UNIQUE/PRIMARY KEY constraint (`payment_events.event_id` or `payos_events.event_id`), the database guarantees that only one concurrent transaction can succeed in creating the row (acquiring the lock).
   * A unique constraint violation returned in the `error` object indicates that another process is handling the transaction. We can then inspect the database row. If `processed = 1`, return a success response (idempotent skip). If `processed = 0`, return a conflict/in-progress response (e.g. 409 status code).
   * To enable retrying if a webhook processor fails, the lock row must be deleted upon transaction failure.

2. **Amount Verification**:
   * In PayOS checkout flow, `amount_usd_cents` is written as `0` because transactions are conducted in VND.
   * To verify the payment amount, the system must derive the expected amount in VND using the standard tier configuration and conversion rate via `getPayOsTierConfig(tier).vndAmount`.
   * Asserting `amount === getPayOsTierConfig(tier).vndAmount` prevents an attacker from altering the paid amount (underpaying) and still receiving the membership plan.

3. **Fallback Removal**:
   * The fallback `?? orders?.[0]` assigns the first pending order of the user if no matching invoice URL or order code is found in their queue.
   * This is insecure because it allows activating incorrect plans (e.g., if a user has multiple pending orders for different tiers, they may get upgraded to the wrong tier).
   * Removing the fallback ensures that only exact matches are processed, and mismatched requests are rejected.

---

## 3. Caveats

* Assumes that `USD_TO_VND` environment variable is identical at both checkout page link generation and webhook IPN verification time. If changed dynamically between the two operations, the amount validation will fail.
* Only investigated `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts` as requested; did not modify the sibling file `apps/sophia-ai-factory/src/app/api/webhooks/payos/route.ts` which has a similar pattern.

---

## 4. Conclusion

The Payments & Webhooks Security edge cases can be safely resolved without changing database schemas:
1. **Idempotency**: Replace check-then-upsert with atomic insert, catching unique constraint failures and deleting the lock row on processing failures.
2. **VND Verification**: Match incoming amount with `getPayOsTierConfig(tier).vndAmount` and reject on mismatch.
3. **Fallback**: Remove `?? orders?.[0]` fallback and reject unmatched requests with `400 Bad Request`.

---

## 5. Verification Method

* Run vitest unit tests:
  ```bash
  cd apps/sophia-ai-factory && npx vitest run src/land/billing/__tests__/nowpayments-ipn-idempotency.test.ts
  ```
* Ensure typescript compilation does not break:
  ```bash
  cd apps/sophia-ai-factory && npm run ci:typecheck
  ```
