# Handoff Report: Milestone 1 - Payments & Webhooks Security Fixes

## 1. Observation
- Target Files:
  - `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts`
  - `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`
- Related Test Files:
  - `apps/sophia-ai-factory/src/land/billing/__tests__/nowpayments-ipn-idempotency.test.ts`
  - `apps/sophia-ai-factory/src/app/api/payos/ipn/__tests__/route.test.ts` (newly created)
- The codebase was using a vulnerable read-then-write or upsert strategy in both NowPayments and PayOS IPN handlers, exposing the application to concurrency races (duplicate tier activation / duplicate credit issuance).
- The PayOS IPN route did not compare the webhook amount with the database tier VND price config, and possessed an insecure fallback `orders?.[0]` that allowed bypassing pending orders.

## 2. Logic Chain
- **NowPayments Fix**:
  - Event ID format was updated to `nowpayments_${payment_id}_${payment_status}` inside `processNowPaymentsIpn` to make it status-aware.
  - Replaced the `.upsert()` call with an atomic `.insert()`.
  - Added a check on unique constraint failure: it retrieves the row's `processed` status. If `processed` is `1`/`true`, it returns success (`Already processed`). If `processed` is `0`/`false`, it returns success/processing in progress (`Already processed or processing`).
  - Added a `try-catch` block around downstream handlers: if they throw, the reserved lock row is deleted to enable retry execution, and the error is returned. If they succeed, `processed` is updated to `1`.
- **PayOS Fix**:
  - Replaced `.upsert()` with an atomic `.insert()` using the D1 client.
  - Added unique constraint failure logic: queries the database and checks `processed`. If `1`, returns `Already processed`. If `0`, returns `Already processed or processing`.
  - Removed standard fallback `orders?.[0]` and basic/synthetic fallbacks. The route now queries `pending_orders` matching `paymentLinkId` or `orderCode`. If no match is found, the lock is deleted and it aborts with a `400 Bad Request`.
  - Imported `getPayOsTierConfig` and verified that the IPN `amount` matches the tier's expected `vndAmount`. If they mismatch, the lock is deleted and it aborts with `400 Bad Request`.
  - Added `try-catch` around all downstream processing: if it throws an error, the event lock row is deleted to enable retries, and a `500` response is returned. On successful completion, `processed` is updated to `1`.
- **Test Alignment**:
  - Updated `nowpayments-ipn-idempotency.test.ts` database mock to simulate the atomic UNIQUE constraint lock behaviour (using an in-memory `Map`).
  - Created a new comprehensive test suite `apps/sophia-ai-factory/src/app/api/payos/ipn/__tests__/route.test.ts` verifying all security properties: success path with locking, duplicate processed webhook, duplicate processing webhook, amount mismatch lock release, order not found lock release, and downstream processing exception lock release.

## 3. Caveats
- The D1 client `insert` unique constraint check depends on the SQL UNIQUE and PRIMARY KEY constraints on the database tables (`payment_events.event_id` and `payos_events.event_id`). These are validated to be present in migrations `0072-payos-events.sql`.
- In the local testing mock, database constraints are simulated in-memory using JavaScript `Map` lookups.

## 4. Conclusion
Milestone 1 Payment & Webhooks Security Fixes are completely implemented, typecheck is clean, and both modified and new test suites pass successfully.

## 5. Verification Method
- Build/Typecheck command:
  ```bash
  npm run ci:typecheck
  ```
- Test commands:
  ```bash
  npx vitest run src/land/payments/__tests__/ src/land/billing/__tests__/ src/app/api/payos/ipn/__tests__/
  ```
- Verification results: All 86 tests passed successfully.
