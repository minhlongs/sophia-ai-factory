/**
 * NOWPayments HMAC-SHA512 verification edge cases.
 * Tests verifyIpnSignature against known valid + invalid inputs.
 */

import { describe, it, expect } from 'vitest'
import { verifyIpnSignature } from '@/tree/clients/nowpayments-client'

const SECRET = 'test-secret-key-for-unit-tests'

/**
 * Compute HMAC-SHA512 the same way verifyIpnSignature does (for test setup).
 */
async function computeHmac(rawBody: string, secret: string): Promise<string> {
  const parsed = JSON.parse(rawBody) as Record<string, unknown>
  const sorted = JSON.stringify(parsed, Object.keys(parsed).sort())
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(sorted))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

describe('verifyIpnSignature', () => {
  it('accepts a valid signature', async () => {
    const body = JSON.stringify({ payment_id: '123', payment_status: 'finished', amount: 399 })
    const sig = await computeHmac(body, SECRET)
    expect(await verifyIpnSignature(body, sig, SECRET)).toBe(true)
  })

  it('rejects a tampered body (single byte change)', async () => {
    const body = JSON.stringify({ payment_id: '123', payment_status: 'finished', amount: 399 })
    const sig = await computeHmac(body, SECRET)
    const tampered = body.replace('399', '400')
    expect(await verifyIpnSignature(tampered, sig, SECRET)).toBe(false)
  })

  it('rejects wrong secret', async () => {
    const body = JSON.stringify({ payment_id: '123', payment_status: 'finished' })
    const sig = await computeHmac(body, SECRET)
    expect(await verifyIpnSignature(body, sig, 'wrong-secret')).toBe(false)
  })

  it('rejects mismatched signature length', async () => {
    const body = JSON.stringify({ payment_id: '123' })
    expect(await verifyIpnSignature(body, 'tooshort', SECRET)).toBe(false)
  })

  it('handles key-reordered JSON (signature is order-agnostic)', async () => {
    // Same data, different key order — sorted JSON must match
    const body1 = JSON.stringify({ b: 2, a: 1 })
    const body2 = JSON.stringify({ a: 1, b: 2 })
    const sig1 = await computeHmac(body1, SECRET)
    // Both should verify since keys are sorted before signing
    expect(await verifyIpnSignature(body2, sig1, SECRET)).toBe(true)
  })
})
