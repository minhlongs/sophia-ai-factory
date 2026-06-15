# Polar.sh Metered Usage & Webhooks Research Report
**Date:** 2026-03-08
**Researcher:** Subagent
**Status:** Complete

## Executive Summary

This report analyzes Polar.sh's metered usage billing capabilities, webhook events, subscription lifecycle, and integration patterns for Next.js applications.

---

## 1. Metered Usage API

### Current Implementation Status

**NO NATUREL METERED USAGE API SUPPORT IN CODEBASE**

The codebase uses a **custom usage tracking system** with Supabase:
- `src/lib/usage-metering/tracker.ts` - Custom usage tracking logic
- Batch ingestion API at `/api/v1/usage`
- Direct database insertion into `usage_events` table

### Polar.sh SDK Available Functions

```typescript
// From @polar-sh/sdk (v0.42.5)
// polar.customers.* - Customer management
// polar.subscriptions.* - Subscription management
// polar.orders.* - One-time orders
// polar.checkouts.* - Checkout sessions
// polar.benefits.* - Benefit delivery (license keys, Discord roles, etc.)
// polar.webhook.endpoints.* - Webhook configuration
```

**Note:** No `polar.meters.*` or `polar.usage.*` API calls found in current usage.

### Recommended Metered Usage Approach

**Option A: Custom Integration (Current)**
- Track usage in `usage_events` table
- Link to Polar customer via `polar_customer_id` in license metadata
- Query usage for reconciliation/billing reports

**Option B: Polar Metered Billing (If Available)**
- Use `polar.customers.createMeteredUsage()` when available
- Requires Polar subscription with metered products configured

---

## 2. Webhook Events

### Supported Event Types (Codebase)

```typescript
// From src/lib/payments/polar-types.ts
export type PolarEventType =
  | 'checkout.created'      // Checkout session created
  | 'checkout.updated'      // Checkout status change (succeeded = payment complete)
  | 'subscription.created'  // New subscription created
  | 'subscription.updated'  // Subscription modified (renewal, tier change)
  | 'subscription.cancelled' // Subscription cancelled
  | 'subscription.active'      // Reactivation after past_due
  | 'subscription.past_due'    // Payment overdue (grace period)
  | 'subscription.expired'     // Subscription expired
  | 'order.created'            // One-time order
```

### Webhook Payload Structure

```typescript
interface PolarWebhookEvent {
  type: PolarEventType
  data: Record<string, unknown>  // Event-specific data
}
```

### Key Data Fields

**Subscription:**
- `id` - Polar subscription ID
- `status` - active, past_due, cancelled, expired
- `metadata` - Custom key-value (includes `userId`, `tier`, `telegram_chat_id`)
- `current_period_start/end` - Billing period dates
- `cancel_at_period_end` - Cancellation flag
- `customer.id` - Polar customer ID
- `customer.email` - Customer email

**Checkout:**
- `id` - Checkout ID
- `status` - created, pending, succeeded, failed
- `metadata` - User metadata
- `customer.*` - Customer information

### Webhook Verification

```typescript
// From src/lib/payments/polar-webhook-verify.ts
// Uses standardwebhooks library
const { Webhook } = await import('standardwebhooks');
const wh = new Webhook(process.env.POLAR_WEBHOOK_SECRET);
wh.verify(payload, headers);
```

**Required Headers:**
- `webhook-id` - Unique event ID (for idempotency)
- `webhook-timestamp` - Event timestamp
- `webhook-signature` - HMAC signature

---

## 3. Subscription Lifecycle States

### State Transitions

```
active → past_due → active (retry success)
active → past_due → cancelled (retry failed)
active → cancelled (user request)
active → expired (grace period end)
```

###.state-Specific Webhooks

| State | Webhook | Behavior |
|-------|---------|----------|
| `active` | `subscription.active` | License reactivated after past_due |
| `past_due` | `subscription.past_due` | Warning metadata added (7-day grace period) |
| `cancelled` | `subscription.cancelled` | Subscription cancelled, license revoked |
| `expired` | `subscription.expired` | Full license revoke after grace period |
| `active` | `subscription.updated` | Renewal, tier upgrade/downgrade |

