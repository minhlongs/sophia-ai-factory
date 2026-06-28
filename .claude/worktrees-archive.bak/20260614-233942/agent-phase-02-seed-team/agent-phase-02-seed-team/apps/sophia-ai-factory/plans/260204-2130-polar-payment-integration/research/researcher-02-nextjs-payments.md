# Next.js 16 App Router Payment Integration Best Practices

## 1. API Route Handlers
In Next.js 16 App Router, payment webhooks and checkout sessions should be handled via **Route Handlers** (`route.ts`).

### Webhook Handler Structure
Located at `app/api/webhooks/polar/route.ts`:

**Key Library**: Polar uses the [Standard Webhooks](https://www.standardwebhooks.com/) specification. Use the `standard-webhooks` package for verification.

```typescript
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'standard-webhooks';
import { WebhookEvent } from '@polar-sh/sdk/models/components'; // Verify import path in SDK

export async function POST(request: Request) {
  // 1. Get raw body for signature verification (CRITICAL)
  // standard-webhooks requires the raw text body
  const body = await request.text();
  const headersList = await headers();

  // 2. Get the signature from 'webhook-signature' header
  // Note: Standard Webhooks uses 'webhook-signature', not 'polar-webhook-signature'
  const signature = headersList.get('webhook-signature');

  if (!signature) {
    return new NextResponse('Missing signature', { status: 400 });
  }

  // 3. Verify signature
  const wh = new Webhook(process.env.POLAR_WEBHOOK_SECRET!);

  try {
    // verify() throws an error if invalid
    const event = wh.verify(body, headersList) as WebhookEvent;

    // 4. Process event
    await handleEvent(event);

    return new NextResponse('Webhook received', { status: 200 });
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return new NextResponse('Invalid signature', { status: 400 });
  }
}
```

### Checkout Session Handler
Located at `app/api/checkout/route.ts`:
```typescript
import { Polar } from '@polar-sh/sdk';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN });
  const { priceId } = await request.json();

  // Create checkout session
  const checkout = await polar.checkouts.create({
    priceId,
    successUrl: `${process.env.NEXT_PUBLIC_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
  });

  return NextResponse.json({ url: checkout.url });
}
```

## 2. Environment Variable Management
Secure keys must never be exposed to the client.

- **POLAR_ACCESS_TOKEN**: Server-side only. Used for API requests.
- **POLAR_WEBHOOK_SECRET**: Server-side only. Used to verify webhook signatures. Starts with `whsec_`.
- **NEXT_PUBLIC_POLAR_PUBLISHABLE_KEY**: Public. Only needed if using client-side components (uncommon for pure checkout flows).

**Recommendation**: Use a `validateEnv()` script (e.g., using `zod` or `t3-env`) to ensure these exist at build time.

## 3. Security & Best Practices
- **Standard Webhooks**: Polar strictly follows the Standard Webhooks spec.
  - **Algorithm**: HMAC-SHA256.
  - **Header**: `webhook-signature`.
  - **Timestamp**: Included in the signature to prevent replay attacks.
- **Raw Body**: You MUST read `request.text()` before any parsing.
- **Idempotency**: Store processed `event.id` (or `webhook_id`) in your database to prevent duplicate processing.

## 4. Error Handling & Retries
- **Retry Policy**: Polar webhooks typically follow an exponential backoff schedule (e.g., immediate, 1m, 5m, 30m, ... up to 3 days) for non-2xx responses.
- **Timeouts**: Vercel functions default to 10-60s. For long-running processes (e.g., provisioning complex resources), push the job to a queue (Inngest, Trigger.dev) and return 200 immediately.

## 5. TypeScript Integration
Use the official SDK for event types.

```typescript
import { WebhookEvent } from '@polar-sh/sdk/models/components';

async function handleEvent(event: WebhookEvent) {
  switch (event.type) {
    case 'subscription.created':
      // data is typed as SubscriptionCreated
      await grantAccess(event.data.userId, event.data.subscriptionId);
      break;
    case 'pledge.created':
      console.log('New pledge:', event.data.amount);
      break;
    default:
      console.log('Unhandled event type:', event.type);
  }
}
```

## Unresolved Questions
- None. (Polar usage of Standard Webhooks is confirmed).
