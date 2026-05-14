---
title: Legacy Stripe & Polar Webhook Configuration Guide
description: Legacy reference for Stripe and Polar.sh webhooks. Sophia customer billing uses NOWPayments and PayOS.
---

# Webhook Configuration Guide

> Status: legacy reference only.
>
> Sophia production customer billing is NOWPayments + PayOS. Do not configure Polar for Sophia customer billing. Stripe may only be used for explicitly approved affiliate payout/KYC flows. Current go-live billing source of truth is `docs/admin-ops/payment-pricing-source-of-truth.md`.

## Environment Variables

Add these to your `.env.local` or deployment environment:

### Stripe Configuration

```env
# Stripe API Keys (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_...              # Test mode starts with sk_test_
STRIPE_PUBLISHABLE_KEY=pk_test_...          # Test mode starts with pk_test_

# Stripe Webhook Secret (get from webhook endpoint settings)
STRIPE_WEBHOOK_SECRET=whsec_...             # Starts with whsec_
```

### Polar Configuration

```env
# Polar.sh API Keys (get from https://dashboard.polar.sh/settings/api)
POLAR_ACCESS_TOKEN=pol_...                  # Polar API token

# Polar Webhook Secret (set in webhook configuration)
POLAR_WEBHOOK_SECRET=whsec_...              # Your webhook signing secret
```

### RaaS License Configuration

```env
# License Generation Secret (32+ characters, keep secure!)
RAAS_LICENSE_SECRET=your_32_char_secret_key_here
```

---

## Stripe Webhook Setup

### Development (Local)

1. **Install Stripe CLI:**

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Or visit: https://docs.stripe.com/stripe-cli
```

2. **Login to Stripe CLI:**

```bash
stripe login
```

3. **Start Webhook Forwarding:**

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Output will show your webhook signing secret:
```
Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

4. **Copy the webhook secret to `.env.local`:**

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

5. **Trigger Test Events:**

```bash
# Test checkout completion
stripe trigger checkout.session.completed \
  --add payment_intent:status=succeeded \
  --add metadata.tier=PREMIUM \
  --add metadata.userId=user_123

# Test subscription creation
stripe trigger customer.subscription.created \
  --add metadata.tier=PREMIUM \
  --add metadata.userId=user_123

# Test subscription cancellation
stripe trigger customer.subscription.deleted \
  --add metadata.tier=PREMIUM \
  --add metadata.userId=user_123
```

### Production (Vercel/Cloudflare)

1. **Get Production Webhook URL:**

```
https://your-domain.com/api/webhooks/stripe
```

2. **Configure Stripe Dashboard:**

   - Go to https://dashboard.stripe.com/test/webhooks (test mode)
   - Or https://dashboard.stripe.com/webhooks (live mode)
   - Click "Add endpoint"
   - Enter URL: `https://your-domain.com/api/webhooks/stripe`
   - Select events to listen to:
     - ✅ `checkout.session.completed`
     - ✅ `customer.subscription.created`
     - ✅ `customer.subscription.updated`
     - ✅ `customer.subscription.deleted`
     - ✅ `invoice.paid`
     - ✅ `invoice.payment_failed`
   - Copy the **Signing Secret** to your production environment variables

3. **Environment Variables in Vercel:**

```bash
# In Vercel Dashboard → Project Settings → Environment Variables
STRIPE_WEBHOOK_SECRET=whsec_production_secret
STRIPE_SECRET_KEY=sk_live_production_key
STRIPE_PUBLISHABLE_KEY=pk_live_production_key
```

---

## Polar Webhook Setup

### Development (Local)

1. **Get Webhook Secret from Polar Dashboard:**

   - Go to https://dashboard.polar.sh/
   - Navigate to Settings → Webhooks
   - Create new webhook or view existing
   - Copy the webhook secret

2. **Configure Local Webhook:**

Since Polar doesn't have a CLI forwarding tool like Stripe, use ngrok:

```bash
# Install ngrok
brew install ngrok

# Start ngrok tunnel
ngrok http 3000
```

3. **Configure Polar Webhook Endpoint:**

   - In Polar Dashboard → Settings → Webhooks
   - Add endpoint URL: `https://xxxx.ngrok.io/api/webhooks/polar`
   - Select events:
     - ✅ `checkout.updated`
     - ✅ `subscription.created`
     - ✅ `subscription.updated`
     - ✅ `subscription.cancelled`
     - ✅ `subscription.active`
     - ✅ `subscription.past_due`
     - ✅ `subscription.expired`
     - ✅ `order.created`
   - Save and copy the webhook secret to `.env.local`:

```bash
POLAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Production (Vercel/Cloudflare)

1. **Get Production Webhook URL:**

```
https://your-domain.com/api/webhooks/polar
```

2. **Configure Polar Dashboard:**

   - Go to https://dashboard.polar.sh/settings/webhooks
   - Add endpoint URL: `https://your-domain.com/api/webhooks/polar`
   - Select all events listed above
   - Copy the webhook secret to production environment variables

