/**
 * Tests for lib/credentials/get-provider-key.ts
 *
 * Covers:
 *  - getHeyGenKey: user found -> source='user'
 *  - getHeyGenKey: user not found, fallbackToPlatform=false -> null
 *  - getHeyGenKey: user not found, fallbackToPlatform=true -> platform key
 *  - getHeyGenKey: no userId, fallbackToPlatform=true -> platform key
 *  - getResendKey: defaults fallbackToPlatform=true
 *  - getNowPaymentsKey: defaults fallbackToPlatform=true
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./user-credentials-repo', () => ({
  getUserCredential: vi.fn(),
}))

import { getUserCredential } from '@/tree/credentials/user-credentials-repo'

describe('lib/credentials/get-provider-key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('getHeyGenKey', () => {
    it('returns user key with source=user when user has key', async () => {
      vi.mocked(getUserCredential).mockResolvedValueOnce('hk_user_key')
      const { getHeyGenKey } = await import('./get-provider-key')
      const result = await getHeyGenKey({ userId: 'user-1', fallbackToPlatform: false })
      expect(result).toEqual({ key: 'hk_user_key', source: 'user' })
    })

    it('returns null when user has no key and fallbackToPlatform=false', async () => {
      vi.mocked(getUserCredential).mockResolvedValueOnce(null)
      vi.stubEnv('HEYGEN_API_KEY', 'hk_platform_key')
      const { getHeyGenKey } = await import('./get-provider-key')
      const result = await getHeyGenKey({ userId: 'user-1', fallbackToPlatform: false })
      expect(result).toBeNull()
    })

    it('returns platform key when user has no key and fallbackToPlatform=true', async () => {
      vi.mocked(getUserCredential).mockResolvedValueOnce(null)
      vi.stubEnv('HEYGEN_API_KEY', 'hk_platform_key')
      const { getHeyGenKey } = await import('./get-provider-key')
      const result = await getHeyGenKey({ userId: 'user-1', fallbackToPlatform: true })
      expect(result).toEqual({ key: 'hk_platform_key', source: 'platform' })
    })

    it('returns platform key when no userId and fallbackToPlatform=true', async () => {
      vi.stubEnv('HEYGEN_API_KEY', 'hk_platform_key')
      const { getHeyGenKey } = await import('./get-provider-key')
      const result = await getHeyGenKey({ fallbackToPlatform: true })
      expect(result).toEqual({ key: 'hk_platform_key', source: 'platform' })
      expect(getUserCredential).not.toHaveBeenCalled()
    })

    it('returns null when both user key missing and no env key', async () => {
      vi.mocked(getUserCredential).mockResolvedValueOnce(null)
      vi.stubEnv('HEYGEN_API_KEY', '')
      const { getHeyGenKey } = await import('./get-provider-key')
      const result = await getHeyGenKey({ userId: 'user-1', fallbackToPlatform: true })
      expect(result).toBeNull()
    })
  })

  describe('getResendKey', () => {
    it('defaults fallbackToPlatform=true (returns platform key when user key missing)', async () => {
      vi.mocked(getUserCredential).mockResolvedValueOnce(null)
      vi.stubEnv('RESEND_API_KEY', 're_platform')
      const { getResendKey } = await import('./get-provider-key')
      const result = await getResendKey({ userId: 'user-1' })
      expect(result).toEqual({ key: 're_platform', source: 'platform' })
    })
  })

  describe('getNowPaymentsKey', () => {
    it('defaults fallbackToPlatform=true (returns platform key when user key missing)', async () => {
      vi.mocked(getUserCredential).mockResolvedValueOnce(null)
      vi.stubEnv('NOWPAYMENTS_API_KEY', 'np_platform')
      const { getNowPaymentsKey } = await import('./get-provider-key')
      const result = await getNowPaymentsKey({ userId: 'user-1' })
      expect(result).toEqual({ key: 'np_platform', source: 'platform' })
    })
  })
})
