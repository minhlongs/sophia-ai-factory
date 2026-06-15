# Handoff Report: Payments & Webhooks Security (Milestone 1)

## 1. Observation

### Target Files Reviewed
1. `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts`
2. `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`
3. `apps/sophia-ai-factory/src/land/billing/__tests__/nowpayments-ipn-idempotency.test.ts`
4. `apps/sophia-ai-factory/src/app/api/payos/ipn/__tests__/route.test.ts`

### Compilation & Test Execution
- **Typecheck Command**: `npm run ci:typecheck` in `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory`
- **Result**: FAILED with exit code 1. Verbatim output:
  ```
  > sophia-ai-factory@0.1.0 ci:typecheck
  > tsc --noEmit

  src/app/api/payos/ipn/__tests__/route.test.ts(305,19): error TS2339: Property 'status' does not exist on type '{ event_id: string; processed: number; amount: number; }'.
  ```

- **Tests Command**: `npx vitest run src/land/billing/__tests__/ src/app/api/payos/ipn/__tests__/` in `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory`
- **Result**: PASSED. Verbatim output:
  ```
   RUN  v4.1.6 /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory

   ↓ src/land/billing/__tests__/phase6-integration.test.ts (31 tests | 31 skipped)
   ✓ src/land/billing/__tests__/nowpayments-ipn-idempotency.test.ts (8 tests) 18ms
   ✓ src/land/billing/__tests__/tier-change-provisioner.test.ts (6 tests) 6ms
   ✓ src/land/billing/__tests__/onboarding-ipn-trigger.test.ts (5 tests) 5ms
   ✓ src/land/billing/__tests__/nowpayments-ipn-one-time.test.ts (14 tests) 9ms
   ✓ src/land/billing/__tests__/nowpayments-ipn-dispatch.test.ts (18 tests) 8ms
   ✓ src/app/api/payos/ipn/__tests__/route.test.ts (8 tests) 15ms
   ✓ src/land/billing/__tests__/nowpayments-ipn-atomic-upgrade.test.ts (4 tests) 10ms
   ✓ src/land/billing/__tests__/tier-transition-matrix.test.ts (16 tests) 20ms

   Test Files  8 passed | 1 skipped (9)
        Tests  79 passed | 31 skipped (110)
     Start at  14:03:14
     Duration  1.14s (transform 1.49s, setup 407ms, import 1.67s, tests 90ms, environment 4.30s)
  ```

### Verbatim Code Details

#### Issue 1 Resolution: PayOS Description Mismatch
In `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts` lines 129-158:
```typescript
  try {
    // Directly query pending_orders table matching payment_method = 'payos' and status = 'pending'
    const { data: pendingOrders, error: pendingOrdersError } = await db
      .from('pending_orders')
      .select('*')
      .eq('payment_method', 'payos')
      .eq('status', 'pending')

    if (pendingOrdersError || !pendingOrders) {
      logger.error('[PayOS IPN] Failed to query pending_orders', { pendingOrdersError })
      // Release lock so it can be retried
      await db.from('payos_events').delete().eq('event_id', eventId)
      return NextResponse.json({ error: 'Database query failure' }, { status: 500 })
    }

    const orders = pendingOrders as Array<{ order_id: string; user_id: string; tier: string; invoice_url: string | null }> | null
    
    // Find matching order
    const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)))

    if (!matchOrder) {
      logger.error('[PayOS IPN] No matching pending order found', { paymentLinkId, orderCode })
      // Release lock so it can be retried
      await db.from('payos_events').delete().eq('event_id', eventId)
      return NextResponse.json({ error: 'Order not found' }, { status: 400 })
    }

    const userId = matchOrder.user_id
    const tier = matchOrder.tier as Tier
    const orderId = matchOrder.order_id
```

#### Issue 2 & 3 Resolution: NOWPayments
In `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts` lines 46-63:
```typescript
  if (insertError) {
    // Unique constraint violation or other error
    const { data: existing, error: selectError } = await db
      .from('payment_events')
      .select('processed')
      .eq('event_id', eventId)
      .single()

    if (selectError || !existing) {
      return { success: false, message: 'Database query failure' }
    }

    if (existing.processed === 1 || existing.processed === true) {
      return { success: true, message: 'Already processed' }
    } else {
      return { success: false, message: 'Already processing' }
    }
  }
```

#### Issue 2 & 3 Resolution: PayOS
In `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts` lines 76-93:
```typescript
  if (insertError) {
    // Unique key/Primary key violation
    const { data: existing, error: selectError } = await db
      .from('payos_events')
      .select('processed')
      .eq('event_id', eventId)
      .single()

    if (selectError || !existing) {
      return NextResponse.json({ error: 'Database query failure' }, { status: 500 })
    }

    if (existing.processed === 1 || existing.processed === true) {
      return NextResponse.json({ received: true, note: 'Already processed' })
    } else {
      return NextResponse.json({ error: 'Already processing' }, { status: 409 })
    }
  }
```

