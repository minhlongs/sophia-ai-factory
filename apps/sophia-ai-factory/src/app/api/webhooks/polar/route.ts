import { Webhook } from 'standardwebhooks'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { webhookHeaderSchema } from '@/lib/schemas'
import { processWebhookEvent } from '@/lib/payments/polar-webhook-handler'
import { PolarWebhookEvent } from '@/lib/payments/polar-types'

const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET!

export async function POST(request: Request) {
  if (!POLAR_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Configuration Error' }, { status: 500 })
  }

  const headersList = await headers()
  const body = await request.text()

  // Validate webhook headers with Zod
  const headerValidation = webhookHeaderSchema.safeParse({
    'webhook-id': headersList.get('webhook-id'),
    'webhook-timestamp': headersList.get('webhook-timestamp'),
    'webhook-signature': headersList.get('webhook-signature'),
  })

  if (!headerValidation.success) {
    return NextResponse.json({ error: 'Invalid headers' }, { status: 400 })
  }

  const {
    'webhook-id': webhookId,
    'webhook-signature': signature,
    'webhook-timestamp': timestamp,
  } = headerValidation.data

  // Verify signature with standardwebhooks
  try {
    const wh = new Webhook(POLAR_WEBHOOK_SECRET)
    try {
      wh.verify(body, {
        'webhook-id': webhookId,
        'webhook-timestamp': timestamp,
        'webhook-signature': signature,
      })
    } catch (err) {
      const base64Secret = Buffer.from(POLAR_WEBHOOK_SECRET).toString('base64')
      try {
        const whVerify = new Webhook(base64Secret)
        whVerify.verify(body, {
          'webhook-id': webhookId,
          'webhook-timestamp': timestamp,
          'webhook-signature': signature,
        })
      } catch {
        throw err
      }
    }
  } catch (err) {
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
  } catch (err: unknown) {
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
