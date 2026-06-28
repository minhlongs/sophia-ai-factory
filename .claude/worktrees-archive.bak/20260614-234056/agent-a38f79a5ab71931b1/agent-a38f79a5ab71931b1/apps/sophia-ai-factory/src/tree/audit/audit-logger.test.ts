/**
 * Tests for Audit Logger with Compliance Receipt Generation
 *
 * Tests cover:
 * - Receipt serialization for HTTP headers
 * - Receipt parsing from headers
 * - Integration with compliance-receipt module
 *
 * Note: Database integration tests require mocking Supabase client
 * which is handled in integration tests.
 *
 * @module audit/audit-logger.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  serializeReceiptForHeader,
  parseReceiptFromHeader
} from '@/tree/audit/audit-logger'

// Mock logger for all tests
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('serializeReceiptForHeader', () => {
  it('should serialize receipt to base64url string', () => {
    const mockReceipt = {
      receiptId: 'test-id',
      auditLogId: 'log-id',
      action: 'VALIDATE',
      licenseNonce: 'nonce',
      timestamp: 1234567890,
      actorId: 'user',
      actorIpHash: 'hash123',
      contentHash: 'content',
      signature: 'signature',
      issuedAt: 1234567890,
      expiresAt: 1234571490
    }

    const serialized = serializeReceiptForHeader(mockReceipt)

    // Should be base64url encoded (no + / = padding)
    expect(serialized).toMatch(/^[a-zA-Z0-9_-]+$/)

    // Should be decodable back
    const decoded = JSON.parse(Buffer.from(serialized, 'base64url').toString('utf-8'))
    expect(decoded.receiptId).toBe('test-id')
  })

  it('should handle receipt with all fields', () => {
    const mockReceipt = {
      receiptId: '550e8400-e29b-41d4-a716-446655440000',
      auditLogId: 'audit-log-123',
      action: 'CREATE',
      licenseNonce: 'license-abc-456',
      timestamp: 1709568000,
      actorId: 'user-789',
      actorIpHash: 'a1b2c3d4e5f6...',
      contentHash: 'sha256-hash-here',
      signature: 'hmac-signature-here',
      issuedAt: 1709568000,
      expiresAt: 1709571600
    }

    const serialized = serializeReceiptForHeader(mockReceipt)
    const decoded = JSON.parse(Buffer.from(serialized, 'base64url').toString('utf-8'))

    expect(decoded.receiptId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(decoded.action).toBe('CREATE')
    expect(decoded.licenseNonce).toBe('license-abc-456')
  })
})

describe('parseReceiptFromHeader', () => {
  it('should parse base64url encoded receipt back to object', () => {
    const mockReceipt = {
      receiptId: 'test-id',
      auditLogId: 'log-id',
      action: 'VALIDATE',
      licenseNonce: 'nonce',
      timestamp: 1234567890,
      actorId: 'user',
      actorIpHash: 'hash123',
      contentHash: 'content',
      signature: 'signature',
      issuedAt: 1234567890,
      expiresAt: 1234571490
    }

    const serialized = serializeReceiptForHeader(mockReceipt)
    const parsed = parseReceiptFromHeader(serialized)

    expect(parsed).not.toBeNull()
    expect(parsed?.receiptId).toBe('test-id')
    expect(parsed?.action).toBe('VALIDATE')
  })

  it('should return null for invalid base64', () => {
    const parsed = parseReceiptFromHeader('invalid-base64!@#$')
    expect(parsed).toBeNull()
  })

  it('should return null for valid base64 but invalid JSON', () => {
    const invalidJson = Buffer.from('not-json-string').toString('base64url')
    const parsed = parseReceiptFromHeader(invalidJson)
    expect(parsed).toBeNull()
  })

  it('should return null for empty string', () => {
    const parsed = parseReceiptFromHeader('')
    expect(parsed).toBeNull()
  })

  it('should return null for non-receipt JSON', () => {
    const notReceipt = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url')
    const parsed = parseReceiptFromHeader(notReceipt)
    // parseReceipt validates required fields
    expect(parsed).toBeNull()
  })
})

describe('Integration: Receipt Header Flow', () => {
  it('should support full round-trip: serialize → parse', () => {
    const mockReceipt = {
      receiptId: 'roundtrip-id',
      auditLogId: 'log-123',
      action: 'REVOKE',
      licenseNonce: 'license-xyz',
      timestamp: 1709568000,
      actorId: 'admin',
      actorIpHash: 'ip-hash',
      contentHash: 'content-hash',
      signature: 'signature-abc',
      issuedAt: 1709568000,
      expiresAt: 1709571600
    }

    // Serialize for header
    const headerValue = serializeReceiptForHeader(mockReceipt)

    // Parse from header
    const parsed = parseReceiptFromHeader(headerValue)

    expect(parsed).not.toBeNull()
    expect(parsed?.receiptId).toBe('roundtrip-id')
    expect(parsed?.action).toBe('REVOKE')
    expect(parsed?.licenseNonce).toBe('license-xyz')
  })

  it('should preserve all fields through serialization round-trip', () => {
    const originalReceipt = {
      receiptId: 'test-receipt-id',
      auditLogId: 'audit-123',
      action: 'UPDATE',
      licenseNonce: 'license-nonce-789',
      timestamp: 1709568000,
      actorId: 'system',
      actorIpHash: '',
      contentHash: 'chain-hash-abc',
      signature: 'hmac-sig-xyz',
      issuedAt: 1709568000,
      expiresAt: 1709571600
    }

    const serialized = serializeReceiptForHeader(originalReceipt)
    const parsed = parseReceiptFromHeader(serialized)

    expect(parsed).toEqual(originalReceipt)
  })
})
