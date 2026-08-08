/**
 * Tests for crypto-utils-signing (HMAC + timing-safe-eq + hash-chain + Merkle root).
 *
 * Pure deterministic functions — real sha256 (no mock). Pins:
 * - hmacSha256 input validation + format (64-hex)
 * - timingSafeEqual constant-time semantics (length-mismatch short-circuit)
 * - verifyHashChain link + content-hash recompute, indices/reasons on break
 * - merkleRoot pairing + odd-count duplication invariant
 */

import { describe, it, expect } from 'vitest'
import {
  hmacSha256,
  timingSafeEqual,
  verifyHashChain,
  merkleRoot,
} from './crypto-utils-signing'
import { sha256, computeContentHash } from './crypto-utils'
import type { AuditLogEntry } from './crypto-utils'

function makeLog(
  overrides: Partial<Record<string, unknown>> & { previous_log_hash: string | null; content_hash: string },
): Record<string, unknown> {
  return {
    id: overrides.id ?? 'log-1',
    action: overrides.action ?? 'license.use',
    license_id: overrides.license_id ?? null,
    license_nonce: overrides.license_nonce ?? 'nonce-1',
    user_id: overrides.user_id ?? 'user-1',
    ip_address: overrides.ip_address ?? '10.0.0.1',
    user_agent: null,
    details: {},
    created_at: overrides.created_at ?? 1_700_000_000,
    content_hash: overrides.content_hash,
    previous_log_hash: overrides.previous_log_hash,
    hash_chain_valid: true,
    model_name: null,
    token_count: null,
    ip_address_hash: null,
    user_pseudonym: null,
  }
}

function chainLog(idx: number, prev: string | null): Record<string, unknown> {
  const created_at = 1_700_000_000 + idx
  const entry: AuditLogEntry = {
    action: 'license.use',
    license_nonce: `nonce-${idx}`,
    user_id: `user-${idx}`,
    ip_address: '10.0.0.1',
    created_at,
  }
  const hash = computeContentHash(entry, prev)
  return makeLog({
    license_nonce: entry.license_nonce,
    user_id: entry.user_id,
    ip_address: entry.ip_address,
    created_at,
    previous_log_hash: prev,
    content_hash: hash,
  })
}

describe('hmacSha256', () => {
  it('returns 64-char hex string for valid inputs', () => {
    const sig = hmacSha256('payload', 'secret-key-32-bytes-padded')
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic (same inputs → same signature)', () => {
    const a = hmacSha256('payload', 'secret')
    const b = hmacSha256('payload', 'secret')
    expect(a).toBe(b)
  })

  it('differs when data changes (avalanche)', () => {
    const a = hmacSha256('payload-A', 'secret')
    const b = hmacSha256('payload-B', 'secret')
    expect(a).not.toBe(b)
  })

  it('differs when secret changes (key isolation)', () => {
    const a = hmacSha256('payload', 'secret-A')
    const b = hmacSha256('payload', 'secret-B')
    expect(a).not.toBe(b)
  })

  it('throws on empty data', () => {
    expect(() => hmacSha256('', 'secret')).toThrow(/data must be a non-empty string/)
  })

  it('throws on null/undefined data', () => {
    expect(() => hmacSha256(null as unknown as string, 'secret')).toThrow(/data must be a non-empty string/)
    expect(() => hmacSha256(undefined as unknown as string, 'secret')).toThrow(/data must be a non-empty string/)
  })

  it('throws on empty/null/undefined secret', () => {
    expect(() => hmacSha256('payload', '')).toThrow(/secret must be a non-empty string/)
    expect(() => hmacSha256('payload', null)).toThrow(/secret must be a non-empty string/)
    expect(() => hmacSha256('payload', undefined)).toThrow(/secret must be a non-empty string/)
  })
})

describe('timingSafeEqual', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true)
  })

  it('returns false for different strings of same length', () => {
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false)
  })

  it('returns false on length mismatch (early short-circuit acceptable)', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
    expect(timingSafeEqual('', 'a')).toBe(false)
  })

  it('returns false for null/undefined inputs', () => {
    expect(timingSafeEqual(null, 'abc')).toBe(false)
    expect(timingSafeEqual('abc', null)).toBe(false)
    expect(timingSafeEqual(undefined, 'abc')).toBe(false)
    expect(timingSafeEqual(null, null)).toBe(false)
  })

  it('returns false for non-string inputs (defensive)', () => {
    expect(timingSafeEqual(123 as unknown as string, 'abc')).toBe(false)
    expect(timingSafeEqual('abc', {} as unknown as string)).toBe(false)
  })

  it('handles long identical hex strings (signature-comparison realistic case)', () => {
    const sig = sha256('some-payload')
    expect(timingSafeEqual(sig, sig)).toBe(true)
    expect(timingSafeEqual(sig, sig.slice(0, -1) + (sig.endsWith('a') ? 'b' : 'a'))).toBe(false)
  })
})

