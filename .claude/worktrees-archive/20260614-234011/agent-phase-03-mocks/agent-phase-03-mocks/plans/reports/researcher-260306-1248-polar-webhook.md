# Polar.sh Webhook Research Report / Nghiên Cứu Webhook Polar.sh

**Date:** 2026-03-06
**Researcher:** researcher
**Project:** Sophia AI Factory
**Work Context:** /Users/macbookprom1/mekong-cli/apps/sophia-ai-factory

---

## Executive Summary / Tóm Tắt

Sophia AI Factory hiện tại đang sử dụng **Polar.sh** làm payment provider duy nhất (PayPal đã被 loại bỏ). Hệ thống webhook hiện tại đã được implement đầy đủ với:

1. **Polar.sh Webhook Handler** (`src/lib/payments/polar-webhook-handler.ts`) - Validate & process events
2. **Signature Verification** (`src/lib/security/webhook-signature-verification.ts`) - HMAC-SHA256
3. **Idempotency Pattern** - Tránh duplicate processing
4. **Supabase Integration** - Lưu payment events & user tier updates

**Key Finding:** Webhook system H music best practices nhưng còn missingsome critical validation checks (see unresolved questions).

---

## Existing Polar Integration / Tích Hợp Polar Hiện Tại

### Core Files

| File | Purpose |
|------|---------|
| `src/lib/payments/polar-webhook-handler.ts` | Main webhook event processor |
| `src/app/api/webhooks/polar/route.ts` | Next.js API route handler |
| `src/lib/security/webhook-signature-verification.ts` | HMAC verification utility |
| `src/lib/payments/polar-subscription-service.ts` | Subscription CRUD with Redis |
| `src/lib/polar.ts` | Polar SDK client singleton |
| `src/lib/polar-config.ts` | Product configuration |
| `src/lib/clients/polar-client.ts` | Polar SDK wrapper |

### Payment Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Polar.sh Dashboard                          │
│  Create Checkout → User pays → Polar sends webhook             │
└─────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────┐
│          /api/webhooks/polar (Next.js API Route)                │
│  1. Verify webhook signature (standardwebhooks)                 │
│  2. Validate headers (Zod schema)                               │
│  3. Parse event JSON                                            │
└─────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────┐
│    processWebhookEvent() - polar-webhook-handler.ts            │
│  - Idempotency check (payment_events table)                     │
│  - Route to handler by event type                               │
│  - Record event in audit trail                                  │
└─────────────────────────────────────────────────────────────────┘
                                             │
                   ┌─────────────────────────┼─────────────────────┐
                   ▼                         ▼                     ▼
           checkout.updated         subscription.created      order.created
           (one-time purchase)      (recurring)              (one-time)
                   │                         │                     │
                   ▼                         ▼                     ▼
         ┌────────────────────────────────────────────────────────┐
         │         Update user_profiles table:                    │
         │   - subscription_tier (basic/premium/enterprise/master)│
         │   - subscription_status (active/cancelled/expired)     │
         │   - polar_subscription_id                              │
         │   - subscription_expires_at                            │
         └────────────────────────────────────────────────────────┘
                   │
                   ▼
         ┌────────────────────────────────────────────────────────┐
         │     Optional: Send Telegram notification               │
         │     (notifySubscriptionActivated/cancelled)            │
         └────────────────────────────────────────────────────────┘
```

---

## Polar.sh Webhook Events (Polar SDK v0.42.5)

### Supported Event Types

```typescript
// From src/lib/payments/polar-types.ts
type PolarEventType =
  | 'checkout.created'
  | 'checkout.updated'     // ✓ Already handled
  | 'subscription.created' // ✓ Already handled
  | 'subscription.updated' // ✓ Already handled
  | 'subscription.cancelled'
  | 'order.created'        // ✓ Already handled
