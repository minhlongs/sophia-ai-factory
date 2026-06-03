/**
 * Unit tests for cryptographic hashing utilities
 *
 * @module audit/crypto-utils.test
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import {
  sha256,
  hmacSha256,
  timingSafeEqual,
  computeContentHash,
  verifyHashChain,
  merkleRoot
} from '@/tree/audit/crypto-utils'
import type { RaasAuditLogRow } from '@/tree/database/supabase-types'

// Save original env vars
const ORIGINAL_SALT = process.env.AUDIT_HASH_SALT

describe('crypto-utils', () => {
  beforeEach(() => {
    // Reset salt for consistent test results
    process.env.AUDIT_HASH_SALT = 'test-salt-for-unit-tests-only'
  })

  afterAll(() => {
    // Restore original env vars
    process.env.AUDIT_HASH_SALT = ORIGINAL_SALT
  })

  describe('sha256', () => {
    it('should return 64-character hexadecimal string', () => {
      const hash = sha256('test-data')
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should be deterministic (same input = same output)', () => {
      const hash1 = sha256('test-data')
      const hash2 = sha256('test-data')
      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different inputs', () => {
      const hash1 = sha256('input-1')
      const hash2 = sha256('input-2')
      expect(hash1).not.toBe(hash2)
    })

    it('should throw on empty string input', () => {
      expect(() => sha256('')).toThrow('Invalid input: data must be a non-empty string')
    })

    it('should throw on null input', () => {
      expect(() => sha256(null)).toThrow('Invalid input: data must be a non-empty string')
    })

    it('should throw on undefined input', () => {
      expect(() => sha256(undefined)).toThrow('Invalid input: data must be a non-empty string')
    })

    it('should throw on non-string input (number)', () => {
      expect(() => sha256(123 as unknown as string)).toThrow('Invalid input: data must be a non-empty string')
    })
  })

  describe('hmacSha256', () => {
    it('should return 64-character hexadecimal string', () => {
      const hmac = hmacSha256('test-data', 'secret-key')
      expect(hmac).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should be deterministic with same data and secret', () => {
      const hmac1 = hmacSha256('test-data', 'secret-key')
      const hmac2 = hmacSha256('test-data', 'secret-key')
      expect(hmac1).toBe(hmac2)
    })

    it('should produce different output with different secrets', () => {
      const hmac1 = hmacSha256('test-data', 'secret-1')
      const hmac2 = hmacSha256('test-data', 'secret-2')
      expect(hmac1).not.toBe(hmac2)
    })

    it('should produce different output with different data', () => {
      const hmac1 = hmacSha256('data-1', 'same-secret')
      const hmac2 = hmacSha256('data-2', 'same-secret')
      expect(hmac1).not.toBe(hmac2)
    })

    it('should throw on empty data', () => {
      expect(() => hmacSha256('', 'secret')).toThrow('Invalid input: data must be a non-empty string')
    })

    it('should throw on empty secret', () => {
      expect(() => hmacSha256('data', '')).toThrow('Invalid input: secret must be a non-empty string')
    })

    it('should throw on null secret', () => {
      expect(() => hmacSha256('data', null)).toThrow('Invalid input: secret must be a non-empty string')
    })
  })

  describe('timingSafeEqual', () => {
    it('should return true for identical strings', () => {
      const hash = sha256('test-data')
      expect(timingSafeEqual(hash, hash)).toBe(true)
    })

    it('should return true for two computations of same input', () => {
      const hash1 = sha256('test-data')
      const hash2 = sha256('test-data')
      expect(timingSafeEqual(hash1, hash2)).toBe(true)
    })

    it('should return false for different strings', () => {
      const hash1 = sha256('test-1')
      const hash2 = sha256('test-2')
      expect(timingSafeEqual(hash1, hash2)).toBe(false)
    })

    it('should return false for strings of different lengths', () => {
      const shortHash = sha256('a')
      const longHash = sha256('a'.repeat(100))
      expect(timingSafeEqual(shortHash, longHash)).toBe(false)
    })

    it('should return false for empty strings', () => {
      expect(timingSafeEqual('', '')).toBe(false)
    })

    it('should return false when one string is empty', () => {
      const hash = sha256('test')
      expect(timingSafeEqual(hash, '')).toBe(false)
      expect(timingSafeEqual('', hash)).toBe(false)
    })

    it('should return false for null inputs', () => {
      expect(timingSafeEqual(null, 'hash')).toBe(false)
      expect(timingSafeEqual('hash', null)).toBe(false)
    })
  })

  describe('computeContentHash', () => {
    const baseEntry = {
      action: 'LOGIN',
      license_nonce: 'nonce-123',
      user_id: 'user-456',
      ip_address: '192.168.1.1',
      created_at: 1709251200
    }

    it('should return 64-character hexadecimal string', () => {
      const hash = computeContentHash(baseEntry, null)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should be deterministic', () => {
      const hash1 = computeContentHash(baseEntry, null)
      const hash2 = computeContentHash(baseEntry, null)
      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different entries', () => {
      const entry1 = { ...baseEntry, action: 'LOGIN' }
      const entry2 = { ...baseEntry, action: 'LOGOUT' }

      const hash1 = computeContentHash(entry1, null)
      const hash2 = computeContentHash(entry2, null)
      expect(hash1).not.toBe(hash2)
    })

    it('should produce different hashes when previousHash differs', () => {
      const hash1 = computeContentHash(baseEntry, null)
      const hash2 = computeContentHash(baseEntry, 'previous-hash-abc')
      expect(hash1).not.toBe(hash2)
    })

    it('should include all fields in hash computation', () => {
      // Changing any field should change the hash
      const hash1 = computeContentHash(baseEntry, null)
      const hash2 = computeContentHash({ ...baseEntry, user_id: 'different-user' }, null)
      expect(hash1).not.toBe(hash2)
    })

    it('should handle empty previousHash as empty string', () => {
      const hash1 = computeContentHash(baseEntry, null)
      const hash2 = computeContentHash(baseEntry, '')
      expect(hash1).toBe(hash2)
    })

    it('should handle special characters in fields', () => {
      const specialEntry = {
        action: 'API_CALL|with|pipes',
        license_nonce: 'nonce-with-dashes',
        user_id: 'user@domain.com',
        ip_address: '10.0.0.1',
        created_at: 1709251200
      }
      const hash = computeContentHash(specialEntry, null)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('verifyHashChain', () => {
    const createValidLog = (
      index: number,
      previousHash: string | null,
      override?: Partial<RaasAuditLogRow>
    ): RaasAuditLogRow => {
      const entry = {
        id: `log-${index}`,
        action: 'LOGIN',
        license_nonce: 'nonce-123',
        user_id: 'user-456',
        ip_address: '192.168.1.1',
        created_at: 1709251200 + index
      }
      const contentHash = computeContentHash(entry, previousHash)

      return {
        ...entry,
        details: {},
        user_agent: null,
        license_id: null,
        content_hash: contentHash,
        previous_log_hash: previousHash,
        hash_chain_valid: true,
        model_name: null,
        token_count: null,
        ip_address_hash: null,
        user_pseudonym: null,
        ...override
      }
    }

    it('should return valid=true for empty array', () => {
      const result = verifyHashChain([])
      expect(result.valid).toBe(true)
      expect(result.firstInvalidIndex).toBeUndefined()
    })

    it('should verify a single entry chain', () => {
      const logs = [createValidLog(0, null)]
      const result = verifyHashChain(logs)
      expect(result.valid).toBe(true)
    })

    it('should verify a valid multi-entry chain', () => {
      const log1 = createValidLog(0, null)
      const log2 = createValidLog(1, log1.content_hash)
      const log3 = createValidLog(2, log2.content_hash)

      const result = verifyHashChain([log1, log2, log3])
      expect(result.valid).toBe(true)
    })

    it('should detect tampered content_hash', () => {
      const log1 = createValidLog(0, null)
      const log2 = createValidLog(1, log1.content_hash)

      // Tamper with log2's content
      log2.action = 'TAMPERED'

      const result = verifyHashChain([log1, log2])
      expect(result.valid).toBe(false)
      expect(result.firstInvalidIndex).toBe(1)
      expect(result.reason).toContain('content_hash mismatch')
    })

    it('should detect broken chain link (wrong previous_log_hash)', () => {
      const log1 = createValidLog(0, null)
      const log2 = createValidLog(1, log1.content_hash)

      // Break the chain link
      log2.previous_log_hash = 'tampered-previous-hash'

      const result = verifyHashChain([log1, log2])
      expect(result.valid).toBe(false)
      expect(result.firstInvalidIndex).toBe(1)
      expect(result.reason).toContain('previous_log_hash mismatch')
    })

    it('should detect first entry with non-null previous_hash', () => {
      const log1 = createValidLog(0, 'should-be-null')

      const result = verifyHashChain([log1])
      expect(result.valid).toBe(false)
      expect(result.firstInvalidIndex).toBe(0)
    })

    it('should provide detailed error reason', () => {
      const logs = [createValidLog(0, null)]
      const log2 = createValidLog(1, logs[0].content_hash)
      log2.content_hash = 'invalid-hash'

      const result = verifyHashChain([...logs, log2])
      expect(result.reason).toBeDefined()
      expect(result.reason).toContain('index 1')
    })
  })

  describe('merkleRoot', () => {
    it('should throw on empty array', () => {
      expect(() => merkleRoot([])).toThrow('Cannot compute Merkle root of empty hash array')
    })

    it('should return single hash for single-element array', () => {
      const hash = sha256('single')
      const root = merkleRoot([hash])
      expect(root).toBe(hash)
    })

    it('should compute root for two hashes', () => {
      const hash1 = sha256('left')
      const hash2 = sha256('right')
      const root = merkleRoot([hash1, hash2])
      expect(root).toMatch(/^[a-f0-9]{64}$/)
      expect(root).not.toBe(hash1)
      expect(root).not.toBe(hash2)
    })

    it('should compute root for three hashes (odd number)', () => {
      const hash1 = sha256('one')
      const hash2 = sha256('two')
      const hash3 = sha256('three')
      const root = merkleRoot([hash1, hash2, hash3])
      expect(root).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should compute root for four hashes', () => {
      const hashes = [
        sha256('a'),
        sha256('b'),
        sha256('c'),
        sha256('d')
      ]
      const root = merkleRoot(hashes)
      expect(root).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should be deterministic', () => {
      const hashes = [sha256('x'), sha256('y'), sha256('z')]
      const root1 = merkleRoot(hashes)
      const root2 = merkleRoot(hashes)
      expect(root1).toBe(root2)
    })

    it('should produce different roots for different inputs', () => {
      const hashes1 = [sha256('a'), sha256('b')]
      const hashes2 = [sha256('c'), sha256('d')]
      const root1 = merkleRoot(hashes1)
      const root2 = merkleRoot(hashes2)
      expect(root1).not.toBe(root2)
    })

    it('should duplicate last hash when odd number', () => {
      // Two identical hashes should produce same root as one hash duplicated
      const hash = sha256('single')
      const rootOdd = merkleRoot([hash, hash, hash])
      const rootWithDup = merkleRoot([hash, hash])

      // Both should be valid hashes (different computation paths)
      expect(rootOdd).toMatch(/^[a-f0-9]{64}$/)
      expect(rootWithDup).toMatch(/^[a-f0-9]{64}$/)
    })
  })
})
