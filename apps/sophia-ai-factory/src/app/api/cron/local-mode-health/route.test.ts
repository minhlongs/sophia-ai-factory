/**
 * Tests for local-mode-health cron — Phase F
 *
 * Tests call runHealthCheck() directly to avoid HTTP layer and module-cache
 * complications with fire-and-forget track(). track() is mocked at module level.
 *
 * Covers: healthy batch, unreachable endpoint, auto-disable after 3 consecutive
 * failures, decrypt failure, and empty user set.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Module-level mocks (hoisted before any import) ────────────────────────────

vi.mock('@/lib/crypto/encrypt-secret', () => ({
  decryptSecret: vi.fn(),
}))

vi.mock('@/lib/signals/track', () => ({
  track: vi.fn(),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { runHealthCheck } from './route'
import { decryptSecret } from '@/lib/crypto/encrypt-secret'
import { track } from '@/lib/signals/track'
import { D1Events } from '@/lib/signals/d1-event-types'

const mockDecrypt = vi.mocked(decryptSecret)
const mockTrack = vi.mocked(track)

// ── D1 mock builder ───────────────────────────────────────────────────────────

interface UserRow {
  id: string
  local_mode_endpoint: string
  local_mode_bearer_encrypted: string
}

/**
 * Build a minimal mock D1Database.
 * Routes prepare() calls by SQL pattern so each statement type gets
 * the correct terminal method (all / first / run).
 *
 * - SELECT id, local_mode_endpoint … → .all() returns userRows
 * - SELECT COUNT(*)                  → .bind().first() returns { cnt: signalCount }
 * - UPDATE users                     → .bind().run() resolves success
 */
