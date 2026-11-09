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
 * Build a D1 mock whose prepare() returns payout_methods (VietQR/USDT) row on
 * first call and Stripe Connect fallback row on second call.
 */
function makeD1Mock(stub: FirstStub) {
  const firstFn = vi
    .fn()
    .mockReturnValueOnce(stub.crypto ?? null)
    .mockReturnValueOnce(stub.stripe ?? null)

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

  it('prefers VietQR bank_account over Stripe Connect when default payout_method exists', async () => {
    mockedGetD1.mockResolvedValue(
      makeD1Mock({
        crypto: {
          method: 'bank_account',
          recipient_addr_encrypted: 'enc:vietqr_970422_123456',
          network: null,
        },
        stripe: { stripe_account_id: 'acct_abc' },
      }) as unknown as D1Database,
    )
    const result = await resolvePayoutMethod('tenant-1', 'aff-vn')
    expect(result).toEqual({
      kind: 'usdt',
      method: 'bank_account',
      recipientAddrEncrypted: 'enc:vietqr_970422_123456',
      network: 'VIETQR',
    })
  })

  it('prefers USDT TRC20 over Stripe Connect when default payout_method exists', async () => {
    mockedGetD1.mockResolvedValue(
      makeD1Mock({
        crypto: {
          method: 'usdt_trc20',
          recipient_addr_encrypted: 'enc:abc123',
          network: 'TRC20',
        },
        stripe: { stripe_account_id: 'acct_abc' },
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

  it('falls back to Stripe Connect when no VietQR/USDT payout_method is configured', async () => {
    mockedGetD1.mockResolvedValue(
      makeD1Mock({
        crypto: null,
        stripe: { stripe_account_id: 'acct_abc' },
      }) as unknown as D1Database,
    )
    const result = await resolvePayoutMethod('tenant-1', 'aff-1')
    expect(result).toEqual({ kind: 'stripe', stripeAccountId: 'acct_abc' })
  })

  it('defaults network to TRC20 when crypto row has null network', async () => {
    mockedGetD1.mockResolvedValue(
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

  it('returns null when neither VietQR/USDT nor Stripe method is set', async () => {
    mockedGetD1.mockResolvedValue(
      makeD1Mock({ stripe: null, crypto: null }) as unknown as D1Database,
    )
    const result = await resolvePayoutMethod('tenant-1', 'aff-4')
    expect(result).toBeNull()
  })

  it('resolves ERC20 when configured as default payout method', async () => {
    mockedGetD1.mockResolvedValue(
      makeD1Mock({
        stripe: null,
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
