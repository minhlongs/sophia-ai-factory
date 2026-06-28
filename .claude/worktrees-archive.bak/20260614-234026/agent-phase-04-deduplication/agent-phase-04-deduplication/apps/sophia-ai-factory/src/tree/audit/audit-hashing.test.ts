/**
 * Tests for audit-hashing (GDPR pseudonymization utilities).
 *
 * Pure functions wrapping node:crypto SHA-256 with salt. Pins:
 * - hashSensitiveData salt+delimiter format, empty-input contract
 * - hashIpAddress + generateUserPseudonym thin-wrapper equivalence
 * - verifyHash constant-time round-trip + tamper detection
 */

import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import {
  hashSensitiveData,
  hashIpAddress,
  generateUserPseudonym,
  verifyHash,
} from './audit-hashing'

// Module reads AUDIT_HASH_SALT at import time; .env.test injects it (or empty).
// To match the module's internal salt without depending on env, we recompute
// the expected hash exactly the way the module does.
const AUDIT_HASH_SALT = process.env.AUDIT_HASH_SALT || ''

function expectedHash(data: string): string {
  return createHash('sha256').update(`${AUDIT_HASH_SALT}|${data}`).digest('hex')
}

describe('hashSensitiveData', () => {
  it('returns 64-char hex SHA-256 for non-empty input', () => {
    expect(hashSensitiveData('payload')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('uses salt|data delimiter format (rainbow-table mitigation)', () => {
    expect(hashSensitiveData('192.168.1.1')).toBe(expectedHash('192.168.1.1'))
  })

  it('returns empty string for empty/null/undefined input (GDPR-safe contract)', () => {
    expect(hashSensitiveData('')).toBe('')
    expect(hashSensitiveData(null as unknown as string)).toBe('')
    expect(hashSensitiveData(undefined as unknown as string)).toBe('')
  })

  it('returns empty string for non-string input (defensive)', () => {
    expect(hashSensitiveData(123 as unknown as string)).toBe('')
    expect(hashSensitiveData({} as unknown as string)).toBe('')
  })

  it('is deterministic — same input → same hash', () => {
    expect(hashSensitiveData('user-1')).toBe(hashSensitiveData('user-1'))
  })

  it('avalanche — single-char change yields different hash', () => {
    expect(hashSensitiveData('user-1')).not.toBe(hashSensitiveData('user-2'))
  })
})

describe('hashIpAddress (thin wrapper)', () => {
  it('returns hash equivalent to hashSensitiveData(ip)', () => {
    expect(hashIpAddress('10.0.0.1')).toBe(hashSensitiveData('10.0.0.1'))
  })

  it('produces distinct hashes for different IPs', () => {
    expect(hashIpAddress('1.1.1.1')).not.toBe(hashIpAddress('1.1.1.2'))
  })

  it('handles IPv6 addresses', () => {
    const h = hashIpAddress('::1')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns empty string for empty IP', () => {
    expect(hashIpAddress('')).toBe('')
  })
})

describe('generateUserPseudonym (thin wrapper)', () => {
  it('returns hash equivalent to hashSensitiveData(userId)', () => {
    expect(generateUserPseudonym('user-123')).toBe(hashSensitiveData('user-123'))
  })

  it('produces distinct pseudonyms for different users (no collision in trivial cases)', () => {
    expect(generateUserPseudonym('user-A')).not.toBe(generateUserPseudonym('user-B'))
  })

  it('returns empty string for empty userId', () => {
    expect(generateUserPseudonym('')).toBe('')
  })
})

describe('verifyHash (round-trip + constant-time compare)', () => {
  it('returns true when data matches expected hash', () => {
    const data = 'verify-me'
    const hash = hashSensitiveData(data)
    expect(verifyHash(data, hash)).toBe(true)
  })

  it('returns false when data does not match hash', () => {
    const hash = hashSensitiveData('original-data')
    expect(verifyHash('other-data', hash)).toBe(false)
  })

  it('returns false when expectedHash is wrong length (length-mismatch guard)', () => {
    const data = 'x'
    // Truncate to invalid length
    expect(verifyHash(data, 'a'.repeat(63))).toBe(false)
  })

  it('returns false for empty data or empty expectedHash', () => {
    expect(verifyHash('', 'a'.repeat(64))).toBe(false)
    expect(verifyHash('data', '')).toBe(false)
    expect(verifyHash('', '')).toBe(false)
  })

  it('works correctly across the IP-hash wrapper round-trip', () => {
    const ip = '203.0.113.42'
    expect(verifyHash(ip, hashIpAddress(ip))).toBe(true)
  })

  it('works correctly across the pseudonym wrapper round-trip', () => {
    const uid = 'user-456'
    expect(verifyHash(uid, generateUserPseudonym(uid))).toBe(true)
  })
})