### Current Implementation

```typescript
// From src/lib/payments/polar-webhook-handler.ts

// Past Due Handling (7-day grace period)
async function handleSubscriptionPastDue(data) {
  // Add warning to license metadata
  metadata.past_due = true
  metadata.past_due_at = Date.now()
  metadata.warning_sent = true
  // DO NOT revoke yet - grace period active
}

// Expired Handling (grace period over)
async function handleSubscriptionExpired(data) {
  // Full revoke (not soft)
  revokeLicenseBySubscription(polarSubId, { soft: false })
}

// Active (Reactivation)
async function handleSubscriptionActive(data) {
  // Reactivate license
  await reactivateLicenseBySubscription(polarSubId)
}
```

---

## 4. Customer Notifications

### Does Polar Handle Email Notifications?

**Partial Automatic Support:**

| Notification Type | Polar Default | Custom Required |
|-------------------|---------------|-----------------|
| Payment success | ✅ Yes | No |
| Payment failure | ⚠️ Yes (dunning) | Maybe |
| Subscription expiry | ⚠️ Yes | Maybe |
| License key delivery | ❌ No | ✅ Yes (via webhook) |
| Usage alerts | ❌ No | ✅ Yes (custom) |

### Current Implementation

```typescript
// Telegram notifications only (no email)
await notifySubscriptionActivated(telegramChatId, tier)
await notifySubscriptionCancelled(telegramChatId, periodEnd)
```

### Recommendation

**Use Polar's dunning emails + custom Telegram/Email:**
1. Enable dunning in Polar dashboard (automatic emails)
2. Send custom Telegram notifications for immediate awareness
3. Email only for critical events (expired license, payment permanently failed)

---

## 5. Integration Patterns

### Next.js Best Practices

#### Pattern 1: Checkout Integration

```typescript
// /api/checkout/route.ts (existing)
1. Authenticate user (Supabase)
2. Create checkout session with metadata:
   {
     userId: user.id,
     tier: 'PREMIUM',
     telegram_chat_id: user.telegram_chat_id
   }
3. Return checkout URL
4. User completes payment on Polar
5. Webhook handles license generation
```

#### Pattern 2: Webhook Processing

```typescript
// /api/webhooks/polar/route.ts (existing)
1. Verify webhook signature
2. Check idempotency (polar_event_id)
3. Record event as pending
4. Route to appropriate handler
5. Mark as processed (success) or failed (retry)
```

