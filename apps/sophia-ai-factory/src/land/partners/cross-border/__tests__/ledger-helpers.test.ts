/**
 * Regression coverage for the extracted cross-border ledger action helpers.
 *
 * Pins the authorization contract that gates every ledger action: an
 * authenticated partner with a live DB binding resolves to `{ db, partnerId }`,
 * and each missing precondition fails with its own Result code instead of
 * throwing.
 *
 * @vitest
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getD1: vi.fn(),
  getPartnerByUserId: vi.fn(),
}))

vi.mock('@/seed/db/client', () => ({ getD1: mocks.getD1 }))
vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/tree/partners/partner-service', () => ({ getPartnerByUserId: mocks.getPartnerByUserId }))

import { handleCrossBorderError, resolveCrossBorderAuth } from '../ledger-helpers'

const DB = { prepare: vi.fn() }

describe('resolveCrossBorderAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the partner id and DB binding for an authenticated partner', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.getD1.mockResolvedValue(DB)
    mocks.getPartnerByUserId.mockResolvedValue({ id: 'partner-1' })

    const result = await resolveCrossBorderAuth()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ db: DB, partnerId: 'partner-1' })
    }
    expect(mocks.getPartnerByUserId).toHaveBeenCalledWith(DB, 'user-1')
  })

  it('fails UNAUTHORIZED without consulting the database', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const result = await resolveCrossBorderAuth()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toEqual({ code: 'UNAUTHORIZED', message: 'Authentication required' })
    expect(mocks.getD1).not.toHaveBeenCalled()
    expect(mocks.getPartnerByUserId).not.toHaveBeenCalled()
  })

  it('fails DB_UNAVAILABLE before touching partner data', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.getD1.mockResolvedValue(null)

    const result = await resolveCrossBorderAuth()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_UNAVAILABLE')
    expect(mocks.getPartnerByUserId).not.toHaveBeenCalled()
  })

  it('fails NOT_FOUND when the user has no partner profile', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.getD1.mockResolvedValue(DB)
    mocks.getPartnerByUserId.mockResolvedValue(null)

    const result = await resolveCrossBorderAuth()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })
})

describe('handleCrossBorderError', () => {
  it('derives a stable FETCH code from the context', () => {
    expect(handleCrossBorderError('settlement ledger', new Error('boom')).code)
      .toBe('FETCH_SETTLEMENT_LEDGER_FAILED')
  })

  it('carries the original message through for the caller to render', () => {
    expect(handleCrossBorderError('ledger', new Error('upstream timeout')))
      .toEqual({ code: 'FETCH_LEDGER_FAILED', message: 'upstream timeout' })
  })

  it('stringifies a non-Error throw', () => {
    expect(handleCrossBorderError('ledger', 'oops').message).toBe('oops')
  })
})
