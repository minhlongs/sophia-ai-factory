/**
 * Tests for /api/user/byok — Phase 8C user-facing BYOK admin.
 *
 * Coverage:
 *   GET     unauthorised (no user)              → 401
 *   GET     authed + 2 providers stored         → 200 { providers: [...] }
 *   POST    unauthorised                         → 401
 *   POST    invalid provider enum                → 400
 *   POST    short key (<10 chars)                → 400
 *   POST    store throws                         → 500, no audit
 *   POST    happy path                           → 200, store + audit called
 *   DELETE  missing provider                     → 400
 *   DELETE  happy path                           → 200, clear + audit called
 *   Audit payload whitelist                      → provider only (no key bytes)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/tree/byok/user-api-key-store', () => ({
  setUserApiKey:            vi.fn(),
  clearUserApiKey:          vi.fn(),
  listUserApiKeyProviders:  vi.fn(),
}))

vi.mock('@/lib/signals/track', () => ({
  track: vi.fn(),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { GET, POST, DELETE } from './route'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import {
  setUserApiKey,
  clearUserApiKey,
  listUserApiKeyProviders,
} from '@/tree/byok/user-api-key-store'
import { track } from '@/lib/signals/track'
import { D1Events } from '@/lib/signals/d1-event-types'

const mockGetCurrentUser = vi.mocked(getCurrentUser)
const mockSet            = vi.mocked(setUserApiKey)
const mockClear          = vi.mocked(clearUserApiKey)
const mockList           = vi.mocked(listUserApiKeyProviders)
const mockTrack          = vi.mocked(track)

const USER = { id: 'user-abc' } as Awaited<ReturnType<typeof getCurrentUser>>

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/user/byok', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('GET /api/user/byok', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('401 when no user session', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('200 with provider list when authed (includes muapi)', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    mockList.mockResolvedValue(['openrouter', 'anthropic', 'muapi'])

    const res = await GET()
    expect(res.status).toBe(200)
    const json = (await res.json()) as { providers: string[] }
    expect(json.providers).toEqual(['openrouter', 'anthropic', 'muapi'])
    expect(mockList).toHaveBeenCalledWith(USER?.id)
  })
})

describe('POST /api/user/byok', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('401 when no user session', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await POST(makeRequest('POST', { provider: 'openrouter', key: 'sk-or-validkey' }))
    expect(res.status).toBe(401)
    expect(mockSet).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()
  })

  it('400 when provider is not in enum', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    const res = await POST(makeRequest('POST', { provider: 'bogus', key: 'sk-something' }))
    expect(res.status).toBe(400)
    expect(mockSet).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()
  })

  it('400 when key shorter than 10 chars', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    const res = await POST(makeRequest('POST', { provider: 'openrouter', key: 'short' }))
    expect(res.status).toBe(400)
    expect(mockSet).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()
  })

  it('400 when openrouter key has invalid format', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    const res = await POST(makeRequest('POST', { provider: 'openrouter', key: 'wrong-format-key-1234567890' }))
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid openrouter key format')
    expect(mockSet).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()
  })

  it('200 when openrouter key has valid format (sk-or-v1-...)', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    mockSet.mockResolvedValue(undefined)
    const res = await POST(makeRequest('POST', {
      provider: 'openrouter',
      key: 'sk-or-v1-abcdefghijklmnopqrstuvwxyz1234567890',
    }))
    expect(res.status).toBe(200)
    expect(mockSet).toHaveBeenCalledWith(
      USER?.id,
      'openrouter',
      'sk-or-v1-abcdefghijklmnopqrstuvwxyz1234567890',
    )
  })

  it('200 when muapi key is stored', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    mockSet.mockResolvedValue(undefined)
    const res = await POST(makeRequest('POST', {
      provider: 'muapi',
      key: 'muapi-valid-key-1234567890abcdef',
    }))
    expect(res.status).toBe(200)
    expect(mockSet).toHaveBeenCalledWith(USER?.id, 'muapi', 'muapi-valid-key-1234567890abcdef')
  })

  it('400 when heygen provider is submitted (removed from enum)', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    const res = await POST(makeRequest('POST', { provider: 'heygen', key: 'some-heygen-key-1234567890' }))
    expect(res.status).toBe(400)
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('500 when store throws — no audit emitted', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    mockSet.mockRejectedValue(new Error('BYOK_D1_UNAVAILABLE'))

    const res = await POST(makeRequest('POST', {
      provider: 'openrouter',
      key: 'sk-or-v1-validkey-12345678901234567890',
    }))
    expect(res.status).toBe(500)
    // Critical: failure path must NOT emit audit (audit implies success)
    expect(mockTrack).not.toHaveBeenCalled()
  })

  it('200 + encrypts + emits BYOK_KEY_SET audit with provider-only whitelist', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    mockSet.mockResolvedValue(undefined)

    const res = await POST(makeRequest('POST', {
      provider: 'anthropic',
      key: 'sk-ant-api03-veryLongKey-abcdef123456',
    }))
    expect(res.status).toBe(200)

    expect(mockSet).toHaveBeenCalledWith(
      USER?.id,
      'anthropic',
      'sk-ant-api03-veryLongKey-abcdef123456',
    )

    // Audit: event type + actor + provider-only payload (NO key bytes)
    expect(mockTrack).toHaveBeenCalledWith(
      D1Events.BYOK_KEY_SET,
      USER?.id,
      { provider: 'anthropic' },
    )
  })
})

describe('DELETE /api/user/byok', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('401 when no user session', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE', { provider: 'openrouter' }))
    expect(res.status).toBe(401)
  })

  it('400 when provider missing', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    const res = await DELETE(makeRequest('DELETE', {}))
    expect(res.status).toBe(400)
    expect(mockClear).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()
  })

  it('500 when clearUserApiKey throws — no audit emitted (symmetric with POST)', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    mockClear.mockRejectedValue(new Error('BYOK_D1_UNAVAILABLE'))

    const res = await DELETE(makeRequest('DELETE', { provider: 'anthropic' }))
    expect(res.status).toBe(500)
    expect(mockTrack).not.toHaveBeenCalled()
  })

  it('200 + emits BYOK_KEY_CLEARED audit on happy path', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    mockClear.mockResolvedValue(undefined)

    const res = await DELETE(makeRequest('DELETE', { provider: 'openrouter' }))
    expect(res.status).toBe(200)

    expect(mockClear).toHaveBeenCalledWith(USER?.id, 'openrouter')
    expect(mockTrack).toHaveBeenCalledWith(
      D1Events.BYOK_KEY_CLEARED,
      USER?.id,
      { provider: 'openrouter' },
    )
  })
})
