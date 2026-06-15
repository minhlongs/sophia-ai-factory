/**
 * Tests for resolve-user-api-key — Phase 4G-BYOK.
 *
 * Covers env gating, user-key preference, fallback semantics, and
 * degraded mode when the user store returns null.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveUserApiKey, isByokEnabled } from '@/tree/byok/resolve-user-api-key'
import * as store from '@/tree/byok/user-api-key-store'

describe('resolve-user-api-key', () => {
  beforeEach(() => {
    delete process.env.BYOK_ENABLED
    vi.restoreAllMocks()
  })

  describe('isByokEnabled', () => {
    it('false when env unset', () => {
      expect(isByokEnabled()).toBe(false)
    })

    it('false for "true" (strict "1")', () => {
      process.env.BYOK_ENABLED = 'true'
      expect(isByokEnabled()).toBe(false)
    })

    it('true only for "1"', () => {
      process.env.BYOK_ENABLED = '1'
      expect(isByokEnabled()).toBe(true)
    })
  })

  describe('resolveUserApiKey', () => {
    it('returns envFallback when BYOK disabled (never queries store)', async () => {
      const spy = vi.spyOn(store, 'getUserApiKey').mockResolvedValue('sk-user')
      const result = await resolveUserApiKey('u-1', 'openrouter', 'env-key')
      expect(result).toBe('env-key')
      expect(spy).not.toHaveBeenCalled()
    })

    it('returns envFallback when userId missing (cron context)', async () => {
      process.env.BYOK_ENABLED = '1'
      const spy = vi.spyOn(store, 'getUserApiKey').mockResolvedValue('sk-user')
      const result = await resolveUserApiKey(null, 'openrouter', 'env-key')
      expect(result).toBe('env-key')
      expect(spy).not.toHaveBeenCalled()
    })

    it('returns user key when BYOK on and stored', async () => {
      process.env.BYOK_ENABLED = '1'
      vi.spyOn(store, 'getUserApiKey').mockResolvedValue('sk-user-byok')

      const result = await resolveUserApiKey('u-1', 'openrouter', 'env-key')
      expect(result).toBe('sk-user-byok')
    })

    it('falls back to env key when user has no stored key', async () => {
      process.env.BYOK_ENABLED = '1'
      vi.spyOn(store, 'getUserApiKey').mockResolvedValue(null)

      const result = await resolveUserApiKey('u-noop', 'openrouter', 'env-key')
      expect(result).toBe('env-key')
    })

    it('returns null when BYOK on, no user key, no env fallback', async () => {
      process.env.BYOK_ENABLED = '1'
      vi.spyOn(store, 'getUserApiKey').mockResolvedValue(null)

      const result = await resolveUserApiKey('u-1', 'anthropic')
      expect(result).toBeNull()
    })

    it('honors exact provider match (no bleed)', async () => {
      process.env.BYOK_ENABLED = '1'
      const spy = vi.spyOn(store, 'getUserApiKey').mockResolvedValue('sk-ant-key')

      await resolveUserApiKey('u-1', 'anthropic', 'env-a')
      expect(spy).toHaveBeenCalledWith('u-1', 'anthropic')
    })
  })
})