**Idempotency Key:** `polar_event_id` (Polar's event ID)

#### Pattern 3: License Generation

```typescript
// Auto-generate on payment webhook
generateLicenseOnPayment({
  userId,
  tier,
  polarSubscriptionId,
  polarCustomerId
})
// Stores in raas_licenses table
// Creates license audit trail
```

### Subscription Linking

```typescript
// Link Polar subscription to user profile
UPDATE user_profiles SET
  subscription_tier = 'PREMIUM',
  subscription_status = 'active',
  polar_subscription_id = 'sub_123',
  polar_customer_id = 'cust_123'
WHERE user_id = 'user_123'
```

### Usage Event Attribution

```typescript
// Link usage to Polar customer via license metadata
SELECT metadata->>'polar_customer_id'
FROM raas_licenses
WHERE nonce = 'XYZ123'

// Results in usage_events.external_customer_id
// Enables Polar reconciliation
```

---

## 6. API Endpoints

### Polar.sh SDK API

```typescript
// From @polar-sh/sdk
polar.customers                // CRUD customers
polar.subscriptions            // Manage subscriptions
polar.orders                   // One-time orders
polar.checkouts                // Checkout sessions
polar.webhook.endpoints        // Webhook configuration
polar.webhook.payloads         // Webhook delivery status
polar.benefits                 // Benefit delivery
polar.licensekeys              // License key management
polar.transactions             // Payment records
```

### Custom Endpoints (Codebase)

| Endpoint | Purpose |
|----------|---------|
| `/api/webhooks/polar` | Webhook receiver |
| `/api/checkout` | Checkout session creation |
| `/api/v1/usage` | Batch usage ingestion |
| `/api/admin/usage/query` | Usage data export |
| `/api/admin/usage/reconciliation` | Polar reconciliation |

---

## 7. Technical Implementation

### License Key Generation

```typescript
// From src/lib/raas-key-generator
generateLicenseKey(tier, expiresDate, secret)
// Format: SOPHIA_<TIER>_<YYYYMMDD>_<NONCE>_<HASH>
// Stored hash in database, full key encrypted to user
```

### Audit Trail

```typescript
// All license operations logged
logLicenseCreation({ nonce, tier, timestamp, createdBy, ipAddress })
logLicenseRevocation({ nonce, tier, revokedBy, reason })
```

### Error Handling

```typescript
// Servlet pattern
try {
  await processWebhookEvent(event, webhookId)
  return { success: true, message: 'Processed' }
} catch (error) {
  recordPaymentEvent({ processed: false }) // Retry flag
  return { success: false, message: error.message }
}
```

### Retry Logic

```typescript
// Exponential backoff for recordPaymentEvent
retryCount < 3
delay = 100ms * 2^retryCount  // 100ms, 200ms, 400ms
```

---

## 8. Recommendations

### Immediate Actions

1. **Metered Usage Tracking**
   - Continue current Supabase-based usage tracking
   - Link `usage_events.external_customer_id` to Polar customer
   - Build reconciliation reports

2. **Webhook Idempotency**
   - Currently using database-level unique constraint
   - Consider Redis cache for faster duplicate detection

3. **Dunning Configuration**
   - Configure retry schedule in Polar dashboard
   - Set grace period duration (currently 7 days in code)

### Future Enhancements

1. **Polar Metered Billing**
   - Monitor @polar-sh/sdk for `polar.customermeters.*` APIs
   - If available, migrate to native metered usage

2. **Email Notifications**
   - Enable dunning emails in Polar dashboard
   - Add custom email notifications for license expiry

3. **Usage Alerts**
   - Implement usage threshold alerts (80%, 90%, 100%)
   - Grid quota dashboard for admin monitoring

---

## 9. Unresolved Questions

1. **Polar Metered API Status:** Is `polar.customers.createMeteredUsage()` or similar available in @polar-sh/sdk v0.42.5?

2. **Metered Product Configuration:** How to configure metered products in Polar dashboard for usage-based billing?

3. **Usage Data Format:** What is the expected format for metered usage reports to Polar API?

4. **Credit vs Meter:** Is there a difference between "credits" (custom) and "meters" (Polar native)?

5. **Reconciliation Timing:** How often should usage data be sent to Polar - real-time, hourly, daily?

---

## 10. References

| Resource | URL |
|----------|-----|
| @polar-sh/sdk GitHub | https://github.com/polar-sh/polar |
| Polar.sh Documentation | https://polar.sh/docs/ |
| Polar Next.js Adapter | `@polar-sh/nextjs` (v0.9.3) |
| Polar SDK Reference | `@polar-sh/sdk` (v0.42.5) |

---

## Appendix: Code Files Summary

| File | Purpose |
|------|---------|
| `src/lib/payments/polar-webhook-handler.ts` | Webhook processing (850 lines) |
| `src/lib/payments/polar-types.ts` | TypeScript types (73 lines) |
| `src/lib/polar.ts` | Polar client initialization |
| `src/lib/clients/polar-client.ts` | Client wrapper helpers |
| `src/lib/usage-metering/tracker.ts` | Usage tracking logic (283 lines) |
| `src/app/api/v1/usage/route.ts` | Batch usage API |
| `src/app/api/webhooks/polar/route.ts` | Webhook endpoint |

---

**Report Generated:** 2026-03-08 18:28 UTC
**Next Review:** After Polar SDK metered usage API confirmation
