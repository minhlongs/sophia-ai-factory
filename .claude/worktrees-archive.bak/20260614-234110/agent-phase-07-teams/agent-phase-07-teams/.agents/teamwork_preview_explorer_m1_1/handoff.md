# Handoff Report — Milestone 1: Payments & Webhooks Security

## 1. Observation
We examined the codebase and D1 migrations and observed:
- `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts:35-37`:
  ```typescript
  if (await isPaymentProcessed(payment_id)) return { success: true, message: 'Already processed' }

  await recordIpnEvent(payment_id, payment_status, ipn as unknown as Record<string, unknown>, false)
  ```
- `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-db.ts:32-41`:
  ```typescript
  export async function recordIpnEvent(paymentId: string, status: string, payload: Record<string, unknown>, processed: boolean): Promise<void> {
    try {
      const db = getDb()
      await db.from('payment_events').upsert(
        { event_id: `nowpayments_${paymentId}`, event_type: `nowpayments.${status}`, payload: JSON.stringify(payload), processed: processed ? 1 : 0, created_at: new Date().toISOString() }
      )
  ```
- `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts:97-102`:
  ```typescript
    // Idempotency check
    if (await isPayOsEventProcessed(orderCode)) {
      return NextResponse.json({ received: true, note: 'Already processed' })
    }

    // Record event as unprocessed (reserve row)
    await recordPayOsEvent(orderCode, success ? 'PAID' : 'CANCELLED', bodyJson, false)
  ```
- `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts:35-47`:
  ```typescript
  async function recordPayOsEvent(orderCode: number, status: string, payload: unknown, processed: boolean): Promise<void> {
    try {
      const db = createServerClient()
      await db.from('payos_events').upsert({
        event_id: `payos_${orderCode}`,
        order_code: String(orderCode),
  ```
- `migrations/0002-payment-events.sql:4`:
  ```sql
    event_id TEXT UNIQUE NOT NULL,
  ```
- `migrations/0072-payos-events.sql:5`:
  ```sql
    event_id TEXT PRIMARY KEY,
  ```
- `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts:132-137`:
  ```typescript
    const orders = pendingOrders as Array<{ order_id: string; tier: string; invoice_url: string | null }> | null
    const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)))
      ?? orders?.[0]

    const tier = (matchOrder?.tier ?? 'BASIC') as Tier
  ```

---

## 2. Logic Chain
1. **Concurrency Idempotency Race**: The current check-then-act logic `isPaymentProcessed()` and `recordIpnEvent()` is vulnerable to concurrency race conditions because `recordIpnEvent()` uses `upsert()`. `upsert()` uses `ON CONFLICT DO UPDATE` under the hood in D1 SQL query builder. When two concurrent requests run at the same time, both pass `isPaymentProcessed() = false`, and both execute `upsert()`, overwriting the row. SQLite does not error, and both flows proceed to fulfill the order.
2. **Constraint Enforcement**: However, because `event_id` is defined as `UNIQUE` in `payment_events` and `PRIMARY KEY` in `payos_events`, changing `upsert()` to `insert()` during the initial reservation will guarantee that any concurrent insertion will violate the uniqueness constraint. The D1 query builder will catch the SQL constraint exception and return an error object containing the error details.
3. **Amount Verification**: The received `amount` from PayOS IPN route is in VND. The expected amount can be computed using `getPayOsTierConfig(tier).vndAmount`, since checkout uses this function to define the VND price of a tier. Comparing the two prevents price spoofing or payment injection attacks.
4. **Fallback Danger**: In the case of PayOS IPN, `orders?.[0]` is used when matching the specific invoice URL/orderCode fails. A user with multiple pending orders (e.g., MASTER and BASIC) can pay for the cheaper order but have it match the premium one, leading to tier escalation. Eliminating the fallback and returning 400 when `matchOrder` is undefined closes this loophole.

---

## 3. Caveats
- We assumed D1 query builder's `.insert()` correctly throws or returns an error on unique key violations. This has been confirmed by examining the `d1-query-chain-executors.ts` file, where `executeQuery()` wraps the execution in `try/catch` and returns `{ data: null, error: { message: ... } }`.
- We assumed PayOS does not support yearly billing discounts yet, which is verified by checking the `/api/checkout` route (it throws an error for yearly period when using PayOS).

---

## 4. Conclusion
- **Idempotency Race**: Replaced `upsert` with `insert` for initial event reservation in both NOWPayments and PayOS IPN endpoints, returning early with a 200/success response if the insertion fails due to unique/primary key violation.
- **Expected Amount Verification**: Verified the incoming `amount` against `getPayOsTierConfig(tier).vndAmount` in PayOS.
- **Fallback Removal**: Removed `orders?.[0]` fallback from PayOS, returning 400 if no match is found.

---

## 5. Verification Method
1. Run typecheck to verify compiler happiness:
   `npm run type-check` (or `tsc --noEmit` under `apps/sophia-ai-factory/`)
2. Run test suite to verify tests pass:
   `npm run test` (or `vitest run`)
3. Inspect `apps/sophia-ai-factory/src/land/payments/__tests__/payos.test.ts` to ensure config and signature verifications behave correctly.