---

## 2. Logic Chain

1. **Issue 1 Verification**: 
   - **Observation**: In `route.ts`, the parsing function `parseUserIdFromPayOsDescription` is no longer used to determine the `userId`. Instead, `pending_orders` are fetched from the database, and the matching order is found by verifying whether the order's `invoice_url` contains the PayOS `paymentLinkId` or the `orderCode` payload values.
   - **Conclusion**: This logic completely avoids parsing the user ID from the description, which resolves the description mismatch bug safely.

2. **Issue 2 Verification (Lock Conflicts)**:
   - **Observation**: When duplicate concurrently running webhooks arrive, the second webhook fails the initial `insert` due to the UNIQUE constraint. It falls back to checking the status of the event in `payment_events`/`payos_events`. If the event is still processing (`processed = 0`), the handler returns `success: false` or status `409 Conflict`.
   - **Conclusion**: This ensures the webhook provider will retry if the initial transaction fails mid-execution (as the lock record gets cleaned up on failure), resolving the silent success risk on concurrent lock conflicts.

3. **Issue 3 Verification (Database query failures)**:
   - **Observation**: In both webhooks, if the SELECT statement fails or returned data is missing (`selectError || !existing`), the code now explicitly returns a failure status (`success: false` / HTTP `500 Database query failure`) instead of defaulting to the success/processed block.
   - **Conclusion**: This prevents silent success on database query failures.

4. **TypeScript Typecheck Failure**:
   - **Observation**: The unit test `route.test.ts` defines the mock DB events map as `const mockDbEvents = new Map<string, { event_id: string; processed: number; amount: number }>()`.
   - **Observation**: At line 305, the test accesses `event?.status`.
   - **Conclusion**: Since `status` is not part of the Map value type definition, the compilation fails. Because typechecking is required for a clean build (`npm run ci:typecheck`), changes are required to fix the test suite.

---

## 3. Caveats

- We assumed that `pending_orders` will always have the `invoice_url` populated with a string containing the PayOS `paymentLinkId` or `orderCode`. If an order is stored with a blank `invoice_url` or a URL that doesn't contain these parts, the IPN route will return `400 Order not found`.
- The sibling PayOS webhook handler under `apps/sophia-ai-factory/src/app/api/webhooks/payos/route.ts` remains unmodified. It is assumed that only `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts` is target of this milestone delivery.

---

## 4. Conclusion & Verdict

**Verdict**: **REQUEST_CHANGES**

- **Correctness (Pass)**: The logic correctly resolves the three issues identified by Reviewer 2.
- **Completeness (Fail)**: The changes are not buildable because the typecheck fails on `route.test.ts`.

### Quality Review Summary

- **Verdict**: REQUEST_CHANGES

#### Major Findings

1. **Type Error in `route.test.ts`**
   - **Location**: `apps/sophia-ai-factory/src/app/api/payos/ipn/__tests__/route.test.ts:305`
   - **Why**: TS compilation fails because `status` is accessed on a type definition that does not declare it.
   - **Suggestion**: Update line 8 of `route.test.ts` to include `status?: string;` or similar:
     ```typescript
     const mockDbEvents = new Map<string, { event_id: string; processed: number; amount: number; status?: string }>()
     ```

#### Verified Claims

- Issue 1 (Description Mismatch) → verified via code inspection of `route.ts` lines 129-158 → PASS
- Issue 2 (Lock Conflicts Retry) → verified via code inspection and test execution (`route.test.ts` "rejects duplicate processing when currently processing") → PASS
- Issue 3 (Silent DB Failures) → verified via code inspection and test execution (`route.test.ts` "returns 500 when database query fails during conflict check") → PASS

### Adversarial Review Summary

- **Overall risk assessment**: LOW (Issues are resolved, only the test typing requires correction).

#### Challenges

- **Challenge**: DB select fails.
  - **Scenario**: DB is down during duplicate check, select query fails.
  - **Actual Behavior**: Handler catches the failure, aborts processing, and returns 500/false, ensuring webhook retry → PASS

- **Challenge**: Concurrent lock drop.
  - **Scenario**: Duplicate request hits during processing, receives 409/false. Initial request crashes and deletes lock.
  - **Actual Behavior**: The second request is retried, ensuring the webhook is eventually processed correctly → PASS

---

## 5. Verification Method

To verify the changes and fix, run the following commands in `apps/sophia-ai-factory/`:

```bash
# Verify TypeScript Typecheck passes
npm run ci:typecheck

# Run target test suites
npx vitest run src/land/billing/__tests__/ src/app/api/payos/ipn/__tests__/
```
