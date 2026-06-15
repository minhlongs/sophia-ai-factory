# Research: Polar SDK Integration (One-Time Payments)

## 1. SDK Setup & Authentication
Use `@polar-sh/sdk` for server-side operations.

```typescript
import { Polar } from '@polar-sh/sdk'

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: 'sandbox' // or 'production'
})
```

## 2. One-Time Product Creation
Create products programmatically or use dashboard IDs. For one-time purchases (e.g., $1,200), ensure `recurring_interval` is null.

```typescript
// Create a one-time product
const product = await polar.products.create({
  organizationId: 'org_...',
  name: 'Sophia AI - Enterprise License',
  prices: [
    {
      amountType: 'fixed',
      priceAmount: 120000, // $1,200.00 in cents
      priceCurrency: 'usd',
    }
  ]
  // recurringInterval is omitted for one-time
})
```

## 3. Checkout Session
Create a checkout session for the product.

```typescript
const checkout = await polar.checkouts.create({
  productId: 'product_...',
  successUrl: 'https://sophia.ai/checkout/success?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl: 'https://sophia.ai/pricing',
  customerEmail: 'customer@example.com', // Optional: pre-fill
})

// Redirect user to checkout.url
```

## 4. Webhook Handling
Handle `order.created` (pending) and `checkout.session.completed`. The key event for fulfillment is usually `order.created` or a specific payment success event.

**Events:**
- `checkout.session.completed`: Payment successful.
- `order.created`: Order generated.

## 5. Webhook Verification
Verify signatures using `WebhookVerification` class or manual HMAC.

```typescript
import { Webhooks } from '@polar-sh/sdk'

const webhook = new Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!
})

// In Next.js Route Handler
export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('Polar-Webhook-Signature')

  try {
    const event = webhook.verify(body, signature!)

    if (event.type === 'checkout.session.completed') {
       // Fulfill order
    }
  } catch (err) {
    return new Response('Invalid signature', { status: 400 })
  }
}
```

## Unresolved Questions
- Confirm exact field names for `one-time` vs `recurring` in current SDK version (API changes frequently).
- specific `expand` parameters needed for checkout retrieval to get customer details?