function buildMockDb(userRows: UserRow[], signalCount = 0): D1Database {
  const runMock = vi.fn().mockResolvedValue({ success: true })
  const countFirstMock = vi.fn().mockResolvedValue({ cnt: signalCount })
  const allMock = vi.fn().mockResolvedValue({ results: userRows })

  const prepareMock = vi.fn().mockImplementation((sql: string) => {
    if (sql.includes('SELECT id,') || sql.includes('SELECT id ')) {
      // users SELECT — called without bind(), terminal is .all()
      return { all: allMock, bind: vi.fn().mockReturnValue({ all: allMock }) }
    }
    if (sql.includes('COUNT(*)')) {
      // signal count query — called with .bind().first()
      return {
        bind: vi.fn().mockReturnValue({ first: countFirstMock }),
      }
    }
    if (sql.includes('UPDATE users')) {
      // auto-disable UPDATE — called with .bind().run()
      return {
        bind: vi.fn().mockReturnValue({ run: runMock }),
      }
    }
    // fallback — users SELECT without explicit column list (current implementation uses SELECT id,)
    return {
      all: allMock,
      bind: vi.fn().mockReturnValue({ all: allMock, first: countFirstMock, run: runMock }),
    }
  })

  return { prepare: prepareMock } as unknown as D1Database
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runHealthCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Stub global fetch — tests override per case
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Test 1 — 2 users healthy → {checked:2, healthy:2, unhealthy:0, disabled:0} + 2 local_mode_healthy tracks', async () => {
    const users: UserRow[] = [
      { id: 'u1', local_mode_endpoint: 'http://t1.example', local_mode_bearer_encrypted: 'enc1' },
      { id: 'u2', local_mode_endpoint: 'http://t2.example', local_mode_bearer_encrypted: 'enc2' },
    ]
    const db = buildMockDb(users)
    mockDecrypt.mockResolvedValue('tok')
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))

    const result = await runHealthCheck(db, 'dek-override')

    expect(result).toEqual({ checked: 2, healthy: 2, unhealthy: 0, disabled: 0 })

    const healthyCalls = mockTrack.mock.calls.filter(
      (c) => c[0] === D1Events.LOCAL_MODE_HEALTHY,
    )
    expect(healthyCalls).toHaveLength(2)
    expect((healthyCalls[0][2] as Record<string, unknown>).user_id).toBe('u1')
    expect((healthyCalls[1][2] as Record<string, unknown>).user_id).toBe('u2')
  })

  it('Test 2 — 1 user unreachable (fetch rejects) → {checked:1, unhealthy:1} + local_mode_unhealthy track', async () => {
    const users: UserRow[] = [
      { id: 'u3', local_mode_endpoint: 'http://dead.example', local_mode_bearer_encrypted: 'enc3' },
    ]
    const db = buildMockDb(users, 0)
    mockDecrypt.mockResolvedValue('tok')
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'))

    const result = await runHealthCheck(db, 'dek-override')

    expect(result.checked).toBe(1)
    expect(result.unhealthy).toBe(1)
    expect(result.healthy).toBe(0)

    const unhealthyCalls = mockTrack.mock.calls.filter(
      (c) => c[0] === D1Events.LOCAL_MODE_UNHEALTHY,
    )
    expect(unhealthyCalls).toHaveLength(1)
    expect((unhealthyCalls[0][2] as Record<string, unknown>).user_id).toBe('u3')
  })

  it('Test 3 — 3rd consecutive failure (prior count=2) → disabled:1, UPDATE called, local_mode_disabled track', async () => {
    const users: UserRow[] = [
      { id: 'u4', local_mode_endpoint: 'http://flap.example', local_mode_bearer_encrypted: 'enc4' },
    ]
    // signalCount=3: DB already has 3 unhealthy rows (including the one just tracked) → triggers disable
    const db = buildMockDb(users, 3)
    mockDecrypt.mockResolvedValue('tok')
    vi.mocked(fetch).mockRejectedValue(new Error('timeout'))

    const result = await runHealthCheck(db, 'dek-override')

    expect(result.disabled).toBe(1)

    const disabledCalls = mockTrack.mock.calls.filter(
      (c) => c[0] === D1Events.LOCAL_MODE_DISABLED,
    )
    expect(disabledCalls).toHaveLength(1)
    expect((disabledCalls[0][2] as Record<string, unknown>).reason).toBe('3_consecutive_unhealthy')

    // Verify UPDATE SQL was prepared
    const prepMock = vi.mocked(db.prepare)
    const updateSqls = prepMock.mock.calls
      .map((c) => c[0] as string)
      .filter((sql) => sql.includes('UPDATE users SET local_mode_endpoint=NULL'))
    expect(updateSqls.length).toBeGreaterThanOrEqual(1)
  })

  it('Test 4 — decrypt failure → counted as unhealthy, no fetch call, no crash', async () => {
    const users: UserRow[] = [
      { id: 'u5', local_mode_endpoint: 'http://t5.example', local_mode_bearer_encrypted: 'bad' },
    ]
    const db = buildMockDb(users, 0)
    mockDecrypt.mockRejectedValue(new Error('decryption failed'))
    const fetchSpy = vi.mocked(fetch)

    const result = await runHealthCheck(db, 'dek-override')

    expect(result.checked).toBe(1)
    expect(result.unhealthy).toBe(1)
    expect(result.healthy).toBe(0)
    // fetch must NOT have been called — we never got a bearer token
    expect(fetchSpy).not.toHaveBeenCalled()

    const unhealthyCalls = mockTrack.mock.calls.filter(
      (c) => c[0] === D1Events.LOCAL_MODE_UNHEALTHY,
    )
    expect(unhealthyCalls).toHaveLength(1)
    expect(
      (unhealthyCalls[0][2] as Record<string, unknown>).status,
    ).toBe('decrypt_failed')
  })

  it('Test 5 — empty user set → {checked:0, healthy:0, unhealthy:0, disabled:0}, no fetch or track', async () => {
    const db = buildMockDb([])
    const fetchSpy = vi.mocked(fetch)

    const result = await runHealthCheck(db, 'dek-override')

    expect(result).toEqual({ checked: 0, healthy: 0, unhealthy: 0, disabled: 0 })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()
  })
})
