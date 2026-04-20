/**
 * Tests for POST /api/setup/local-mode/provision (Phase D)
 *
 * 5 cases:
 *   1. Valid body + healthy endpoint + successful D1 write → 200
 *   2. Invalid hostname regex → 400
 *   3. Unreachable endpoint (fetch rejects) → 503, no D1 write
 *   4. D1 write error → 500, proper error format
 *   5. Missing auth (no user) → 401
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, DELETE } from './route'
import { NextRequest } from 'next/server'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/lib/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}))

vi.mock('@/lib/crypto/encrypt-secret', () => ({
  encryptSecret: vi.fn(),
}))

vi.mock('@/lib/signals/track', () => ({
  track: vi.fn(),
}))

import { getCurrentUserFromHeaders } from '@/lib/better-auth-session'
import { encryptSecret } from '@/lib/crypto/encrypt-secret'
import { track } from '@/lib/signals/track'

const mockGetCurrentUser = vi.mocked(getCurrentUserFromHeaders)
const mockEncryptSecret = vi.mocked(encryptSecret)
const mockTrack = vi.mocked(track)

// ── Helpers ────────────────────────────────────────────────────────────────────

const VALID_HOSTNAME = 'https://mekongd-abc123.cashclaw.cc'
const VALID_BEARER = 'super-secret-bearer-token-that-is-at-least-32-chars'

function makeRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/setup/local-mode/provision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

/** Build a D1 mock that resolves run() successfully and inject into globalThis.__env */
function setupD1Mock(runImpl?: () => Promise<unknown>) {
  const runFn = vi.fn().mockImplementation(runImpl ?? (() => Promise.resolve({ success: true, meta: {} })))
  const bindFn = vi.fn().mockReturnValue({ run: runFn })
  const prepareFn = vi.fn().mockReturnValue({ bind: bindFn })

  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env ?? {}
  env.DB = { prepare: prepareFn } as unknown as D1Database
  ;(globalThis as unknown as Record<string, Record<string, unknown>>).__env = env

  return { prepareFn, bindFn, runFn }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('POST /api/setup/local-mode/provision', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user
    mockGetCurrentUser.mockResolvedValue({ id: 'user-x', email: 'x@test.com', role: 'user' })

    // Default: encrypt returns a blob
    mockEncryptSecret.mockResolvedValue('aes-gcm-encrypted-blob')

    // Default: fetch is healthy (200)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    )

    setupD1Mock()
  })

  // ── Case 1: happy path ─────────────────────────────────────────────────────

  it('returns 200 with ok:true on valid body + reachable endpoint + D1 success', async () => {
    const req = makeRequest({ hostname: VALID_HOSTNAME, bearer: VALID_BEARER })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, hostname: VALID_HOSTNAME })

    // track() must have been called (fire-and-forget signal)
    expect(mockTrack).toHaveBeenCalledOnce()
    expect(mockTrack).toHaveBeenCalledWith(
      'local_mode_provisioned',
      'user-x',
      expect.objectContaining({ user_id: 'user-x', hostname_hash: expect.any(Number) }),
    )
  })

  // ── Case 2: invalid hostname regex ────────────────────────────────────────

  it('returns 400 when hostname does not match *.cashclaw.cc pattern', async () => {
    const req = makeRequest({
      hostname: 'https://mekongd-abc.evil.com',
      bearer: VALID_BEARER,
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toMatchObject({ error: 'invalid_body' })

    // No health-check, no D1 write, no signal
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    expect(mockEncryptSecret).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()
  })

  // ── Case 3: unreachable endpoint ──────────────────────────────────────────

  it('returns 503 when fetch throws (network/DNS error) and does not write D1', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    )
    const { prepareFn } = setupD1Mock()

    const req = makeRequest({ hostname: VALID_HOSTNAME, bearer: VALID_BEARER })
    const res = await POST(req)

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body).toEqual({ error: 'local_mekongd_unreachable' })

    // No D1 write after unreachable check
    expect(prepareFn).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()
  })

  // ── Case 4: D1 write error ────────────────────────────────────────────────

  it('returns 503 with d1_write_failed error when D1 prepare throws', async () => {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env ?? {}
    env.DB = {
      prepare: vi.fn().mockImplementation(() => {
        throw new Error('D1_ERROR: disk full')
      }),
    } as unknown as D1Database
    ;(globalThis as unknown as Record<string, Record<string, unknown>>).__env = env

    const req = makeRequest({ hostname: VALID_HOSTNAME, bearer: VALID_BEARER })
    const res = await POST(req)

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body).toEqual({ error: 'd1_write_failed' })
    expect(mockTrack).not.toHaveBeenCalled()
  })

  // ── Case 5: missing auth ──────────────────────────────────────────────────

  it('returns 401 when getCurrentUserFromHeaders returns null', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const req = makeRequest({ hostname: VALID_HOSTNAME, bearer: VALID_BEARER })
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'unauthorized' })

    // Nothing downstream should execute
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    expect(mockEncryptSecret).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()
  })
})

// ── DELETE handler tests ───────────────────────────────────────────────────────

describe('DELETE /api/setup/local-mode/provision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'user-x', email: 'x@test.com', role: 'user' })
    setupD1Mock()
  })

  it('returns 200 with {ok:true,disabled:true}, calls D1 UPDATE with NULL NULL, emits local_mode_disabled track', async () => {
    const { prepareFn, bindFn, runFn } = setupD1Mock()

    const req = new NextRequest('http://localhost/api/setup/local-mode/provision', { method: 'DELETE' })
    const res = await DELETE(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, disabled: true })

    // D1 UPDATE called with NULL NULL for this user
    expect(prepareFn).toHaveBeenCalledWith(
      expect.stringContaining('local_mode_endpoint=NULL'),
    )
    expect(bindFn).toHaveBeenCalledWith('user-x')
    expect(runFn).toHaveBeenCalled()

    // track called with local_mode_disabled
    expect(mockTrack).toHaveBeenCalledOnce()
    expect(mockTrack).toHaveBeenCalledWith(
      'local_mode_disabled',
      'user-x',
      expect.objectContaining({ user_id: 'user-x', reason: 'user_disabled' }),
    )
  })

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/setup/local-mode/provision', { method: 'DELETE' })
    const res = await DELETE(req)

    expect(res.status).toBe(401)
    expect(mockTrack).not.toHaveBeenCalled()
  })
})
