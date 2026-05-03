/**
 * Tests for JWT Nonce Tracker
 *
 * Tests replay attack prevention and nonce tracking
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  checkJwtNonce,
  markJwtNonceAsUsed,
  preRegisterNonce,
  cleanupExpiredNonces,
  getNonceStats,
} from '@/seed/auth/jwt-nonce-tracker'

// Shared mock client — all calls to createAdminClient() return same instance
const mockNonceFrom = vi.fn()
const mockNonceSupabaseClient = { from: mockNonceFrom }

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => mockNonceSupabaseClient),
}))

// Mock logger
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock KV client
const mockKvGet = vi.fn()
const mockKvSet = vi.fn()

describe('checkJwtNonce', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset KV client mock
    mockKvGet.mockReset()
    mockKvSet.mockReset()

    // Mock global KV
    Object.defineProperty(globalThis, 'KV_KV', {
      value: {
        get: mockKvGet,
        set: mockKvSet,
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    // Reset KV_KV to undefined rather than deleting (property may be non-configurable from setup)
    ;(globalThis as any).KV_KV = undefined
  })

  it('should return invalid for empty nonce', async () => {
    const result = await checkJwtNonce('')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('invalid')
  })

  it('should return invalid for short nonce', async () => {
    const result = await checkJwtNonce('short')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('invalid')
  })

  it('should return valid when nonce not in KV cache', async () => {
    mockKvGet.mockResolvedValue(null)

    const { createServerClient } = await import('@/seed/db/client')
    const db = vi.mocked(createServerClient)()

    vi.mocked(mockNonceFrom).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    } as any)

    const result = await checkJwtNonce('valid-nonce-12345')

    expect(result.valid).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('should return already-used when nonce is marked as used in KV', async () => {
    mockKvGet.mockResolvedValue({
      used: true,
      userId: 'user-123',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    })

    const result = await checkJwtNonce('reused-nonce-12345')

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('already-used')
  })

  it('should return expired when nonce is expired in KV', async () => {
    mockKvGet.mockResolvedValue({
      used: false,
      userId: 'user-123',
      expiresAt: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    })

    const result = await checkJwtNonce('expired-nonce-12345')

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('expired')
  })

  it('should fall back to DB when KV is unavailable', async () => {
    // Remove KV client
    // Reset KV_KV to undefined rather than deleting (property may be non-configurable from setup)
    ;(globalThis as any).KV_KV = undefined

    const { createServerClient } = await import('@/seed/db/client')
    const db = vi.mocked(createServerClient)()

    vi.mocked(mockNonceFrom).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    } as any)

    const result = await checkJwtNonce('db-fallback-nonce')

    expect(result.valid).toBe(true)
  })

  it('should return already-used when DB shows used_at', async () => {
    mockKvGet.mockResolvedValue(null)

    const { createServerClient } = await import('@/seed/db/client')
    const db = vi.mocked(createServerClient)()

    vi.mocked(mockNonceFrom).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            used_at: Math.floor(Date.now() / 1000),
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
          error: null,
        }),
      }),
    } as any)

    const result = await checkJwtNonce('used-nonce-12345')

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('already-used')
  })

  it('should fail open on database error', async () => {
    // Reset KV_KV to undefined rather than deleting (property may be non-configurable from setup)
    ;(globalThis as any).KV_KV = undefined

    const { createServerClient } = await import('@/seed/db/client')
    const db = vi.mocked(createServerClient)()

    vi.mocked(mockNonceFrom).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockRejectedValue(new Error('DB error')),
      }),
    } as any)

    const result = await checkJwtNonce('error-nonce')

    expect(result.valid).toBe(true) // Fail open
  })
})

describe('markJwtNonceAsUsed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockKvGet.mockReset()
    mockKvSet.mockReset()

    Object.defineProperty(globalThis, 'KV_KV', {
      value: {
        get: mockKvGet,
        set: mockKvSet,
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    // Reset KV_KV to undefined rather than deleting (property may be non-configurable from setup)
    ;(globalThis as any).KV_KV = undefined
  })

  it('should mark nonce as used in both KV and DB', async () => {
    mockKvSet.mockResolvedValue(undefined)

    const { createServerClient } = await import('@/seed/db/client')
    const db = vi.mocked(createServerClient)()

    vi.mocked(mockNonceFrom).mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    } as any)

    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + 3600

    const result = await markJwtNonceAsUsed('new-nonce', 'user-123', expiresAt)

    expect(result).toBe(true)
    expect(mockKvSet).toHaveBeenCalledWith(
      `nonce:new-nonce`,
      expect.objectContaining({ used: true }),
      expect.any(Object)
    )
  })

  it('should succeed even if KV write fails', async () => {
    mockKvSet.mockRejectedValue(new Error('KV error'))

    const { createServerClient } = await import('@/seed/db/client')
    const db = vi.mocked(createServerClient)()

    vi.mocked(mockNonceFrom).mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    } as any)

    const result = await markJwtNonceAsUsed('kv-fail-nonce', 'user-123', Date.now() + 3600)

    expect(result).toBe(true) // DB write succeeded
  })

  it('should return false when DB write fails', async () => {
    mockKvSet.mockResolvedValue(undefined)

    const { createServerClient } = await import('@/seed/db/client')
    const db = vi.mocked(createServerClient)()

    vi.mocked(mockNonceFrom).mockReturnValue({
      upsert: vi.fn().mockRejectedValue(new Error('DB error')),
    } as any)

    const result = await markJwtNonceAsUsed('db-fail-nonce', 'user-123', Date.now() + 3600)

    expect(result).toBe(false)
  })
})

describe('preRegisterNonce', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockKvGet.mockReset()
    mockKvSet.mockReset()

    Object.defineProperty(globalThis, 'KV_KV', {
      value: {
        get: mockKvGet,
        set: mockKvSet,
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    // Reset KV_KV to undefined rather than deleting (property may be non-configurable from setup)
    ;(globalThis as any).KV_KV = undefined
  })

  it('should pre-register nonce in KV cache', async () => {
    mockKvSet.mockResolvedValue(undefined)

    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + 3600

    const result = await preRegisterNonce('future-nonce', 'user-123', expiresAt)

    expect(result).toBe(true)
    expect(mockKvSet).toHaveBeenCalledWith(
      `nonce:future-nonce`,
      expect.objectContaining({ used: false }),
      expect.any(Object)
    )
  })

  it('should return false when KV is unavailable', async () => {
    // Reset KV_KV to undefined rather than deleting (property may be non-configurable from setup)
    ;(globalThis as any).KV_KV = undefined

    const result = await preRegisterNonce('no-kv-nonce', 'user-123', Date.now() + 3600)

    expect(result).toBe(false)
  })

  it('should return false when KV write fails', async () => {
    mockKvSet.mockRejectedValue(new Error('KV error'))

    const result = await preRegisterNonce('kv-error-nonce', 'user-123', Date.now() + 3600)

    expect(result).toBe(false)
  })
})

describe('cleanupExpiredNonces', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete expired nonces from database', async () => {
    const { createServerClient } = await import('@/seed/db/client')
    const db = vi.mocked(createServerClient)()

    vi.mocked(mockNonceFrom).mockReturnValue({
      delete: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: 1 }, { id: 2 }, { id: 3 }],
            error: null,
          }),
        }),
      }),
    } as any)

    const result = await cleanupExpiredNonces()

    expect(result).toBe(3)
  })

  it('should return 0 when cleanup fails', async () => {
    const { createServerClient } = await import('@/seed/db/client')
    const db = vi.mocked(createServerClient)()

    vi.mocked(mockNonceFrom).mockReturnValue({
      delete: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          select: vi.fn().mockRejectedValue(new Error('Cleanup error')),
        }),
      }),
    } as any)

    const result = await cleanupExpiredNonces()

    expect(result).toBe(0)
  })

  it('should handle empty result', async () => {
    const { createServerClient } = await import('@/seed/db/client')
    const db = vi.mocked(createServerClient)()

    vi.mocked(mockNonceFrom).mockReturnValue({
      delete: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    } as any)

    const result = await cleanupExpiredNonces()

    expect(result).toBe(0)
  })
})

describe('getNonceStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return nonce statistics', async () => {
    const { createServerClient } = await import('@/seed/db/client')
    const db = vi.mocked(createServerClient)()

    // Production code: .from().select('nonce', {count: 'exact', head: true}).gte() / .lt()
    // .gte() and .lt() are the terminal calls that return promises
    vi.mocked(mockNonceFrom).mockReturnValue({
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockResolvedValue({ count: 150, error: null }),
        lt: vi.fn().mockResolvedValue({ count: 50, error: null }),
      }),
    } as any)

    const result = await getNonceStats()

    expect(result.totalActive).toBe(150)
    expect(result.expiredCount).toBe(50)
    expect(result.replayAttemptsDetected).toBe(0)
  })

  it('should handle null counts', async () => {
    const { createServerClient } = await import('@/seed/db/client')
    const db = vi.mocked(createServerClient)()

    vi.mocked(mockNonceFrom).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          count: null,
          error: null,
        }),
      }),
      lt: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          count: null,
          error: null,
        }),
      }),
    } as any)

    const result = await getNonceStats()

    expect(result.totalActive).toBe(0)
    expect(result.expiredCount).toBe(0)
  })

  it('should return zeros on error', async () => {
    const { createServerClient } = await import('@/seed/db/client')
    const db = vi.mocked(createServerClient)()

    vi.mocked(mockNonceFrom).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnValue({
        select: vi.fn().mockRejectedValue(new Error('Stats error')),
      }),
      lt: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          count: null,
          error: null,
        }),
      }),
    } as any)

    const result = await getNonceStats()

    expect(result.totalActive).toBe(0)
    expect(result.expiredCount).toBe(0)
    expect(result.replayAttemptsDetected).toBe(0)
  })
})
