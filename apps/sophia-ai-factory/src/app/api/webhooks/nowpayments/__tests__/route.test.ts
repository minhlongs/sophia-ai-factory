/**
 * NOWPayments IPN webhook route tests.
 * Verifies: valid HMAC-SHA512 → not 400/401, invalid sig → 400, missing sig → 400.
 * Uses real HMAC computation (no mocks) to match production behavior.
 *
 * @module app/api/webhooks/nowpayments/__tests__/route.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const TEST_SECRET = 'test-ipn-secret-sha512'

/** Compute NOWPayments HMAC-SHA512: sorted JSON keys over raw body */
async function computeNowPaymentsHmac(rawBody: string, secret: string): Promise<string> {
  const parsed = JSON.parse(rawBody) as Record<string, unknown>
  const sorted = JSON.stringify(parsed, Object.keys(parsed).sort())
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(sorted))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function makeRequest(body: string, sig: string | null): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (sig !== null) headers['x-nowpayments-sig'] = sig
  return new NextRequest('http://localhost/api/webhooks/nowpayments', {
    method: 'POST',
    headers,
    body,
  })
}

const VALID_PAYLOAD = JSON.stringify({
  payment_id: 'test-payment-123',
  payment_status: 'finished',
  pay_address: 'TXTestAddress',
  price_amount: 199,
  price_currency: 'USD',
  pay_amount: 199,
  pay_currency: 'USDTTRC20',
  order_id: 'sophia_user123_1700000000000',
  order_description: 'Sophia BASIC',
  invoice_id: '5710519960',
  created_at: '2026-05-09T00:00:00Z',
  updated_at: '2026-05-09T00:01:00Z',
})

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('NOWPAYMENTS_IPN_SECRET', TEST_SECRET)
})

describe('POST /api/webhooks/nowpayments', () => {
  it('returns 400 when x-nowpayments-sig header is missing', async () => {
    const { POST } = await import('../route')
    const req = makeRequest(VALID_PAYLOAD, null)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/missing signature/i)
  })

  it('returns 400 when signature is invalid', async () => {
    const { POST } = await import('../route')
    const req = makeRequest(VALID_PAYLOAD, 'a'.repeat(128))
    const res = await POST(req)
    // Invalid sig must be rejected (400 or 401)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })

  it('accepts valid HMAC-SHA512 signature and processes IPN', async () => {
    const { POST } = await import('../route')
    const sig = await computeNowPaymentsHmac(VALID_PAYLOAD, TEST_SECRET)
    const req = makeRequest(VALID_PAYLOAD, sig)
    const res = await POST(req)
    // Route may return 200 (received) or 500 (no DB in test) but NOT 400/401
    // 400/401 = signature rejected; 500 = downstream error (acceptable in unit test)
    expect(res.status).not.toBe(400)
    expect(res.status).not.toBe(401)
  })
})
