import { describe, it, expect } from 'vitest'
import {
  FAILURE_COOLDOWNS,
  DEFAULT_THRESHOLDS,
  getCooldownMs,
  shouldImmediateOpen,
} from '@/seed/config/circuit-breaker'
import { FailureKind } from '@/seed/types/failure-kind'

describe('FAILURE_COOLDOWNS', () => {
  it('AUTH_FAILURE has 0ms cooldown (immediate open)', () => {
    expect(FAILURE_COOLDOWNS[FailureKind.AUTH_FAILURE]).toBe(0)
  })

  it('RATE_LIMIT has 60s cooldown', () => {
    expect(FAILURE_COOLDOWNS[FailureKind.RATE_LIMIT]).toBe(60_000)
  })

  it('TIMEOUT has 120s cooldown', () => {
    expect(FAILURE_COOLDOWNS[FailureKind.TIMEOUT]).toBe(120_000)
  })

  it('NETWORK has 180s cooldown', () => {
    expect(FAILURE_COOLDOWNS[FailureKind.NETWORK]).toBe(180_000)
  })

  it('SERVER_ERROR has 300s cooldown', () => {
    expect(FAILURE_COOLDOWNS[FailureKind.SERVER_ERROR]).toBe(300_000)
  })

  it('UNKNOWN has 120s cooldown', () => {
    expect(FAILURE_COOLDOWNS[FailureKind.UNKNOWN]).toBe(120_000)
  })

  it('covers all FailureKind values', () => {
    const kinds = Object.values(FailureKind)
    for (const kind of kinds) {
      expect(FAILURE_COOLDOWNS[kind]).toBeDefined()
      expect(typeof FAILURE_COOLDOWNS[kind]).toBe('number')
    }
  })
})

describe('DEFAULT_THRESHOLDS', () => {
  it('degraded threshold is 3', () => {
    expect(DEFAULT_THRESHOLDS.degradedThreshold).toBe(3)
  })

  it('open threshold is 5', () => {
    expect(DEFAULT_THRESHOLDS.openThreshold).toBe(5)
  })

  it('failure window is 60 seconds', () => {
    expect(DEFAULT_THRESHOLDS.failureWindowMs).toBe(60_000)
  })

  it('max services is 2000', () => {
    expect(DEFAULT_THRESHOLDS.maxServices).toBe(2000)
  })
})

describe('getCooldownMs', () => {
  it('returns correct cooldown for each kind', () => {
    expect(getCooldownMs(FailureKind.AUTH_FAILURE)).toBe(0)
    expect(getCooldownMs(FailureKind.RATE_LIMIT)).toBe(60_000)
    expect(getCooldownMs(FailureKind.SERVER_ERROR)).toBe(300_000)
  })
})

describe('shouldImmediateOpen', () => {
  it('returns true for AUTH_FAILURE', () => {
    expect(shouldImmediateOpen(FailureKind.AUTH_FAILURE)).toBe(true)
  })

  it('returns false for all other kinds', () => {
    expect(shouldImmediateOpen(FailureKind.RATE_LIMIT)).toBe(false)
    expect(shouldImmediateOpen(FailureKind.SERVER_ERROR)).toBe(false)
    expect(shouldImmediateOpen(FailureKind.TIMEOUT)).toBe(false)
    expect(shouldImmediateOpen(FailureKind.NETWORK)).toBe(false)
    expect(shouldImmediateOpen(FailureKind.UNKNOWN)).toBe(false)
  })
})
