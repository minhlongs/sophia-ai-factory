/**
 * Audit Score Calculator
 * Calculates weighted score from CheckResult array.
 * Score = (sum of weighted pass + 0.5 * weighted warn) / total weight * 100
 *
 * @module lib/audit/audit-score-calculator
 */

import type { CheckResult, CheckStatus } from './zero-gap-types'

export function calculateAuditScore(results: CheckResult[]): number {
  if (results.length === 0) return 0

  let totalWeight = 0
  let earnedWeight = 0

  for (const r of results) {
    totalWeight += r.weight
    if (r.status === 'pass') {
      earnedWeight += r.weight
    } else if (r.status === 'warn') {
      earnedWeight += r.weight * 0.5
    }
  }

  if (totalWeight === 0) return 0
  return Math.round((earnedWeight / totalWeight) * 100)
}

export function countByStatus(results: CheckResult[]): Record<CheckStatus, number> {
  return {
    pass: results.filter((r) => r.status === 'pass').length,
    warn: results.filter((r) => r.status === 'warn').length,
    fail: results.filter((r) => r.status === 'fail').length,
  }
}

export function getTrafficLight(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 90) return 'green'
  if (score >= 70) return 'yellow'
  return 'red'
}
