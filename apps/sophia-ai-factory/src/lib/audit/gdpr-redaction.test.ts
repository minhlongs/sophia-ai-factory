/**
 * Tests for GDPR Redaction Module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  hashIpAddress,
  generateUserPseudonym,
  redactEmail,
  containsPII,
  redactAuditLog,
  batchRedactAuditLogs,
  shouldDeleteForRetentionPolicy,
  type RedactionOptions,
} from './gdpr-redaction'
import type { RaasAuditLogRow } from '@/lib/supabase/types'

// Mock environment variable for consistent testing
const ORIGINAL_SALT = process.env.AUDIT_HASH_SALT

describe('GDPR Redaction Module', () => {
  beforeEach(() => {
    process.env.AUDIT_HASH_SALT = 'test-salt-for-consistent-hashing'
    vi.resetModules()
  })

  afterEach(() => {
    process.env.AUDIT_HASH_SALT = ORIGINAL_SALT
  })

  describe('hashIpAddress', () => {
    it('produces consistent SHA-256 hashes for same IP', () => {
      const ip = '192.168.1.1'
      const hash1 = hashIpAddress(ip)
      const hash2 = hashIpAddress(ip)
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64)
    })

    it('produces different hashes for different IPs', () => {
      const hash1 = hashIpAddress('192.168.1.1')
      const hash2 = hashIpAddress('192.168.1.2')
      expect(hash1).not.toBe(hash2)
    })

    it('handles IPv6 addresses', () => {
      const hash = hashIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334')
      expect(hash).toHaveLength(64)
    })

    it('returns empty string for invalid input', () => {
      expect(hashIpAddress('')).toBe('')
      expect(hashIpAddress(null as unknown as string)).toBe('')
    })

    it('produces deterministic hash with salt', () => {
      // Verify hash is deterministic (same input = same output)
      const hash1 = hashIpAddress('10.0.0.1')
      const hash2 = hashIpAddress('10.0.0.1')
      expect(hash1).toBe(hash2)
      // Hash should be different from unsalted version (we just verify it's a valid hash)
      expect(hash1).toHaveLength(64)
    })
  })

  describe('generateUserPseudonym', () => {
    it('produces consistent pseudonym for same user ID', () => {
      const userId = 'user-123'
      const pseudo1 = generateUserPseudonym(userId)
      const pseudo2 = generateUserPseudonym(userId)
      expect(pseudo1).toBe(pseudo2)
      expect(pseudo1).toHaveLength(64)
    })

    it('produces different pseudonyms for different users', () => {
      const pseudo1 = generateUserPseudonym('user-1')
      const pseudo2 = generateUserPseudonym('user-2')
      expect(pseudo1).not.toBe(pseudo2)
    })

    it('returns empty string for invalid input', () => {
      expect(generateUserPseudonym('')).toBe('')
      expect(generateUserPseudonym(null as unknown as string)).toBe('')
    })
  })

  describe('redactEmail', () => {
    it('masks local part preserving domain', () => {
      expect(redactEmail('john.doe@example.com')).toBe('j***e@example.com')
    })

    it('handles single character local part', () => {
      expect(redactEmail('a@test.org')).toBe('a***@test.org')
    })

    it('handles two character local part', () => {
      expect(redactEmail('ab@test.org')).toBe('a***b@test.org')
    })

    it('returns [REDACTED] for invalid email without @', () => {
      expect(redactEmail('invalidemail')).toBe('[REDACTED]')
    })

    it('returns [REDACTED] for empty email', () => {
      expect(redactEmail('')).toBe('[REDACTED]')
    })

    it('returns [REDACTED] for null/undefined', () => {
      expect(redactEmail(null as unknown as string)).toBe('[REDACTED]')
      expect(redactEmail(undefined as unknown as string)).toBe('[REDACTED]')
    })
  })

  describe('containsPII', () => {
    it('detects email addresses', () => {
      expect(containsPII('john@example.com')).toBe(true)
      expect(containsPII('test.user@domain.org')).toBe(true)
    })

    it('detects phone numbers', () => {
      expect(containsPII('555-123-4567')).toBe(true)
      expect(containsPII('+1 (555) 123-4567')).toBe(true)
      expect(containsPII('5551234567')).toBe(true)
    })

    it('detects SSN pattern', () => {
      expect(containsPII('123-45-6789')).toBe(true)
    })

    it('detects credit card pattern', () => {
      expect(containsPII('1234-5678-9012-3456')).toBe(true)
      expect(containsPII('1234567890123456')).toBe(true)
    })

    it('returns false for regular text', () => {
      expect(containsPII('Hello, World!')).toBe(false)
      expect(containsPII('This is just regular text')).toBe(false)
    })

    it('handles empty/null input', () => {
      expect(containsPII('')).toBe(false)
      expect(containsPII(null as unknown as string)).toBe(false)
    })
  })

  describe('redactAuditLog', () => {
    const createMockLog = (overrides?: Partial<RaasAuditLogRow>): RaasAuditLogRow => ({
      id: 'log-1',
      action: 'LOGIN',
      license_id: 'license-123',
      license_nonce: 'nonce-abc',
      user_id: 'user-123',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      details: { email: 'user@example.com', action: 'login' },
      created_at: 1234567890,
      model_name: null,
      token_count: null,
      ip_address_hash: null,
      user_pseudonym: null,
      content_hash: 'abc123',
      previous_log_hash: null,
      hash_chain_valid: true,
      ...overrides,
    })

    it('pseudonymizes user_id', () => {
      const log = createMockLog()
      const redacted = redactAuditLog(log)
      expect(redacted.user_id).not.toBe(log.user_id)
      expect(redacted.user_id).toHaveLength(64)
    })

    it('hashes ip_address', () => {
      const log = createMockLog()
      const redacted = redactAuditLog(log)
      expect(redacted.ip_address).not.toBe(log.ip_address)
      expect(redacted.ip_address).toHaveLength(64)
    })

    it('redacts email in details', () => {
      const log = createMockLog()
      const redacted = redactAuditLog(log)
      const details = redacted.details as Record<string, unknown>
      // Field named 'email' is fully redacted for safety
      expect(details.email).toBe('[REDACTED]')
    })

    it('preserves non-PII details', () => {
      const log = createMockLog({
        details: { action: 'login', status: 'success', count: 5 },
      })
      const redacted = redactAuditLog(log)
      const details = redacted.details as Record<string, unknown>
      expect(details.action).toBe('login')
      expect(details.status).toBe('success')
      expect(details.count).toBe(5)
    })

    it('handles null user_id and ip_address', () => {
      const log = createMockLog({ user_id: null, ip_address: null })
      const redacted = redactAuditLog(log)
      expect(redacted.user_id).toBeNull()
      expect(redacted.ip_address).toBeNull()
    })

    it('does not mutate original log', () => {
      const log = createMockLog()
      const originalUserId = log.user_id
      const originalIp = log.ip_address
      redactAuditLog(log)
      expect(log.user_id).toBe(originalUserId)
      expect(log.ip_address).toBe(originalIp)
    })
  })

  describe('batchRedactAuditLogs', () => {
    const createMockLogs = (count: number): RaasAuditLogRow[] => {
      return Array.from({ length: count }, (_, i) => ({
        id: `log-${i}`,
        action: 'ACTION',
        license_id: null,
        license_nonce: null,
        user_id: `user-${i}`,
        ip_address: `192.168.1.${i}`,
        user_agent: 'Mozilla/5.0',
        details: {},
        created_at: 1234567890 + i,
        model_name: null,
        token_count: null,
        ip_address_hash: null,
        user_pseudonym: null,
        content_hash: `hash-${i}`,
        previous_log_hash: null,
        hash_chain_valid: true,
      }))
    }

    it('handles large datasets (1000+ logs)', () => {
      const logs = createMockLogs(1000)
      const options: RedactionOptions = {
        redactIp: true,
        redactEmail: true,
        redactUserId: true,
      }

      const result = batchRedactAuditLogs(logs, options)
      expect(result).toHaveLength(1000)
      expect(result[0].user_id).not.toBe(logs[0].user_id)
      expect(result[0].ip_address).not.toBe(logs[0].ip_address)
    })

    it('respects redactIp=false option', () => {
      const logs = createMockLogs(10)
      const options: RedactionOptions = {
        redactIp: false,
        redactEmail: true,
        redactUserId: true,
      }

      const result = batchRedactAuditLogs(logs, options)
      expect(result[0].ip_address).toBe(logs[0].ip_address)
      expect(result[0].user_id).not.toBe(logs[0].user_id)
    })

    it('respects redactUserId=false option', () => {
      const logs = createMockLogs(10)
      const options: RedactionOptions = {
        redactIp: true,
        redactEmail: true,
        redactUserId: false,
      }

      const result = batchRedactAuditLogs(logs, options)
      expect(result[0].ip_address).not.toBe(logs[0].ip_address)
      expect(result[0].user_id).toBe(logs[0].user_id)
    })

    it('handles empty array', () => {
      const result = batchRedactAuditLogs([], {
        redactIp: true,
        redactEmail: true,
        redactUserId: true,
      })
      expect(result).toHaveLength(0)
    })
  })

  describe('shouldDeleteForRetentionPolicy', () => {
    it('returns false for recent logs within retention period', () => {
      const now = Date.now()
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
      expect(shouldDeleteForRetentionPolicy(sevenDaysAgo, 90)).toBe(false)
    })

    it('returns true for old logs beyond retention period', () => {
      const now = Date.now()
      const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000
      expect(shouldDeleteForRetentionPolicy(oneYearAgo, 90)).toBe(true)
    })

    it('uses default 90 days retention', () => {
      const now = Date.now()
      const ninetyFiveDaysAgo = now - 95 * 24 * 60 * 60 * 1000
      expect(shouldDeleteForRetentionPolicy(ninetyFiveDaysAgo)).toBe(true)
    })

    it('handles custom retention period', () => {
      const now = Date.now()
      const thirtyFiveDaysAgo = now - 35 * 24 * 60 * 60 * 1000
      expect(shouldDeleteForRetentionPolicy(thirtyFiveDaysAgo, 30)).toBe(true)
      expect(shouldDeleteForRetentionPolicy(thirtyFiveDaysAgo, 60)).toBe(false)
    })
  })
})
