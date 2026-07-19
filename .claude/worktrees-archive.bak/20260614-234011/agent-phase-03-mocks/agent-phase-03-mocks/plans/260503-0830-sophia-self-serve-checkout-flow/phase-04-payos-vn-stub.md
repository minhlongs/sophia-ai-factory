# Phase 04 — PayOS VN Flow Stub (Feature-Flag Gated)

## Context Links
- Feature flag: `src/config/flags.ts` → `FEATURE_PAYOS` (added Phase 02)
- NOWPayments client pattern: `src/lib/clients/nowpayments-client.ts`
- IPN model: `src/app/api/webhooks/nowpayments/route.ts`

## Overview
- Priority: P3 (defer until VN traffic justifies; ship stub now)
- Status: pending
- Effort: 30m
- Description: Scaffold PayOS client interface + webhook route + stub functions, all gated by `FEATURE_PAYOS=false` default. Throws "Not implemented" if invoked. Allows future implementation without API churn.

## Key Insights
- KISS: Stub only — no actual PayOS integration. We just want the seam ready.
- PayOS uses HMAC-SHA256 (different from NOWPayments' SHA512) — note in interface.
- Currency: USD pricing → VND conversion at order time. Pin USD_TO_VND env var or fetch live rate (defer decision).
- PayOS QR code returned as URL → render in /checkout/payos page (defer).

## Requirements

### Functional
- `FEATURE_PAYOS=false` (default) → POST /api/checkout with `paymentMethod=payos` returns 400 "Not enabled"
- `FEATURE_PAYOS=true` → returns 501 "Not implemented" with stub URL placeholder (clear signal to dev)
- Webhook route exists at `/api/webhooks/payos` returning 501 if invoked

### Non-Functional
- Zero impact on NOWPayments flow when flag off
- All stub functions throw with helpful messages (not silent fail)

## Architecture
```
src/lib/clients/payos-client.ts       ← stub interface
  - createPayOsInvoice(...)           → throws 501
  - verifyPayOsSignature(...)         → throws 501
  - getPayOsTierConfig(tier, period)  → returns { invoiceTemplate, vndAmount }

src/app/api/webhooks/payos/route.ts   ← stub route
  - POST → 501 "Not implemented"
```

## Related Code Files

### Create
- `src/lib/clients/payos-client.ts` — stub with explicit "throw new Error('PayOS not implemented')"
- `src/app/api/webhooks/payos/route.ts` — POST returning 501
- `src/lib/clients/__tests__/payos-client.test.ts` — 3 tests verifying stubs throw correctly

### Modify
- `src/lib/checkout/checkout-validators.ts` — `assertPaymentMethodAllowed` references FEATURE_PAYOS

## Implementation Steps

1. Create `payos-client.ts` (~60 lines):
   ```ts
   import { FEATURE_PAYOS } from '@/config/flags'
   import type { Tier } from '@/types'
   import { UNIFIED_TIERS } from '@/config/tiers'

   export interface PayOsCheckoutInput {
     tier: Tier
     period: 'monthly'|'lifetime'
     userId: string
     orderId: string
     customerEmail?: string
   }
   export interface PayOsCheckoutResult {
     qrUrl: string
     paymentLinkId: string
     expiresAt: string
   }

   const USD_TO_VND = Number(process.env.USD_TO_VND ?? '24500')

   export function getPayOsTierConfig(tier: Tier): { vndAmount: number } {
     const usd = UNIFIED_TIERS[tier].price
     return { vndAmount: Math.round(usd * USD_TO_VND) }
   }

   export async function createPayOsInvoice(_input: PayOsCheckoutInput): Promise<PayOsCheckoutResult> {
     if (!FEATURE_PAYOS) throw new Error('PayOS feature flag disabled')
     throw new Error('PayOS createPayOsInvoice not implemented — see plans/260503-0830-sophia-self-serve-checkout-flow/phase-04')
   }

   export async function verifyPayOsSignature(_body: string, _sig: string): Promise<boolean> {
     throw new Error('PayOS verifyPayOsSignature not implemented')
   }
   ```

2. Create webhook stub `src/app/api/webhooks/payos/route.ts`:
   ```ts
   import { NextRequest, NextResponse } from 'next/server'
   import { FEATURE_PAYOS } from '@/config/flags'
   import { logger } from '@/lib/utils/logger-utility'

   export async function POST(request: NextRequest) {
     if (!FEATURE_PAYOS) {
       return NextResponse.json({ error: 'PayOS not enabled' }, { status: 503 })
     }
     logger.warn('[PayOS Webhook] Received but handler not implemented', { headers: Array.from(request.headers.keys()) })
     return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
   }
   ```

3. Update `checkout-validators.ts`:
   ```ts
   export function assertPaymentMethodAllowed(method: PaymentMethod) {
     if (method === 'payos' && !FEATURE_PAYOS) {
       throw new Error('PayOS not currently available — choose nowpayments')
     }
   }
   ```

4. Tests (`payos-client.test.ts`):
   - Stub throws with FEATURE_PAYOS=false
   - Stub throws "not implemented" with FEATURE_PAYOS=true
   - getPayOsTierConfig returns correct VND for each tier

## Todo List
- [ ] Create payos-client.ts stub
- [ ] Create webhooks/payos/route.ts stub
- [ ] Add 3 unit tests for stub
- [ ] Update checkout-validators
- [ ] Build → 0 errors
- [ ] Document in `docs/system-architecture.md` that PayOS is stub-only

## Success Criteria
- POST /api/checkout with paymentMethod=payos returns 400 (default flag off)
- /api/webhooks/payos returns 503 (default flag off)
- 0 impact on existing NOWPayments tests

## Risk Assessment
- Risk: Stub gets accidentally enabled in prod → mitigation: flag default false + readme + log warning on every webhook hit
- Risk: USD→VND conversion math wrong later → mitigation: TODO comment in getPayOsTierConfig referencing currency-rate strategy decision

## Security Considerations
- 503 vs 501: 503 when flag off (service unavailable, retryable), 501 when flag on but unimplemented (permanent until shipped)
- No PII logged in stub

## Next Steps
- Future phase (deferred): full PayOS SDK integration when VN traffic justifies
- For now: marketing/landing page can still mention "VN payments coming soon"
