/**
 * Step B7b — error hierarchy contract tests for the Creative Economy OS.
 *
 * Covers the code table, concrete error classes, type guards, and the
 * Result bridge. Pure contracts — no I/O, no mocks.
 *
 * @module seed/types/creative-economy/__tests__/errors
 */

import { describe, it, expect } from 'vitest'
import {
  ApprovalRequiredError,
  BudgetExceededError,
  CreativeEconomyError,
  CreativeEconomyErrorCode,
  InvalidStateTransitionError,
  ProvenanceMissingError,
  ProviderUnavailableError,
  isCreativeEconomyError,
  isErrorCode,
  toFailure,
} from '@/seed/types/creative-economy/errors'

describe('error hierarchy', () => {
  it('CreativeEconomyErrorCode has 5 codes', () => {
    expect(Object.keys(CreativeEconomyErrorCode)).toHaveLength(5)
  })

  it('every concrete error extends CreativeEconomyError and carries a code', () => {
    const errors = [
      new InvalidStateTransitionError('draft', 'running', ['planned']),
      new ApprovalRequiredError('publish'),
      new BudgetExceededError(500, 100),
      new ProviderUnavailableError('openrouter', 'generate'),
      new ProvenanceMissingError('asset_1', 'publish'),
    ]
    for (const e of errors) {
      expect(e).toBeInstanceOf(CreativeEconomyError)
      expect(e).toBeInstanceOf(Error)
      expect(e.name).not.toBe('Error')
      expect(typeof e.code).toBe('string')
    }
  })

  it('isCreativeEconomyError rejects plain Errors', () => {
    expect(isCreativeEconomyError(new Error('nope'))).toBe(false)
    expect(isCreativeEconomyError(null)).toBe(false)
    expect(isCreativeEconomyError('string')).toBe(false)
  })

  it('isErrorCode narrows by code', () => {
    const e = new BudgetExceededError(500, 100)
    expect(isErrorCode(e, CreativeEconomyErrorCode.BUDGET_EXCEEDED)).toBe(true)
    expect(isErrorCode(e, CreativeEconomyErrorCode.APPROVAL_REQUIRED)).toBe(false)
  })

  it('concrete errors carry their typed fields', () => {
    const e = new InvalidStateTransitionError('draft', 'running', ['planned'])
    expect(e.from).toBe('draft')
    expect(e.to).toBe('running')
    expect(e.allowed).toEqual(['planned'])
    expect(e.code).toBe(CreativeEconomyErrorCode.INVALID_STATE_TRANSITION)

    const a = new ApprovalRequiredError('publish', 'apr_1')
    expect(a.actionType).toBe('publish')
    expect(a.approvalRequestId).toBe('apr_1')
  })

  it('toFailure wraps an error into a failure Result', () => {
    const e = new ProvenanceMissingError('asset_1', 'publish')
    const r = toFailure(e)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBe(e)
      expect(r.error.code).toBe(CreativeEconomyErrorCode.PROVENANCE_MISSING)
    }
  })
})