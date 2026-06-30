/**
 * Contract tests: NOWPayments IPN Webhook Route
 *
 * Verifies HTTP response contracts for the POST /api/webhooks/nowpayments route:
 * - Method restriction (GET allowed for health, others rejected)
 * - Body parsing (no body, malformed JSON)
 * - Signature verification (missing/invalid signature)
 * - Valid IPN processing returns 200
 * - Idempotency: duplicate IPN returns 200 (not 500)
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Hoisted mocks for dependencies
const { mockVerifyIpnSignature, mockProcessIpn, mockLogger } = vi.hoisted(() => ({
  mockVerifyIpnSignature: vi.fn(),
  mockProcessIpn: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/tree/clients/nowpayments-client', () => ({
  verifyIpnSignature: mockVerifyIpnSignature,
  lookupInvoice: vi.fn(),
}))

vi.mock('@/land/billing/nowpayments-ipn-handlers', () => ({
  processNowPaymentsIpn: mockProcessIpn,
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mockLogger,
}))

vi.mock('@/tree/signals/posthog-capture', () => ({
  captureTierUpgraded: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/tree/signals/track', () => ({ track: vi.fn() }))
vi.mock('@/tree/signals/d1-event-types', () => ({ D1Events: {} }))
vi.mock('@/land/webhooks/emitter', () => ({ emit: vi.fn() }))
vi.mock('@/seed/db/resolve-user-tier', () => ({ resolveUserTier: vi.fn().mockResolvedValue('BASIC') }))
vi.mock('@/seed/db/client', () => ({ getD1: vi.fn(() => ({ prepare: vi.fn() })) }))
vi.mock('@/land/billing/ipn-payload-schema', () => {
  const { z } = require('zod')
  const schema = z.object({
    payment_id: z.string().min(1),
    payment_status: z.enum(['waiting', 'confirming', 'confirmed', 'sending', 'partially_paid', 'finished', 'failed', 'refunded', 'expired']),
    pay_address: z.string().optional(),
    price_amount: z.number().positive(),
    price_currency: z.string().min(1),
    pay_amount: z.number().optional(),
    pay_currency: z.string().optional(),
    order_id: z.string().optional(),
    order_description: z.string().optional(),
    invoice_id: z.string().optional(),
    actually_paid: z.number().optional(),
    outcome_amount: z.number().optional(),
    outcome_currency: z.string().optional(),
    customer_email: z.string().email().optional(),
  })
  return { ipnPayloadSchema: schema }
})

const TEST_SECRET = 'test-ipn-secret-sha512'
const VALID_PAYLOAD = JSON.stringify({
  payment_id: 'test-payment-123',
  payment_status: 'finished',
  price_amount: 199,
  price_currency: 'USD',
  order_id: 'sophia_user123_1700000000000',
  invoice_id: '5710519960',
})

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('NOWPAYMENTS_IPN_SECRET', TEST_SECRET)
  mockVerifyIpnSignature.mockReset()
  mockProcessIpn.mockReset()
  mockVerifyIpnSignature.mockResolvedValue(true)
  mockProcessIpn.mockResolvedValue({ success: true, message: 'Processed finished' })
})

function makePostRequest(body: string | null, sig: string | null): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (sig !== null) headers['x-nowpayments-sig'] = sig
  return new NextRequest('http://localhost/api/webhooks/nowpayments', {
    method: 'POST',
    headers,
    body,
  })
}

describe('contract: HTTP method restrictions', () => {
  it('returns 200 for GET request (health check)', async () => {
    const { GET } = await import('../route')
    const req = new NextRequest('http://localhost/api/webhooks/nowpayments', { method: 'GET' })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string }
    expect(body.status).toBe('ok')
  })
})

describe('contract: POST body parsing', () => {
  it('returns 400 for requests with no body', async () => {
    const { POST } = await import('../route')
    const req = makePostRequest(null, 'any-sig')
    const res = await POST(req)
    expect(res.status).toBe(400)
    // Route tries JSON.parse('') which throws "Invalid JSON"
  })

  it('returns 400 for requests with malformed JSON body', async () => {
    const { POST } = await import('../route')
    const req = makePostRequest('this is not json', 'some-sig')
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/json/i)
  })
})

describe('contract: signature verification', () => {
  it('returns 400 when x-nowpayments-sig header is missing', async () => {
    const { POST } = await import('../route')
    const req = makePostRequest(VALID_PAYLOAD, null)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/missing signature/i)
  })

  it('returns 400 when signature verification fails', async () => {
    mockVerifyIpnSignature.mockResolvedValue(false)
    const { POST } = await import('../route')
    const req = makePostRequest(VALID_PAYLOAD, 'invalid-signature')
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/invalid signature/i)
  })
})

describe('contract: valid IPN processing', () => {
  it('returns 200 for valid IPN with correct signature and payload', async () => {
    const { POST } = await import('../route')
    const req = makePostRequest(VALID_PAYLOAD, 'valid-sig')
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json() as { received: boolean }
    expect(body.received).toBe(true)
  })

  it('returns 500 when IPN processing fails', async () => {
    mockProcessIpn.mockResolvedValue({ success: false, message: 'Processing error' })
    const { POST } = await import('../route')
    const req = makePostRequest(VALID_PAYLOAD, 'valid-sig')
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/processing error/i)
  })

  it('returns 400 when payload schema validation fails', async () => {
    const badPayload = JSON.stringify({ payment_id: '', payment_status: 'invalid', price_amount: -1, price_currency: '' })
    const { POST } = await import('../route')
    const req = makePostRequest(badPayload, 'valid-sig')
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/invalid payload/i)
  })
})

describe('contract: idempotency', () => {
  beforeEach(() => {
    mockProcessIpn.mockReset()
    mockProcessIpn.mockResolvedValue({ success: true, message: 'Processed finished' })
  })

  it('duplicate IPN with same payment_id returns 200 (not 500)', async () => {
    const { POST } = await import('../route')
    const payload = VALID_PAYLOAD
    const req1 = makePostRequest(payload, 'valid-sig')
    const res1 = await POST(req1)
    expect(res1.status).toBe(200)

    // Second request with same payload — should return 200, not 500
    const req2 = makePostRequest(payload, 'valid-sig')
    const res2 = await POST(req2)
    expect(res2.status).toBe(200)
  })
})
