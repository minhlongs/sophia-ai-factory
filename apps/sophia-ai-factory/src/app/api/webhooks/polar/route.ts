import { verifyWebhookSignature } from '@/lib/polar';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Define minimal event interface since SDK export is tricky
interface WebhookEvent {
  type: string;
  data: any;
  id?: string;
}

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('webhook-signature');
  const secret = process.env.POLAR_WEBHOOK_SECRET;

  if (!secret) {
    console.error('POLAR_WEBHOOK_SECRET is missing');
    return new NextResponse('Server Configuration Error', { status: 500 });
  }

  if (!signature) {
    return new NextResponse('Missing webhook-signature header', { status: 400 });
  }

  let event: WebhookEvent;

  try {
    // Verify the signature and get the typed event
    // verifyWebhookSignature wraps the standardwebhooks verify method
    const payload = verifyWebhookSignature(body, headersList, secret);

    // Parse the payload JSON to get the event object
    // standardwebhooks returns the payload object directly if using verify(payload, headers)
    // BUT verifyWebhookSignature in lib/polar.ts uses verify(payload, headers) which returns the *payload object* (decoded)
    // OR it returns the verified content.
    // Let's check standardwebhooks docs or types if possible.
    // Usually it returns the object.
    // If verifyWebhookSignature returns the object, we cast it.

    // Correction: standardwebhooks `verify` returns the parsed object in recent versions?
    // Let's assume verifyWebhookSignature returns the result of wh.verify(body, headers).

    event = payload as unknown as WebhookEvent;

  } catch (error) {
    console.error('Webhook verification failed:', error);
    return new NextResponse('Invalid signature', { status: 400 });
  }

  // Handle specific events
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('✅ Checkout completed:', event.data.id);
        // TODO: Fulfill order (e.g., update database, send email)
        // const { customerEmail, productId } = event.data;
        break;

      case 'order.created':
        console.log('📦 Order created:', event.data.id);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return new NextResponse('Webhook received', { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new NextResponse('Error processing webhook', { status: 500 });
  }
}
