/**
 * Tests for API Key Validator
 *
 * Tests format validation, generation, and database validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  validateApiKeyFormat,
  extractKeyIdAndSignature,
  generateApiKey,
  checkApiKey,
  validateApiKey,
  revokeApiKey,
  deleteApiKey,
  getUserApiKeys,
} from '@/lib/security/api-key-validator'

// Mock Supabase admin client
const mockSupabase = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockSupabase,
}))

// Mock crypto-utils
vi.mock('@/lib/audit/crypto-utils', async () => {
  const actual = await vi.importActual('@/lib/audit/crypto-utils')
  return {
    ...(actual as any),
    hmacSha256: vi.fn((data: string, secret: string) => {
      // Return consistent 64-char hex hash for testing
      // The real function returns 64 chars (SHA256 = 32 bytes = 64 hex chars)
      return 'a'.repeat(64)
    }),
    timingSafeEqual: vi.fn((a: string, b: string) => a === b),
  }
})

describe('validateApiKeyFormat', () => {
  it('should accept valid mk_ API key format', () => {
    const validKey = 'mk_0123456789abcdef_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    expect(validateApiKeyFormat(validKey)).toBe(true)
  })

  it('should reject keys without mk_ prefix', () => {
    expect(validateApiKeyFormat('0123456789abcdef_signature')).toBe(false)
    expect(validateApiKeyFormat('sk_0123456789abcdef_signature')).toBe(false)
  })

  it('should reject keys with wrong keyId length', () => {
    expect(validateApiKeyFormat('mk_0123456789abcde_signature')).toBe(false)
    expect(validateApiKeyFormat('mk_0123456789abcdef0_signature')).toBe(false)
  })

  it('should reject keys with invalid hex characters', () => {
    expect(validateApiKeyFormat('mk_0123456789abcdeg_signature')).toBe(false)
    expect(validateApiKeyFormat('mk_0123456789abcdef_GHIJKL_signature')).toBe(false)
  })

  it('should reject keys with wrong signature length', () => {
    expect(validateApiKeyFormat('mk_0123456789abcdef_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde')).toBe(false)
    expect(validateApiKeyFormat('mk_0123456789abcdef_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0')).toBe(false)
  })

  it('should reject keys with non-hex signature', () => {
    expect(validateApiKeyFormat('mk_0123456789abcdef_INVALIDSIGNATURE')).toBe(false)
  })

  it('should reject keys with wrong number of underscores', () => {
    expect(validateApiKeyFormat('mk_0123456789abcdefsignature')).toBe(false)
    expect(validateApiKeyFormat('mk_0123456789abcdef_sig_nature')).toBe(false)
  })

  it('should reject empty or null keys', () => {
    expect(validateApiKeyFormat('')).toBe(false)
    expect(validateApiKeyFormat(null as any)).toBe(false)
    expect(validateApiKeyFormat(undefined as any)).toBe(false)
  })
})

describe('extractKeyIdAndSignature', () => {
  it('should extract keyId and signature from valid key', () => {
    const key = 'mk_0123456789abcdef_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    const result = extractKeyIdAndSignature(key)

    expect(result).toEqual({
      keyId: '0123456789abcdef',
      signature: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    })
  })

  it('should return null for invalid key', () => {
    expect(extractKeyIdAndSignature('invalid')).toBe(null)
    expect(extractKeyIdAndSignature('mk_tooshort_sig')).toBe(null)
  })
})

describe('generateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate API key with correct format', async () => {
    const mockInsert = {
      data: { id: '1', key_id: '0123456789abcdef', owner_id: 'user-123' },
      error: null,
    }

    mockSupabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(mockInsert),
        }),
      }),
    })

    const result = await generateApiKey('user-123', ['audit:read', 'audit:write'])

    expect(result.apiKey).toMatch(/^mk_[0-9a-f]{16}_[0-9a-f]{64}$/)
    expect(result.keyId).toHaveLength(16)
    expect(result.keyPrefix).toHaveLength(8)
  })

  it('should generate API key with custom expiration', async () => {
    const mockInsert = {
      data: { id: '1', key_id: '0123456789abcdef', owner_id: 'user-123' },
      error: null,
    }

    mockSupabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(mockInsert),
        }),
      }),
    })

    const expiresAt = Date.now() + 86400000
    const result = await generateApiKey('user-123', ['audit:read'], expiresAt)

    expect(result.apiKey).toMatch(/^mk_/)
  })

  it('should generate API key with custom rate limit', async () => {
    const mockInsert = {
      data: { id: '1', key_id: '0123456789abcdef', owner_id: 'user-123' },
      error: null,
    }

    mockSupabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(mockInsert),
        }),
      }),
    })

    const result = await generateApiKey('user-123', ['audit:read'], undefined, 50)

    expect(result.apiKey).toMatch(/^mk_/)
  })

  it('should throw error on database failure', async () => {
    mockSupabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
        }),
      }),
    })

    await expect(generateApiKey('user-123', ['audit:read']))
      .rejects.toThrow('Failed to generate API key')
  })
})

describe('checkApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return valid result for existing key', async () => {
    // Setup hmacSha256 mock to return consistent hash for signature verification
    const { hmacSha256, timingSafeEqual } = await import('@/lib/audit/crypto-utils')
    vi.mocked(hmacSha256).mockReturnValue('a'.repeat(64))
    vi.mocked(timingSafeEqual).mockReturnValue(true)

    const mockKey = {
      id: '1',
      key_id: '0123456789abcdef',
      owner_id: 'user-123',
      permissions: ['audit:read'],
      created_at: 1234567890,
      expires_at: null,
      revoked_at: null,
      last_used_at: null,
      rate_limit_per_min: 100,
    }

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockKey, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    // Use the mock signature that timingSafeEqual will accept (64 chars)
    const mockSignature = 'a'.repeat(64)
    const result = await checkApiKey('0123456789abcdef', mockSignature)

    expect(result.valid).toBe(true)
    expect(result.apiKey).toBeDefined()
    expect(result.apiKey?.keyId).toBe('0123456789abcdef')
    expect(result.apiKey?.ownerId).toBe('user-123')
  })

  it('should return not-found for non-existent key', async () => {
    const { hmacSha256, timingSafeEqual } = await import('@/lib/audit/crypto-utils')
    vi.mocked(hmacSha256).mockReturnValue('a'.repeat(64))
    vi.mocked(timingSafeEqual).mockReturnValue(true)

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
        }),
      }),
    })

    const mockSignature = 'a'.repeat(64)
    const result = await checkApiKey('0123456789abcdef', mockSignature)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('not-found')
  })

  it('should return expired for expired key', async () => {
    const { hmacSha256, timingSafeEqual } = await import('@/lib/audit/crypto-utils')
    vi.mocked(hmacSha256).mockReturnValue('a'.repeat(64))
    vi.mocked(timingSafeEqual).mockReturnValue(true)

    const expiredKey = {
      id: '1',
      key_id: '0123456789abcdef',
      owner_id: 'user-123',
      permissions: ['audit:read'],
      created_at: 1234567890,
      expires_at: 1234567890,
      revoked_at: null,
      last_used_at: null,
      rate_limit_per_min: 100,
    }

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: expiredKey, error: null }),
        }),
      }),
    })

    const mockSignature = 'a'.repeat(64)
    const result = await checkApiKey('0123456789abcdef', mockSignature)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('expired')
  })

  it('should return revoked for revoked key', async () => {
    const { hmacSha256, timingSafeEqual } = await import('@/lib/audit/crypto-utils')
    vi.mocked(hmacSha256).mockReturnValue('a'.repeat(64))
    vi.mocked(timingSafeEqual).mockReturnValue(true)

    const revokedKey = {
      id: '1',
      key_id: '0123456789abcdef',
      owner_id: 'user-123',
      permissions: ['audit:read'],
      created_at: 1234567890,
      expires_at: null,
      revoked_at: 1234567890,
      last_used_at: null,
      rate_limit_per_min: 100,
    }

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: revokedKey, error: null }),
        }),
      }),
    })

    const mockSignature = 'a'.repeat(64)
    const result = await checkApiKey('0123456789abcdef', mockSignature)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('revoked')
  })
})

describe('validateApiKey', () => {
  it('should return missing-key for null', async () => {
    const result = await validateApiKey(null)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('missing-key')
  })

  it('should return invalid-format for wrong format', async () => {
    const result = await validateApiKey('invalid_key')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('invalid-format')
  })
})

describe('revokeApiKey', () => {
  it('should revoke API key successfully', async () => {
    mockSupabase.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    const result = await revokeApiKey('test-key-id')

    expect(result).toBe(true)
  })

  it('should return false on failure', async () => {
    mockSupabase.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: new Error('DB error') }),
      }),
    })

    const result = await revokeApiKey('test-key-id')

    expect(result).toBe(false)
  })
})

describe('getUserApiKeys', () => {
  it('should return array of API keys for user', async () => {
    const mockKeys = [
      {
        id: '1',
        key_id: '0123456789abcdef',
        owner_id: 'user-123',
        permissions: ['audit:read'],
        created_at: 1234567890,
        expires_at: null,
        revoked_at: null,
        last_used_at: null,
        rate_limit_per_min: 100,
      },
    ]

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockKeys, error: null }),
        }),
      }),
    })

    const keys = await getUserApiKeys('user-123')

    expect(Array.isArray(keys)).toBe(true)
    expect(keys.length).toBe(1)
    expect(keys[0].keyId).toBe('0123456789abcdef')
  })

  it('should return empty array on error', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
        }),
      }),
    })

    const keys = await getUserApiKeys('user-123')

    expect(keys).toEqual([])
  })
})

describe('deleteApiKey', () => {
  it('should delete API key successfully', async () => {
    mockSupabase.from.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    const result = await deleteApiKey('test-key-id')

    expect(result).toBe(true)
  })

  it('should return false on failure', async () => {
    mockSupabase.from.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: new Error('DB error') }),
      }),
    })

    const result = await deleteApiKey('test-key-id')

    expect(result).toBe(false)
  })
})
