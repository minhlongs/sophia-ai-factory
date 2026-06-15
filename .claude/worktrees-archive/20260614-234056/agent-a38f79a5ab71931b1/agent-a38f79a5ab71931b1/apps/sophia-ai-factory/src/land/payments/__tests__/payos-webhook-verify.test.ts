/**
 * PayOS webhook verifier tests — verifyPayOsWebhook (raw body API).
 * Covers: valid sig → true, invalid sig → false, tampered body → false.
 * Uses real HMAC-SHA256 computation (no mocks).
 *
 * @module land/payments/__tests__/payos-webhook-verify.test
 */

import { describe, it, expect } from 'vitest'
import { verifyPayOsWebhook, payOsCanonicalize } from '../payos'

const CHECKSUM_KEY = 'test-payos-checksum-key-256'

/**
 * Compute expected PayOS HMAC-SHA256.
 * PayOS signs over sorted key=value pairs from the data sub-object.
 */
async function computeExpectedSig(rawBody: string, key: string): Promise<string> {
  const canonical = payOsCanonicalize(rawBody)
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(canonical))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const SAMPLE_IPN_DATA = {
  orderCode: 123456,
  amount: 4975000,
  description: 'sophia_user123_1700000000000',
  accountNumber: 'ACC123',
  reference: 'ref_abc',
  transactionDateTime: '2026-05-09T10:00:00Z',
  currency: 'VND',
  paymentLinkId: 'link_abc123',
  code: '00',
  desc: 'success',
}

function buildRawBody(dataObj: Record<string, unknown>): string {
  return JSON.stringify({
    code: '00',
    desc: 'success',
    success: true,
    data: dataObj,
    signature: 'placeholder', // will be computed separately
  })
}

describe('payOsCanonicalize', () => {
  it('returns sorted key=value pairs from data sub-object', () => {
    const rawBody = JSON.stringify({ data: { z: 3, a: 1, m: 2 } })
    const canonical = payOsCanonicalize(rawBody)
    expect(canonical).toBe('a=1&m=2&z=3')
  })

  it('falls back to top-level object if no data key', () => {
    const rawBody = JSON.stringify({ z: 3, a: 1 })
    const canonical = payOsCanonicalize(rawBody)
    expect(canonical).toBe('a=1&z=3')
  })
})

describe('verifyPayOsWebhook', () => {
  it('accepts valid HMAC-SHA256 over raw body (happy path)', async () => {
    const rawBody = buildRawBody(SAMPLE_IPN_DATA)
    const sig = await computeExpectedSig(rawBody, CHECKSUM_KEY)
    const result = await verifyPayOsWebhook(rawBody, sig, CHECKSUM_KEY)
    expect(result).toBe(true)
  })

  it('rejects tampered data field', async () => {
    const rawBody = buildRawBody(SAMPLE_IPN_DATA)
    const sig = await computeExpectedSig(rawBody, CHECKSUM_KEY)
    const tampered = buildRawBody({ ...SAMPLE_IPN_DATA, amount: 1 })
    const result = await verifyPayOsWebhook(tampered, sig, CHECKSUM_KEY)
    expect(result).toBe(false)
  })

  it('rejects wrong checksum key', async () => {
    const rawBody = buildRawBody(SAMPLE_IPN_DATA)
    const sig = await computeExpectedSig(rawBody, 'correct-key')
    const result = await verifyPayOsWebhook(rawBody, sig, 'wrong-key')
    expect(result).toBe(false)
  })

  it('rejects garbage signature', async () => {
    const rawBody = buildRawBody(SAMPLE_IPN_DATA)
    const result = await verifyPayOsWebhook(rawBody, 'not-a-valid-hex', CHECKSUM_KEY)
    expect(result).toBe(false)
  })
})
