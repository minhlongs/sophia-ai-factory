# Handoff Report — Payments & Webhooks Security (Milestone 1)

## 1. Observation
I directly observed the following from the codebase:
- **NOWPayments Webhook Handler**:
  - File: `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts`
  - Lines 35–37:
    ```typescript
    if (await isPaymentProcessed(payment_id)) return { success: true, message: 'Already processed' }

    await recordIpnEvent(payment_id, payment_status, ipn as unknown as Record<string, unknown>, false)
    ```
  - File: `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-db.ts`
  - Lines 20–30 (`isPaymentProcessed`):
    ```typescript
    export async function isPaymentProcessed(paymentId: string): Promise<boolean> {
      try {
        const db = getDb()
        const { data } = await db
          .from('payment_events')
          .select('processed')
          .eq('event_id', `nowpayments_${paymentId}`)
          .single()
        return data?.processed === 1 || data?.processed === true
      } catch { return false }
    }
    ```
  - Lines 32–41 (`recordIpnEvent`):
    ```typescript
    export async function recordIpnEvent(paymentId: string, status: string, payload: Record<string, unknown>, processed: boolean): Promise<void> {
      try {
        const db = getDb()
        await db.from('payment_events').upsert(
          { event_id: `nowpayments_${paymentId}`, event_type: `nowpayments.${status}`, payload: JSON.stringify(payload), processed: processed ? 1 : 0, created_at: new Date().toISOString() }
        )
      } catch (err) {
        logger.warn('[NOWPayments] Failed to record IPN event', { paymentId, error: getErrorMessage(err) })
      }
    }
    ```
- **PayOS Webhook Handler**:
  - File: `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`
  - Lines 96–102:
    ```typescript
    // Idempotency check
    if (await isPayOsEventProcessed(orderCode)) {
      return NextResponse.json({ received: true, note: 'Already processed' })
    }

    // Record event as unprocessed (reserve row)
    await recordPayOsEvent(orderCode, success ? 'PAID' : 'CANCELLED', bodyJson, false)
    ```
  - Lines 23–33 (`isPayOsEventProcessed`):
    ```typescript
    async function isPayOsEventProcessed(orderCode: number): Promise<boolean> {
      try {
        const db = createServerClient()
        const { data } = await db
          .from('payos_events')
          .select('processed')
          .eq('event_id', `payos_${orderCode}`)
          .single()
        return data?.processed === 1 || data?.processed === true
      } catch { return false }
    }
    ```
  - Lines 35–51 (`recordPayOsEvent`):
    ```typescript
    async function recordPayOsEvent(orderCode: number, status: string, payload: unknown, processed: boolean): Promise<void> {
      try {
        const db = createServerClient()
        await db.from('payos_events').upsert({
          event_id: `payos_${orderCode}`,
          order_code: String(orderCode),
          status,
          amount: 0, // updated by caller
          currency: 'VND',
          payload: JSON.stringify(payload),
          processed: processed ? 1 : 0,
          created_at: new Date().toISOString(),
        })
      } catch (err) {
        logger.warn('[PayOS IPN] Failed to record event', { orderCode, error: String(err) })
      }
    }
    ```
  - Lines 132–138 (Pending Order matching and fallback):
    ```typescript
      const orders = pendingOrders as Array<{ order_id: string; tier: string; invoice_url: string | null }> | null
      const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)))
        ?? orders?.[0]

      const tier = (matchOrder?.tier ?? 'BASIC') as Tier
      const orderId = matchOrder?.order_id ?? `payos_${userId}_${orderCode}`
    ```
- **Database Unique Constraints**:
  - File: `apps/sophia-ai-factory/migrations/0002-payment-events.sql`
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
    - Shows that `event_id` is defined as `TEXT UNIQUE NOT NULL`.
  - File: `apps/sophia-ai-factory/migrations/0072-payos-events.sql`
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
    - Shows that `event_id` is defined as `TEXT PRIMARY KEY` (implicitly unique).