3. **Environment Variables in Vercel:**

```bash
# In Vercel Dashboard → Project Settings → Environment Variables
POLAR_WEBHOOK_SECRET=whsec_production_secret
POLAR_ACCESS_TOKEN=pol_production_token
```

---

## Event Metadata Requirements

Both Stripe and Polar webhooks require specific metadata to be passed during checkout/subscription creation for proper user linkage.

### Required Metadata Fields

```typescript
{
  userId: string        // Supabase user ID
  tier: string          // 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'
  telegram_chat_id?: string  // Optional: for Telegram notifications
}
```

### Example: Creating Checkout Session (Stripe)

```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: 'price_xxx', quantity: 1 }],
  metadata: {
    userId: 'user_123',
    tier: 'PREMIUM',
    telegram_chat_id: '123456789'
  },
  success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://example.com/cancel',
})
```

### Example: Creating Product (Polar)

```typescript
// In Polar Dashboard → Products → Create Product
// Add metadata in product settings:
{
  "userId": "user_123",
  "tier": "PREMIUM",
  "telegram_chat_id": "123456789"
}
```

---

## Testing Checklist

### Stripe Webhooks

- [ ] `checkout.session.completed` → License created, user profile updated
- [ ] `customer.subscription.created` → License created, subscription activated
- [ ] `customer.subscription.updated` → Tier changed if metadata updated
- [ ] `customer.subscription.deleted` → License revoked
- [ ] `invoice.paid` → Subscription extended
- [ ] `invoice.payment_failed` → Warning added to user profile

### Polar Webhooks

- [ ] `checkout.updated` (succeeded) → License created
- [ ] `subscription.created` → License created, subscription activated
- [ ] `subscription.updated` → Tier/status updated
- [ ] `subscription.cancelled` → License revoked
- [ ] `subscription.active` → License reactivated
- [ ] `subscription.past_due` → Warning added (7-day grace period)
- [ ] `subscription.expired` → License fully revoked
- [ ] `order.created` → License created for one-time purchase

---

## Debugging

### Check Webhook Logs

**Stripe:**
```bash
# Real-time logs
stripe logs tail

# View recent webhook attempts
stripe events list --limit 10
```

**Polar:**
- Dashboard → Settings → Webhooks → View delivery logs

### Database Queries

Check processed events:

```sql
-- Last 10 webhook events
SELECT event_type, stripe_event_id, polar_event_id, processed, created_at
FROM payment_events
ORDER BY created_at DESC
LIMIT 10;

-- Unprocessed events (should be 0)
SELECT * FROM payment_events WHERE processed = false;

-- Licenses created by webhooks
SELECT nonce, tier, metadata->>'source' as source, created_at
FROM raas_licenses
WHERE metadata->>'source' IN ('stripe-webhook', 'polar-webhook')
ORDER BY created_at DESC;
```

### Application Logs

Check server logs for webhook processing:

```bash
# Development
npm run dev

# Look for log lines like:
[Stripe] Processing webhook event { eventType: 'checkout.session.completed', ... }
[Polar] Subscription active - license reactivated { polarSubId: 'xxx' }
```

---

## Troubleshooting

### "Invalid signature" Error

**Stripe:**
1. Verify `STRIPE_WEBHOOK_SECRET` matches the one from dashboard
2. For local dev, use secret from `stripe listen` output (not dashboard)
3. Ensure raw body is passed to verification (not JSON.parsed)

**Polar:**
1. Verify `POLAR_WEBHOOK_SECRET` is correct
2. Check webhook timestamp is within 5-minute tolerance
3. Ensure signature header format matches expected pattern

### "Event already processed" Message

This is normal for idempotency - the webhook was already handled successfully.

### License Not Created

1. Check metadata contains `userId` and `tier`
2. Verify `RAAS_LICENSE_SECRET` environment variable is set
3. Check database for foreign key constraints

### User Not Found

1. Verify user exists in `user_profiles` table
2. Check metadata `userId` matches Supabase user ID
3. For Stripe, ensure `stripe_customer_id` or `stripe_subscription_id` is linked

---

## Security Best Practices

1. **Never expose webhook secrets in client-side code**
2. **Use test keys for development, live keys for production**
3. **Rotate webhook secrets periodically**
4. **Enable webhook signature verification in production**
5. **Monitor failed webhook attempts**
6. **Set up alerts for unusual activity**

---

## Resources

- [Stripe Webhook Docs](https://docs.stripe.com/webhooks)
- [Polar Webhook Docs](https://docs.polar.sh/webhooks)
- [Stripe CLI Reference](https://docs.stripe.com/stripe-cli)
- [Standard Webhooks Spec](https://standardwebhooks.com/)
