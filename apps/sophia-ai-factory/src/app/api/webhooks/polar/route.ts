import { Webhook } from 'standardwebhooks'
import { NextRequest, NextResponse } from 'next/server'
import { webhookHeaderSchema } from '@/lib/schemas'
import { processWebhookEvent } from '@/lib/payments/polar-webhook-handler'
import { PolarWebhookEvent } from '@/lib/payments/polar-types'

const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  if (!POLAR_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Configuration Error' }, { status: 500 })
  }

  const body = await request.text()

  // Validate webhook headers with Zod
  // Support both standard 'webhook-signature' and Polar's 'Polar-Signature' header
  const headerValidation = webhookHeaderSchema.safeParse({
    'webhook-id': request.headers.get('webhook-id'),
    'webhook-timestamp': request.headers.get('webhook-timestamp'),
    'webhook-signature': request.headers.get('webhook-signature'),
    'Polar-Signature': request.headers.get('Polar-Signature'),
  })

  if (!headerValidation.success) {
    return NextResponse.json({
      error: 'Invalid headers',
      details: headerValidation.error.message
    }, { status: 400 })
  }

  const {
    'webhook-id': webhookId,
    'webhook-signature': signature,
    'Polar-Signature': polarSignature,
    'webhook-timestamp': timestamp,
  } = headerValidation.data

  // Use Polar-Signature if available, fallback to webhook-signature
  // Zod refinement ensures at least one is defined
  const finalSignature = (polarSignature || signature)!

  // Verify signature with standardwebhooks
  try {
    const wh = new Webhook(POLAR_WEBHOOK_SECRET)
    try {
      wh.verify(body, {
        'webhook-id': webhookId,
        'webhook-timestamp': timestamp,
        'webhook-signature': finalSignature,
      })
    } catch (firstError) {
      const base64Secret = Buffer.from(POLAR_WEBHOOK_SECRET).toString('base64')
      try {
        const whVerify = new Webhook(base64Secret)
        whVerify.verify(body, {
          'webhook-id': webhookId,
          'webhook-timestamp': timestamp,
          'webhook-signature': finalSignature,
        })
      } catch {
        throw firstError
      }
    }
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Parse event
  let event: PolarWebhookEvent
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Process event with idempotency via modular handler
  try {
    const result = await processWebhookEvent(event, webhookId)

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
