/**
 * Unit Tests for Compliance Receipt Generator
 *
 * Tests cover:
 * - Receipt generation with all fields
 * - Signature verification (valid/tampered/expired)
 * - Serialization and parsing
 * - Error handling (missing secret, invalid input)
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import {
  generateReceipt,
  verifyReceipt,
  serializeReceipt,
  parseReceipt,
  verifyReceiptDetailed,
  type ComplianceReceipt
} from '@/tree/audit/compliance-receipt'
import type { RaasAuditLogRow } from '@/lib/supabase/types'

// Set up test environment variable for receipt secret
const TEST_RECEIPT_SECRET = 'test-secret-key-for-compliance-receipt-32-bytes-minimum'

beforeAll(() => {
  process.env.AUDIT_RECEIPT_SECRET = TEST_RECEIPT_SECRET
})

afterAll(() => {
  delete process.env.AUDIT_RECEIPT_SECRET
})

// Mock audit log for testing
const createMockAuditLog = (overrides?: Partial<RaasAuditLogRow>): RaasAuditLogRow => ({
  id: 'test-audit-log-uuid-12345',
  action: 'VALIDATE',
  license_id: 'license-uuid-67890',
  license_nonce: 'test-nonce-abc123',
  user_id: 'user-uuid-11111',
  ip_address: '192.168.1.100',
  user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  details: { validation_result: 'success', tier: 'premium' },
  created_at: 1709856000,
  content_hash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
  previous_log_hash: '0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba',
  hash_chain_valid: true,
  model_name: null,
  token_count: null,
  ip_address_hash: null,
  user_pseudonym: null,
  ...overrides
})

describe('generateReceipt', () => {
  const mockLog = createMockAuditLog()

  it('should generate receipt with all required fields', () => {
    const receipt = generateReceipt(mockLog)

    expect(receipt.receiptId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(receipt.auditLogId).toBe(mockLog.id)
    expect(receipt.action).toBe(mockLog.action)
    expect(receipt.licenseNonce).toBe(mockLog.license_nonce)
    expect(receipt.timestamp).toBe(mockLog.created_at)
    expect(receipt.actorId).toBe(mockLog.user_id)
    expect(receipt.contentHash).toBe(mockLog.content_hash)
    expect(receipt.signature).toMatch(/^[a-f0-9]{64}$/)
    expect(receipt.issuedAt).toBeGreaterThan(0)
    expect(receipt.expiresAt).toBeGreaterThan(receipt.issuedAt)
  })

  it('should hash IP address for privacy protection', () => {
    const receipt = generateReceipt(mockLog)

    // IP should be hashed, not stored raw
    expect(receipt.actorIpHash).not.toBe(mockLog.ip_address)
    expect(receipt.actorIpHash).toMatch(/^[a-f0-9]{64}$/)
    expect(receipt.actorIpHash.length).toBe(64) // SHA-256 = 64 hex chars
  })

  it('should handle missing IP address gracefully', () => {
    const logWithoutIp = createMockAuditLog({ ip_address: null })
    const receipt = generateReceipt(logWithoutIp)

    expect(receipt.actorIpHash).toBe('')
  })

  it('should handle missing user_id (system action)', () => {
    const systemLog = createMockAuditLog({ user_id: null })
    const receipt = generateReceipt(systemLog)

    expect(receipt.actorId).toBe('system')
  })

  it('should handle missing license_nonce', () => {
    const logWithoutNonce = createMockAuditLog({ license_nonce: null })
    const receipt = generateReceipt(logWithoutNonce)

    expect(receipt.licenseNonce).toBe('')
  })

  it('should generate unique receipt IDs for same log', () => {
    const receipt1 = generateReceipt(mockLog)
    const receipt2 = generateReceipt(mockLog)

    expect(receipt1.receiptId).not.toBe(receipt2.receiptId)
  })

  it('should throw error if AUDIT_RECEIPT_SECRET is not set', () => {
    // Temporarily clear the env var
    const originalSecret = process.env.AUDIT_RECEIPT_SECRET
    process.env.AUDIT_RECEIPT_SECRET = ''

    expect(() => generateReceipt(mockLog)).toThrow(
      'AUDIT_RECEIPT_SECRET environment variable is required'
    )

    // Restore
    process.env.AUDIT_RECEIPT_SECRET = originalSecret
  })
})

describe('verifyReceipt', () => {
  const mockLog = createMockAuditLog()

  it('should return true for valid receipt', () => {
    const receipt = generateReceipt(mockLog)
    const valid = verifyReceipt(receipt)

    expect(valid).toBe(true)
  })

  it('should return false for tampered action', () => {
    const receipt = generateReceipt(mockLog)
    receipt.action = 'TAMPERED_ACTION'

    const valid = verifyReceipt(receipt)
    expect(valid).toBe(false)
  })

  it('should return false for tampered auditLogId', () => {
    const receipt = generateReceipt(mockLog)
    receipt.auditLogId = 'tampered-id'

    const valid = verifyReceipt(receipt)
    expect(valid).toBe(false)
  })

  it('should return false for tampered signature', () => {
    const receipt = generateReceipt(mockLog)
    receipt.signature = '0000000000000000000000000000000000000000000000000000000000000000'

    const valid = verifyReceipt(receipt)
    expect(valid).toBe(false)
  })

  it('should return false for expired receipt', () => {
    const receipt = generateReceipt(mockLog)
    // Set expiration to 1000 seconds in the past
    receipt.expiresAt = Math.floor(Date.now() / 1000) - 1000

    const valid = verifyReceipt(receipt)
    expect(valid).toBe(false)
  })

  it('should return true for receipt near expiration', () => {
    const receipt = generateReceipt(mockLog)
    // Set expiration to 1 second in the future
    receipt.expiresAt = Math.floor(Date.now() / 1000) + 1

    const valid = verifyReceipt(receipt)
    expect(valid).toBe(true)
  })
})

describe('serializeReceipt and parseReceipt', () => {
  const mockLog = createMockAuditLog()

  it('should serialize receipt to JSON string', () => {
    const receipt = generateReceipt(mockLog)
    const jsonStr = serializeReceipt(receipt)

    expect(typeof jsonStr).toBe('string')
    expect(jsonStr).toContain('"receiptId"')
    expect(jsonStr).toContain('"signature"')
    expect(jsonStr).toContain(receipt.receiptId)
  })

  it('should parse valid JSON back to receipt', () => {
    const receipt = generateReceipt(mockLog)
    const jsonStr = serializeReceipt(receipt)
    const parsed = parseReceipt(jsonStr)

    expect(parsed).toBeDefined()
    expect(parsed).not.toBeNull()
    expect(parsed?.receiptId).toBe(receipt.receiptId)
    expect(parsed?.signature).toBe(receipt.signature)
  })

  it('should return null for invalid JSON', () => {
    const result = parseReceipt('not valid json {{{')
    expect(result).toBeNull()
  })

  it('should return null for JSON missing required fields', () => {
    const invalidJson = JSON.stringify({
      receiptId: 'some-id',
      // Missing signature and other required fields
    })

    const result = parseReceipt(invalidJson)
    expect(result).toBeNull()
  })

  it('should return null for JSON with wrong field types', () => {
    const invalidJson = JSON.stringify({
      receiptId: 123, // Should be string
      auditLogId: 'valid-id',
      action: 'VALIDATE',
      signature: 'valid-signature'
    })

    const result = parseReceipt(invalidJson)
    expect(result).toBeNull()
  })

  it('round-trip: serialize then parse should preserve receipt', () => {
    const original = generateReceipt(mockLog)
    const jsonStr = serializeReceipt(original)
    const parsed = parseReceipt(jsonStr)

    expect(parsed).toBeDefined()
    expect(parsed).not.toBeNull()
    expect(parsed?.receiptId).toBe(original.receiptId)
    expect(parsed?.auditLogId).toBe(original.auditLogId)
    expect(parsed?.action).toBe(original.action)
    expect(parsed?.signature).toBe(original.signature)
    expect(parsed?.licenseNonce).toBe(original.licenseNonce)
    expect(parsed?.contentHash).toBe(original.contentHash)
  })
})

describe('verifyReceiptDetailed', () => {
  const mockLog = createMockAuditLog()

  it('should return success result for valid receipt', () => {
    const receipt = generateReceipt(mockLog)
    const result = verifyReceiptDetailed(receipt)

    expect(result.valid).toBe(true)
    expect(result.receiptId).toBe(receipt.receiptId)
    expect(result.message).toBe('Receipt verified successfully')
    expect(result.reason).toBeUndefined()
  })

  it('should return detailed error for expired receipt', () => {
    const receipt = generateReceipt(mockLog)
    receipt.expiresAt = Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago

    const result = verifyReceiptDetailed(receipt)

    expect(result.valid).toBe(false)
    expect(result.receiptId).toBe(receipt.receiptId)
    expect(result.message).toBe('Receipt verification failed')
    expect(result.reason).toContain('expired')
  })

  it('should return detailed error for tampered receipt', () => {
    const receipt = generateReceipt(mockLog)
    receipt.action = 'TAMPERED'

    const result = verifyReceiptDetailed(receipt)

    expect(result.valid).toBe(false)
    expect(result.receiptId).toBe(receipt.receiptId)
    expect(result.message).toBe('Receipt verification failed')
    expect(result.reason).toContain('tampered')
  })
})

describe('ComplianceReceipt type', () => {
  it('should have correct interface structure', () => {
    const receipt: ComplianceReceipt = {
      receiptId: 'test-id',
      auditLogId: 'audit-123',
      action: 'CREATE',
      licenseNonce: 'nonce-456',
      timestamp: 1234567890,
      actorId: 'user-789',
      actorIpHash: 'hash-abc',
      contentHash: 'content-hash-xyz',
      signature: 'signature-def',
      issuedAt: 1234567800,
      expiresAt: 1234571400
    }

    expect(receipt.receiptId).toBe('test-id')
    expect(receipt.action).toBe('CREATE')
  })
})

describe('Edge cases', () => {
  it('should handle audit log with all null optional fields', () => {
    const minimalLog = createMockAuditLog({
      license_id: null,
      license_nonce: null,
      user_id: null,
      ip_address: null,
      user_agent: null
    })

    const receipt = generateReceipt(minimalLog)

    expect(receipt.licenseNonce).toBe('')
    expect(receipt.actorId).toBe('system')
    expect(receipt.actorIpHash).toBe('')
  })

  it('should handle very long license_nonce values', () => {
    const longNonceLog = createMockAuditLog({
      license_nonce: 'a'.repeat(500)
    })

    const receipt = generateReceipt(longNonceLog)
    expect(receipt.licenseNonce).toHaveLength(500)

    // Should still verify correctly
    expect(verifyReceipt(receipt)).toBe(true)
  })

  it('should handle unicode characters in action', () => {
    const unicodeLog = createMockAuditLog({
      action: 'VALIDATE_🔐_SECURE'
    })

    const receipt = generateReceipt(unicodeLog)
    expect(receipt.action).toBe('VALIDATE_🔐_SECURE')
    expect(verifyReceipt(receipt)).toBe(true)
  })
})
