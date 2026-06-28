# Phase 05 — Success/Failure Pages with Status Polling

## Context Links
- Existing success page: `apps/sophia-ai-factory/src/app/[locale]/payment-success/page.tsx`
- Phase 01: `pending-order-repo.ts` → `getOrderById()`
- Phase 03: handleFinished marks pending_orders.status=completed

## Overview
- Priority: P1 (UX — closes the loop)
- Status: pending
- Effort: 45m
- Description: Replace optimistic success rendering with a status-aware view. Add `/checkout/failure` route with retry CTA. Add `GET /api/checkout/status?order_id=...` polling endpoint.

## Key Insights
- NOWPayments redirects to success_url on `confirming` status (NOT yet `finished`). Showing "Payment Confirmed!" before IPN finished = user confusion when tier doesn't activate.
- Three success-page states needed: `pending` (poll → show "Confirming on blockchain... wait 2-5 min"), `completed` (current happy UI), `failed` (link to /checkout/failure).
- Polling: client-side fetch every 4s for max 60s, then suggest user check email or contact support.

## Requirements

### Functional
- GET `/api/checkout/status?orderId=...` → returns `{ status, tier, paymentId, completedAt }`
- 404 if order not found OR order belongs to different user (if logged in)
- Success page reads orderId from query, fetches status, renders correct state
- Failure page at `/checkout/failure` — explains common reasons (underpayment, expired) + retry button + link to support

### Non-Functional
- Status endpoint p95 < 100ms
- No auth required for status (orderId is unguessable secret)
- Polling stops automatically once status non-pending or after 15 attempts

## Architecture
```
NOWPayments redirect → /payment-success?order_id=...&tier=...
  └─ Server component reads getOrderById(orderId) for initial render
      └─ if status='pending', renders <PaymentStatusPoller orderId={...}/>
      └─ if status='completed', renders existing success UI
      └─ if status='failed', redirects to /checkout/failure?orderId=...
  └─ <PaymentStatusPoller> client comp
      └─ polls /api/checkout/status every 4s
      └─ on completed → reload page (re-renders success)
      └─ on failed → redirect to failure page
```

## Related Code Files

### Modify
- `src/app/[locale]/payment-success/page.tsx` — read order via getOrderById; conditionally render poller

### Create
- `src/app/api/checkout/status/route.ts` — GET handler
- `src/components/checkout/payment-status-poller.tsx` — client polling component
- `src/app/[locale]/checkout/failure/page.tsx` — failure UI
- `src/app/api/checkout/status/__tests__/route.test.ts` — endpoint tests

## Implementation Steps

1. Create GET `/api/checkout/status/route.ts`:
   ```ts
   const querySchema = z.object({ orderId: z.string().regex(/^sophia_/) })

   export async function GET(request: NextRequest) {
     const orderId = request.nextUrl.searchParams.get('orderId')
     const parsed = querySchema.safeParse({ orderId })
     if (!parsed.success) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })

     const order = await getOrderById(parsed.data.orderId)
     if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

     return NextResponse.json({
       status: order.status,
       tier: order.tier,
       period: order.period,
       paymentId: order.payment_id,
       completedAt: order.completed_at,
     })
   }
   ```
   Add rate limit (30 req/min — accommodates polling).

2. Create `payment-status-poller.tsx`:
   - useEffect with setInterval(4000)
   - max 15 attempts → after that show "Still processing — check email"
   - Stop on `completed` (location.reload()) or `failed` (router.push to /checkout/failure)
   - Show waiting UI: spinner, current attempt counter, "Crypto confirmations take 2-5 min"

3. Modify `payment-success/page.tsx`:
   - If `searchParams.order_id` present, call `getOrderById(orderId)` server-side
   - If status === 'pending', render `<PaymentStatusPoller orderId=...>` instead of full success
   - If status === 'completed', render existing UI
   - If status === 'failed', use `redirect('/checkout/failure?orderId=...')`
   - Bilingual (vi + en) preserved

4. Create `/checkout/failure/page.tsx`:
   - Bilingual: "Thanh toán không thành công / Payment unsuccessful"
   - Common reasons: underpayment, blockchain timeout, wrong amount, expired
   - CTA: "Try again" → /pricing, "Contact support" → mailto or Telegram
   - Show order_id for support reference

5. Tests (`route.test.ts`):
   - Returns 200 for valid orderId
   - Returns 404 for unknown orderId
   - Returns 400 for malformed orderId

## Todo List
- [ ] Create GET /api/checkout/status route + Zod
- [ ] Create payment-status-poller.tsx (client comp)
- [ ] Modify payment-success/page.tsx for 3-state render
- [ ] Create checkout/failure/page.tsx
- [ ] Add 3 unit tests for status endpoint
- [ ] E2E manual: simulate pending → completed transition
- [ ] Build → 0 errors

## Success Criteria
- Status endpoint returns within 100ms
- Success page polls when pending, renders correct UI on each state
- Failure page provides clear next steps
- No info leak: 404 for unknown orderId (not 403)

## Risk Assessment
- Risk: Polling never converges (IPN didn't arrive) → mitigation: max 15 attempts (60s), then "we'll email you" message
- Risk: orderId in URL is enumerable → mitigation: orderId contains userId+timestamp(ms) — practically unguessable for time-locked window; rate limit prevents brute force
- Risk: Race between page render and IPN arrival → mitigation: reload on poller completion lets server re-render with fresh DB state

## Security Considerations
- Status endpoint does NOT require auth — orderId is the bearer token (acceptable since it's high-entropy and short-lived)
- Returns minimal info: status, tier, period, paymentId, completedAt — no email, no amount
- Rate limit prevents enumeration

## Next Steps
- Phase 06: Receipt email triggered after status reaches completed
- Phase 07: Dashboard widget can also link "View past orders" using listOrdersByUser