- **PayOS Tier Config Prices**:
  - File: `apps/sophia-ai-factory/src/land/payments/payos.ts`
  - Lines 30–34 (`getPayOsTierConfig`):
    ```typescript
    export function getPayOsTierConfig(tier: Tier): PayOsTierConfig {
      const usd = TIER_USD_PRICES[tier]
      const vnd = Math.round((usd * USD_TO_VND) / 1000) * 1000 // round to 1000 VND
      return { tier, vndAmount: vnd, usdAmount: usd }
    }
    ```

---

## 2. Logic Chain
1. **Idempotency Races**:
   - The current check-then-act pattern (`isPaymentProcessed`/`isPayOsEventProcessed` followed by `recordIpnEvent`/`recordPayOsEvent` with `processed = 0`) is non-atomic and permits multiple concurrent processes to read `processed = false` before any of them write `processed = 0` (and eventually `processed = 1`).
   - Using `.upsert()` inside event-recording functions does not throw a duplicate key error when a record already exists; it silently updates it, masking concurrent operations.
   - Replacing `.upsert()` with `.insert()` on initial reservation forces the SQLite/D1 database to enforce uniqueness. Concurrent requests trying to insert the same `event_id` will fail with a uniqueness violation.
   - Catching the uniqueness violation, checking if `processed = 1` (completed, exit with success), or `processed = 0` (active/in-progress, exit/abort), completely prevents concurrent double-processing.
   - Deleting the event record on handler failure allows the webhook provider to retry successfully.
   - Transitioning the event ID pattern in NOWPayments to `nowpayments_${paymentId}_${status}` ensures status updates are not blocked, while preventing duplicate execution of the same status handler.

2. **PayOS Amount Verification**:
   - Currently, the PayOS webhook does not verify the `amount` paid in VND. A malicious request or erroneous QR transfer could pay an arbitrary low amount and successfully activate premium tiers.
   - Since `getPayOsTierConfig(tier).vndAmount` computes the expected tier price in VND, we can verify the payload `amount` matches `expectedVndAmount`. If they do not match, returning a 400 response prevents fraudulent package registrations.

3. **Insecure Match Fallback**:
   - The fallback `?? orders?.[0]` matches the first pending order of the user if the specific `paymentLinkId` or `orderCode` fails to match the `invoice_url`. If a user has a pending `MASTER` checkout and a `BASIC` checkout, they can buy `BASIC`, trigger a match failure, fall back to `orders?.[0]` (which could resolve to the `MASTER` order), and acquire the `MASTER` tier for the price of `BASIC`.
   - The default fallback `tier = 'BASIC'` when `orders` is empty grants access without an associated pending order record in the database.
   - Removing the fallback and failing with a 400 error if `matchOrder` is not found closes this exploit vector.

---

## 3. Caveats
- I assumed that no third-party plugin or client alters the payload structure before it reaches `POST` in `payos/ipn/route.ts` or `processNowPaymentsIpn`.
- I did not verify whether other payment routes (like Stripe or Polar) suffer from similar issues, as they are out of the scope of this milestone.

---

## 4. Conclusion
- Concurrent duplicate IPN requests can be resolved atomically by replacing check-then-act `.upsert()` calls with immediate `.insert()` statements, checking the database for status on conflict, and deleting the lock key in the catch/failure block to support retry logic. NOWPayments keys must include status.
- PayOS amount verification is implemented by retrieving the expected price in VND via `getPayOsTierConfig(tier).vndAmount` and comparing it to the received webhook `amount`.
- The insecure fallback `?? orders?.[0]` must be removed, and the route must return a 400 Bad Request if `matchOrder` is not resolved.

---

## 5. Verification Method
1. **Idempotency Races**:
   - Inspect `apps/sophia-ai-factory/src/land/billing/__tests__/nowpayments-ipn-atomic-upgrade.test.ts` to see how the billing status changes are tracked.
   - Test command: Run `npx vitest run apps/sophia-ai-factory/src/land/billing/__tests__/nowpayments-ipn-atomic-upgrade.test.ts` or `npm run test` inside `apps/sophia-ai-factory`.
2. **Review proposed code structure**:
   - Verify `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts` rejects mismatching amounts and missing pending orders.
