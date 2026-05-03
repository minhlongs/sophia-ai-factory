/**
 * Tests for per-user BYOK provider router (provider-router.ts)
 *
 * 7 cases:
 *   1. userId falsy → null
 *   2. KV flag returns false → null
 *   3. KV on + user has no endpoint → null
 *   4. KV on + endpoint but no bearer → { endpoint } (no bearer field)
 *   5. KV on + endpoint + encrypted bearer → { endpoint, bearer: 'plaintext' }
 *   6. Decrypt fails → null (fail-closed)
 *   7. D1 query error → null (graceful)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveLocalMekongdForUser } from '@/tree/byok/provider-router'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/feature-flags', () => ({
  isEnabled: vi.fn(),
}))

vi.mock('@/tree/crypto/encrypt-secret', () => ({
  decryptSecret: vi.fn(),
}))

import { createServerClient } from '@/seed/db/client'
import { isEnabled } from '@/lib/feature-flags'
import { decryptSecret } from '@/tree/crypto/encrypt-secret'

const mockIsEnabled = vi.mocked(isEnabled)
const mockDecryptSecret = vi.mocked(decryptSecret)
const mockCreateServerClient = vi.mocked(createServerClient)

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build a chainable D1 mock that resolves maybeSingle() with given data/error */
function buildDbMock(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  }
  mockCreateServerClient.mockReturnValue({
    from: vi.fn().mockReturnValue(chain),
  } as unknown as ReturnType<typeof createServerClient>)
  return chain
}

/** Build a D1 mock that throws on maybeSingle() */
function buildDbErrorMock(message: string) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockRejectedValue(new Error(message)),
  }
  mockCreateServerClient.mockReturnValue({
    from: vi.fn().mockReturnValue(chain),
  } as unknown as ReturnType<typeof createServerClient>)
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('resolveLocalMekongdForUser()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Case 1: userId falsy
  it('returns null when userId is falsy (null)', async () => {
    const result = await resolveLocalMekongdForUser(null)
    expect(result).toBeNull()
    expect(mockIsEnabled).not.toHaveBeenCalled()
  })

  it('returns null when userId is falsy (undefined)', async () => {
    const result = await resolveLocalMekongdForUser(undefined)
    expect(result).toBeNull()
    expect(mockIsEnabled).not.toHaveBeenCalled()
  })

  it('returns null when userId is empty string', async () => {
    const result = await resolveLocalMekongdForUser('')
    expect(result).toBeNull()
    expect(mockIsEnabled).not.toHaveBeenCalled()
  })

  // Case 2: KV flag returns false
  it('returns null when KV flag local_mode_rollout is disabled for user', async () => {
    mockIsEnabled.mockResolvedValueOnce(false)

    const result = await resolveLocalMekongdForUser('user-abc')

    expect(result).toBeNull()
    expect(mockIsEnabled).toHaveBeenCalledWith('local_mode_rollout', 'user-abc')
    expect(mockCreateServerClient).not.toHaveBeenCalled()
  })

  // Case 3: KV on + no endpoint
  it('returns null when flag enabled but user has no local_mode_endpoint', async () => {
    mockIsEnabled.mockResolvedValueOnce(true)
    buildDbMock({ local_mode_endpoint: null, local_mode_bearer_encrypted: null })

    const result = await resolveLocalMekongdForUser('user-abc')

    expect(result).toBeNull()
    expect(mockDecryptSecret).not.toHaveBeenCalled()
  })

  // Case 4: KV on + endpoint, no bearer
  it('returns { endpoint } without bearer field when no encrypted bearer stored', async () => {
    mockIsEnabled.mockResolvedValueOnce(true)
    buildDbMock({
      local_mode_endpoint: 'https://mekongd.example.com',
      local_mode_bearer_encrypted: null,
    })

    const result = await resolveLocalMekongdForUser('user-abc')

    expect(result).toEqual({ endpoint: 'https://mekongd.example.com' })
    expect(result).not.toHaveProperty('bearer')
    expect(mockDecryptSecret).not.toHaveBeenCalled()
  })

  // Case 5: KV on + endpoint + encrypted bearer → decrypted
  it('returns { endpoint, bearer } when encrypted bearer decrypts successfully', async () => {
    mockIsEnabled.mockResolvedValueOnce(true)
    buildDbMock({
      local_mode_endpoint: 'https://mekongd.example.com',
      local_mode_bearer_encrypted: 'aes-gcm-ciphertext-blob',
    })
    mockDecryptSecret.mockResolvedValueOnce('plain-bearer-token')

    const result = await resolveLocalMekongdForUser('user-abc')

    expect(result).toEqual({
      endpoint: 'https://mekongd.example.com',
      bearer: 'plain-bearer-token',
    })
    expect(mockDecryptSecret).toHaveBeenCalledWith('aes-gcm-ciphertext-blob')
  })

  // Case 6: Decrypt fails → null (fail-closed)
  it('returns null (fail-closed) when decryptSecret throws', async () => {
    mockIsEnabled.mockResolvedValueOnce(true)
    buildDbMock({
      local_mode_endpoint: 'https://mekongd.example.com',
      local_mode_bearer_encrypted: 'tampered-or-wrong-key',
    })
    mockDecryptSecret.mockRejectedValueOnce(new Error('GCM auth tag mismatch'))

    const result = await resolveLocalMekongdForUser('user-abc')

    expect(result).toBeNull()
  })

  // Case 7: D1 query error → null (graceful)
  it('returns null gracefully when D1 query throws', async () => {
    mockIsEnabled.mockResolvedValueOnce(true)
    buildDbErrorMock('D1_ERROR: connection refused')

    const result = await resolveLocalMekongdForUser('user-abc')

    expect(result).toBeNull()
  })

  // Case 7b: D1 returns error field (non-throw path)
  it('returns null when D1 returns an error field (non-null error)', async () => {
    mockIsEnabled.mockResolvedValueOnce(true)
    buildDbMock(null, { message: 'no such column' })

    const result = await resolveLocalMekongdForUser('user-abc')

    expect(result).toBeNull()
  })

  // Case 7c: D1 row not found
  it('returns null when D1 returns no row (user not in DB)', async () => {
    mockIsEnabled.mockResolvedValueOnce(true)
    buildDbMock(null, null)

    const result = await resolveLocalMekongdForUser('user-abc')

    expect(result).toBeNull()
  })
})
