/**
 * NOWPayments IPN Webhook Route
 * Verifies x-nowpayments-sig header with HMAC-SHA512, then routes to IPN handlers
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseIpnWebhook, lookupInvoice } from '@/tree/clients/nowpayments-client'
import { processNowPaymentsIpn } from '@/land/billing/nowpayments-ipn-handlers'
import { processTopupIpn } from '@/land/billing/overage-topup'
import { ipnPayloadSchema } from '@/land/billing/ipn-payload-schema'
import { logger } from '@/seed/utils/logger-utility'
import { captureTierUpgraded } from '@/tree/signals/posthog-capture'
import { track } from '@/tree/signals/track'
import { D1Events } from '@/tree/signals/d1-event-types'
import { emit } from '@/land/webhooks/emitter'
import { resolveUserTier } from '@/seed/db/resolve-user-tier'
import { getD1 } from '@/seed/db/client'

function getCloudflareEnv(): Record<string, unknown> | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env
    if (env) return env
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')]
    return ctx?.env ?? null
  } catch {
    return null
  }
}

function getNowPaymentsIpnSecret(): string | null {
  const env = getCloudflareEnv()
  const secret = env?.NOWPAYMENTS_IPN_SECRET
  if (typeof secret === 'string') return secret
  return process.env.NOWPAYMENTS_IPN_SECRET ?? null
}

const MAX_BODY_BYTES = 64 * 1024 // 64KB limit — prevent memory exhaustion

/** Health check — ensures webhook endpoint is reachable */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'nowpayments-ipn',
    timestamp: new Date().toISOString(),
    methods: ['POST'],
  })
}

export async function POST(request: NextRequest) {
const nowPaymentsIpnSecret = getNowPaymentsIpnSecret()
if (!nowPaymentsIpnSecret) {
logger.error('[NOWPayments Webhook] NOWPAYMENTS_IPN_SECRET not configured')
return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
}

// Read body with size limit (reject oversized payloads with 413)
let rawBody = ''
try {
const reader = request.body?.getReader()
if (reader) {
const chunks: Uint8Array[] = []
let totalSize = 0
while (true) {
const { done, value } = await reader.read()
if (done) break
totalSize += value.byteLength
if (totalSize > MAX_BODY_BYTES) {
logger.warn('[NOWPayments Webhook] Payload too large', { size: totalSize })
return NextResponse.json({ error: 'Payload too large (max 64KB)' }, { status: 413 })
}
chunks.push(value)
}
rawBody = new TextDecoder().decode(
chunks.reduce((acc, chunk) => {
const merged = new Uint8Array(acc.byteLength + chunk.byteLength)
merged.set(acc, 0)
merged.set(chunk, acc.byteLength)
return merged
}, new Uint8Array(0)),
)
}
} catch {
return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 })
}

// Verify IPN signature from x-nowpayments-sig header
const signature = request.headers.get('x-nowpayments-sig')
if (!signature) {
logger.warn('[NOWPayments Webhook] Missing x-nowpayments-sig header')
return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
}

// Parse JSON body
let rawPayload: Record<string, unknown>
try {
rawPayload = JSON.parse(rawBody) as Record<string, unknown>
} catch {
return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
}

// SDK parseWebhook handles signature verification + parsing in one call
let sdkResult: ReturnType<typeof parseIpnWebhook>
try {
sdkResult = parseIpnWebhook(rawPayload, signature)
} catch (err) {
logger.warn('[NOWPayments Webhook] SDK verification failed', { error: String(err) })
return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
}

// Defense-in-depth: Zod validation still applied after SDK parsing
const parsed = ipnPayloadSchema.safeParse(sdkResult)
if (!parsed.success) {
logger.warn('[NOWPayments Webhook] Invalid payload shape', { errors: parsed.error.flatten() })
return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
}

const ipn = parsed.data

// Route top-up orders (order_id prefixed "topup_") to the top-up handler
if (ipn.order_id?.startsWith('topup_')) {
const topupResult = await processTopupIpn({
payment_id: ipn.payment_id,
payment_status: ipn.payment_status,
order_id: ipn.order_id,
price_amount: ipn.price_amount,
price_currency: ipn.price_currency,
})

if (!topupResult.success) {
logger.error('[NOWPayments Webhook] Top-up IPN processing failed', new Error(topupResult.message), {
payment_id: ipn.payment_id,
payment_status: ipn.payment_status,
order_id: ipn.order_id,
})
return NextResponse.json({ error: topupResult.message }, { status: 500 })
}

return NextResponse.json({ received: true })
}

// Process the IPN event (subscriptions, one-time purchases)
const result = await processNowPaymentsIpn(ipn)

if (!result.success) {
logger.error('[NOWPayments Webhook] IPN processing failed', new Error(result.message), {
payment_id: ipn.payment_id,
payment_status: ipn.payment_status,
})
track(D1Events.PAYMENT_FAILED, 'webhook', { provider: 'nowpayments', payment_id: ipn.payment_id, reason: result.message })
return NextResponse.json({ error: result.message }, { status: 500 })
}

// RED-TEAM #11: emit tier_upgraded server-side only — single trust boundary
if (ipn.payment_status === 'finished' && ipn.order_id) {
const userId = ipn.order_id.split('_')[1] ?? ipn.order_id

// Resolve tier name from invoice lookup (not raw invoice_id string)
const tierLookup = ipn.invoice_id ? lookupInvoice(ipn.invoice_id) : null
const tierName = (tierLookup?.kind === 'subscription') ? tierLookup.tier : 'unknown'

void captureTierUpgraded({ distinctId: userId, tier: tierName, amount: ipn.price_amount, currency: ipn.price_currency }).catch((e) => logger.warn('[NOWPayments Webhook] captureTierUpgraded failed', { error: String(e) }))
track(D1Events.PAYMENT_SUCCESS, 'webhook', { amount_usd: ipn.price_amount, currency: ipn.price_currency, provider: 'nowpayments', payment_id: ipn.payment_id }, userId)

// resolveUserTier can throw if D1 binding unavailable in webhook context — guard it
let fromTier: string = 'unknown'
try {
fromTier = await resolveUserTier(userId)
} catch (tierErr) {
logger.warn('[NOWPayments Webhook] resolveUserTier failed, using fallback', tierErr instanceof Error ? tierErr : new Error(String(tierErr)))
}
track(D1Events.TIER_CONVERSION, userId, { from_tier: fromTier, to_tier: tierName, amount_usd: ipn.price_amount, provider: 'nowpayments' }, userId)

// Emit outbound webhook event (fire-and-forget)
const db = getD1();
if (db) {
emit({ DB: db }, 'payment.received', {
tenantId: userId,
amountUsd: ipn.price_amount,
tier: tierName,
paymentId: ipn.payment_id,
paidAt: new Date().toISOString(),
}, userId);
}
}

return NextResponse.json({ received: true })
}