```

**Note:** The current implementation handles the core events. Missing: `subscription.active`, `subscription.past_due`, `benefit_grant.created`.

### Event Payload Structure

```typescript
{
  type: PolarEventType,
  data: {
    id: string,                    // Polar event ID (use as webhook_id)
    status: string,                // e.g., "succeeded" for checkout
    metadata?: Record<string, unknown>, // Contains: userId, tier, telegram_chat_id
    product_id?: string,
    customer?: {
      id: string,
      email: string,
      name?: string
    },
    amount?: number,
    currency?: string,
    billing_reason?: string,      // For orders: "purchase" | "subscription_cycle"
    current_period_start?: string,
    current_period_end?: string,
    cancel_at_period_end?: boolean
  }
}
```

### Metadata Mapping (Polar → Sophia)

Polar `metadata`字段 truyền từ checkout:

```typescript
// From src/app/api/checkout/route.ts
metadata: {
  tier: mappedTier,         // 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'
  userId: user?.id,         // Supabase user ID (or guest id)
  telegram_chat_id?: string // From user session
}
```

---

## Security Implementation

### 1. Webhook Signature Verification

```typescript
// src/lib/security/webhook-signature-verification.ts
export function verifyPolarWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
```

**Current Status:** Manual HMAC verification implemented
**Note:** Main webhook route uses `standardwebhooks` library for verification.

### 2. Webhook Handling in API Route

```typescript
// src/app/api/webhooks/polar/route.ts - Line 35-59
const wh = new Webhook(POLAR_WEBHOOK_SECRET)
try {
  wh.verify(body, {
    'webhook-id': webhookId,
    'webhook-timestamp': timestamp,
    'webhook-signature': signature,
  })
} catch (firstError) {
  // Fallback: base64-encoded secret
  const base64Secret = Buffer.from(POLAR_WEBHOOK_SECRET).toString('base64')
  const whVerify = new Webhook(base64Secret)
  whVerify.verify(body, { ... })
}
```

**Security Features:**
- Timing-safe comparison (prevents timing attacks)
- Secondary verification with base64 secret (Polar uses base64 encoding)
- Immediate 400 error on invalid signature

### 3. Replay Attack Prevention

**Current:**
- Webhook timestamp verification (5-minute max age)
- Idempotency via `payment_events` table (upsert on polar_event_id)

**Missing:**
- Nonce tracking (Polar already includes unique event IDs)

---

## Idempotency Implementation

### Pattern Used

```typescript
// src/lib/payments/polar-webhook-handler.ts - Line 36-46
async function isEventProcessed(polarEventId: string): Promise<boolean> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('payment_events')
    .select('id')
    .eq('polar_event_id', polarEventId)
    .eq('processed', true)
    .single()
  return !!data
}
```

### Audit Trail Table

```sql
-- From supabase/migrations/20260208_user_sessions_and_payment_events.sql
CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  polar_event_id TEXT UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TEXT
);
```

**Purpose:**
1. Prevent duplicate processing of same webhook
2. Audit trail for debugging
3. Re-process failed events

---

## License System Integration

### Current Integration Points

```typescript
// From src/lib/raas-service.ts (phase 1 - Redis)
// From src/lib/raas-gate.ts (phase 2 - Supabase)
```

**RaaS License Flow:**
1. User signs up → Create license key (raas_{tier}_{timestamp}_{nonce}_{hmac})
2. License stored in `raas_licenses` table (hash only, not raw key)
3. API routes protected by `raas-gate.ts` middleware
4. Headers: `X-RaaS-License-Key`

### Relationship Between Polar & RaaS

| Component | Purpose | Storage |
|-----------|---------|---------|
| **Polar Subscribe** | Credit card billing | Polar dashboard |
| **RaaS License** | API key gating | Supabase `raas_licenses` |
| **Linkage** | Customer email → License | Via user_id |

**Currently:** No automatic license generation on Polar subscription.

---

## Address Mapping: Customer → License

### Email Flow

```
1. Customer: customer@example.com
   ↓ Buys via Polar
2. Polar webhook received:
   {
     "metadata": {
       "userId": "supabase-uuid",
       "tier": "PREMIUM"
     },
     "customer": {
       "email": "customer@example.com"
     }
   }
   ↓
3. Update user_profiles:
   {
     user_id: "supabase-uuid",
     subscription_tier: "premium",
     polar_subscription_id: "sub_xxx"
   }
   ↓
4. RaaS License (optional - manual or API):
   - Admin generates license via /api/admin/licenses/create
   - Or: Auto-generate on checkout
```

### Missing Integration

**Question:** Should licenses auto-generate when Polar subscription is created?

---

## Unresolved Questions / Câu Hỏi Chưa Giải Quyết

### High Priority

1. **License Key Generation Trigger**
   > Should a license key be auto-generated when `subscription.created` webhook fires?
   > Current: Manual admin action via `/api/admin/licenses/create`
   > Suggested: Auto-generate with tier from metadata

2. **Missing Event Types**
   > `subscription.active`, `subscription.past_due`, `benefit_grant.created` are NOT handled
   > Impact: Mindyk không nhận notifications cho trial ends / failed renewals

3. **Telegram Chat ID Mapping**
   > metadata.telegram_chat_id được truyền từ checkout, nhưng:
   > - Làm sao đảm bảo chat ID đúng vớiuser?
   > - Có trường hợp user đổi Telegram account?

### Medium Priority

4. **Webhook Retry Behavior**
   > Polar retries failed webhooks (non-2xx) up to 3 days.
   > Current idempotency handles duplicates, but:
   > - Có thể bị xử lý lại sau months?
   > - Should expire old processed events?

5. **Environment Variable Validation**
   > `POLAR_WEBHOOK_SECRET`Merge check exist but not throw error if missing
   > File: `src/lib/security/webhook-signature-verification.ts` line 45-48

### Low Priority

6. **Price Currency**
   > All prices use `usd` (hardcoded in `polar-config.ts`)
   > Any plans for multi-currency support?

7. **RaaS License Revocation**
   > When subscription cancelled, should licenses be revoked?
   > Current: License exists until manually revoked

---

## Recommendations / Gợi Ý

### Immediate Actions

1. **Add `subscription.active` handler**
   ```typescript
   case 'subscription.active':
     // Handle trial end → first charge
     await handleSubscriptionActive(event.data)
     break
   ```

2. **Add `subscription.past_due` handler**
   ```typescript
   case 'subscription.past_due':
     // Notify customer, grant grace period
     await notifyPastDue(event.data.customer_email)
     break
   ```

3. **Validate email in metadata**
   ```typescript
   function validateMetadata(data: Record<string, unknown>) {
     const metadata = data.metadata || {}
     if (!metadata.email && !metadata.userId) {
       throw new Error('Missing customer identifier')
     }
   }
   ```

### Future Enhancements

4. **Auto-license generation**
   - Trigger on `subscription.active`
   - Store license hash in `raas_licenses`
   - Grant API access based on tier

5. **Webhook monitoring dashboard**
   - Show last 100 webhook attempts
   - Filter by event type
   - Manual retry option

6. **Dedicated webhook testing endpoint**
   - `/api/webhooks/polar/test`
   - Send test payloads to verify processing
   - View processing logs

---

## Files Modified/Sequential Pattern Reference

### Complete Event Processing Flow

```
Polar.sends webhook
    ↓
