# NOWPayments Configuration Guide

## Overview
Sophia AI Factory uses **NOWPayments** for subscription tier payments in USDT (TRC20 stablecoin). Polar.sh rejected this product due to "wellness/health" classification; NOWPayments is the primary payment provider.

## Environment Variables

Add these to your `.env.local` or Vercel environment variables:

```bash
# NOWPayments Configuration
NOWPAYMENTS_API_KEY=your_nowpayments_api_key
NOWPAYMENTS_IPN_SECRET=your_nowpayments_ipn_secret

# Backup Provider (Vietnam Domestic)
PAYOS_MERCHANT_ID=your_payos_merchant_id
PAYOS_API_KEY=your_payos_api_key
PAYOS_CHECKSUM_KEY=your_payos_checksum_key
```

## Tier → Invoice ID Mapping

Pre-create invoices in NOWPayments dashboard and store the mapping in `src/lib/clients/nowpayments-client.ts`:

| Tier | Invoice ID | Price (USD) | Name |
|------|-----------|-----------|------|
| BASIC | 5710519960 | 199 | Starter |
| PREMIUM | 4559269964 | 399 | Growth |
| ENTERPRISE | 6336799275 | 799 | Premium |
| MASTER | 5589879034 | 4999 | Master |

## Webhook Setup

### IPN Endpoint Configuration

In NOWPayments dashboard (Settings → Webhooks):

- **Webhook URL**: `https://sophia.agencyos.network/api/webhooks/nowpayments`
- **Events**: Enable `payment_finished`, `payment_partially_paid`, `payment_failed`, `payment_expired`, `payment_refunded`
- **Test**: Use NOWPayments test webhook feature before going live

### Signature Verification

All IPN requests include `x-nowpayments-sig` header containing HMAC-SHA512 signature of raw request body.

Verification logic: `/api/webhooks/nowpayments/route.ts`

```typescript
// Pseudo-code
const signature = request.headers.get('x-nowpayments-sig')
const rawBody = await request.text()
const isValid = await verifyIpnSignature(rawBody, signature, IPN_SECRET)
```

## Payment Flow

1. User selects tier on pricing page
2. App calls NOWPayments API with invoice ID
3. User is redirected to NOWPayments hosted checkout
4. User completes payment in USDT TRC20
5. NOWPayments sends IPN webhook to `/api/webhooks/nowpayments`
6. App verifies signature and:
   - If `status: finished` → Update `subscription_tier` + set `period_end` = now + 30 days
   - If `status: failed` → Log failure, notify user via email
   - If `status: refunded` → Deactivate subscription tier
7. User sees tier upgrade on dashboard

## IPN Status Handlers

### Finished (payment_status: finished)
- **Action**: Activate tier subscription
- **DB Update**: `subscription_tier = TIER`, `period_end = now + 30 days`
- **Notification**: Send "Upgrade Successful" email

### Partially Paid (payment_status: partially_paid)
- **Action**: Hold in pending state
- **Behavior**: Wait for full payment or timeout
- **Auto-refund**: After 24 hours if incomplete

### Expired (payment_status: expired)
- **Action**: No-op (no action)
- **Notification**: Send "Invoice Expired" email

### Failed (payment_status: failed)
- **Action**: Log failure, track reason
- **Notification**: Send "Payment Failed" email with retry link

### Refunded (payment_status: refunded)
- **Action**: Deactivate tier (revert to FREE tier)
- **DB Update**: `subscription_tier = 'BASIC'`, `period_end = now`
- **Notification**: Send "Subscription Cancelled" email

## Idempotency

Order IDs follow format: `sophia_{orgId}_{timestamp}`

Example: `sophia_org_12345_1712756400`

This enables idempotency tracking via `payment_events` table. If the same IPN is received multiple times, it's processed only once.

## Backup: PayOS for Vietnam

For users paying via Vietnam bank transfer (VietQR, Momo, ZaloPay):

**Fallback Logic**: If NOWPayments payment fails or user prefers local payment → redirect to PayOS

**PayOS Features**:
- Bank transfer, Momo, ZaloPay support
- VietQR code generation
- Instant settlement (D+1)

**Webhook**: `/api/webhooks/payos` (separate from NOWPayments)

## Testing

### Local Development

Mock mode: `NEXT_PUBLIC_MOCK_AI_SERVICES=true`

Mock payment service auto-approves all tier activations.

### Staging

1. Set up NOWPayments test account
2. Use test invoice IDs in `.env.local`
3. Verify webhook signature verification works with NOWPayments test payload
4. Check `payment_events` table records all IPN events

### Production

1. Create production invoices in NOWPayments dashboard
2. Update `NOWPAYMENTS_IPN_SECRET` in Vercel
3. Update invoice IDs in `nowpayments-client.ts` (or use env vars if applicable)
4. Test with real small payment ($1 USDT)
5. Monitor Sentry for webhook errors
6. Verify user tier updates on dashboard

## Troubleshooting

### Webhook Not Firing
- Check `x-nowpayments-sig` header present in request
- Verify `NOWPAYMENTS_IPN_SECRET` matches NOWPayments dashboard setting
- Check Cloudflare Workers logs for 400/500 responses

### Signature Verification Failing
- Ensure raw request body (not parsed JSON) is used for HMAC calculation
- Verify secret key is exact match (no spaces/encoding issues)
- Check timestamp in order_id is recent (within 30 days)

### User Tier Not Updating
- Check `order_id` contains valid `orgId` (format: `sophia_{orgId}_{timestamp}`)
- Verify `invoice_id` matches one of the pre-created invoices
- Check `payment_events` table for duplicate processing (idempotency)
- Review Supabase logs for RLS policy denials

## Contacts
- **NOWPayments Support**: support@nowpayments.io
- **PayOS Support** (Vietnam): support@payos.vn
