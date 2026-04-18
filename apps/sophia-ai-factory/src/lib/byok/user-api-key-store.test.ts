/**
 * Tests for user-api-key-store — Phase 4G-BYOK.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  setUserApiKey,
  getUserApiKey,
  clearUserApiKey,
  listUserApiKeyProviders,
} from './user-api-key-store'
import * as resolveOrg from '@/lib/auth/resolve-org-id'

const TEST_MASTER_KEY = 'QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI='

function makeD1() {
  const first = vi.fn().mockResolvedValue(null)
  const all   = vi.fn().mockResolvedValue({ results: [] })
  const run   = vi.fn().mockResolvedValue({ success: true })
  const bind  = vi.fn().mockReturnValue({ first, all, run })
  const prepare = vi.fn().mockReturnValue({ bind })
  return { d1: { prepare } as unknown as D1Database, prepare, bind, first, all, run }
}

describe('user-api-key-store', () => {
  beforeEach(() => {
    process.env.BYOK_MASTER_KEY = TEST_MASTER_KEY
    vi.restoreAllMocks()
  })

  describe('setUserApiKey', () => {
    it('rejects empty inputs', async () => {
      await expect(setUserApiKey('', 'openrouter', 'k')).rejects.toThrow('BYOK_SET_INVALID_ARGS')
      await expect(setUserApiKey('u', 'openrouter' as const, '')).rejects.toThrow('BYOK_SET_INVALID_ARGS')
    })

    it('throws when D1 unavailable', async () => {
      vi.spyOn(resolveOrg, 'getD1Raw').mockReturnValue(null)
      await expect(setUserApiKey('u-1', 'openrouter', 'sk-or-x')).rejects.toThrow('BYOK_D1_UNAVAILABLE')
    })

    it('upserts encrypted blob (never plaintext) into D1', async () => {
      const { d1, prepare, bind, run } = makeD1()
      vi.spyOn(resolveOrg, 'getD1Raw').mockReturnValue(d1)

      await setUserApiKey('u-1', 'anthropic', 'sk-ant-secret')

      expect(prepare).toHaveBeenCalledTimes(1)
      const sql = prepare.mock.calls[0][0] as string
      expect(sql).toMatch(/INSERT INTO user_api_keys/i)
      expect(sql).toMatch(/ON CONFLICT\(user_id, provider\) DO UPDATE/i)

      const [userId, provider, encrypted] = bind.mock.calls[0] as unknown[]
      expect(userId).toBe('u-1')
      expect(provider).toBe('anthropic')
      expect(encrypted).toBeInstanceOf(Uint8Array)
      // Plaintext MUST NOT appear verbatim in the blob
      const asString = new TextDecoder().decode(encrypted as Uint8Array)
      expect(asString).not.toContain('sk-ant-secret')
      expect(run).toHaveBeenCalledTimes(1)
    })
  })

  describe('getUserApiKey', () => {
    it('returns null on missing row', async () => {
      const { d1 } = makeD1()
      vi.spyOn(resolveOrg, 'getD1Raw').mockReturnValue(d1)
      const result = await getUserApiKey('u-missing', 'openrouter')
      expect(result).toBeNull()
    })

    it('returns null when D1 unavailable', async () => {
      vi.spyOn(resolveOrg, 'getD1Raw').mockReturnValue(null)
      const result = await getUserApiKey('u-1', 'openrouter')
      expect(result).toBeNull()
    })

    it('round-trips (set → get returns original)', async () => {
      // Simulate D1 by capturing upsert row and returning it on subsequent select
      let stored: Uint8Array | null = null
      const prepare = vi.fn().mockImplementation((sql: string) => ({
        bind: (...args: unknown[]) => ({
          run: async () => {
            if (sql.includes('INSERT INTO')) stored = args[2] as Uint8Array
            return { success: true }
          },
          first: async () => (stored ? { encrypted_key: stored } : null),
          all:   async () => ({ results: [] }),
        }),
      }))
      vi.spyOn(resolveOrg, 'getD1Raw').mockReturnValue({ prepare } as unknown as D1Database)

      const plain = 'sk-or-v1-roundtrip-xyz'
      await setUserApiKey('u-42', 'openrouter', plain)
      const got = await getUserApiKey('u-42', 'openrouter')
      expect(got).toBe(plain)
    })

    it('returns null when decrypt fails (tamper / wrong key)', async () => {
      // Make D1 return a garbage blob
      const prepare = vi.fn().mockReturnValue({
        bind: () => ({
          first: async () => ({ encrypted_key: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) }),
        }),
      })
      vi.spyOn(resolveOrg, 'getD1Raw').mockReturnValue({ prepare } as unknown as D1Database)

      const got = await getUserApiKey('u-tampered', 'anthropic')
      expect(got).toBeNull()
    })

    it('returns null when D1 throws', async () => {
      const prepare = vi.fn().mockImplementation(() => { throw new Error('D1 down') })
      vi.spyOn(resolveOrg, 'getD1Raw').mockReturnValue({ prepare } as unknown as D1Database)
      const got = await getUserApiKey('u-1', 'openrouter')
      expect(got).toBeNull()
    })
  })

  describe('clearUserApiKey', () => {
    it('runs DELETE with user+provider bound params', async () => {
      const { d1, prepare, bind, run } = makeD1()
      vi.spyOn(resolveOrg, 'getD1Raw').mockReturnValue(d1)

      await clearUserApiKey('u-1', 'openrouter')

      const sql = prepare.mock.calls[0][0] as string
      expect(sql).toMatch(/DELETE FROM user_api_keys/i)
      expect(bind).toHaveBeenCalledWith('u-1', 'openrouter')
      expect(run).toHaveBeenCalledTimes(1)
    })
  })

  describe('listUserApiKeyProviders', () => {
    it('returns ordered providers for user', async () => {
      const prepare = vi.fn().mockReturnValue({
        bind: () => ({
          all: async () => ({ results: [{ provider: 'anthropic' }, { provider: 'openrouter' }] }),
        }),
      })
      vi.spyOn(resolveOrg, 'getD1Raw').mockReturnValue({ prepare } as unknown as D1Database)

      const result = await listUserApiKeyProviders('u-1')
      expect(result).toEqual(['anthropic', 'openrouter'])
    })

    it('returns [] on D1 throw', async () => {
      const prepare = vi.fn().mockImplementation(() => { throw new Error('boom') })
      vi.spyOn(resolveOrg, 'getD1Raw').mockReturnValue({ prepare } as unknown as D1Database)
      const result = await listUserApiKeyProviders('u-1')
      expect(result).toEqual([])
    })
  })
})
