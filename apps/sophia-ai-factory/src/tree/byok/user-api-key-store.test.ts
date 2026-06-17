/**
 * Tests for user-api-key-store — Phase 4G-BYOK.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mock for D1 client (required by vi.mock hoisting)
const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }))
vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }))

// Mock @cloudflare/d1 to avoid missing types
vi.mock('@cloudflare/d1', () => ({}));

import {
  setUserApiKey,
  getUserApiKey,
  clearUserApiKey,
  listUserApiKeyProviders,
} from '@/tree/byok/user-api-key-store'
import { getD1 } from '@/seed/db/client'

const TEST_MASTER_KEY = 'QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI='

function makeD1() {
  const first = vi.fn().mockResolvedValue(null)
  const all = vi.fn().mockResolvedValue({ results: [] })
  const run = vi.fn().mockResolvedValue({ success: true })
  const bind = vi.fn().mockReturnValue({ first, all, run })
  const prepare = vi.fn().mockReturnValue({ bind, first })
  return { d1: { prepare } as any, prepare, bind, first, all, run }
}

describe('user-api-key-store', () => {
  beforeEach(() => {
    process.env.BYOK_MASTER_KEY = TEST_MASTER_KEY
    vi.clearAllMocks()
  })

  describe('setUserApiKey', () => {
    it('rejects empty inputs', async () => {
      await expect(setUserApiKey('', 'openrouter', 'k')).rejects.toThrow('BYOK_SET_INVALID_ARGS')
      await expect(setUserApiKey('u', 'openrouter' as const, '')).rejects.toThrow('BYOK_SET_INVALID_ARGS')
    })

    it('throws when D1 unavailable', async () => {
      vi.mocked(getD1).mockReturnValue(null)
      await expect(setUserApiKey('u-1', 'openrouter', 'sk-or-x')).rejects.toThrow('BYOK_D1_UNAVAILABLE')
    })

    it('upserts encrypted blob (never plaintext) into D1', async () => {
      const { d1, prepare, bind, run } = makeD1()
      vi.mocked(getD1).mockReturnValue(d1)

      await setUserApiKey('u-1', 'anthropic', 'sk-ant-secret')

      // prepare called for getActiveKeyVersion + ensureKeyVersionRow check + INSERT
      expect(prepare).toHaveBeenCalled()
      // Find the INSERT INTO user_api_keys call
      const insertCall = prepare.mock.calls.find((c: string[]) => c[0].includes('INSERT INTO user_api_keys'))
      expect(insertCall).toBeDefined()
      const sql = insertCall![0] as string
      expect(sql).toMatch(/ON CONFLICT\(user_id, provider\) DO UPDATE/i)

      // Find the bind call that matches the user_api_keys INSERT (has 5 args: userId, provider, encrypted, keyVersion, timestamp)
      const userApiKeyBindCall = bind.mock.calls.find((c: unknown[]) => (c as unknown[]).length >= 5)
      expect(userApiKeyBindCall).toBeDefined()
      const [userId, provider, encrypted] = userApiKeyBindCall! as unknown[]
      expect(userId).toBe('u-1')
      expect(provider).toBe('anthropic')
      expect(encrypted).toBeInstanceOf(Uint8Array)
      // Plaintext MUST NOT appear verbatim in the blob
      const asString = new TextDecoder().decode(encrypted as Uint8Array)
      expect(asString).not.toContain('sk-ant-secret')
      // run called for ensureKeyVersionRow INSERT + setUserApiKey INSERT
      expect(run).toHaveBeenCalledTimes(2)
    })
  })

  describe('getUserApiKey', () => {
    it('returns null on missing row', async () => {
      const { d1 } = makeD1()
      vi.mocked(getD1).mockReturnValue(d1)
      const result = await getUserApiKey('u-missing', 'openrouter')
      expect(result).toBeNull()
    })

    it('returns null when D1 unavailable', async () => {
      vi.mocked(getD1).mockReturnValue(null)
      const result = await getUserApiKey('u-1', 'openrouter')
      expect(result).toBeNull()
    })

    it('round-trips (set → get returns original)', async () => {
      // Stateful mock: capture INSERT blob, return it on SELECT
      const storedBlob: { encrypted_key: Uint8Array; key_version: number } | null = null
      const captured = { blob: null as Uint8Array | null, keyVersion: 0 }

      const prepare = vi.fn().mockImplementation(() => {
        const sql = prepare.mock.calls[prepare.mock.calls.length - 1]?.[0] as string | undefined

        // key_versions queries → return version 1
        if (sql?.includes('key_versions')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: async () => ({ version: 1 }),
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ success: true }),
          }
        }

        // user_api_keys INSERT → capture the encrypted blob
        if (sql?.includes('INSERT INTO user_api_keys')) {
          return {
            bind: vi.fn().mockImplementation((...args: unknown[]) => {
              captured.blob = args[2] as Uint8Array
              captured.keyVersion = args[3] as number
              return { first: async () => null, all: vi.fn().mockResolvedValue({ results: [] }), run: vi.fn().mockResolvedValue({ success: true }) }
            }),
            first: async () => null,
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ success: true }),
          }
        }

        // user_api_keys SELECT → return captured blob
        return {
          bind: vi.fn().mockReturnThis(),
          first: async () => captured.blob ? { encrypted_key: captured.blob, key_version: captured.keyVersion } : null,
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }
      })

      vi.mocked(getD1).mockReturnValue({ prepare } as any)
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
      vi.mocked(getD1).mockReturnValue({ prepare } as any)

      const got = await getUserApiKey('u-tampered', 'anthropic')
      expect(got).toBeNull()
    })

    it('returns null when D1 throws', async () => {
      const prepare = vi.fn().mockImplementation(() => { throw new Error('D1 down') })
      vi.mocked(getD1).mockReturnValue({ prepare } as any)
      const got = await getUserApiKey('u-1', 'openrouter')
      expect(got).toBeNull()
    })
  })

  describe('clearUserApiKey', () => {
    it('runs DELETE with user+provider bound params', async () => {
      const { d1, prepare, bind, run } = makeD1()
      vi.mocked(getD1).mockReturnValue(d1)

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
      vi.mocked(getD1).mockReturnValue({ prepare } as any)

      const result = await listUserApiKeyProviders('u-1')
      expect(result).toEqual(['anthropic', 'openrouter'])
    })

    it('returns [] on D1 throw', async () => {
      const prepare = vi.fn().mockImplementation(() => { throw new Error('boom') })
      vi.mocked(getD1).mockReturnValue({ prepare } as any)
      const result = await listUserApiKeyProviders('u-1')
      expect(result).toEqual([])
    })
  })
})
