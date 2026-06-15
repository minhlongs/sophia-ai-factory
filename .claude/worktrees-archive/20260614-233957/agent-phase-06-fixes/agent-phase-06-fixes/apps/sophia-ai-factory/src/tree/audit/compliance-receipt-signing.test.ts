/**
 * Tests for compliance receipt signing primitives.
 *
 * Pins deterministic payload shape (sorted keys), HMAC sign+verify
 * round-trip, env-gated secret retrieval, timing-safe signature
 * comparison (tamper detection at any field).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getReceiptSecret,
  buildSignaturePayload,
  signReceipt,
  hashIpAddress,
  verifyReceiptSignature,
} from './compliance-receipt-signing'
import { hmacSha256, sha256 } from './crypto-utils'
import type { ComplianceReceipt } from './compliance-receipt-types'

const baseReceipt: ComplianceReceipt = {
  receiptId: 'r-1',
  auditLogId: 'log-1',
  action: 'CREATE',
  licenseNonce: 'nonce-1',
  timestamp: 1_700_000_000,
  actorId: 'user-1',
  actorIpHash: 'ip-hash-1',
  contentHash: 'content-hash-1',
  signature: '',
  issuedAt: 1_700_000_100,
  expiresAt: 1_700_086_400,
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getReceiptSecret', () => {
  it('returns AUDIT_RECEIPT_SECRET env var value', () => {
    vi.stubEnv('AUDIT_RECEIPT_SECRET', 'super-secret-32-bytes-of-entropy')
    expect(getReceiptSecret()).toBe('super-secret-32-bytes-of-entropy')
  })

  it('returns empty string when env unset (caller must validate)', () => {
    vi.stubEnv('AUDIT_RECEIPT_SECRET', '')
    expect(getReceiptSecret()).toBe('')
  })
})

describe('buildSignaturePayload', () => {
  it('returns canonical JSON with sorted keys (alphabetical order)', () => {
    const payload = buildSignaturePayload(baseReceipt)
    const parsed = JSON.parse(payload)
    expect(Object.keys(parsed)).toEqual([
      'action',
      'actorId',
      'actorIpHash',
      'auditLogId',
      'contentHash',
      'licenseNonce',
      'receiptId',
      'timestamp',
    ])
  })

  it('excludes signature, issuedAt, expiresAt (signed payload cannot include signature itself)', () => {
    const payload = buildSignaturePayload(baseReceipt)
    expect(payload).not.toMatch(/signature|issuedAt|expiresAt/)
  })

  it('is deterministic — same input produces identical bytes', () => {
    expect(buildSignaturePayload(baseReceipt)).toBe(buildSignaturePayload(baseReceipt))
  })

  it('differs when any signed field changes (avalanche)', () => {
    const p1 = buildSignaturePayload(baseReceipt)
    const p2 = buildSignaturePayload({ ...baseReceipt, actorId: 'user-2' })
    expect(p1).not.toBe(p2)
  })

  it('only depends on the 8 signed fields (extra fields ignored by Omit-typed input)', () => {
    // buildSignaturePayload's input type is Omit<..., 'signature' | 'issuedAt' | 'expiresAt'>
    // so we cannot pass those in. But it MUST be stable across the 8 signed fields.
    const p1 = buildSignaturePayload(baseReceipt)
    const p2 = buildSignaturePayload({ ...baseReceipt })
    expect(p1).toBe(p2)
  })
})

describe('signReceipt', () => {
  it('returns 64-char hex HMAC for valid payload + secret', () => {
    const sig = signReceipt('payload-text', 'secret-key-32-bytes-of-entropy-x')
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it('matches direct hmacSha256 call (thin wrapper)', () => {
    const payload = 'p'
    const secret = 's'
    expect(signReceipt(payload, secret)).toBe(hmacSha256(payload, secret))
  })

  it('differs when secret changes (key isolation)', () => {
    expect(signReceipt('p', 's1')).not.toBe(signReceipt('p', 's2'))
  })
})

describe('hashIpAddress', () => {
  it('returns 64-char hex SHA-256 hash', () => {
    expect(hashIpAddress('192.168.1.1')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic (same IP → same hash)', () => {
    expect(hashIpAddress('10.0.0.1')).toBe(hashIpAddress('10.0.0.1'))
  })

  it('matches direct sha256 call (thin wrapper)', () => {
    expect(hashIpAddress('1.2.3.4')).toBe(sha256('1.2.3.4'))
  })

  it('produces distinct hashes for distinct IPs (privacy)', () => {
    expect(hashIpAddress('1.1.1.1')).not.toBe(hashIpAddress('1.1.1.2'))
  })
})

describe('verifyReceiptSignature (round-trip)', () => {
  const secret = 'verify-secret-32-bytes-of-entropy-x'

  function sign(receipt: ComplianceReceipt, sec = secret): ComplianceReceipt {
    const payload = buildSignaturePayload(receipt)
    return { ...receipt, signature: signReceipt(payload, sec) }
  }

  it('returns true for legitimate signature + correct secret', () => {
    const signed = sign(baseReceipt)
    expect(verifyReceiptSignature(signed, secret)).toBe(true)
  })

  it('returns false when secret is wrong (key rotation/tamper)', () => {
    const signed = sign(baseReceipt)
    expect(verifyReceiptSignature(signed, 'wrong-secret-32-bytes-padded-out')).toBe(false)
  })

  it('returns false when signature itself tampered', () => {
    const signed = sign(baseReceipt)
    const tampered = { ...signed, signature: 'a'.repeat(64) }
    expect(verifyReceiptSignature(tampered, secret)).toBe(false)
  })

  it('returns false when any signed field tampered (action)', () => {
    const signed = sign(baseReceipt)
    const tampered = { ...signed, action: 'REVOKE' }
    expect(verifyReceiptSignature(tampered, secret)).toBe(false)
  })

  it('returns false when any signed field tampered (actorId)', () => {
    const signed = sign(baseReceipt)
    const tampered = { ...signed, actorId: 'attacker' }
    expect(verifyReceiptSignature(tampered, secret)).toBe(false)
  })

  it('returns false when contentHash tampered (hash-chain link)', () => {
    const signed = sign(baseReceipt)
    const tampered = { ...signed, contentHash: 'forged-content-hash' }
    expect(verifyReceiptSignature(tampered, secret)).toBe(false)
  })

  it('returns true when non-signed fields tampered (issuedAt/expiresAt outside payload)', () => {
    const signed = sign(baseReceipt)
    const reissued = { ...signed, issuedAt: 9999, expiresAt: 9999 }
    expect(verifyReceiptSignature(reissued, secret)).toBe(true)
  })
})
