# Handoff Report: Payments & Webhooks Security (Milestone 1)

## 1. Observation

### Observation 1: PayOS Description Mismatch and Webhook Breakdown
- **File**: `apps/sophia-ai-factory/src/land/payments/payos.ts`
- **Line 178**:
  ```typescript
  const description = `Sophia ${tier} - ${orderId.slice(-8)}`
  ```
- **Lines 252-256**:
  ```typescript
  export function parseUserIdFromPayOsDescription(description: string): string | null {
    // Match sophia_{userId}_{ts} pattern in description
    const match = description.match(/sophia_([^_]+)_\d+/)
    return match ? match[1] : null
  }
  ```
- **File**: `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`
- **Lines 105-111**:
  ```typescript
  const userId = parseUserIdFromPayOsDescription(description)
  if (!userId) {
    logger.warn('[PayOS IPN] Cannot parse userId from description', { description, orderCode })
    // Release lock so it can be retried
    await db.from('payos_events').delete().eq('event_id', eventId)
    return NextResponse.json({ error: 'Invalid description' }, { status: 400 })
  }
  ```
- **File**: `apps/sophia-ai-factory/src/app/api/payos/ipn/__tests__/route.test.ts`
- **Lines 26-28**:
  ```typescript
  description: body.description || 'sophia_user123_1700000000000',
  ```

### Observation 2: Silent Success on Concurrent Webhook Lock Conflicts
- **File**: `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts`
- **Lines 54-58**:
  ```typescript
  if (existing?.processed === 1 || existing?.processed === true) {
    return { success: true, message: 'Already processed' }
  } else {
    return { success: true, message: 'Already processed or processing' }
  }
  ```
- **File**: `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`
- **Lines 84-88**:
  ```typescript
  if (existing?.processed === 1 || existing?.processed === true) {
    return NextResponse.json({ received: true, note: 'Already processed' })
  } else {
    return NextResponse.json({ received: true, note: 'Already processed or processing' })
  }
  ```

### Observation 3: Silent Success on Database Query Failures
- **File**: `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts`
- **Lines 46-59**:
  ```typescript
  if (insertError) {
    // Unique constraint violation or other error
    const { data: existing } = await db
      .from('payment_events')
      .select('processed')
      .eq('event_id', eventId)
      .single()

    if (existing?.processed === 1 || existing?.processed === true) {
      return { success: true, message: 'Already processed' }
    } else {
      return { success: true, message: 'Already processed or processing' }
    }
  }
  ```

---

## 2. Logic Chain

### 2.1. PayOS Description Mismatch & Webhook Breakdown
1. **Description Generation**: According to **Observation 1**, `createPayOsInvoice` sets the transaction description to `Sophia ${tier} - ${orderId.slice(-8)}`. For an order ID like `sophia_user123_1717141234567`, the last 8 characters are numeric timestamp digits (e.g., `41234567`). The description sent to PayOS is therefore `Sophia BASIC - 41234567`.
2. **UserId Parsing**: When PayOS calls the IPN route with this description, the route calls `parseUserIdFromPayOsDescription("Sophia BASIC - 41234567")`.
3. **Pattern Mismatch**: `parseUserIdFromPayOsDescription` matches against `/sophia_([^_]+)_\d+/`. Since `Sophia BASIC - 41234567` does not contain `sophia_` or an underscore separating the username, the match fails and returns `null`.
4. **Endpoint Failure**: When `userId` is `null`, the route returns `400 Bad Request` with `{ error: 'Invalid description' }` and deletes the event lock. In production, every real PayOS webhook request will fail to resolve the user, resulting in a complete failure of PayOS tier activations.
5. **Masked Tests**: The unit tests in `route.test.ts` pass only because the test suite mocks the payload's description with `'sophia_user123_1700000000000'` (matching the regex), masking this critical production bug.

