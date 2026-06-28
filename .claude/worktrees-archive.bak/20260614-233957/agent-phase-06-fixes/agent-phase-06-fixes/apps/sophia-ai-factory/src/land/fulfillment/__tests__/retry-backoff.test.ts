/**
 * Unit tests for retry-backoff.ts
 * Pure functions — no mocks needed.
 */

import { describe, it, expect } from 'vitest'
import { nextRetryAt, isRetryDue, MAX_ATTEMPTS } from '../retry-backoff'

describe('nextRetryAt', () => {
  it('returns 0 when lastAttemptAt is null (first attempt — retry immediately)', () => {
    expect(nextRetryAt(0, null)).toBe(0)
    expect(nextRetryAt(1, null)).toBe(0)
  })

  it('returns 0 when lastAttemptAt is 0', () => {
    expect(nextRetryAt(1, 0)).toBe(0)
  })

  it('attempt 1: next retry at lastAttemptAt + 30s', () => {
    const t = 1000
    expect(nextRetryAt(1, t)).toBe(t + 30)
  })

  it('attempt 2: next retry at lastAttemptAt + 60s', () => {
    const t = 1000
    expect(nextRetryAt(2, t)).toBe(t + 60)
  })

  it('attempt 3: next retry at lastAttemptAt + 300s', () => {
    const t = 1000
    expect(nextRetryAt(3, t)).toBe(t + 300)
  })

  it('attempt 4: next retry at lastAttemptAt + 900s', () => {
    const t = 1000
    expect(nextRetryAt(4, t)).toBe(t + 900)
  })

  it('attempt 5+: capped at lastAttemptAt + 3600s', () => {
    const t = 1000
    expect(nextRetryAt(5, t)).toBe(t + 3600)
    expect(nextRetryAt(10, t)).toBe(t + 3600)
  })
})

describe('isRetryDue', () => {
  const now = 2000

  it('returns true when lastAttemptAt is null (never attempted)', () => {
    expect(isRetryDue(0, null, now)).toBe(true)
  })

  it('returns true when backoff window has elapsed', () => {
    const last = now - 31 // 31s ago, backoff for attempt 1 is 30s
    expect(isRetryDue(1, last, now)).toBe(true)
  })

  it('returns false when still within backoff window', () => {
    const last = now - 10 // only 10s ago, backoff for attempt 1 is 30s
    expect(isRetryDue(1, last, now)).toBe(false)
  })

  it('returns false when attempt_count >= MAX_ATTEMPTS', () => {
    expect(isRetryDue(MAX_ATTEMPTS, null, now)).toBe(false)
    expect(isRetryDue(MAX_ATTEMPTS + 1, null, now)).toBe(false)
  })
})

describe('MAX_ATTEMPTS', () => {
  it('is 5', () => {
    expect(MAX_ATTEMPTS).toBe(5)
  })
})
