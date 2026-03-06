import { NextRequest, NextResponse } from 'next/server'
import { processStripeWebhookEvent } from '@/lib/payments/stripe-webhook-handler'
import { verifyStripeWebhook } from '@/lib/payments/stripe-webhook-verify'
import Stripe from 'stripe'

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  if (!STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Configuration Error' }, { status: 500 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  // Validate signature header exists
  if (!signature) {
    return NextResponse.json({
      error: 'Missing Stripe-Signature header'
    }, { status: 400 })
  }

  // Verify webhook signature using official Stripe SDK
  let event: Stripe.Event
  try {
    const verifiedEvent = verifyStripeWebhook(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    )

    if (!verifiedEvent) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    event = verifiedEvent
  } catch (error) {
    return NextResponse.json({
      error: 'Signature verification failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 })
  }

  // Process event with idempotency via modular handler
  try {
    const result = await processStripeWebhookEvent(event, body)

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    return NextResponse.json({
      error: 'Processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
