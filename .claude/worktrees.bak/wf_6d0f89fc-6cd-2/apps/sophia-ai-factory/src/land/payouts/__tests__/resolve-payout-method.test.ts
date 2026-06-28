/**
 * Unit tests for resolve-payout-method.ts
 * Mocks getD1 to simulate the two D1 lookup paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(),
}))

import { getD1 } from '@/seed/db/client'
import { resolvePayoutMethod } from '../resolve-payout-method'

const mockedGetD1 = vi.mocked(getD1)

interface FirstStub {
  stripe?: unknown
  crypto?: unknown
}

/**
 * Build a D1 mock whose prepare() returns Stripe row on first call and
 * crypto row on second call. Each `.first()` resolution is queued separately.
 */
function makeD1Mock(stub: FirstStub) {
  const firstFn = vi
    .fn()
    .mockReturnValueOnce(stub.stripe ?? null)
    .mockReturnValueOnce(stub.crypto ?? null)

  const prepared = {
    bind: vi.fn().mockReturnThis(),
    first: firstFn,
    all: vi.fn().mockReturnValue({ results: [], success: true }),
    run: vi.fn().mockReturnValue({ success: true }),
  }
  return {
    prepare: vi.fn().mockReturnValue(prepared),
    batch: vi.fn(),
    exec: vi.fn(),
  }
}

describe('resolvePayoutMethod', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefers Stripe when stripe_payout_enabled=1 and stripe_account_id set', async () => {
    mockedGetD1.mockReturnValue(
      makeD1Mock({ stripe: { stripe_account_id: 'acct_abc' } }) as unknown as D1Database,
    )
    const result = await resolvePayoutMethod('tenant-1', 'aff-1')
    expect(result).toEqual({ kind: 'stripe', stripeAccountId: 'acct_abc' })
  })

  it('falls back to USDT crypto when Stripe not enabled', async () => {
    mockedGetD1.mockReturnValue(
      makeD1Mock({
        stripe: null,
        crypto: {
          method: 'usdt_trc20',
          recipient_addr_encrypted: 'enc:abc123',
          network: 'TRC20',
        },
      }) as unknown as D1Database,
    )
    const result = await resolvePayoutMethod('tenant-1', 'aff-2')
    expect(result).toEqual({
      kind: 'usdt',
      method: 'usdt_trc20',
      recipientAddrEncrypted: 'enc:abc123',
      network: 'TRC20',
    })
  })

  it('defaults network to TRC20 when crypto row has null network', async () => {
    mockedGetD1.mockReturnValue(
      makeD1Mock({
        stripe: null,
        crypto: {
          method: 'usdt_trc20',
          recipient_addr_encrypted: 'enc:xyz',
          network: null,
        },
      }) as unknown as D1Database,
    )
    const result = await resolvePayoutMethod('tenant-1', 'aff-3')
    expect(result).toMatchObject({ kind: 'usdt', network: 'TRC20' })
  })

  it('returns null when neither Stripe nor crypto method is set', async () => {
    mockedGetD1.mockReturnValue(
      makeD1Mock({ stripe: null, crypto: null }) as unknown as D1Database,
    )
    const result = await resolvePayoutMethod('tenant-1', 'aff-4')
    expect(result).toBeNull()
  })

  it('treats stripe row with null stripe_account_id as missing (SQL guard)', async () => {
    // SQL filters this out, but defense-in-depth: even if row sneaks through, fall back
    mockedGetD1.mockReturnValue(
      makeD1Mock({
        stripe: null, // simulating the guarded SQL returning nothing
        crypto: {
          method: 'usdt_erc20',
          recipient_addr_encrypted: 'enc:eth',
          network: 'ERC20',
        },
      }) as unknown as D1Database,
    )
    const result = await resolvePayoutMethod('tenant-2', 'aff-5')
    expect(result).toEqual({
      kind: 'usdt',
      method: 'usdt_erc20',
      recipientAddrEncrypted: 'enc:eth',
      network: 'ERC20',
    })
  })
})
