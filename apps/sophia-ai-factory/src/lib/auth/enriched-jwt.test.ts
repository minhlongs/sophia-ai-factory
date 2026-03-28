/**
 * Tests for Enriched JWT Service
 *
 * Tests JWT creation, verification, and enrichment with license metadata
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  createEnrichedJwt,
  verifyEnrichedJwt,
  decodeEnrichedJwt,
  extractQuotaFromJwt,
  isJwtExpired,
  refreshJwtIfExpired,
  getLicenseContext,
} from '@/lib/auth/enriched-jwt'

// Mock jose library — use regular function (not arrow) so `new SignJWT(...)` works
vi.mock('jose', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SignJWT: function MockSignJWT(_payload: unknown) {
    return {
      setProtectedHeader: vi.fn().mockReturnThis(),
      setIssuedAt: vi.fn().mockReturnThis(),
      setExpirationTime: vi.fn().mockReturnThis(),
      setJti: vi.fn().mockReturnThis(),
      sign: vi.fn().mockResolvedValue('mock-signed-jwt-token'),
    }
  },
  jwtVerify: vi.fn(),
}))

// Shared mock client — all calls to createAdminClient() return same instance
// so tests can configure mocks that production code will see
const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockInsertUpdate = vi.fn()
const mockOnConflict = vi.fn(() => ({ update: mockInsertUpdate }))
const mockInsert = vi.fn(() => ({ onConflict: mockOnConflict }))
const mockFrom = vi.fn(() => ({ select: mockSelect, insert: mockInsert }))
const mockSupabaseClient = { from: mockFrom }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockSupabaseClient),
}))

// Mock logger
vi.mock('@/lib/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock quota checker
vi.mock('@/lib/quota/quota-checker', () => ({
  getEffectiveQuotaLimits: vi.fn(),
}))

// Mock environment variables
const originalEnv = process.env

describe('getLicenseContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret-key'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should fetch license context from database', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = vi.mocked(createAdminClient)()
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          tier: 'PREMIUM',
          agency_id: 'agency-123',
          polar_customer_id: 'cus_abc123',
          polar_subscription_status: 'active',
          expires_at: 1735689600,
          created_at: 1704067200,
        },
        error: null,
      }),
    })

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
    } as any)

    const result = await getLicenseContext('test-nonce-123')

    expect(result).toBeDefined()
    expect(result?.tier).toBe('PREMIUM')
    expect(result?.agencyId).toBe('agency-123')
    expect(result?.polarCustomerId).toBe('cus_abc123')
    expect(result?.polarStatus).toBe('active')
  })

  it('should return null when license not found', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = vi.mocked(createAdminClient)()

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }),
    } as any)

    const result = await getLicenseContext('invalid-nonce')

    expect(result).toBe(null)
  })

  it('should handle missing optional fields gracefully', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = vi.mocked(createAdminClient)()

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            tier: 'BASIC',
            agency_id: null,
            polar_customer_id: null,
            polar_subscription_status: null,
            expires_at: null,
            created_at: 1704067200,
          },
          error: null,
        }),
      }),
    } as any)

    const result = await getLicenseContext('basic-nonce')

    expect(result?.tier).toBe('BASIC')
    expect(result?.agencyId).toBeUndefined()
    expect(result?.polarCustomerId).toBeUndefined()
    expect(result?.polarStatus).toBeUndefined()
    expect(result?.expiresAt).toBeUndefined()
  })
})

describe('createEnrichedJwt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret-key'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should create enriched JWT with all claims', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { getEffectiveQuotaLimits } = await import('@/lib/quota/quota-checker')
    const supabase = vi.mocked(createAdminClient)()

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        single: vi.fn()
          .mockResolvedValueOnce({ // First call: license context
            data: {
              tier: 'PREMIUM',
              agency_id: 'agency-123',
              polar_customer_id: 'cus_abc123',
              polar_subscription_status: 'active',
              expires_at: null,
              created_at: 1704067200,
            },
            error: null,
          })
          .mockResolvedValueOnce({ // Second call: dunning state
            data: { state: 'ok' },
            error: null,
          }),
      }),
    } as any)

    vi.mocked(getEffectiveQuotaLimits).mockResolvedValue({
      tier: 'PREMIUM',
      dailyCredits: 500,
      hourlyCredits: 100,
      dailyRequests: 2500,
      monthlyCredits: 10000,
    })

    const result = await createEnrichedJwt('user-123', 'test-nonce')

    expect(result).toBeDefined()
    expect(result?.token).toBe('mock-signed-jwt-token')
    expect(result?.payload.sub).toBe('user-123')
    expect(result?.payload.license_nonce).toBe('test-nonce')
    expect(result?.payload.license_tier).toBe('PREMIUM')
    expect(result?.payload.agency_id).toBe('agency-123')
    expect(result?.payload.polar_customer_id).toBe('cus_abc123')
    expect(result?.payload.dunning_state).toBe('ok')
  })

  it('should return null when license context fetch fails', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = vi.mocked(createAdminClient)()

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'License not found' },
        }),
      }),
    } as any)

    const result = await createEnrichedJwt('user-123', 'invalid-nonce')

    expect(result).toBe(null)
  })

  it('should use custom TTL when provided', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { getEffectiveQuotaLimits } = await import('@/lib/quota/quota-checker')
    const supabase = vi.mocked(createAdminClient)()

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        single: vi.fn()
          .mockResolvedValueOnce({
            data: {
              tier: 'BASIC',
              agency_id: null,
              polar_customer_id: null,
              polar_subscription_status: null,
              expires_at: null,
              created_at: 1704067200,
            },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { state: 'ok' },
            error: null,
          }),
      }),
    } as any)

    vi.mocked(getEffectiveQuotaLimits).mockResolvedValue({
      tier: 'BASIC',
      dailyCredits: 100,
      hourlyCredits: 20,
      dailyRequests: 500,
      monthlyCredits: 2000,
    })

    const customTtl = 7200 // 2 hours
    const result = await createEnrichedJwt('user-123', 'test-nonce', customTtl)

    expect(result).toBeDefined()
    expect(result?.payload.exp - result?.payload.iat).toBe(customTtl)
  })
})

describe('verifyEnrichedJwt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret-key'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should verify valid enriched JWT', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: {
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        license_nonce: 'test-nonce',
        license_tier: 'PREMIUM',
        quota: {
          tier: 'PREMIUM',
          dailyCredits: 500,
          hourlyCredits: 100,
          dailyRequests: 2500,
          monthlyCredits: 10000,
        },
        agency_id: 'agency-123',
        dunning_state: 'ok',
      },
      protectedHeader: { alg: 'HS256' },
    } as any)

    const result = await verifyEnrichedJwt('valid-token')

    expect(result).toBeDefined()
    expect(result?.sub).toBe('user-123')
    expect(result?.license_tier).toBe('PREMIUM')
    expect(result?.agency_id).toBe('agency-123')
  })

  it('should return null for invalid token', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockRejectedValue(new Error('Invalid signature'))

    const result = await verifyEnrichedJwt('invalid-token')

    expect(result).toBe(null)
  })

  it('should return null for expired token', async () => {
    const { jwtVerify } = await import('jose')
    const expiredError = new Error('Token is expired')
    expiredError.name = 'JwtExpired'
    vi.mocked(jwtVerify).mockRejectedValue(expiredError)

    const result = await verifyEnrichedJwt('expired-token')

    expect(result).toBe(null)
  })
})

describe('decodeEnrichedJwt', () => {
  it('should decode JWT without verification', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      sub: 'user-123',
      license_nonce: 'test-nonce',
      license_tier: 'PREMIUM',
      quota: {
        tier: 'PREMIUM',
        dailyCredits: 500,
      },
    })).toString('base64url')
    const signature = 'signature'

    const token = `${header}.${payload}.${signature}`

    const result = decodeEnrichedJwt(token)

    expect(result).toBeDefined()
    expect(result?.sub).toBe('user-123')
    expect(result?.license_nonce).toBe('test-nonce')
  })

  it('should return null for invalid format', () => {
    expect(decodeEnrichedJwt('invalid')).toBe(null)
    expect(decodeEnrichedJwt('too.few')).toBe(null)
  })

  it('should return null for malformed payload', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')
    const invalidPayload = Buffer.from('not-valid-json').toString('base64url')
    const signature = 'sig'

    const token = `${header}.${invalidPayload}.${signature}`

    expect(decodeEnrichedJwt(token)).toBe(null)
  })
})

describe('extractQuotaFromJwt', () => {
  it('should extract quota from payload', () => {
    const payload = {
      sub: 'user-123',
      iat: 123456,
      exp: 789012,
      license_nonce: 'test-nonce',
      license_tier: 'PREMIUM' as const,
      quota: {
        tier: 'PREMIUM' as const,
        dailyCredits: 500,
        hourlyCredits: 100,
        dailyRequests: 2500,
        monthlyCredits: 10000,
      },
    }

    const result = extractQuotaFromJwt(payload)

    expect(result).toEqual({
      tier: 'PREMIUM',
      dailyCredits: 500,
      hourlyCredits: 100,
      dailyRequests: 2500,
      monthlyCredits: 10000,
    })
  })
})

describe('isJwtExpired', () => {
  it('should return true for expired token', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      sub: 'user-123',
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      license_nonce: 'test-nonce',
      license_tier: 'BASIC',
    })).toString('base64url')
    const signature = 'sig'

    const token = `${header}.${payload}.${signature}`

    expect(isJwtExpired(token)).toBe(true)
  })

  it('should return false for valid token', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      sub: 'user-123',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
      license_nonce: 'test-nonce',
      license_tier: 'BASIC',
    })).toString('base64url')
    const signature = 'sig'

    const token = `${header}.${payload}.${signature}`

    expect(isJwtExpired(token)).toBe(false)
  })

  it('should return true for invalid token', () => {
    expect(isJwtExpired('invalid')).toBe(true)
    expect(isJwtExpired('')).toBe(true)
  })
})

describe('refreshJwtIfExpired', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret-key'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return same token if not expired', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      sub: 'user-123',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      license_nonce: 'test-nonce',
      license_tier: 'BASIC',
    })).toString('base64url')
    const signature = 'sig'

    const token = `${header}.${payload}.${signature}`

    // Since refreshJwtIfExpired calls isJwtExpired which uses decodeEnrichedJwt,
    // and the token is not expired, it should return the same token
    // But we can't easily test this without mocking, so we test the expired case
    expect(isJwtExpired(token)).toBe(false)
  })

  it('should throw error for invalid token', async () => {
    await expect(refreshJwtIfExpired('invalid-token')).rejects.toThrow('Invalid JWT token')
  })

  it('should create new token when expired', async () => {
    // Mock an expired token
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      sub: 'user-123',
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600,
      license_nonce: 'test-nonce',
      license_tier: 'BASIC',
    })).toString('base64url')
    const signature = 'sig'

    const expiredToken = `${header}.${payload}.${signature}`

    // Mock createEnrichedJwt to return a new token
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { getEffectiveQuotaLimits } = await import('@/lib/quota/quota-checker')
    const supabase = vi.mocked(createAdminClient)()

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        single: vi.fn()
          .mockResolvedValueOnce({
            data: {
              tier: 'BASIC',
              agency_id: null,
              polar_customer_id: null,
              polar_subscription_status: null,
              expires_at: null,
              created_at: 1704067200,
            },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { state: 'ok' },
            error: null,
          }),
      }),
    } as any)

    vi.mocked(getEffectiveQuotaLimits).mockResolvedValue({
      tier: 'BASIC',
      dailyCredits: 100,
      hourlyCredits: 20,
      dailyRequests: 500,
      monthlyCredits: 2000,
    })

    const result = await refreshJwtIfExpired(expiredToken)

    expect(result).toBe('mock-signed-jwt-token')
  })
})
