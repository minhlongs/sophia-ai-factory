# Analysis Report — Milestone 1: Payments & Webhooks Security

## Overview
This report details the security analysis and proposed remediation plans for the Sophia AI Factory billing system under Milestone 1. Specifically, it addresses concurrent duplicate IPN requests (idempotency races), expected VND amount verification, and the removal of insecure fallback logic.

---

## 1. Concurrent Duplicate IPN Requests (Idempotency Race)

### Direct Observations & Vulnerability Analysis
- **NOWPayments Webhook**:
  - **File Path**: `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts`
  - **Lines 35–37**:
    ```typescript
    if (await isPaymentProcessed(payment_id)) return { success: true, message: 'Already processed' }
    await recordIpnEvent(payment_id, payment_status, ipn as unknown as Record<string, unknown>, false)
    ```
  - **Code Logic**: `isPaymentProcessed(paymentId)` queries the `payment_events` table for a record matching `nowpayments_${paymentId}` with `processed = 1` or `true`. If not found, it writes a row with `processed = 0` via `recordIpnEvent(...)` using `.upsert()`.
  - **Vulnerability**: This is a classic read-then-write check that is non-atomic. In high-concurrency scenarios, two duplicate webhooks received simultaneously will both check `isPaymentProcessed` before either has written, bypassing the guard and executing the side effects (subscription activation, onboarding emails, credit provision) multiple times.
  - **Key Format Issue**: The event key `nowpayments_${paymentId}` is status-agnostic. However, NOWPayments sends multiple webhooks per payment for status updates (e.g., `waiting`, `confirmed`, `finished`). If the key is status-agnostic, the first webhook prevents future updates from being processed.

- **PayOS Webhook**:
  - **File Path**: `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`
  - **Lines 97–102**:
    ```typescript
    if (await isPayOsEventProcessed(orderCode)) {
      return NextResponse.json({ received: true, note: 'Already processed' })
    }
    await recordPayOsEvent(orderCode, success ? 'PAID' : 'CANCELLED', bodyJson, false)
    ```
  - **Code Logic**: `isPayOsEventProcessed(orderCode)` checks `payos_${orderCode}` in the `payos_events` table. If not processed, it reserves the lock by calling `recordPayOsEvent(...)` which performs an `.upsert()` with `processed = 0`.
  - **Vulnerability**: Same non-atomic read-then-write vulnerability. Concurrent requests for the same `orderCode` will both read `processed: false`, pass the check, upsert, and trigger duplicate activations.

### Database Tables & Capabilities
- **NOWPayments**:
  - Table: `payment_events` (D1 table)
  - Schema (`apps/sophia-ai-factory/migrations/0002-payment-events.sql`):
    ```sql
    CREATE TABLE IF NOT EXISTS payment_events (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      event_id TEXT UNIQUE NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT DEFAULT '{}',
      processed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    ```
  - **Constraint**: `event_id` is declared `UNIQUE NOT NULL`.

- **PayOS**:
  - Table: `payos_events` (D1 table)
  - Schema (`apps/sophia-ai-factory/migrations/0072-payos-events.sql`):
    ```sql
    CREATE TABLE IF NOT EXISTS payos_events (
      event_id TEXT PRIMARY KEY,
      order_code TEXT NOT NULL,
      status TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'VND',
      payload TEXT NOT NULL,
      processed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    ```
  - **Constraint**: `event_id` is the `PRIMARY KEY` (implicitly unique).

### Resolution Strategy
Instead of read-then-write, we enforce **write-then-act** by immediately inserting a row into the database using the unique constraint of `event_id` to acquire a lock.
1. **NOWPayments Key Pattern Modification**: Update the event identifier format to `nowpayments_${paymentId}_${status}`. This tracks idempotency on a per-status basis, allowing distinct status updates to be processed while preventing duplicate processing of the same status (e.g., handling `finished` twice).
2. **PayOS Key Pattern**: Use `payos_${orderCode}` as the `event_id`.
3. **Atomic Reservation (Insertion)**:
   - Perform an `.insert()` of the record with `processed = 0` (or `false`).
   - If the insertion fails due to a uniqueness constraint violation (D1 returns an error object), handle it as follows:
     - Query the database for the existing record.
     - If `processed = 1`, return a success response immediately (already completed).
     - If `processed = 0`, return a processing-in-progress/duplicate response to safely abort the current execution.
4. **Failure Recovery (Lock Release)**:
   - Wrap the entire webhook handler logic in a `try-catch` block.
   - If an exception occurs during downstream processing (e.g., D1 transaction failure or network error), the lock must be deleted from the database in the `catch` block (e.g. `DELETE FROM payment_events/payos_events WHERE event_id = ?`). This enables the webhook provider's retries to succeed.
5. **Completion**:
   - If processing succeeds, update the row to `processed = 1`.

---

## 2. PayOS Expected VND Amount Verification

### Direct Observations
- **File Path**: `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`
- **Lines 86–87**:
  ```typescript
  const { data: ipnData, signature, success } = parsed.data
  const { orderCode, amount, description, paymentLinkId } = ipnData
  ```
- **Vulnerability**: The handler extracts `amount` (VND) paid, but completely bypasses any verification of this amount against the actual price of the tier. If a user tampers with the payment or pays an incorrect amount, the system will blindly activate the tier.

### Resolution Strategy
1. **Import Price Helper**: Import `getPayOsTierConfig` from `@/land/payments/payos`.
2. **Perform Verification**: After the matching pending order (`matchOrder`) is found and the `tier` is resolved, fetch the expected VND price using `getPayOsTierConfig(tier).vndAmount`.
3. **Compare & Reject**:
   - Verify that `amount === expectedVndAmount`.
   - If they do not match, log a mismatch warning (`logger.error('[PayOS IPN] Amount mismatch', { orderCode, received: amount, expected: expectedVndAmount, tier })`) and abort processing by returning a `400 Bad Request` response (`NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })`).

---

## 3. Removal of PayOS Insecure Match Fallback

### Direct Observations
- **File Path**: `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`
- **Lines 133–138**:
  ```typescript
  const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)))
    ?? orders?.[0]

  const tier = (matchOrder?.tier ?? 'BASIC') as Tier
  const orderId = matchOrder?.order_id ?? `payos_${userId}_${orderCode}`
  ```
- **Vulnerability**:
  - If a user has multiple pending checkout sessions (e.g. they started a premium checkout, abandoned it, and then started a basic checkout), and the system fails to match the payment link ID/order code, it falls back to the first available pending order (`orders?.[0]`). This allows a user to buy a cheap tier and get upgraded to a more expensive tier if `orders?.[0]` happens to be the expensive one.
  - If no pending orders exist at all (meaning `orders` is empty/null), the code falls back to `tier = 'BASIC'` and generates a dummy `orderId`. This permits rogue/dangling payments to activate subscriptions without a valid order trace.

### Resolution Strategy
1. **Remove Fallbacks**:
   - Eliminate the `?? orders?.[0]` fallback completely.
   - Eliminate the default `tier = 'BASIC'` and synthesized `orderId` fallback values.
2. **Enforce Match Existence**:
   - Check if `matchOrder` is defined.
   - If no pending order matches the transaction identifiers (`paymentLinkId` or `orderCode`), log an error (`logger.error('[PayOS IPN] No matching pending order found', { paymentLinkId, orderCode })`) and return a `400 Bad Request` response (`NextResponse.json({ error: 'Matching order not found' }, { status: 400 })`).
