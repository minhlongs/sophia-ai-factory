/**
 * Tests for audit-score-calculator.
 *
 * Pure functions — pin the weighted-score formula, status counting,
 * and traffic-light thresholds for the Zero-GAP audit runner.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateAuditScore,
  countByStatus,
  getTrafficLight,
} from './audit-score-calculator'
import type { CheckResult, CheckStatus } from './zero-gap-types'

function makeResult(status: CheckStatus, weight: number, id = 'x'): CheckResult {
  return {
    id,
    category: 'cat',
    name: 'test',
    status,
    weight,
    score: status === 'pass' ? 1 : status === 'warn' ? 0.5 : 0,
    evidence: '',
    durationMs: 0,
  }
}

describe('calculateAuditScore', () => {
  it('returns 0 for empty results', () => {
    expect(calculateAuditScore([])).toBe(0)
  })

  it('returns 100 when every check passes (any weights)', () => {
    expect(
      calculateAuditScore([
        makeResult('pass', 5),
        makeResult('pass', 1),
        makeResult('pass', 10),
      ])
    ).toBe(100)
  })

  it('returns 0 when every check fails', () => {
    expect(
      calculateAuditScore([
        makeResult('fail', 5),
        makeResult('fail', 3),
      ])
    ).toBe(0)
  })

  it('returns 50 when every check warns (warn = 0.5 weight)', () => {
    expect(
      calculateAuditScore([
        makeResult('warn', 2),
        makeResult('warn', 8),
        makeResult('warn', 5),
      ])
    ).toBe(50)
  })

  it('computes weighted mix: 1 pass(w=10) + 1 warn(w=5) + 1 fail(w=5) → 63', () => {
    // earned = 10 + 2.5 + 0 = 12.5; total = 20; pct = 62.5 → round to 63
    expect(
      calculateAuditScore([
        makeResult('pass', 10),
        makeResult('warn', 5),
        makeResult('fail', 5),
      ])
    ).toBe(63)
  })

  it('respects weight magnitude (heavy fail drags score down)', () => {
    // 1 pass(w=1) + 1 fail(w=99) → earned=1, total=100, pct=1
    expect(
      calculateAuditScore([
        makeResult('pass', 1),
        makeResult('fail', 99),
      ])
    ).toBe(1)
  })

  it('returns 0 when all weights are 0 (avoid divide-by-zero)', () => {
    expect(
      calculateAuditScore([
        makeResult('pass', 0),
        makeResult('pass', 0),
      ])
    ).toBe(0)
  })

  it('rounds to nearest integer (Math.round)', () => {
    // 2 pass(w=1) + 1 warn(w=1) + 1 fail(w=1) → earned=2.5, total=4, pct=62.5 → 63
    expect(
      calculateAuditScore([
        makeResult('pass', 1),
        makeResult('pass', 1),
        makeResult('warn', 1),
        makeResult('fail', 1),
      ])
    ).toBe(63)
  })
})

describe('countByStatus', () => {
  it('returns all zeros for empty input', () => {
    expect(countByStatus([])).toEqual({ pass: 0, warn: 0, fail: 0 })
  })

  it('counts each status independently', () => {
    expect(
      countByStatus([
        makeResult('pass', 1),
        makeResult('pass', 1),
        makeResult('pass', 1),
        makeResult('warn', 1),
        makeResult('warn', 1),
        makeResult('fail', 1),
      ])
    ).toEqual({ pass: 3, warn: 2, fail: 1 })
  })

  it('handles single-status arrays', () => {
    expect(countByStatus([makeResult('warn', 1)])).toEqual({ pass: 0, warn: 1, fail: 0 })
  })
})

describe('getTrafficLight', () => {
  it.each([100, 95, 90])('returns green for score %i (≥ 90)', (score) => {
    expect(getTrafficLight(score)).toBe('green')
  })

  it.each([89, 80, 70])('returns yellow for score %i (70 ≤ x < 90)', (score) => {
    expect(getTrafficLight(score)).toBe('yellow')
  })

  it.each([69, 50, 0])('returns red for score %i (< 70)', (score) => {
    expect(getTrafficLight(score)).toBe('red')
  })

  it('handles negative scores as red (defensive)', () => {
    expect(getTrafficLight(-10)).toBe('red')
  })

  it('handles scores above 100 as green (defensive)', () => {
    expect(getTrafficLight(150)).toBe('green')
  })
})
