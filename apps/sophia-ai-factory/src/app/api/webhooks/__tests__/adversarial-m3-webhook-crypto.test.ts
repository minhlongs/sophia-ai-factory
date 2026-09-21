/**
 * Adversarial Cryptographic Verification Test Suite for Milestone M3
 *
 * EMPIRICAL CHALLENGER M3-1:
 * Comprehensive stress testing of cryptographic signature verification across:
 * 1. NOWPayments IPN Webhook (HMAC-SHA512 with canonical sortObjectDeep)
 * 2. Telegram Webhook (X-Telegram-Bot-Api-Secret-Token)
 * 3. Static AST/Source Code Audit for Zero Mocks / Bypasses
 *
 * @module app/api/webhooks/__tests__/adversarial-m3-webhook-crypto.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createWebhookSignature, sortObjectDeep } from '@nowpaymentsio/nowpayments-sdk-nodejs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Mock downstream side-effects so route testing focuses strictly on cryptographic gates
vi.mock('@/land/billing/nowpayments-ipn-handlers', () => ({
  processNowPaymentsIpn: vi.fn().mockResolvedValue({ success: true, message: 'Processed' }),
}))

vi.mock('@/land/billing/overage-topup', () => ({
  processTopupIpn: vi.fn().mockResolvedValue({ success: true, message: 'Topup OK' }),
}))

vi.mock('@/land/commerce/commerce-payment', () => ({
  confirmCommercePayment: vi.fn().mockResolvedValue({
    ok: false,
    error: { code: 'ORDER_NOT_FOUND', message: 'Not commerce' },
  }),
}))

vi.mock('@/tree/signals/posthog-capture', () => ({
  captureTierUpgraded: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/tree/signals/track', () => ({
  track: vi.fn(),
}))

vi.mock('@/land/webhooks/emitter', () => ({
  emit: vi.fn(),
}))

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn().mockResolvedValue('BASIC'),
}))

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
  }),
  tryCreateServerClient: vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
  }),
}))

vi.mock('@/seed/r2/bucket-ops', () => ({
  writeDeadLetterToR2: vi.fn().mockResolvedValue(undefined),
  generateDeadLetterKey: vi.fn().mockReturnValue('mock-dead-letter-key'),
}))

vi.mock('@/tree/telegram/telegram-command-handlers', () => ({
  handleStart: vi.fn().mockResolvedValue(undefined),
  handleHelp: vi.fn().mockResolvedValue(undefined),
  handleEmail: vi.fn().mockResolvedValue(undefined),
  handleStatus: vi.fn().mockResolvedValue(undefined),
  handleResults: vi.fn().mockResolvedValue(undefined),
  handleSubscribe: vi.fn().mockResolvedValue(undefined),
  handleDiscover: vi.fn().mockResolvedValue(undefined),
  handleCallbackQuery: vi.fn().mockResolvedValue(undefined),
  handleCampaignList: vi.fn().mockResolvedValue(undefined),
  handleCampaignCancel: vi.fn().mockResolvedValue(undefined),
  handleAnalytics: vi.fn().mockResolvedValue(undefined),
  withMiddleware: vi.fn((_chatId: string, fn: () => Promise<void>) => fn()),
}))

vi.mock('@/tree/telegram/telegram-bot-campaign-handlers', () => ({
  handleCampaign: vi.fn().mockResolvedValue(undefined),
  handleOfferCallback: vi.fn().mockResolvedValue(undefined),
  handleConfirmCommand: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/tree/telegram/telegram-client', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/tree/telegram/pairing', () => ({
  isAllowed: vi.fn().mockResolvedValue(true),
  requestPairing: vi.fn().mockResolvedValue({ code: '123456' }),
  approvePairing: vi.fn().mockResolvedValue({ chatId: '987654' }),
  listPaired: vi.fn().mockResolvedValue([]),
  revokePairing: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/tree/telegram/pairing-token-service', () => ({
  consumePairingToken: vi.fn().mockResolvedValue({ valid: true, userId: 'u1' }),
}))

const NOWPAYMENTS_TEST_SECRET = 'adversarial_nowpayments_secret_key_999'
const NOWPAYMENTS_TEST_API_KEY = 'test_api_key_nowpayments_000'
const TELEGRAM_TEST_SECRET = 'adversarial_telegram_secret_token_abc123'
const TELEGRAM_TEST_BOT_TOKEN = '987654:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'

const AUTHENTIC_NOWPAYMENTS_PAYLOAD = {
  payment_id: 'np_pay_adversarial_123',
  payment_status: 'finished',
  pay_address: 'TXAdversarialAddress123',
  price_amount: 199,
  price_currency: 'USD',
  pay_amount: 199,
  pay_currency: 'USDTTRC20',
  order_id: 'sophia_user999_1700000000000',
  order_description: 'Sophia Pro Tier',
  invoice_id: '5710519960',
  created_at: '2026-09-21T00:00:00Z',
  updated_at: '2026-09-21T00:01:00Z',
}

function makeNowPaymentsRequest(body: string | null, sig?: string | null): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (sig !== undefined && sig !== null) {
    headers['x-nowpayments-sig'] = sig
  }
  return new NextRequest('http://localhost/api/webhooks/nowpayments', {
    method: 'POST',
    headers,
    body: body ?? undefined,
  })
}

function makeTelegramRequest(body: Record<string, unknown> | null, token?: string | null): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token !== undefined && token !== null) {
    headers['x-telegram-bot-api-secret-token'] = token
  }
  return new NextRequest('http://localhost/api/webhooks/telegram', {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. NOWPAYMENTS IPN CRYPTOGRAPHIC SIGNATURE CHALLENGE
// ═══════════════════════════════════════════════════════════════════════════

describe('Milestone M3 Challenger: NOWPayments IPN Signature Verification', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv('NOWPAYMENTS_IPN_SECRET', NOWPAYMENTS_TEST_SECRET)
    vi.stubEnv('NOWPAYMENTS_API_KEY', NOWPAYMENTS_TEST_API_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('EDGE-NP-01: rejects request with completely missing x-nowpayments-sig header with HTTP 400', async () => {
    const { POST } = await import('../nowpayments/route')
    const rawBody = JSON.stringify(AUTHENTIC_NOWPAYMENTS_PAYLOAD)
    const req = makeNowPaymentsRequest(rawBody, null)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Missing signature')
  })

  it('EDGE-NP-02: rejects request with empty string x-nowpayments-sig header with HTTP 400', async () => {
    const { POST } = await import('../nowpayments/route')
    const rawBody = JSON.stringify(AUTHENTIC_NOWPAYMENTS_PAYLOAD)
    const req = makeNowPaymentsRequest(rawBody, '')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Missing signature')
  })

  it('EDGE-NP-03: rejects empty body with HTTP 400', async () => {
    const { POST } = await import('../nowpayments/route')
    const sig = createWebhookSignature({}, NOWPAYMENTS_TEST_SECRET)
    const req = makeNowPaymentsRequest('', sig)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Invalid JSON')
  })

  it('EDGE-NP-04: rejects null/missing body with HTTP 400', async () => {
    const { POST } = await import('../nowpayments/route')
    const sig = createWebhookSignature(AUTHENTIC_NOWPAYMENTS_PAYLOAD, NOWPAYMENTS_TEST_SECRET)
    const req = makeNowPaymentsRequest(null, sig)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Invalid JSON')
  })

  it('EDGE-NP-05: rejects malformed JSON with HTTP 400 (SyntaxError)', async () => {
    const { POST } = await import('../nowpayments/route')
    const malformedBody = '{"payment_id": "test", broken_json...'
    const sig = 'a'.repeat(128)
    const req = makeNowPaymentsRequest(malformedBody, sig)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Invalid JSON')
  })

  it('EDGE-NP-06: rejects forged 128-hex-char HMAC-SHA512 signature with HTTP 400', async () => {
    const { POST } = await import('../nowpayments/route')
    const rawBody = JSON.stringify(AUTHENTIC_NOWPAYMENTS_PAYLOAD)
    const forgedSig = '0123456789abcdef'.repeat(8) // 128 chars
    const req = makeNowPaymentsRequest(rawBody, forgedSig)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Invalid signature')
  })

  it('EDGE-NP-07: rejects 1-byte mutated signature at index 0 with HTTP 400', async () => {
    const { POST } = await import('../nowpayments/route')
    const validSig = createWebhookSignature(AUTHENTIC_NOWPAYMENTS_PAYLOAD, NOWPAYMENTS_TEST_SECRET)
    const mutatedChar = validSig[0] === 'a' ? 'b' : 'a'
    const tamperedSig = mutatedChar + validSig.slice(1)

    const rawBody = JSON.stringify(AUTHENTIC_NOWPAYMENTS_PAYLOAD)
    const req = makeNowPaymentsRequest(rawBody, tamperedSig)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Invalid signature')
  })

  it('EDGE-NP-08: rejects 1-byte mutated signature at middle character (offset 64) with HTTP 400', async () => {
    const { POST } = await import('../nowpayments/route')
    const validSig = createWebhookSignature(AUTHENTIC_NOWPAYMENTS_PAYLOAD, NOWPAYMENTS_TEST_SECRET)
    const midIdx = 64
    const mutatedChar = validSig[midIdx] === 'f' ? '0' : 'f'
    const tamperedSig = validSig.slice(0, midIdx) + mutatedChar + validSig.slice(midIdx + 1)

    const rawBody = JSON.stringify(AUTHENTIC_NOWPAYMENTS_PAYLOAD)
    const req = makeNowPaymentsRequest(rawBody, tamperedSig)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Invalid signature')
  })

  it('EDGE-NP-09: rejects 1-byte mutated signature at final character (offset 127) with HTTP 400', async () => {
    const { POST } = await import('../nowpayments/route')
    const validSig = createWebhookSignature(AUTHENTIC_NOWPAYMENTS_PAYLOAD, NOWPAYMENTS_TEST_SECRET)
    const lastIdx = validSig.length - 1
    const mutatedChar = validSig[lastIdx] === 'c' ? 'd' : 'c'
    const tamperedSig = validSig.slice(0, lastIdx) + mutatedChar

    const rawBody = JSON.stringify(AUTHENTIC_NOWPAYMENTS_PAYLOAD)
    const req = makeNowPaymentsRequest(rawBody, tamperedSig)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Invalid signature')
  })

  it('EDGE-NP-10: rejects truncated signature (64 chars instead of 128 chars) with HTTP 400', async () => {
    const { POST } = await import('../nowpayments/route')
    const validSig = createWebhookSignature(AUTHENTIC_NOWPAYMENTS_PAYLOAD, NOWPAYMENTS_TEST_SECRET)
    const truncatedSig = validSig.slice(0, 64)

    const rawBody = JSON.stringify(AUTHENTIC_NOWPAYMENTS_PAYLOAD)
    const req = makeNowPaymentsRequest(rawBody, truncatedSig)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Invalid signature')
  })

  it('EDGE-NP-11: rejects signature generated with different secret with HTTP 400', async () => {
    const { POST } = await import('../nowpayments/route')
    const attackerSecret = 'attacker_malicious_secret_key_123'
    const attackerSig = createWebhookSignature(AUTHENTIC_NOWPAYMENTS_PAYLOAD, attackerSecret)

    const rawBody = JSON.stringify(AUTHENTIC_NOWPAYMENTS_PAYLOAD)
    const req = makeNowPaymentsRequest(rawBody, attackerSig)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Invalid signature')
  })

  it('EDGE-NP-12: rejects tampered financial amount (price_amount modified from 199 to 1.99) with HTTP 400', async () => {
    const { POST } = await import('../nowpayments/route')
    // Signature computed for genuine 199 USD transaction
    const genuineSig = createWebhookSignature(AUTHENTIC_NOWPAYMENTS_PAYLOAD, NOWPAYMENTS_TEST_SECRET)

    // Attacker modifies price_amount in payload
    const tamperedPayload = { ...AUTHENTIC_NOWPAYMENTS_PAYLOAD, price_amount: 1.99 }
    const req = makeNowPaymentsRequest(JSON.stringify(tamperedPayload), genuineSig)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Invalid signature')
  })

  it('EDGE-NP-13: rejects tampered status (waiting -> finished privilege escalation) with HTTP 400', async () => {
    const { POST } = await import('../nowpayments/route')
    const unpaidPayload = { ...AUTHENTIC_NOWPAYMENTS_PAYLOAD, payment_status: 'waiting' }
    const unpaidSig = createWebhookSignature(unpaidPayload, NOWPAYMENTS_TEST_SECRET)

    // Attacker intercepts and flips status to 'finished' without secret
    const tamperedPayload = { ...unpaidPayload, payment_status: 'finished' }
    const req = makeNowPaymentsRequest(JSON.stringify(tamperedPayload), unpaidSig)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Invalid signature')
  })

  it('EDGE-NP-14: handles altered payload key order via canonical sortObjectDeep', async () => {
    const { POST } = await import('../nowpayments/route')
    // NOWPayments specification requires canonical alphabetical key sorting.
    // 1. Generate signature with official SDK
    const validSig = createWebhookSignature(AUTHENTIC_NOWPAYMENTS_PAYLOAD, NOWPAYMENTS_TEST_SECRET)

    // 2. Construct reverse-ordered JSON string
    const reversedKeys = Object.keys(AUTHENTIC_NOWPAYMENTS_PAYLOAD).reverse()
    const reversedObj: Record<string, unknown> = {}
    for (const k of reversedKeys) {
      reversedObj[k] = (AUTHENTIC_NOWPAYMENTS_PAYLOAD as Record<string, unknown>)[k]
    }
    const reversedJson = JSON.stringify(reversedObj)

    // 3. Verify that the SDK's sortObjectDeep matches canonical sort
    expect(JSON.stringify(sortObjectDeep(reversedObj))).toBe(
      JSON.stringify(sortObjectDeep(AUTHENTIC_NOWPAYMENTS_PAYLOAD)),
    )

    // 4. Request with altered JSON key order succeeds through signature gate
    const req = makeNowPaymentsRequest(reversedJson, validSig)
    const res = await POST(req)
    expect(res.status).toBe(200)

    // 5. Conversely, if an attacker alters a key name in the reordered payload, it is rejected with 400
    const tamperedKeyObj: Record<string, unknown> = { ...reversedObj }
    delete tamperedKeyObj.price_amount
    tamperedKeyObj.tampered_amount = 199
    const reqTampered = makeNowPaymentsRequest(JSON.stringify(tamperedKeyObj), validSig)
    const resTampered = await POST(reqTampered)
    expect(resTampered.status).toBe(400)
  })

  it('EDGE-NP-15: rejects oversized payloads exceeding 64KB with HTTP 413 Payload Too Large', async () => {
    const { POST } = await import('../nowpayments/route')
    const bloatedPayload = {
      ...AUTHENTIC_NOWPAYMENTS_PAYLOAD,
      padding: 'x'.repeat(65 * 1024), // 65KB string padding
    }
    const sig = createWebhookSignature(bloatedPayload, NOWPAYMENTS_TEST_SECRET)
    const req = makeNowPaymentsRequest(JSON.stringify(bloatedPayload), sig)
    const res = await POST(req)

    expect(res.status).toBe(413)
    const data = (await res.json()) as { error: string }
    expect(data.error).toMatch(/Payload too large/i)
  })

  it('EDGE-NP-16: fails closed with HTTP 500 if NOWPAYMENTS_IPN_SECRET is missing', async () => {
    vi.stubEnv('NOWPAYMENTS_IPN_SECRET', '')
    const { POST } = await import('../nowpayments/route')
    const rawBody = JSON.stringify(AUTHENTIC_NOWPAYMENTS_PAYLOAD)
    const req = makeNowPaymentsRequest(rawBody, 'any-sig')
    const res = await POST(req)

    expect(res.status).toBe(500)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Configuration error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. TELEGRAM WEBHOOK SECRET TOKEN CHALLENGE
// ═══════════════════════════════════════════════════════════════════════════

describe('Milestone M3 Challenger: Telegram Webhook Secret Token Verification', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv('TELEGRAM_BOT_TOKEN', TELEGRAM_TEST_BOT_TOKEN)
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', TELEGRAM_TEST_SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('EDGE-TG-01: rejects request with missing X-Telegram-Bot-Api-Secret-Token with HTTP 401 Unauthorized', async () => {
    const { POST } = await import('../telegram/route')
    const req = makeTelegramRequest({ message: { text: '/help', chat: { id: 12345 } } }, null)
    const res = await POST(req)

    expect(res.status).toBe(401)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Unauthorized')
  })

  it('EDGE-TG-02: rejects request with empty token string with HTTP 401 Unauthorized', async () => {
    const { POST } = await import('../telegram/route')
    const req = makeTelegramRequest({ message: { text: '/help', chat: { id: 12345 } } }, '')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Unauthorized')
  })

  it('EDGE-TG-03: rejects request with forged/tampered token with HTTP 401 Unauthorized', async () => {
    const { POST } = await import('../telegram/route')
    const forgedToken = 'attacker_forged_secret_token_xyz999'
    const req = makeTelegramRequest({ message: { text: '/help', chat: { id: 12345 } } }, forgedToken)
    const res = await POST(req)

    expect(res.status).toBe(401)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Unauthorized')
  })

  it('EDGE-TG-04: rejects request with 1-character difference in secret token with HTTP 401', async () => {
    const { POST } = await import('../telegram/route')
    const lastChar = TELEGRAM_TEST_SECRET.slice(-1)
    const alteredToken = TELEGRAM_TEST_SECRET.slice(0, -1) + (lastChar === '3' ? '4' : '3')
    const req = makeTelegramRequest({ message: { text: '/start', chat: { id: 12345 } } }, alteredToken)
    const res = await POST(req)

    expect(res.status).toBe(401)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Unauthorized')
  })

  it('EDGE-TG-05: rejects token with inverted casing (strict case sensitivity) with HTTP 401', async () => {
    const { POST } = await import('../telegram/route')
    const upperToken = TELEGRAM_TEST_SECRET.toUpperCase()
    const req = makeTelegramRequest({ message: { text: '/help', chat: { id: 12345 } } }, upperToken)
    const res = await POST(req)

    expect(res.status).toBe(401)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Unauthorized')
  })

  it('EDGE-TG-06a: rejects whitespace-only secret token header with HTTP 401', async () => {
    const { POST } = await import('../telegram/route')
    // HTTP Headers trims '   ' to ''
    const req = makeTelegramRequest({ message: { text: '/help', chat: { id: 12345 } } }, '   ')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Unauthorized')
  })

  it('EDGE-TG-06b: rejects internal whitespace injection in secret token with HTTP 401', async () => {
    const { POST } = await import('../telegram/route')
    const splitPoint = Math.floor(TELEGRAM_TEST_SECRET.length / 2)
    const tamperedToken = `${TELEGRAM_TEST_SECRET.slice(0, splitPoint)} ${TELEGRAM_TEST_SECRET.slice(splitPoint)}`
    const req = makeTelegramRequest({ message: { text: '/help', chat: { id: 12345 } } }, tamperedToken)
    const res = await POST(req)

    expect(res.status).toBe(401)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Unauthorized')
  })

  it('EDGE-TG-06c: rejects token with appended suffix with HTTP 401', async () => {
    const { POST } = await import('../telegram/route')
    const req = makeTelegramRequest({ message: { text: '/help', chat: { id: 12345 } } }, `${TELEGRAM_TEST_SECRET}_tampered`)
    const res = await POST(req)

    expect(res.status).toBe(401)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Unauthorized')
  })

  it('EDGE-TG-07: fails closed with HTTP 500 when TELEGRAM_WEBHOOK_SECRET is unconfigured', async () => {
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', '')
    const { POST } = await import('../telegram/route')
    const req = makeTelegramRequest({ message: { text: '/help', chat: { id: 12345 } } }, TELEGRAM_TEST_SECRET)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Webhook secret not configured')
  })

  it('EDGE-TG-08: enters dormant mode and returns HTTP 200 when TELEGRAM_BOT_TOKEN is unset', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '')
    const { POST } = await import('../telegram/route')
    const req = makeTelegramRequest({ update_id: 1 }, null)
    const res = await POST(req)

    expect(res.status).toBe(200)
    const data = (await res.json()) as { ok: boolean }
    expect(data.ok).toBe(true)
  })

  it('EDGE-TG-09: accepts authentic secret token and routes text message with HTTP 200', async () => {
    const { POST } = await import('../telegram/route')
    const req = makeTelegramRequest(
      { message: { text: '/help', chat: { id: 12345678, first_name: 'Adversary' } } },
      TELEGRAM_TEST_SECRET,
    )
    const res = await POST(req)

    expect(res.status).toBe(200)
    const data = (await res.json()) as { ok: boolean }
    expect(data.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. ZERO-MOCK AND HARDCODED BYPASS CODEBASE AUDIT
// ═══════════════════════════════════════════════════════════════════════════

describe('Milestone M3 Challenger: Zero-Mock and Hardcoded Signature Bypass Verification', () => {
  it('EDGE-AUDIT-01: NOWPayments webhook route contains zero test-mode signature bypasses', () => {
    const routePath = resolve(__dirname, '../nowpayments/route.ts')
    const routeContent = readFileSync(routePath, 'utf8')

    // 1. Must never bypass signature in test or development environments
    expect(routeContent).not.toMatch(/if\s*\(.*NODE_ENV\s*===?\s*['"]test['"].*\)\s*return/i)
    expect(routeContent).not.toMatch(/if\s*\(.*NODE_ENV\s*===?\s*['"]development['"].*\)\s*return/i)
    expect(routeContent).not.toMatch(/bypassSignature|skipSignature|skipVerification/i)

    // 2. Must always enforce signature header extraction and parseIpnWebhook
    expect(routeContent).toContain("request.headers.get('x-nowpayments-sig')")
    expect(routeContent).toContain("parseIpnWebhook(rawPayload, signature)")
    expect(routeContent).toContain("status: 400")
  })

  it('EDGE-AUDIT-02: Telegram webhook route contains zero secret bypasses or backdoors', () => {
    const routePath = resolve(__dirname, '../telegram/route.ts')
    const routeContent = readFileSync(routePath, 'utf8')

    // 1. Must never bypass secret verification based on NODE_ENV
    expect(routeContent).not.toMatch(/if\s*\(.*NODE_ENV\s*===?\s*['"]test['"].*\)\s*return/i)
    expect(routeContent).not.toMatch(/bypassSecret|skipSecret|skipAuth/i)

    // 2. Must enforce secret header comparison against TELEGRAM_WEBHOOK_SECRET
    expect(routeContent).toContain("request.headers.get('X-Telegram-Bot-Api-Secret-Token')")
    expect(routeContent).toContain("token !== webhookSecret")
    expect(routeContent).toContain("status: 401")
  })

  it('EDGE-AUDIT-03: nowpayments-client enforces hardcoded { verify: true } during webhook parsing', () => {
    const clientPath = resolve(__dirname, '../../../../tree/clients/nowpayments-client.ts')
    const clientContent = readFileSync(clientPath, 'utf8')

    // verify: true must be present and never set to false
    expect(clientContent).toContain("sdk.parseWebhook(payload, signature, { verify: true })")
    expect(clientContent).not.toMatch(/sdk\.parseWebhook\([^,]+,\s*[^,]+,\s*\{\s*verify:\s*false\s*\}\)/)
  })
})
