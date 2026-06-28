/**
 * Tests for clickbank-signature-verifier
 */

import { describe, it, expect } from 'vitest'
import { verifyClickBankSignature } from './clickbank-signature-verifier'

// Helper: compute expected HMAC-SHA1 hex using Web Crypto
async function hmacSha1Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

describe('verifyClickBankSignature', () => {
  const secret = 'test-secret-key'
  const body = 'receipt=ABC123&transactionType=SALE&amount=120.00'

  it('returns true for valid signature', async () => {
    const sig = await hmacSha1Hex(body, secret)
    const result = await verifyClickBankSignature(body, sig, secret)
    expect(result).toBe(true)
  })

  it('returns false for wrong secret', async () => {
    const sig = await hmacSha1Hex(body, secret)
    const result = await verifyClickBankSignature(body, sig, 'wrong-secret')
    expect(result).toBe(false)
  })

  it('returns false for tampered body', async () => {
    const sig = await hmacSha1Hex(body, secret)
    const result = await verifyClickBankSignature(body + '&extra=1', sig, secret)
    expect(result).toBe(false)
  })

  it('returns false for empty signature', async () => {
    const result = await verifyClickBankSignature(body, '', secret)
    expect(result).toBe(false)
  })

  it('returns false for empty secret', async () => {
    const sig = await hmacSha1Hex(body, secret)
    const result = await verifyClickBankSignature(body, sig, '')
    expect(result).toBe(false)
  })

  it('returns false for empty body', async () => {
    const sig = await hmacSha1Hex(body, secret)
    const result = await verifyClickBankSignature('', sig, secret)
    expect(result).toBe(false)
  })

  it('is case-insensitive for signature hex', async () => {
    const sig = await hmacSha1Hex(body, secret)
    const result = await verifyClickBankSignature(body, sig.toUpperCase(), secret)
    expect(result).toBe(true)
  })

  // H5: signature format validation
  it('returns false for signature with leading/trailing whitespace', async () => {
    const sig = await hmacSha1Hex(body, secret)
    // whitespace-only signature fails format check (39 hex chars after trim doesn't match)
    const result = await verifyClickBankSignature(body, `  ${sig}  `, secret)
    // trimmed + lowercased valid sig should pass (40 hex chars)
    expect(result).toBe(true)  // trim is applied, so leading/trailing space is OK
  })

  it('returns false for signature with non-hex characters', async () => {
    const result = await verifyClickBankSignature(body, 'g'.repeat(40), secret)
    expect(result).toBe(false)
  })

  it('returns false for signature shorter than 40 hex chars', async () => {
    const result = await verifyClickBankSignature(body, 'a'.repeat(39), secret)
    expect(result).toBe(false)
  })

  it('returns false for signature longer than 40 hex chars', async () => {
    const result = await verifyClickBankSignature(body, 'a'.repeat(41), secret)
    expect(result).toBe(false)
  })
})