describe('verifyHashChain', () => {
  it('returns valid:true for empty array', () => {
    expect(verifyHashChain([])).toEqual({ valid: true })
  })

  it('returns valid:true for properly-linked single-entry chain (previous_log_hash = null)', () => {
    const log = chainLog(0, null)
    expect(verifyHashChain([log])).toEqual({ valid: true })
  })

  it('returns valid:true for properly-linked multi-entry chain', () => {
    const log0 = chainLog(0, null)
    const log1 = chainLog(1, log0.content_hash)
    const log2 = chainLog(2, log1.content_hash)
    expect(verifyHashChain([log0, log1, log2])).toEqual({ valid: true })
  })

  it('detects broken previous_log_hash link (returns first invalid index + reason)', () => {
    const log0 = chainLog(0, null)
    const log1 = chainLog(1, log0.content_hash)
    // Tamper: rewrite log1 to claim a wrong previous_log_hash
    const tampered = { ...log1, previous_log_hash: 'wrong-prev-hash' }
    const result = verifyHashChain([log0, tampered])
    expect(result.valid).toBe(false)
    expect(result.firstInvalidIndex).toBe(1)
    expect(result.reason).toMatch(/previous_log_hash mismatch at index 1/)
  })

  it('detects forged content_hash (recompute differs)', () => {
    const log0 = chainLog(0, null)
    // Tamper content_hash directly
    const tampered = { ...log0, content_hash: 'forged'.padEnd(64, '0') }
    const result = verifyHashChain([tampered])
    expect(result.valid).toBe(false)
    expect(result.firstInvalidIndex).toBe(0)
    expect(result.reason).toMatch(/content_hash mismatch at index 0/)
  })

  it('detects break at index 0 when first entry claims a non-null previous_log_hash', () => {
    const log0 = chainLog(0, null)
    const tampered = { ...log0, previous_log_hash: 'fake-genesis' }
    const result = verifyHashChain([tampered])
    expect(result.valid).toBe(false)
    expect(result.firstInvalidIndex).toBe(0)
  })

  it('detects mismatch when previous-link tampered mid-chain (index 1, not 0)', () => {
    const log0 = chainLog(0, null)
    const log1 = chainLog(1, log0.content_hash)
    const log2 = chainLog(2, log1.content_hash)
    // Tamper log2 to claim it follows log0 directly, skipping log1
    const tampered = { ...log2, previous_log_hash: log0.content_hash }
    const result = verifyHashChain([log0, log1, tampered])
    expect(result.valid).toBe(false)
    expect(result.firstInvalidIndex).toBe(2)
    expect(result.reason).toMatch(/previous_log_hash mismatch at index 2/)
  })
})

describe('merkleRoot', () => {
  it('throws on empty array', () => {
    expect(() => merkleRoot([])).toThrow(/Cannot compute Merkle root of empty hash array/)
  })

  it('returns single hash unchanged for length-1 array', () => {
    const h = sha256('one')
    expect(merkleRoot([h])).toBe(h)
  })

  it('hashes pair concatenation for length-2 array', () => {
    const a = sha256('a')
    const b = sha256('b')
    expect(merkleRoot([a, b])).toBe(sha256(a + b))
  })

  it('duplicates last hash when odd count (3 hashes → pair0 + dup1)', () => {
    const a = sha256('a')
    const b = sha256('b')
    const c = sha256('c')
    const expected = sha256(sha256(a + b) + sha256(c + c))
    expect(merkleRoot([a, b, c])).toBe(expected)
  })

  it('is deterministic for same input', () => {
    const hashes = [sha256('1'), sha256('2'), sha256('3'), sha256('4')]
    expect(merkleRoot(hashes)).toBe(merkleRoot(hashes))
  })

  it('changes when any leaf changes (avalanche)', () => {
    const base = [sha256('1'), sha256('2'), sha256('3'), sha256('4')]
    const tampered = [sha256('1'), sha256('2'), sha256('3'), sha256('4-tampered')]
    expect(merkleRoot(base)).not.toBe(merkleRoot(tampered))
  })

  it('produces 64-char hex output', () => {
    const hashes = [sha256('1'), sha256('2'), sha256('3'), sha256('4'), sha256('5')]
    expect(merkleRoot(hashes)).toMatch(/^[0-9a-f]{64}$/)
  })
})
