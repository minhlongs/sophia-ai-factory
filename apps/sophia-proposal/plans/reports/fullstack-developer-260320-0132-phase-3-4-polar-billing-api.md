# Phase 3 + 4 Implementation Report — Polar Billing API

**Date:** 2026-03-20 01:32
**Sprint:** Sprint 3 — Polar Billing Integration
**Phases:** Phase 3 (Checkout API) + Phase 4 (Webhook Handler)

---

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `app/api/billing/checkout/route.ts` | 126 | POST create Polar checkout session |
| `app/api/billing/portal/route.ts` | 76 | GET customer portal session |
| `app/api/billing/subscription/route.ts` | 79 | GET subscription status + balance |
| `app/api/webhooks/polar/route.ts` | 312 | Webhook handler for Polar events |
| `middleware.ts` | 2 (modified) | Added /api/billing to protected routes |

**Total:** 595 lines created

---

## Tasks Completed

### Phase 3: Checkout API Endpoints
- [x] `POST /api/billing/checkout` — Create checkout session with tier selection
- [x] `GET /api/billing/portal` — Get customer portal URL for subscription management
- [x] `GET /api/billing/subscription` — Get current subscription + MCU balance
- [x] Authentication via `getCurrentUser()` from cookie headers
- [x] Organization-scoped billing (org_id from org_members)
- [x] Zod validation for request schema
- [x] Error handling with proper HTTP status codes

### Phase 4: Webhook Handler
- [x] `POST /api/webhooks/polar` — Public webhook endpoint
- [x] Signature verification via `verifyWebhookSignature()`
- [x] Event handlers:
  - [x] `subscription.created` — Create subscription record
  - [x] `subscription.updated` — Update status/cancel_at_period_end
  - [x] `subscription.deleted` — Cancel subscription
  - [x] `order.paid` — Credit MCU via `credit_mcu_balance()` RPC
  - [x] `order.refunded` — Deduct MCU (allows negative for refunds)
- [x] Idempotency via upsert on `polar_subscription_id`
- [x] Error logging with `WebhookKnownError` for non-retry failures

---

## Type Check Status

```bash
npx tsc --noEmit --skipLibCheck
# Result: 0 errors - PASS
```

---

## Implementation Notes

### Authentication Pattern
Used `getCurrentUser(cookies)` pattern consistent with existing auth API routes:
```typescript
const cookies = request.headers.get('cookie') || '';
const user = await getCurrentUser(cookies);
```

### Webhook Config
Disabled body parsing for signature verification:
```typescript
export const config = {
  api: {
    bodyParser: false,
  },
};
```

### MCU Deduction Fix
Original plan used `supabase.raw()` which doesn't exist. Fixed to use:
```typescript
const { data: currentBalance } = await supabase
  .from('org_balances')
  .select('balance')
  .eq('org_id', billingSettings.org_id)
  .single();

const newBalance = (currentBalance?.balance || 0) - mcuToDeduct;
```

### Middleware Protection
Added `/api/billing` to protected API routes to prevent unauthorized access.

---

## Next Steps (Unblocked)

1. **Phase 5: MCU Tracking** — Integrate `deduct_mcu_balance()` into API usage
2. **Phase 6: Billing Dashboard UI** — Create UI components for billing management
3. **Phase 7: Pilot Onboarding** — Connect checkout flow to onboarding wizard

---

## Unresolved Questions

None. Both phases implemented successfully.

---

## Testing Commands

```bash
# Test checkout (requires auth cookie)
curl -X POST http://localhost:3000/api/billing/checkout \
  -H "Cookie: sb-token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "premium"}'

# Test subscription fetch
curl -X GET http://localhost:3000/api/billing/subscription \
  -H "Cookie: sb-token=YOUR_TOKEN"

# Test portal
curl -X GET http://localhost:3000/api/billing/portal \
  -H "Cookie: sb-token=YOUR_TOKEN"

# Test webhook (use Polar dashboard test events)
```

---

## Polar Webhook Configuration

In Polar.sh Dashboard:
1. Settings → Webhooks
2. Add endpoint: `https://sophia.agencyos.network/api/webhooks/polar`
3. Select events: subscription.*, order.paid, order.refunded
4. Copy webhook secret to `POLAR_WEBHOOK_SECRET` env var
