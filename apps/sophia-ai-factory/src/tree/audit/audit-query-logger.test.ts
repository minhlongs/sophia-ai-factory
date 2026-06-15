/**
 * Tests for Audit Query Logger
 *
 * Tests self-auditing, query logging, and GDPR redaction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  logAuditQuery,
  logApiKeyCreation,
  logApiKeyRevocation,
  logApiKeyValidationFailure,
  queryAuditLogs,
} from '@/tree/audit/audit-query-logger'

// Mock Supabase admin client
const mockFrom = {
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn(),
  eq: vi.fn().mockReturnThis(),
}
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => mockFrom),
  })),
}))

// Mock logger
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Import mocked modules after vi.mock
import { createServerClient } from '@/seed/db/client'

describe('logAuditQuery', () => {
  let mockSupabase: any
  let mockFrom: any
  let mockSingle: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle = vi.fn()
    mockFrom = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: mockSingle,
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    mockSupabase = {
      from: vi.fn().mockReturnValue(mockFrom),
    }
    vi.mocked(createServerClient).mockReturnValue(mockSupabase)
  })

  it('should log audit query successfully', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'log-123' }, error: null })

    const result = await logAuditQuery({
      queriedBy: 'user-123',
      apiKeyId: 'key-456',
      filters: {
        dateFrom: 1234567890,
        dateTo: 1234567899,
        action: 'USAGE',
      },
      resultCount: 50,
      duration: 125,
    })

    expect(result).toBe(true)
  })

  it('should return false on database error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: new Error('DB error') })

    const result = await logAuditQuery({
      queriedBy: 'user-123',
      apiKeyId: 'key-456',
      filters: {},
      resultCount: 10,
      duration: 50,
    })

    expect(result).toBe(false)
  })

  it('should include IP address and user agent when provided', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'log-123' }, error: null })

    await logAuditQuery({
      queriedBy: 'user-123',
      apiKeyId: 'key-456',
      filters: {},
      resultCount: 10,
      duration: 50,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    })

    const insertCall = mockFrom.insert.mock.calls[0][0]
    expect(insertCall.ip_address).toBe('192.168.1.1')
    expect(insertCall.user_agent).toBe('Mozilla/5.0')
  })
})

describe('logApiKeyCreation', () => {
  let mockSupabase: any
  let mockFrom: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom = {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockSupabase = {
      from: vi.fn().mockReturnValue(mockFrom),
    }
    vi.mocked(createServerClient).mockReturnValue(mockSupabase)
  })

  it('should log API key creation successfully', async () => {
    mockFrom.insert.mockResolvedValue({ data: null, error: null })

    const result = await logApiKeyCreation(
      'user-123',
      'key-456',
      ['audit:read', 'audit:write'],
      '192.168.1.1'
    )

    expect(result).toBe(true)

    const insertCall = mockFrom.insert.mock.calls[0][0]
    expect(insertCall.action).toBe('API_KEY_CREATE')
    expect(insertCall.user_id).toBe('user-123')
  })

  it('should return false on error', async () => {
    mockFrom.insert.mockResolvedValue({ data: null, error: new Error('DB error') })

    const result = await logApiKeyCreation('user-123', 'key-456', ['audit:read'])

    expect(result).toBe(false)
  })
})

describe('logApiKeyRevocation', () => {
  let mockSupabase: any
  let mockFrom: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom = {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockSupabase = {
      from: vi.fn().mockReturnValue(mockFrom),
    }
    vi.mocked(createServerClient).mockReturnValue(mockSupabase)
  })

  it('should log API key revocation with reason', async () => {
    mockFrom.insert.mockResolvedValue({ data: null, error: null })

    const result = await logApiKeyRevocation(
      'admin-123',
      'key-456',
      'Security violation',
      '192.168.1.1'
    )

    expect(result).toBe(true)

    const insertCall = mockFrom.insert.mock.calls[0][0]
    expect(insertCall.action).toBe('API_KEY_REVOKE')
    expect(insertCall.user_id).toBe('admin-123')
  })

  it('should handle revocation without reason', async () => {
    mockFrom.insert.mockResolvedValue({ data: null, error: null })

    const result = await logApiKeyRevocation('admin-123', 'key-456')

    expect(result).toBe(true)
  })
})

describe('logApiKeyValidationFailure', () => {
  let mockSupabase: any
  let mockFrom: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom = {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockSupabase = {
      from: vi.fn().mockReturnValue(mockFrom),
    }
    vi.mocked(createServerClient).mockReturnValue(mockSupabase)
  })

  it('should log validation failure', async () => {
    mockFrom.insert.mockResolvedValue({ data: null, error: null })

    const result = await logApiKeyValidationFailure(
      'key-456',
      'expired',
      '192.168.1.1'
    )

    expect(result).toBe(true)

    const insertCall = mockFrom.insert.mock.calls[0][0]
    expect(insertCall.action).toBe('API_KEY_VALIDATION_FAILURE')
  })
})

describe('queryAuditLogs', () => {
  let mockSupabase: any
  let mockFrom: any
  let mockOrder: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockOrder = vi.fn().mockResolvedValue({ data: [], error: null })
    mockFrom = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      order: mockOrder,
    }
    mockSupabase = {
      from: vi.fn().mockReturnValue(mockFrom),
    }
    vi.mocked(createServerClient).mockReturnValue(mockSupabase)
  })

  it('should query audit logs with filters', async () => {
    const mockLogs = [
      { id: '1', action: 'USAGE', created_at: 1234567890 },
      { id: '2', action: 'VALIDATE', created_at: 1234567891 },
    ]
    mockOrder.mockResolvedValue({ data: mockLogs, error: null })

    const results = await queryAuditLogs({
      dateFrom: 1234567890,
      dateTo: 1234567899,
      action: 'USAGE',
      limit: 50,
      offset: 0,
    })

    // Check key properties since implementation may add additional properties
    expect(results).toHaveLength(2)
    expect(results[0].id).toBe('1')
    expect(results[0].action).toBe('USAGE')
    expect(results[1].id).toBe('2')
    expect(results[1].action).toBe('VALIDATE')
  })

  it('should apply GDPR redaction when includePII is false', async () => {
    const mockLogs = [
      {
        id: '1',
        action: 'USAGE',
        ip_address: '192.168.1.1',
        ip_address_hash: 'hashed_ip',
        user_id: 'user-123',
        user_pseudonym: 'pseudonym-123',
      },
    ]
    mockOrder.mockResolvedValue({ data: mockLogs, error: null })

    // includePII defaults to false
    const results = await queryAuditLogs({})

    // GDPR redaction replaces ip_address with ip_address_hash and user_id with user_pseudonym
    expect(results[0].ip_address).toBe('hashed_ip') // Redacted
    expect(results[0].user_id).toBe('pseudonym-123') // Pseudonymized
  })

  it('should return empty array on error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: new Error('DB error') })

    const results = await queryAuditLogs({})

    expect(results).toEqual([])
  })

  it('should use default pagination when not specified', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    await queryAuditLogs({})

    // Verify default pagination was applied
    expect(mockFrom.range).toHaveBeenCalledWith(0, 99) // default limit 100, offset 0
  })
})
