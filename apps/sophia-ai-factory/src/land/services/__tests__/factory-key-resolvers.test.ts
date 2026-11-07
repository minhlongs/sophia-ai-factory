/**
 * Unit tests for the BYOK + env credential gates in `factory-key-resolvers`.
 *
 * These resolvers decide which credential a paid provider call is billed to.
 * The distinction that matters: a stored key that *cannot be read* is not the
 * same as a key that was *never added*. On a store or decryption outage the
 * resolvers must return null (fail closed) instead of silently falling back to
 * the environment key, because doing so would spend platform credit on a call
 * the customer entered their own key for, and would label the spend as theirs
 * when their credential state is in fact unknown.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { mockLookupUserApiKey } = vi.hoisted(() => ({ mockLookupUserApiKey: vi.fn() }))

vi.mock('@/tree/byok/user-api-key-store', () => ({
  lookupUserApiKey: mockLookupUserApiKey,
}))

describe('factory-key-resolvers — fail-closed credential gate', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.HEYGEN_API_KEY
    delete process.env.REPLICATE_API_TOKEN
    delete process.env.OPENROUTER_API_KEY
    delete process.env.NEXT_PUBLIC_MOCK_AI_SERVICES
    delete process.env.BYOK_ENABLED
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('resolveHeygenKey', () => {
    it('returns the customer key when the stored key reads successfully', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('BYOK_ENABLED', '1')
      mockLookupUserApiKey.mockResolvedValue({ status: 'FOUND', key: 'heygen-customer-key' })

      const { resolveHeygenKey } = await import('../factory-key-resolvers')

      await expect(resolveHeygenKey('usr_1')).resolves.toBe('heygen-customer-key')
      expect(mockLookupUserApiKey).toHaveBeenCalledWith('usr_1', 'heygen')
    })

    it('falls back to the env key when the customer has no stored key', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('BYOK_ENABLED', '1')
      vi.stubEnv('HEYGEN_API_KEY', 'heygen-env-key')
      mockLookupUserApiKey.mockResolvedValue({ status: 'NOT_CONFIGURED' })

      const { resolveHeygenKey } = await import('../factory-key-resolvers')

      // Not-configured is the one legitimate fallback: the customer explicitly
      // never added a key, so platform credit is the intended payer.
      await expect(resolveHeygenKey('usr_1')).resolves.toBe('heygen-env-key')
    })

    it.each(['STORE_UNAVAILABLE', 'DECRYPT_FAILED', 'KEY_VERSION_UNSUPPORTED'] as const)(
      'returns null instead of the env key on %s, so platform credit is never spent by guess',
      async (status) => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('BYOK_ENABLED', '1')
        vi.stubEnv('HEYGEN_API_KEY', 'heygen-env-key')
        mockLookupUserApiKey.mockResolvedValue({ status })

        const { resolveHeygenKey } = await import('../factory-key-resolvers')

        await expect(resolveHeygenKey('usr_1')).resolves.toBeNull()
      },
    )
  })

  describe('resolveReplicateKey', () => {
    it('returns the customer key when the stored key reads successfully', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('BYOK_ENABLED', '1')
      mockLookupUserApiKey.mockResolvedValue({ status: 'FOUND', key: 'replicate-customer-key' })

      const { resolveReplicateKey } = await import('../factory-key-resolvers')

      await expect(resolveReplicateKey('usr_1')).resolves.toBe('replicate-customer-key')
      expect(mockLookupUserApiKey).toHaveBeenCalledWith('usr_1', 'replicate')
    })

    it('returns null on a store outage rather than billing the platform key', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('BYOK_ENABLED', '1')
      vi.stubEnv('REPLICATE_API_TOKEN', 'replicate-env-token')
      mockLookupUserApiKey.mockResolvedValue({ status: 'DECRYPT_FAILED' })

      const { resolveReplicateKey } = await import('../factory-key-resolvers')

      await expect(resolveReplicateKey('usr_1')).resolves.toBeNull()
    })
  })

  describe('resolveKey', () => {
    it('returns the customer key when the stored key reads successfully', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      mockLookupUserApiKey.mockResolvedValue({ status: 'FOUND', key: 'or-customer-key' })

      const { resolveKey } = await import('../factory-key-resolvers')

      await expect(resolveKey('OPENROUTER_API_KEY', 'openrouter', 'usr_1')).resolves.toBe(
        'or-customer-key',
      )
      expect(mockLookupUserApiKey).toHaveBeenCalledWith('usr_1', 'openrouter')
    })

    it('falls back to env when the provider is simply not configured', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('OPENROUTER_API_KEY', 'or-env-key')
      mockLookupUserApiKey.mockResolvedValue({ status: 'NOT_CONFIGURED' })

      const { resolveKey } = await import('../factory-key-resolvers')

      await expect(resolveKey('OPENROUTER_API_KEY', 'openrouter', 'usr_1')).resolves.toBe(
        'or-env-key',
      )
    })

    it('returns null on an unreadable store rather than falling back to env', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('OPENROUTER_API_KEY', 'or-env-key')
      mockLookupUserApiKey.mockResolvedValue({ status: 'STORE_UNAVAILABLE' })

      const { resolveKey } = await import('../factory-key-resolvers')

      await expect(resolveKey('OPENROUTER_API_KEY', 'openrouter', 'usr_1')).resolves.toBeNull()
    })
  })
})
