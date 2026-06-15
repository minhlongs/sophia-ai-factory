# Phase 02 — Checkout API Hardening

## Context Links
- Existing route: `apps/sophia-ai-factory/src/app/api/checkout/route.ts`
- NOWPayments client: `src/lib/clients/nowpayments-client.ts`
- Phase 01 deliverable: `pending-order-repo.ts`
- Auth: `@/lib/better-auth-session` → `getCurrentUserFromHeaders()`

## Overview
- Priority: P1
- Status: pending
- Effort: 60m
- Description: Extend POST /api/checkout to accept `period`, `paymentMethod`, persist `pending_orders` row, and surface unauthenticated UX (redirect to login with return-to-checkout).

## Key Insights
- POST today returns 401 to unauthenticated users, leaving the pricing UI to alert() — bad UX. Frontend should redirect to /login?next=/pricing#tier=PREMIUM instead of swallowing 401.
- Period MVP: support `monthly` for BASIC/PREMIUM/ENTERPRISE and `lifetime` for MASTER. `yearly` returns 400 with feature-flag explanation (deferred).
- PaymentMethod MVP: `nowpayments` only by default; `payos` returns 400 unless `FEATURE_PAYOS=true`.
- Promo code reservation logic preserved — moved unchanged from current route.

## Requirements

### Functional
- POST `/api/checkout` body: `{ tier: Tier, period?: PendingOrderPeriod, paymentMethod?: PaymentMethod, promoCode?: string, customerEmail?: string }`
- Returns: `{ url: string, orderId: string }`
- 401 when no session → JSON `{ error, redirectTo: '/login?next=...' }` instead of bare error
- Writes pending_orders row before returning URL
- GET handler unchanged (Telegram bot URL buttons depend on it)

### Non-Functional
- Latency p95 < 200ms (1 D1 write + URL build, no external HTTP)
- Rate limit unchanged: 10 req/min per IP
- Zod validation on all inputs (no `:any`)

## Architecture
```
POST /api/checkout
  ├─ rate limit (existing)
  ├─ Zod parse { tier, period, paymentMethod, promoCode, customerEmail }
  ├─ Better Auth session check → if no user, return 401 + redirectTo
  ├─ Validate tier exists in NOWPAYMENTS_TIERS
  ├─ Validate period (monthly|lifetime; yearly → 400)
  ├─ Validate paymentMethod (nowpayments default; payos requires flag)
  ├─ Promo code reservation (existing logic preserved)
  ├─ writeOrder({order_id, user_id, tier, period, payment_method, amount_usd_cents, promo_code, customer_email, invoice_url})
  ├─ NOWPayments: createInvoiceUrl(tier, userId, customerEmail) → invoice_url
  └─ Return { url: invoice_url, orderId }
```

## Related Code Files

### Modify
- `apps/sophia-ai-factory/src/app/api/checkout/route.ts` — extend POST handler
- `apps/sophia-ai-factory/src/lib/schemas.ts` — extend `checkoutSchema` with `period`, `paymentMethod`
- `apps/sophia-ai-factory/src/components/pricing/pricing-section.tsx` — handle 401 via redirect to /login?next=/pricing
- `apps/sophia-ai-factory/src/config/flags.ts` — add `FEATURE_PAYOS` flag

### Create
- `apps/sophia-ai-factory/src/lib/checkout/checkout-validators.ts` — pure validation helpers (period, paymentMethod gates) — keeps route handler thin

## Implementation Steps

1. Add to `src/lib/schemas.ts`:
   ```ts
   export const checkoutSchema = z.object({
     tier: z.enum(['BASIC','PREMIUM','ENTERPRISE','MASTER']),
     period: z.enum(['monthly','yearly','lifetime']).optional(),
     paymentMethod: z.enum(['nowpayments','payos']).default('nowpayments'),
     promoCode: z.string().min(3).max(40).optional(),
     customerEmail: z.string().email().optional(),
   });
   ```

2. Create `src/lib/checkout/checkout-validators.ts`:
   - `derivePeriod(tier)` → `'lifetime'` for MASTER, `'monthly'` default
   - `assertPeriodAllowed(tier, period)` → throws on yearly
   - `assertPaymentMethodAllowed(method)` → throws on payos unless flag

3. Modify `route.ts` POST handler:
   - Parse Zod (replace existing two-schema parse with one)
   - Apply validators
   - Compute amount_usd_cents from `NOWPAYMENTS_TIERS[tier].price * 100`
   - Call `writeOrder()` BEFORE building URL (fail fast on DB write)
   - Existing promo reservation block preserved — reads orderId now
   - Return `{ url, orderId }` (was just `{ url }`)

4. Modify 401 path:
   ```ts
   if (!userId) {
     return NextResponse.json(
       { error: 'Login required', redirectTo: `/login?next=${encodeURIComponent('/pricing')}` },
       { status: 401 }
     );
   }
   ```

5. Modify `pricing-section.tsx` `handleSelectTier`:
   - On 401 with `redirectTo`, `window.location.href = redirectTo`
   - On other errors, alert (existing behavior)

6. Add to `src/config/flags.ts`:
   ```ts
   export const FEATURE_PAYOS = process.env.FEATURE_PAYOS === 'true';
   ```

7. Run existing tests in `route.test.ts` → fix any breakage (email param order changed)

## Todo List
- [ ] Extend checkoutSchema with period + paymentMethod
- [ ] Create checkout-validators.ts (period/method gates)
- [ ] Modify POST route: writeOrder before URL build
- [ ] Modify 401 path to return redirectTo
- [ ] Update pricing-section.tsx redirect logic
- [ ] Add FEATURE_PAYOS flag
- [ ] Update existing route.test.ts cases
- [ ] Run `npm test src/app/api/checkout/route.test.ts`
- [ ] Build → 0 errors

## Success Criteria
- 401 response includes `redirectTo` field
- pending_orders row exists for every successful POST
- Yearly period rejected (400) until invoice IDs added
- Existing GET handler unchanged
- All existing checkout tests still pass

## Risk Assessment
- Risk: GET handler also needs writeOrder (Telegram bot path) — mitigation: shared `buildCheckoutForUser(tier, userId, ctx)` helper, called by both POST and GET
- Risk: pending_orders write fails → user blocked — mitigation: log + still return URL (graceful degrade) but emit metric for monitoring

## Security Considerations
- Auth check before writeOrder — never persist pending order for anonymous user
- customerEmail is user-provided → already validated as email in Zod
- promoCode reservation runs only after user check (no enumeration attack)

## Next Steps
- Phase 03: IPN handler reads pending_orders to mark completed atomically
- Phase 07: Dashboard widget posts to this route instead of raw NOWPayments URL