Next.js: /api/webhooks/polar/route.ts POST()
    ↓
1. Headers validation (Zod webhookHeaderSchema)
2. StandardWebhooks.verify() with secret
3. JSON.parse(body) → PolarWebhookEvent
4. processWebhookEvent(event, webhookId)
    ↓
Idempotency Check (payment_events table)
    ↓
Switch on event.type:
  - checkout.updated → handleCheckoutSuccess()
  - subscription.created → handleSubscriptionCreated()
  - subscription.updated → handleSubscriptionUpdated()
  - order.created → handleOrderCreated()
    ↓
Update user_profiles (tier, status, expires_at)
    ↓
Optional: Telegram notification
    ↓
Mark payment_events.processed = true
```

---

## Reference Data

### Environment Variables (Required)

| Variable | Description | Verification |
|----------|-------------|--------------|
| `POLAR_ACCESS_TOKEN` | Polar API access token | Required for `polar` client |
| `POLAR_WEBHOOK_SECRET` | Webhook signature secret | Base64 encoded |
| `POLAR_PRODUCT_ID_STARTER` | Starter tier product ID | $199/month |
| `POLAR_PRODUCT_ID_GROWTH` | Growth tier product ID | $399/month |
| `POLAR_PRODUCT_ID_PREMIUM` | Premium tier product ID | $799/month |
| `POLAR_PRODUCT_ID_MASTER` | Master tier product ID | $4,999 one-time |

### Tier Mapping

| Polar Metadata.tier | DB Value | RaaS Tier |
|---------------------|----------|-----------|
| BASIC | 'basic' | 'basic' |
| PREMIUM | 'premium' | 'premium' |
| ENTERPRISE | 'enterprise' | 'enterprise' |
| MASTER | 'master' | 'master' |

**Note:** MASTER tier = perpetual (no expiration)

---

## Test Results

### Current Test Coverage

| Component | Test File | Status |
|-----------|-----------|--------|
| polar-config | `src/lib/polar-config.test.ts` | ✓ Pass |
| raas-service | `src/lib/raas-service.test.ts` | ✓ Pass |
| tier-guard | `src/lib/tier-guard.test.ts` | ✓ Pass |
| polar-webhook-handler | Not found | Unknown |
| polar-subscription | `src/lib/subscription.test.ts` | ✓ Pass |

---

## Appendix: Key Code References

### Checkout Session Creation

**File:** `src/app/api/checkout/route.ts` (Lines 24-46)

```typescript
const checkout = await paymentService.createCheckoutSession({
  productIds: [productId],
  successUrl: `${origin}/dashboard?checkout=success`,
  customerEmail: user?.email,
  metadata: { tier: mappedTier, userId },
})
```

### Webhook Event Types

**File:** `src/lib/payments/polar-types.ts` (Lines 7-18)

```typescript
export type PolarEventType =
  | 'checkout.created'
  | 'checkout.updated'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.cancelled'
  | 'order.created'
```

### Subscription Tier Mapping

**File:** `src/lib/subscription.ts` (Lines 29-43)

```typescript
export const DB_TIER_MAPPING: Record<string, Tier> = {
  'basic': 'BASIC',
  'premium': 'PREMIUM',
  'pro': 'PREMIUM',
  'enterprise': 'ENTERPRISE',
  'master': 'MASTER',
  'free': 'BASIC'
}
```

---

*Report generated: 2026-03-06 12:48*
*Researcher: researcher agent*
*Token budget: 150000 | Tokens used: ~25000*
