/**
 * Contract tests for clickbank-signature-verifier
 *
 * Validates public API behavior of verifyClickBankSignature including
 * HMAC verification, tamper detection, and edge cases.
 *
 * @module affiliates/__tests__/clickbank-signature-verifier-contract
 */

import { describe, it, expect } from 'vitest'
import { verifyClickBankSignature } from '../clickbank-signature-verifier'

// Helper: compute expected HMAC-SHA1 hex using Web Crypto
async function hmacSha1Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

describe('verifyClickBankSignature', () => {
  const secret = 'test-secret-key'
  const body = 'receipt=ABC123&transactionType=SALE&amount=120.00'

  it('passes verification for a valid signature', async () => {
    const sig = await hmacSha1Hex(body, secret)
    const result = await verifyClickBankSignature(body, sig, secret)
    expect(result).toBe(true)
  })

  it('fails verification for tampered payload', async () => {
    const sig = await hmacSha1Hex(body, secret)
    const result = await verifyClickBankSignature(body + '&extra=1', sig, secret)
    expect(result).toBe(false)
  })

  it('fails verification with wrong secret', async () => {
    const sig = await hmacSha1Hex(body, secret)
    const result = await verifyClickBankSignature(body, sig, 'wrong-secret')
    expect(result).toBe(false)
  })

  it('returns false for missing signature header (empty string)', async () => {
    const result = await verifyClickBankSignature(body, '', secret)
    expect(result).toBe(false)
  })

  it('returns false for empty body', async () => {
    const sig = await hmacSha1Hex(body, secret)
    const result = await verifyClickBankSignature('', sig, secret)
    expect(result).toBe(false)
  })

  it('returns false for empty secret', async () => {
    const sig = await hmacSha1Hex(body, secret)
    const result = await verifyClickBankSignature(body, sig, '')
    expect(result).toBe(false)
  })
})
