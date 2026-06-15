/**
 * Tests for lib/credentials/user-credentials-repo.ts
 *
 * Covers:
 *  - getUserCredential: returns null when row missing
 *  - getUserCredential: returns null when status != active
 *  - getUserCredential: decrypts and returns plaintext on success
 *  - setUserCredential: encrypts and upserts row
 *  - listUserProviders: returns credential summaries (no plaintext)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const TEST_HEX_KEY = 'b'.repeat(64)

// Mock getD1Raw
vi.mock('@/seed/db/client', () => ({
  getD1Raw: vi.fn(),
}))

// Mock encryption to avoid Web Crypto complexity in unit tests
vi.mock('./encryption', () => ({
  encryptValue: vi.fn(async (plain: string) => `enc:${plain}`),
  decryptValue: vi.fn(async (enc: string) => enc.replace(/^enc:/, '')),
}))

import { getD1Raw } from '@/seed/db/client'

describe('lib/credentials/user-credentials-repo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CREDENTIALS_MASTER_KEY', TEST_HEX_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('getUserCredential returns null when row missing', async () => {
    const mockD1 = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }),
      }),
    }
    vi.mocked(getD1Raw).mockResolvedValue(mockD1 as unknown as D1Database)

    const { getUserCredential } = await import('./user-credentials-repo')
    const result = await getUserCredential('user-1', 'heygen')
    expect(result).toBeNull()
  })

  it('getUserCredential returns null when status is revoked', async () => {
    const mockD1 = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ encrypted_value: 'enc:key123', status: 'revoked' }),
          run: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }
    vi.mocked(getD1Raw).mockResolvedValue(mockD1 as unknown as D1Database)

    const { getUserCredential } = await import('./user-credentials-repo')
    const result = await getUserCredential('user-1', 'heygen')
    expect(result).toBeNull()
  })

  it('getUserCredential returns plaintext on active row', async () => {
    const mockPrepare = {
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ encrypted_value: 'enc:hk_mykey', status: 'active' }),
        run: vi.fn().mockResolvedValue(undefined),
      }),
    }
    const mockD1 = {
      prepare: vi.fn().mockReturnValue(mockPrepare),
    }
    vi.mocked(getD1Raw).mockResolvedValue(mockD1 as unknown as D1Database)

    const { getUserCredential } = await import('./user-credentials-repo')
    const result = await getUserCredential('user-1', 'heygen')
    expect(result).toBe('hk_mykey')
  })

  it('setUserCredential calls D1 upsert with encrypted value', async () => {
    const runMock = vi.fn().mockResolvedValue(undefined)
    const mockD1 = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ run: runMock }),
      }),
    }
    vi.mocked(getD1Raw).mockResolvedValue(mockD1 as unknown as D1Database)

    const { setUserCredential } = await import('./user-credentials-repo')
    await setUserCredential('user-1', 'resend', 're_testkey')

    expect(runMock).toHaveBeenCalledOnce()
    // Verify the encrypted value (mocked encryptValue returns 'enc:<plain>')
    const bindCall = mockD1.prepare.mock.results[0]?.value.bind.mock.calls[0]
    expect(bindCall).toBeDefined()
    expect(bindCall[2]).toBe('enc:re_testkey') // encrypted_value param
    expect(bindCall[3]).toBe('...tkey') // display_hint (last 4 chars)
  })

  it('listUserProviders returns credential summaries', async () => {
    const rows = [
      { provider: 'heygen', display_hint: '...XYZ9', status: 'active', last_used_at: 1234567 },
      { provider: 'resend', display_hint: '...abcd', status: 'active', last_used_at: null },
    ]
    const mockD1 = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results: rows }) }),
      }),
    }
    vi.mocked(getD1Raw).mockResolvedValue(mockD1 as unknown as D1Database)

    const { listUserProviders } = await import('./user-credentials-repo')
    const result = await listUserProviders('user-1')
    expect(result).toHaveLength(2)
    expect(result[0]?.provider).toBe('heygen')
    expect(result[0]?.display_hint).toBe('...XYZ9')
    expect(result[1]?.provider).toBe('resend')
  })
})
