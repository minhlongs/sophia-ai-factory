/**
 * F01 — Per-account failed-login rate limit (ASVS V2.2.2)
 *
 * Verifies:
 *   - 5 failed attempts → 6th attempt blocked even from a new IP
 *   - Lock expires after 24h (time mocked)
 *   - Successful login resets counter
 *   - Lock is independent of IP (different IPs, same userId → still locked)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import {
  checkAccountLock,
  incrementFailedLogin,
  resetFailedLogin,
  ACCOUNT_LOCK_THRESHOLD,
  ACCOUNT_LOCK_DURATION_MS,
  type D1Binding,
} from '@/seed/security/sql-rate-limiter'
import { verifyWithLockout } from '@/seed/auth/account-lockout-hook'

// ── D1 mock helpers ──────────────────────────────────────────────────────────

interface MockUserRow {
  failed_login_attempts: number
  locked_until: number | null
}

function buildD1Mock(store: Record<string, MockUserRow>): D1Binding {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...args: unknown[]) => ({
        first: vi.fn(async <T>(): Promise<T | null> => {
          const userId = args[0] as string
          const row = store[userId]
          if (!row) return null
          if (sql.includes('failed_login_attempts, locked_until')) {
            return { failed_login_attempts: row.failed_login_attempts, locked_until: row.locked_until } as unknown as T
          }
          if (sql.includes('failed_login_attempts')) {
            return { failed_login_attempts: row.failed_login_attempts } as unknown as T
          }
          return row as unknown as T
        }),
        run: vi.fn(async () => {
          // Parse UPDATE SET clause to mutate store
          if (sql.startsWith('UPDATE')) {
            const userId = args[args.length - 1] as string
            if (!store[userId]) store[userId] = { failed_login_attempts: 0, locked_until: null }
            if (sql.includes('failed_login_attempts = ?1, locked_until = ?2')) {
              store[userId].failed_login_attempts = args[0] as number
              store[userId].locked_until = args[1] as number | null
            } else if (sql.includes('failed_login_attempts = 0, locked_until = NULL')) {
              store[userId].failed_login_attempts = 0
              store[userId].locked_until = null
            }
          }
          return { meta: { changes: 1 } }
        }),
      })),
    })),
  } as unknown as D1Binding
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('F01 — Per-account failed-login rate limit', () => {
  const USER_A = 'user_abc123'
  let store: Record<string, MockUserRow>
  let db: ReturnType<typeof buildD1Mock>

  beforeEach(() => {
    store = {
      [USER_A]: { failed_login_attempts: 0, locked_until: null },
    }
    db = buildD1Mock(store)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── checkAccountLock ──────────────────────────────────────────────────────

  it('returns unlocked for fresh account', async () => {
    const result = await checkAccountLock(db, USER_A)
    expect(result.locked).toBe(false)
    expect(result.attempts).toBe(0)
  })

  it('returns unlocked for unknown userId', async () => {
    const result = await checkAccountLock(db, 'unknown_user')
    expect(result.locked).toBe(false)
    expect(result.attempts).toBe(0)
  })

  it('returns locked when locked_until is in the future', async () => {
    const futureMs = Date.now() + ACCOUNT_LOCK_DURATION_MS
    store[USER_A] = { failed_login_attempts: ACCOUNT_LOCK_THRESHOLD, locked_until: futureMs }
    const result = await checkAccountLock(db, USER_A)
    expect(result.locked).toBe(true)
    expect(result.lockedUntil).toBe(futureMs)
  })

  it('returns unlocked when lock has expired', async () => {
    const pastMs = Date.now() - 1000
    store[USER_A] = { failed_login_attempts: ACCOUNT_LOCK_THRESHOLD, locked_until: pastMs }
    const result = await checkAccountLock(db, USER_A)
    expect(result.locked).toBe(false)
  })

  // ── incrementFailedLogin ──────────────────────────────────────────────────

  it('increments counter without locking below threshold', async () => {
    for (let i = 1; i < ACCOUNT_LOCK_THRESHOLD; i++) {
      const result = await incrementFailedLogin(db, USER_A)
      expect(result.locked).toBe(false)
      expect(result.attempts).toBe(i)
    }
  })

  it('locks account exactly at threshold', async () => {
    store[USER_A].failed_login_attempts = ACCOUNT_LOCK_THRESHOLD - 1
    const result = await incrementFailedLogin(db, USER_A)
    expect(result.locked).toBe(true)
    expect(result.attempts).toBe(ACCOUNT_LOCK_THRESHOLD)
    expect(store[USER_A].locked_until).toBeGreaterThan(Date.now())
  })

  it('lock duration is 24 hours', async () => {
    store[USER_A].failed_login_attempts = ACCOUNT_LOCK_THRESHOLD - 1
    const before = Date.now()
    await incrementFailedLogin(db, USER_A)
    const lockedUntil = store[USER_A].locked_until!
    expect(lockedUntil).toBeGreaterThanOrEqual(before + ACCOUNT_LOCK_DURATION_MS - 10)
    expect(lockedUntil).toBeLessThanOrEqual(before + ACCOUNT_LOCK_DURATION_MS + 100)
  })

  // ── resetFailedLogin ──────────────────────────────────────────────────────

  it('resets counter and clears lock on successful login', async () => {
    store[USER_A] = {
      failed_login_attempts: ACCOUNT_LOCK_THRESHOLD,
      locked_until: Date.now() + ACCOUNT_LOCK_DURATION_MS,
    }
    await resetFailedLogin(db, USER_A)
    expect(store[USER_A].failed_login_attempts).toBe(0)
    expect(store[USER_A].locked_until).toBeNull()
  })

  // ── verifyWithLockout ─────────────────────────────────────────────────────

  it('blocks 6th attempt even from new IP (no IP param — lock is per userId)', async () => {
    store[USER_A].failed_login_attempts = ACCOUNT_LOCK_THRESHOLD
    store[USER_A].locked_until = Date.now() + ACCOUNT_LOCK_DURATION_MS

    // Simulate new IP — verifyWithLockout does NOT use IP, only userId
    const fakeVerify = vi.fn().mockResolvedValue(false)
    const allowed = await verifyWithLockout(db, USER_A, fakeVerify)

    expect(allowed).toBe(false)
    // Password verifier must NOT be called when account is locked
    expect(fakeVerify).not.toHaveBeenCalled()
  })

  it('allows login and resets counter after successful password verify', async () => {
    store[USER_A].failed_login_attempts = 3
    const allowed = await verifyWithLockout(db, USER_A, async () => true)
    expect(allowed).toBe(true)
    expect(store[USER_A].failed_login_attempts).toBe(0)
  })

  it('increments counter on failed password verify', async () => {
    const allowed = await verifyWithLockout(db, USER_A, async () => false)
    expect(allowed).toBe(false)
    expect(store[USER_A].failed_login_attempts).toBe(1)
  })

  it('lock is independent of IP — different IPs same account still blocked', async () => {
    // Saturate lock
    store[USER_A].failed_login_attempts = ACCOUNT_LOCK_THRESHOLD
    store[USER_A].locked_until = Date.now() + ACCOUNT_LOCK_DURATION_MS

    // Attempt from "IP 1"
    const ip1Result = await checkAccountLock(db, USER_A)
    expect(ip1Result.locked).toBe(true)

    // Attempt from "IP 2" (no IP param — same userId, same result)
    const ip2Result = await checkAccountLock(db, USER_A)
    expect(ip2Result.locked).toBe(true)
  })

  it('lock expires after 24h with fake timers', async () => {
    const now = Date.now()
    store[USER_A].failed_login_attempts = ACCOUNT_LOCK_THRESHOLD
    store[USER_A].locked_until = now + ACCOUNT_LOCK_DURATION_MS

    // Before expiry
    const beforeExpiry = await checkAccountLock(db, USER_A)
    expect(beforeExpiry.locked).toBe(true)

    // Advance time past lock duration
    vi.setSystemTime(now + ACCOUNT_LOCK_DURATION_MS + 1000)

    const afterExpiry = await checkAccountLock(db, USER_A)
    expect(afterExpiry.locked).toBe(false)
  })

  it('verifyWithLockout handles verify() throwing — increments counter', async () => {
    const failingVerify = vi.fn().mockRejectedValue(new Error('bcrypt failure'))
    const allowed = await verifyWithLockout(db, USER_A, failingVerify)
    expect(allowed).toBe(false)
    expect(store[USER_A].failed_login_attempts).toBe(1)
  })
})