### 2.2. Robustness Flaw in Lock Conflicts (Concurrent Requests)
1. **Locking Mechanism**: When two duplicate webhook requests arrive concurrently, the first request inserts a record with `processed: 0` into the DB. The second request fails to insert because of the UNIQUE / PRIMARY KEY constraint.
2. **Success Fallback**: Under **Observation 2**, the second request checks if the first is processed. If `existing.processed` is not `1` (indicating it is still processing), it returns `success: true` / status `200` to the webhook provider.
3. **Failure Scenarios**: If the first request encounters an error later in its execution path, it deletes the lock record to allow subsequent retries. However, because the duplicate request already returned a successful status code, the payment provider assumes successful delivery and will not retry the webhook, resulting in a permanently lost payment event.

### 2.3. Silent Success on DB Failures
1. **DB Down**: If the database server is down or unreachable during the initial insert operation, `insertError` is thrown.
2. **Select Fails**: The code then attempts to query the event status. The select query also fails due to the connection outage, so `existing` is undefined.
3. **Loss of Webhook**: The handler falls back to the `else` block and returns `success: true` (or status `200`). The webhook provider ceases retrying, and the user's tier is never activated, making the system highly vulnerable to database fluctuations.

---

## 3. Caveats

- We assumed that PayOS descriptions must be under 25 characters based on PayOS REST API documentation limits, which is why the code originally sliced the order ID (`orderId.slice(-8)`).
- We reviewed only the payment security and idempotency logic; we did not perform live testing against the PayOS production API endpoints.

---

## 4. Conclusion & Verdict

**Verdict**: **REQUEST_CHANGES**

- **Correctness (Critical)**: The PayOS description parsing mechanism will always fail in production checkouts because `createPayOsInvoice` strips the user ID prefix to fit PayOS character limits. This breaks PayOS webhooks completely.
- **Robustness (Major)**: Returning success status codes for concurrent lock conflicts and database query failures risks silent failures and permanently lost payments.
- **Integrity Compliance**: Pass. No signs of malicious cheating, hardcoded test bypasses, or facade implementations. The defects are logical design and testing bugs.

### Quality Review Findings

| Severity | Finding | Location | Suggestion |
|---|---|---|---|
| **Critical** | PayOS Description Mismatch | `payos.ts:178` & `route.ts:105` | Since `paymentLinkId` or `orderCode` is unique per transaction, resolve the pending order by querying `invoice_url` or `order_code` without filtering by `user_id` first. This avoids parsing the user ID from the description. |
| **Major** | Silent Success on Lock Conflicts | `nowpayments-ipn-handlers.ts:57` & `route.ts:87` | Return a failure status code (e.g., `409 Conflict` or `429 Too Many Requests`) if the event is currently processing (`processed = 0`) to trigger webhooks retry. |
| **Major** | Silent Success on DB Failure | `nowpayments-ipn-handlers.ts:46` & `route.ts:76` | Propagate database errors or return a retry failure if the SELECT query fails, instead of defaulting to success. |

### Adversarial Review Challenges

| Severity | Challenge | Scenario | Mitigation |
|---|---|---|---|
| **High** | DB Outage Lock Loss | Database is down during webhook processing. Both insert and select fail. Webhook succeeds, and payment is lost. | Check if the insert error is specifically a unique key conflict. Reject with `500` otherwise. |
| **Medium** | Concurrent Replay Drop | Two requests hit simultaneously. Request 2 returns 200. Request 1 fails and deletes lock. Webhook is not retried. | Return `409` or `429` for lock contention to ensure retries. |

---

## 5. Verification Method

To verify the changes, run:
```bash
# 1. Inside apps/sophia-ai-factory directory:
npm run ci:typecheck
npx vitest run src/land/billing/__tests__/ src/app/api/payos/ipn/__tests__/
```
*Invalidation Conditions*:
- If `parseUserIdFromPayOsDescription("Sophia BASIC - 41234567")` is called and returns `null` in production, PayOS is broken.
- If database connection drops during IPN handling, verify that the webhook returns an HTTP 500 error instead of HTTP 200.
